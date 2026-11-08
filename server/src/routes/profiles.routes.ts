import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { Profile, Section, Video, Progress } from '../models/index.js';
import { validateProfilePath, scanProfileLibrary, findProfileByIdOrKey } from '../services/scanner.service.js';
import { extractGDriveFolderId, resolveGDriveUrlToLocalPath } from '../services/gdrive.service.js';

export const profileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Get all profiles
  app.get('/api/profiles', async (_req, reply) => {
    const profiles = await Profile.find().sort({ order: 1 });
    return reply.send(profiles);
  });

  // Detect local Google Drive folders automatically
  app.get('/api/gdrive/detect', async (_req, reply) => {
    const candidateBases = ['G:\\My Drive', 'G:\\', 'H:\\My Drive', 'H:\\', 'F:\\My Drive'];
    const detected: Array<{ name: string; fullPath: string }> = [];

    for (const base of candidateBases) {
      try {
        if (fs.existsSync(base)) {
          const entries = await fs.promises.readdir(base, { withFileTypes: true });
          for (const e of entries) {
            if (e.isDirectory()) {
              detected.push({
                name: e.name,
                fullPath: path.join(base, e.name)
              });
            }
          }
          if (detected.length > 0) break;
        }
      } catch {}
    }

    return reply.send({ detected });
  });

  // Update profile
  app.put<{ Params: { id: string }; Body: { name?: string; rootPath?: string; gdriveUrl?: string } }>(
    '/api/profiles/:id',
    async (req, reply) => {
      const { id } = req.params;
      const { name, rootPath, gdriveUrl } = req.body || {};

      const profile = await findProfileByIdOrKey(id);
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      if (name !== undefined) profile.name = name;
      if (rootPath !== undefined) {
        profile.rootPath = rootPath.trim();
        if (extractGDriveFolderId(profile.rootPath) || profile.rootPath.includes('drive.google.com')) {
          profile.gdriveUrl = profile.rootPath;
          const resolved = await resolveGDriveUrlToLocalPath(profile.rootPath);
          if (resolved.localPath) {
            profile.resolvedLocalPath = resolved.localPath;
          }
        } else if (profile.rootPath) {
          profile.resolvedLocalPath = profile.rootPath;
        }
      }
      if (gdriveUrl !== undefined) profile.gdriveUrl = gdriveUrl;

      await profile.save();
      return reply.send(profile);
    }
  );

  // Validate profile path (non-invasive check, counts sections & videos)
  app.post<{ Params: { id: string }; Body: { rootPath?: string } }>(
    '/api/profiles/:id/validate',
    async (req, reply) => {
      const { id } = req.params;
      const profile = await findProfileByIdOrKey(id);
      if (!profile) {
        return reply.status(404).send({ error: 'Profile not found' });
      }

      const pathToValidate = req.body?.rootPath ?? profile.resolvedLocalPath ?? profile.rootPath;
      const result = await validateProfilePath(pathToValidate, profile.key);
      return reply.send(result);
    }
  );

  // Scan library for profile
  app.post<{ Params: { id: string }; Body: { rootPath?: string } }>('/api/profiles/:id/scan', async (req, reply) => {
    const { id } = req.params;
    const { rootPath } = req.body || {};
    try {
      const result = await scanProfileLibrary(id, rootPath);
      return reply.send({ success: true, ...result });
    } catch (err: any) {
      app.log.error(err);
      console.error(`[Scan Error for profile ${id}]:`, err);
      return reply.status(400).send({ error: err.message || 'Scan failed' });
    }
  });

  // Get library tree with sections, videos and user progress
  app.get<{ Params: { id: string } }>('/api/profiles/:id/library', async (req, reply) => {
    const { id } = req.params;
    const profile = await findProfileByIdOrKey(id);
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    const sections = await Section.find({ profileId: profile._id }).sort({ order: 1 });
    const videos = await Video.find({ profileId: profile._id }).sort({ order: 1 });
    const progressDocs = await Progress.find({ profileId: profile._id });

    const progressMap = new Map<string, typeof progressDocs[0]>();
    for (const p of progressDocs) {
      progressMap.set(p.videoId.toString(), p);
    }

    // Group videos by section
    const videoListBySection = new Map<string, any[]>();
    let totalCompleted = 0;
    let totalVideos = 0;

    for (const v of videos) {
      const vidStr = v._id.toString();
      const prog = progressMap.get(vidStr);
      const isCompleted = prog?.completed || false;
      if (isCompleted) totalCompleted++;
      totalVideos++;

      const item = {
        _id: v._id,
        sectionId: v.sectionId,
        title: v.title,
        fileName: v.fileName,
        badge: v.badge,
        relPath: v.relPath,
        order: v.order,
        duration: v.duration,
        size: v.size,
        hasSubtitles: v.hasSubtitles,
        missing: v.missing,
        progress: prog
          ? {
              currentTime: prog.currentTime,
              duration: prog.duration,
              completed: prog.completed,
              lastWatched: prog.lastWatched,
              percent: prog.duration > 0 ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100)) : 0
            }
          : null
      };

      const secId = v.sectionId.toString();
      if (!videoListBySection.has(secId)) {
        videoListBySection.set(secId, []);
      }
      videoListBySection.get(secId)!.push(item);
    }

    const sectionTree = sections.map((s) => {
      const sVideos = videoListBySection.get(s._id.toString()) || [];
      const secCompleted = sVideos.filter((sv) => sv.progress?.completed).length;
      const totalSecDuration = sVideos.reduce((acc, sv) => acc + (sv.duration || 0), 0);

      return {
        _id: s._id,
        name: s.name,
        badge: s.badge,
        folderName: s.folderName,
        order: s.order,
        videoCount: sVideos.length,
        completedCount: secCompleted,
        totalDuration: totalSecDuration,
        videos: sVideos
      };
    });

    const overallPercent = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;

    return reply.send({
      profile,
      overallProgress: {
        totalVideos,
        totalCompleted,
        percent: overallPercent
      },
      sections: sectionTree
    });
  });

  // Continue watching: finds the current / most recently watched video for this profile
  app.get<{ Params: { id: string } }>('/api/profiles/:id/continue', async (req, reply) => {
    const { id } = req.params;
    const profile = await findProfileByIdOrKey(id);
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    let targetVideo: any = null;
    let prog: any = null;

    if (profile.currentVideoId) {
      targetVideo = await Video.findById(profile.currentVideoId);
      if (targetVideo && !targetVideo.missing) {
        prog = await Progress.findOne({ profileId: profile._id, videoId: targetVideo._id });
      } else {
        targetVideo = null;
      }
    }

    if (!targetVideo) {
      const recentProgress = await Progress.find({ profileId: profile._id })
        .sort({ lastWatched: -1 })
        .limit(1);

      if (recentProgress && recentProgress.length > 0) {
        prog = recentProgress[0];
        targetVideo = await Video.findById(prog.videoId);
      }
    }

    if (!targetVideo) {
      // If no watched videos, fallback to the very first video in the first section with videos
      const firstSectionWithVideos = await Section.findOne({
        profileId: profile._id,
        videoCount: { $gt: 0 }
      }).sort({ order: 1 });

      let firstVideo: any = null;
      if (firstSectionWithVideos) {
        firstVideo = await Video.findOne({
          profileId: profile._id,
          sectionId: firstSectionWithVideos._id,
          missing: false
        }).sort({ order: 1 });
      }

      if (!firstVideo) {
        firstVideo = await Video.findOne({ profileId: profile._id, missing: false }).sort({ order: 1 });
      }

      if (!firstVideo) {
        return reply.send({ continueVideo: null });
      }

      const section = await Section.findById(firstVideo.sectionId);
      return reply.send({
        continueVideo: {
          video: firstVideo,
          section,
          currentTime: 0,
          duration: firstVideo.duration || 0,
          percent: 0,
          completed: false,
          isFirstLesson: true
        }
      });
    }

    const section = await Section.findById(targetVideo.sectionId);
    return reply.send({
      continueVideo: {
        video: targetVideo,
        section,
        currentTime: prog?.currentTime || 0,
        duration: prog?.duration || targetVideo.duration || 0,
        percent:
          prog && prog.duration > 0
            ? Math.min(100, Math.round((prog.currentTime / prog.duration) * 100))
            : 0,
        completed: prog?.completed || false
      }
    });
  });

  // Bulk Progress Marking Endpoint
  app.post<{
    Params: { id: string };
    Body: {
      action: 'mark-all-completed' | 'mark-all-uncompleted' | 'mark-section-completed' | 'mark-up-to-lesson';
      sectionId?: string;
      videoId?: string;
    };
  }>('/api/profiles/:id/bulk-progress', async (req, reply) => {
    const { id } = req.params;
    const { action, sectionId, videoId } = req.body || {};

    const profile = await findProfileByIdOrKey(id);
    if (!profile) {
      return reply.status(404).send({ error: 'Profile not found' });
    }

    if (action === 'mark-all-completed') {
      const videos = await Video.find({ profileId: profile._id, missing: false });
      const bulkOps = videos.map((v) => ({
        updateOne: {
          filter: { videoId: v._id },
          update: {
            $set: {
              profileId: profile._id,
              sectionId: v.sectionId,
              currentTime: v.duration || 100,
              duration: v.duration || 100,
              completed: true,
              lastWatched: new Date()
            }
          },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await Progress.bulkWrite(bulkOps);
      }
      return reply.send({ success: true, count: videos.length });
    }

    if (action === 'mark-all-uncompleted') {
      const res = await Progress.updateMany(
        { profileId: profile._id },
        { $set: { completed: false, currentTime: 0, lastWatched: new Date() } }
      );
      return reply.send({ success: true, count: res.modifiedCount });
    }

    if (action === 'mark-section-completed') {
      if (!sectionId) {
        return reply.status(400).send({ error: 'sectionId is required' });
      }
      const videos = await Video.find({ sectionId, profileId: profile._id, missing: false });
      const bulkOps = videos.map((v) => ({
        updateOne: {
          filter: { videoId: v._id },
          update: {
            $set: {
              profileId: profile._id,
              sectionId: v.sectionId,
              currentTime: v.duration || 100,
              duration: v.duration || 100,
              completed: true,
              lastWatched: new Date()
            }
          },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await Progress.bulkWrite(bulkOps);
      }
      return reply.send({ success: true, count: videos.length });
    }

    if (action === 'mark-up-to-lesson') {
      if (!videoId) {
        return reply.status(400).send({ error: 'videoId is required' });
      }

      const allSections = await Section.find({ profileId: profile._id }).sort({ order: 1 });
      const allVideos = await Video.find({ profileId: profile._id, missing: false }).sort({ order: 1 });

      const orderedVideos: typeof allVideos = [];
      for (const sec of allSections) {
        const secVids = allVideos.filter((v) => v.sectionId.toString() === sec._id.toString());
        orderedVideos.push(...secVids);
      }

      const targetIndex = orderedVideos.findIndex((v) => v._id.toString() === videoId);
      if (targetIndex === -1) {
        return reply.status(404).send({ error: 'Target lesson not found' });
      }

      const videosToComplete = orderedVideos.slice(0, targetIndex + 1);
      const bulkOps = videosToComplete.map((v) => ({
        updateOne: {
          filter: { videoId: v._id },
          update: {
            $set: {
              profileId: profile._id,
              sectionId: v.sectionId,
              currentTime: v.duration || 100,
              duration: v.duration || 100,
              completed: true,
              lastWatched: new Date()
            }
          },
          upsert: true
        }
      }));

      if (bulkOps.length > 0) {
        await Progress.bulkWrite(bulkOps);
      }
      return reply.send({ success: true, count: videosToComplete.length });
    }

    return reply.status(400).send({ error: 'Invalid action' });
  });
};
