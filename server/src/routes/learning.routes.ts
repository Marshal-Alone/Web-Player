import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { Note, Bookmark, Setting, WatchLog, Video, Section, Profile, Progress } from '../models/index.js';

// Convert SRT format to WebVTT format on the fly
function srtToVtt(srtText: string): string {
  let vtt = 'WEBVTT\n\n' + srtText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Replace SRT comma timestamp with period (00:01:20,000 --> 00:01:20.000)
  vtt = vtt.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

export const learningRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // --- NOTES ---
  app.get<{ Params: { id: string } }>('/api/videos/:id/notes', async (req, reply) => {
    const notes = await Note.find({ videoId: req.params.id }).sort({ timestamp: 1 });
    return reply.send(notes);
  });

  app.post<{ Params: { id: string }; Body: { timestamp: number; content: string } }>(
    '/api/videos/:id/notes',
    async (req, reply) => {
      const { timestamp, content } = req.body || {};
      if (!content || !content.trim()) {
        return reply.status(400).send({ error: 'Content is required' });
      }

      const note = await Note.create({
        videoId: req.params.id,
        timestamp: Math.round(timestamp || 0),
        content: content.trim()
      });
      return reply.send(note);
    }
  );

  app.put<{ Params: { noteId: string }; Body: { content: string } }>('/api/notes/:noteId', async (req, reply) => {
    const { content } = req.body || {};
    const note = await Note.findById(req.params.noteId);
    if (!note) return reply.status(404).send({ error: 'Note not found' });
    note.content = content;
    await note.save();
    return reply.send(note);
  });

  app.delete<{ Params: { noteId: string } }>('/api/notes/:noteId', async (req, reply) => {
    await Note.findByIdAndDelete(req.params.noteId);
    return reply.send({ success: true });
  });

  // --- BOOKMARKS ---
  app.get<{ Params: { id: string } }>('/api/videos/:id/bookmarks', async (req, reply) => {
    const bookmarks = await Bookmark.find({ videoId: req.params.id }).sort({ timestamp: 1 });
    return reply.send(bookmarks);
  });

  app.post<{ Params: { id: string }; Body: { timestamp: number; title?: string } }>(
    '/api/videos/:id/bookmarks',
    async (req, reply) => {
      const { timestamp, title } = req.body || {};
      const bookmark = await Bookmark.create({
        videoId: req.params.id,
        timestamp: Math.round(timestamp || 0),
        title: title?.trim() || `Bookmark at ${Math.round(timestamp || 0)}s`
      });
      return reply.send(bookmark);
    }
  );

  app.delete<{ Params: { bookmarkId: string } }>('/api/bookmarks/:bookmarkId', async (req, reply) => {
    await Bookmark.findByIdAndDelete(req.params.bookmarkId);
    return reply.send({ success: true });
  });

  // --- SETTINGS ---
  app.get('/api/settings', async (_req, reply) => {
    const settings = await Setting.find();
    const settingsObj: Record<string, any> = {
      autoplay: true,
      autoplayDelay: 5,
      completeThreshold: 95,
      defaultSpeed: 1.0,
      theme: 'dark',
      sidebarCollapsed: false,
      volume: 1.0
    };
    for (const s of settings) {
      settingsObj[s.key] = s.value;
    }
    return reply.send(settingsObj);
  });

  app.put<{ Body: Record<string, any> }>('/api/settings', async (req, reply) => {
    const updates = req.body || {};
    for (const [key, value] of Object.entries(updates)) {
      await Setting.findOneAndUpdate({ key }, { key, value }, { upsert: true });
    }
    return reply.send({ success: true, settings: updates });
  });

  // --- SUBTITLES ---
  app.get<{ Params: { id: string } }>('/api/videos/:id/subtitle', async (req, reply) => {
    const video = await Video.findById(req.params.id);
    if (!video || !video.subtitlePath) {
      return reply.status(404).send({ error: 'No subtitles available' });
    }

    try {
      const subContent = await fs.promises.readFile(video.subtitlePath, 'utf8');
      const isSrt = video.subtitlePath.endsWith('.srt');
      const vttContent = isSrt ? srtToVtt(subContent) : subContent;

      reply.header('Content-Type', 'text/vtt; charset=utf-8');
      return reply.send(vttContent);
    } catch {
      return reply.status(404).send({ error: 'Subtitle file unreadable' });
    }
  });

  // --- RESOURCES ---
  app.get<{ Params: { sectionId: string } }>('/api/sections/:sectionId/resources', async (req, reply) => {
    const section = await Section.findById(req.params.sectionId);
    if (!section) return reply.status(404).send({ error: 'Section not found' });

    const profile = await Profile.findById(section.profileId);
    if (!profile || !profile.rootPath) return reply.send([]);

    const sectionPath = path.join(profile.rootPath, section.folderName);
    const RESOURCE_EXTS = new Set(['.pdf', '.zip', '.txt', '.md', '.docx', '.json']);

    try {
      const entries = await fs.promises.readdir(sectionPath, { withFileTypes: true });
      const resources = [];
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (RESOURCE_EXTS.has(ext)) {
            const stat = await fs.promises.stat(path.join(sectionPath, entry.name));
            resources.push({
              name: entry.name,
              ext: ext.slice(1),
              size: stat.size,
              relPath: path.join(section.folderName, entry.name).replace(/\\/g, '/')
            });
          }
        }
      }
      return reply.send(resources);
    } catch {
      return reply.send([]);
    }
  });

  // --- STATS & 12-WEEK HEATMAP ---
  app.get<{ Querystring: { profileId?: string } }>('/api/stats', async (req, reply) => {
    const { profileId } = req.query;
    const filter: Record<string, any> = {};
    if (profileId) {
      filter.profileId = profileId;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const logs = await WatchLog.find(filter).sort({ date: 1 });

    // Calculate today watch time
    const todayLog = logs.find((l) => l.date === todayStr);
    const secondsToday = todayLog ? todayLog.secondsWatched : 0;

    // Calculate 7-day watch time
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);
    const secondsWeek = logs
      .filter((l) => l.date && l.date >= sevenDaysAgoStr)
      .reduce((sum, l) => sum + l.secondsWatched, 0);

    // Calculate daily streak
    let streak = 0;
    const dateSet = new Set(
      logs
        .filter((l) => l.date && l.secondsWatched > 60)
        .map((l) => l.date as string)
    );
    let checkDate = new Date();

    // Check if watched today
    if (dateSet.has(todayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If haven't watched today yet, check yesterday to continue yesterday's streak
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = checkDate.toISOString().slice(0, 10);
      if (dateSet.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // 12-week (84 days) heatmap
    const heatmap: Array<{ date: string; minutes: number }> = [];
    const heatmapStart = new Date();
    heatmapStart.setDate(heatmapStart.getDate() - 83);

    const logMap = new Map<string, number>();
    for (const l of logs) {
      if (l.date) {
        logMap.set(l.date, Math.round(l.secondsWatched / 60));
      }
    }

    for (let i = 0; i < 84; i++) {
      const cur = new Date(heatmapStart);
      cur.setDate(cur.getDate() + i);
      const dStr = cur.toISOString().slice(0, 10);
      heatmap.push({
        date: dStr,
        minutes: logMap.get(dStr) || 0
      });
    }

    // Completion metrics
    const totalVideos = await Video.countDocuments({ ...filter, missing: false });
    const completedProgress = await Progress.countDocuments({ ...filter, completed: true });
    const completionPercent = totalVideos > 0 ? Math.round((completedProgress / totalVideos) * 100) : 0;

    return reply.send({
      secondsToday,
      minutesToday: Math.round(secondsToday / 60),
      secondsWeek,
      minutesWeek: Math.round(secondsWeek / 60),
      streak,
      completionPercent,
      totalVideos,
      completedVideos: completedProgress,
      heatmap
    });
  });

  // --- BACKUP EXPORT & IMPORT ---
  app.get('/api/backup/export', async (_req, reply) => {
    const profiles = await Profile.find();
    const progress = await Progress.find();
    const notes = await Note.find();
    const bookmarks = await Bookmark.find();
    const settings = await Setting.find();

    reply.header('Content-Disposition', 'attachment; filename="course_player_backup.json"');
    return reply.send({
      exportedAt: new Date(),
      profiles,
      progress,
      notes,
      bookmarks,
      settings
    });
  });

  app.post<{ Body: { progress?: any[]; notes?: any[]; bookmarks?: any[] } }>(
    '/api/backup/import',
    async (req, reply) => {
      const { progress = [], notes = [], bookmarks = [] } = req.body || {};

      for (const p of progress) {
        if (p.videoId) {
          await Progress.findOneAndUpdate(
            { videoId: p.videoId },
            {
              currentTime: p.currentTime,
              duration: p.duration,
              completed: p.completed,
              lastWatched: p.lastWatched || new Date()
            },
            { upsert: true }
          );
        }
      }

      for (const n of notes) {
        if (n.videoId && n.content) {
          await Note.create({
            videoId: n.videoId,
            timestamp: n.timestamp || 0,
            content: n.content
          });
        }
      }

      for (const b of bookmarks) {
        if (b.videoId) {
          await Bookmark.create({
            videoId: b.videoId,
            timestamp: b.timestamp || 0,
            title: b.title
          });
        }
      }

      return reply.send({ success: true, importedProgress: progress.length, importedNotes: notes.length });
    }
  );
};
