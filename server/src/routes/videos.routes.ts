import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Video, Section, Profile, Progress, WatchLog } from '../models/index.js';
import { getEffectiveLocalPath } from '../services/gdrive.service.js';
import { findProfileByIdOrKey, getCurriculumJsonPath } from '../services/scanner.service.js';

const SUPPORTED_VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi']);

// Curriculum ID mapping cache
let curriculumVideosMap: Map<string, { relPath: string; badge: string; title: string }> | null = null;
function getCurriculumVideo(id: string) {
  if (!curriculumVideosMap) {
    curriculumVideosMap = new Map();
    try {
      const p = getCurriculumJsonPath();
      if (p && fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, 'utf8'));
        if (Array.isArray(data.videos)) {
          for (const v of data.videos) {
            curriculumVideosMap.set(v._id, { relPath: v.relPath, badge: v.badge, title: v.title });
          }
        }
      }
    } catch {}
  }
  return curriculumVideosMap.get(id);
}

export const videoRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Get video details with previous & next navigation
  app.get<{ Params: { id: string } }>('/api/videos/:id', async (req, reply) => {
    const { id } = req.params;
    let video = mongoose.Types.ObjectId.isValid(id) ? await Video.findById(id) : null;
    if (!video) {
      video = await Video.findOne({ badge: id });
    }
    if (!video) {
      const cur = getCurriculumVideo(id);
      if (cur) {
        if (cur.relPath) {
          video = await Video.findOne({ relPath: cur.relPath });
        }
        if (!video && cur.badge) {
          video = await Video.findOne({ badge: cur.badge });
        }
      }
    }
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    const section = await Section.findById(video.sectionId);

    // Update profile current video and record active viewing state in MongoDB
    await Profile.updateOne({ _id: video.profileId }, { $set: { currentVideoId: video._id } });

    let progress = await Progress.findOne({ videoId: video._id });
    if (!progress) {
      progress = await Progress.create({
        profileId: video.profileId,
        videoId: video._id,
        sectionId: video.sectionId,
        currentTime: 0,
        duration: video.duration || 0,
        completed: false,
        lastWatched: new Date()
      });
    } else {
      progress.lastWatched = new Date();
      await progress.save();
    }

    // Fetch all non-missing videos in this profile ordered by section.order and video.order
    const allSections = await Section.find({ profileId: video.profileId }).sort({ order: 1 });
    const allVideos = await Video.find({ profileId: video.profileId, missing: false }).sort({ order: 1 });

    // Flatten in correct sequence
    const orderedVideos: typeof allVideos = [];
    for (const sec of allSections) {
      const secVids = allVideos.filter((v) => v.sectionId.toString() === sec._id.toString());
      orderedVideos.push(...secVids);
    }

    const currentIndex = orderedVideos.findIndex((v) => v._id.toString() === video._id.toString());
    const prevVideo = currentIndex > 0 ? orderedVideos[currentIndex - 1] : null;
    const nextVideo = currentIndex >= 0 && currentIndex < orderedVideos.length - 1 ? orderedVideos[currentIndex + 1] : null;

    return reply.send({
      video,
      section,
      progress: progress || {
        currentTime: 0,
        duration: video.duration || 0,
        completed: false
      },
      prevVideo: prevVideo ? { _id: prevVideo._id, title: prevVideo.title, badge: prevVideo.badge } : null,
      nextVideo: nextVideo ? { _id: nextVideo._id, title: nextVideo.title, badge: nextVideo.badge } : null
    });
  });

  // Range-based video streaming endpoint
  app.get<{ Params: { id: string } }>('/api/videos/:id/stream', async (req, reply) => {
    const { id } = req.params;
    let video = mongoose.Types.ObjectId.isValid(id) ? await Video.findById(id) : null;
    if (!video) {
      video = await Video.findOne({ badge: id });
    }
    if (!video) {
      const cur = getCurriculumVideo(id);
      if (cur) {
        if (cur.relPath) {
          video = await Video.findOne({ relPath: cur.relPath });
        }
        if (!video && cur.badge) {
          video = await Video.findOne({ badge: cur.badge });
        }
      }
    }
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    const profile = await findProfileByIdOrKey(video.profileId.toString());
    const effectiveRoot = profile ? getEffectiveLocalPath(profile) : '';

    // Dynamic resolution if disk path moved, drive letter changed, or cloned to another laptop
    let resolvedPath = path.resolve(video.fullPath);

    if (!fs.existsSync(resolvedPath)) {
      if (effectiveRoot && video.relPath) {
        const candidate = path.resolve(path.join(effectiveRoot, video.relPath));
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
          video.fullPath = candidate;
          video.save().catch(() => {});
        }
      }
      // If still not found, try G:\My Drive and other candidate roots
      if (!fs.existsSync(resolvedPath) && video.relPath) {
        const candidateDrives = ['G:\\My Drive', 'G:\\', 'H:\\My Drive', 'H:\\', 'F:\\My Drive', 'D:\\My Drive'];
        const courseFolder = profile?.key === 'dsa' ? 'Apna College DSA' : 'Apna College Development';
        for (const base of candidateDrives) {
          const cand = path.resolve(path.join(base, courseFolder, video.relPath));
          if (fs.existsSync(cand)) {
            resolvedPath = cand;
            video.fullPath = cand;
            video.save().catch(() => {});
            break;
          }
        }
      }
    }

    // Verify file extension is an allowed video format
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!SUPPORTED_VIDEO_EXTS.has(ext)) {
      return reply.status(403).send({ error: 'Access denied: not a supported video file' });
    }

    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(resolvedPath);
    } catch {
      return reply.status(404).send({ error: 'Video file not found on disk' });
    }

    const fileSize = stat.size;
    const range = req.headers.range;

    // Determine MIME type
    let mimeType = 'video/mp4';
    if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.mkv') mimeType = 'video/x-matroska';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.avi') mimeType = 'video/x-msvideo';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        reply.header('Content-Range', `bytes */${fileSize}`);
        return reply.status(416).send({ error: 'Requested range not satisfiable' });
      }

      const chunksize = end - start + 1;
      const fileStream = fs.createReadStream(resolvedPath, { start, end });

      // Handle stream abort on client seek/disconnect
      req.raw.on('close', () => {
        fileStream.destroy();
      });

      return reply
        .code(206)
        .header('Content-Range', `bytes ${start}-${end}/${fileSize}`)
        .header('Accept-Ranges', 'bytes')
        .header('Content-Length', chunksize)
        .header('Content-Type', mimeType)
        .header('Cache-Control', 'no-cache')
        .send(fileStream);
    } else {
      const fileStream = fs.createReadStream(resolvedPath);

      req.raw.on('close', () => {
        fileStream.destroy();
      });

      return reply
        .code(200)
        .header('Content-Length', fileSize)
        .header('Content-Type', mimeType)
        .header('Accept-Ranges', 'bytes')
        .header('Cache-Control', 'no-cache')
        .send(fileStream);
    }
  });

  // Save progress
  app.put<{ Params: { id: string }; Body: { currentTime: number; duration: number; completed?: boolean } }>(
    '/api/videos/:id/progress',
    async (req, reply) => {
      const { id } = req.params;
      const { currentTime = 0, duration = 0, completed } = req.body || {};

      const video = await Video.findById(id);
      if (!video) {
        return reply.status(404).send({ error: 'Video not found' });
      }

      // Auto-complete at >= 95%
      const watchedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
      const isCompleted = completed !== undefined ? completed : watchedPercent >= 95;

      const progress = await Progress.findOneAndUpdate(
        { videoId: video._id },
        {
          profileId: video.profileId,
          sectionId: video.sectionId,
          currentTime,
          duration,
          completed: isCompleted,
          lastWatched: new Date()
        },
        { upsert: true, new: true }
      );

      // Keep profile's current video pointer in sync
      await Profile.updateOne({ _id: video.profileId }, { $set: { currentVideoId: video._id } });

      // Record in watch log for streak and daily stats
      const todayStr = new Date().toISOString().slice(0, 10);
      try {
        await WatchLog.findOneAndUpdate(
          { videoId: video._id, date: todayStr },
          {
            $inc: { secondsWatched: 5 },
            $setOnInsert: { profileId: video.profileId, date: todayStr }
          },
          { upsert: true }
        );
      } catch {
        // ignore duplicate key or logging error
      }

      return reply.send(progress);
    }
  );

  // sendBeacon progress endpoint (supports text/plain JSON payload from navigator.sendBeacon)
  app.post<{ Params: { id: string } }>('/api/videos/:id/progress/beacon', async (req, reply) => {
    const { id } = req.params;
    let payload: any = req.body;
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = {};
      }
    }

    const { currentTime = 0, duration = 0, completed } = payload || {};
    const video = await Video.findById(id);
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    const watchedPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
    const isCompleted = completed !== undefined ? completed : watchedPercent >= 95;

    await Progress.findOneAndUpdate(
      { videoId: video._id },
      {
        profileId: video.profileId,
        sectionId: video.sectionId,
        currentTime,
        duration,
        completed: isCompleted,
        lastWatched: new Date()
      },
      { upsert: true }
    );

    // Keep profile's current video pointer in sync
    await Profile.updateOne({ _id: video.profileId }, { $set: { currentVideoId: video._id } });

    return reply.send({ success: true });
  });

  // Lazy duration update from browser loadedmetadata
  app.post<{ Params: { id: string }; Body: { duration: number } }>('/api/videos/:id/duration', async (req, reply) => {
    const { id } = req.params;
    const { duration } = req.body || {};
    if (!duration || duration <= 0) {
      return reply.status(400).send({ error: 'Invalid duration' });
    }

    const video = await Video.findById(id);
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    video.duration = Math.round(duration);
    await video.save();

    // Also update Progress document duration if it exists
    await Progress.updateOne({ videoId: video._id }, { $set: { duration: Math.round(duration) } });

    return reply.send({ success: true, duration: video.duration });
  });

  // Toggle complete manually
  app.put<{ Params: { id: string } }>('/api/videos/:id/toggle-complete', async (req, reply) => {
    const { id } = req.params;
    const video = await Video.findById(id);
    if (!video) {
      return reply.status(404).send({ error: 'Video not found' });
    }

    let progress = await Progress.findOne({ videoId: video._id });
    if (!progress) {
      progress = await Progress.create({
        profileId: video.profileId,
        videoId: video._id,
        sectionId: video.sectionId,
        currentTime: 0,
        duration: video.duration || 0,
        completed: true,
        lastWatched: new Date()
      });
    } else {
      progress.completed = !progress.completed;
      progress.lastWatched = new Date();
      await progress.save();
    }

    return reply.send(progress);
  });
};
