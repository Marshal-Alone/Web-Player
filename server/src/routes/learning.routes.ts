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

// Format date in YYYY-MM-DD using local time
function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  // --- ENHANCED STATS & ACTIVITY HEATMAP ---
  app.get<{ Querystring: { profileId?: string } }>('/api/stats', async (req, reply) => {
    const { profileId } = req.query;
    const filter: Record<string, any> = {};
    if (profileId) {
      filter.profileId = profileId;
    }

    const today = new Date();
    const todayStr = formatLocalDate(today);
    const logs = await WatchLog.find(filter).sort({ date: 1 });

    const logMap = new Map<string, number>();
    let totalSecondsAllTime = 0;
    for (const l of logs) {
      if (l.date) {
        logMap.set(l.date, Math.round(l.secondsWatched / 60));
        totalSecondsAllTime += l.secondsWatched || 0;
      }
    }

    // Calculate today watch time
    const todayLog = logs.find((l) => l.date === todayStr);
    const secondsToday = todayLog ? todayLog.secondsWatched : 0;

    // Calculate 7-day watch time
    const sevenDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const sevenDaysAgoStr = formatLocalDate(sevenDaysAgo);
    const secondsWeek = logs
      .filter((l) => l.date && l.date >= sevenDaysAgoStr)
      .reduce((sum, l) => sum + (l.secondsWatched || 0), 0);

    // Calculate past 7 days breakdown for bar chart
    const past7Days: Array<{ date: string; day: string; minutes: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dStr = formatLocalDate(d);
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      past7Days.push({
        date: dStr,
        day: dayName,
        minutes: logMap.get(dStr) || 0
      });
    }

    // Active days list & streaks
    const activeDates = Array.from(
      new Set(
        logs
          .filter((l) => l.date && l.secondsWatched > 60)
          .map((l) => l.date as string)
      )
    ).sort();

    const activeDateSet = new Set(activeDates);
    const activeDaysCount = activeDateSet.size;

    // Current streak
    let streak = 0;
    let checkDate = new Date(today);
    if (activeDateSet.has(todayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dStr = formatLocalDate(checkDate);
      if (activeDateSet.has(dStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    // Best streak ever
    let bestStreak = 0;
    let currentStreakCount = 0;
    let prevDateTime: number | null = null;
    for (const dStr of activeDates) {
      const curDateTime = new Date(dStr + 'T00:00:00').getTime();
      if (prevDateTime === null) {
        currentStreakCount = 1;
      } else {
        const diffDays = Math.round((curDateTime - prevDateTime) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreakCount++;
        } else {
          currentStreakCount = 1;
        }
      }
      prevDateTime = curDateTime;
      if (currentStreakCount > bestStreak) {
        bestStreak = currentStreakCount;
      }
    }
    if (streak > bestStreak) bestStreak = streak;

    // Aligned 52-week (364 days) calendar (Sunday to Saturday weeks)
    const todayDayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
    // Go back 51 full weeks plus today's day of week to start on Sunday
    const calendarStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - (51 * 7 + todayDayOfWeek)
    );

    const heatmap: Array<{ date: string; minutes: number; dayOfWeek: number }> = [];
    const totalDays = 51 * 7 + todayDayOfWeek + 1; // Exactly up to today
    for (let i = 0; i < totalDays; i++) {
      const cur = new Date(
        calendarStart.getFullYear(),
        calendarStart.getMonth(),
        calendarStart.getDate() + i
      );
      const dStr = formatLocalDate(cur);
      heatmap.push({
        date: dStr,
        minutes: logMap.get(dStr) || 0,
        dayOfWeek: cur.getDay()
      });
    }

    // Completion metrics
    const totalVideos = await Video.countDocuments({ ...filter, missing: false });
    const completedProgress = await Progress.countDocuments({ ...filter, completed: true });
    const completionPercent = totalVideos > 0 ? Math.round((completedProgress / totalVideos) * 100) : 0;

    // Curriculum section progress breakdown
    let sectionProgress: Array<{
      _id: string;
      name: string;
      order: number;
      totalVideos: number;
      completedVideos: number;
      percent: number;
    }> = [];

    if (profileId) {
      const sections = await Section.find({ profileId }).sort({ order: 1 });
      const videos = await Video.find({ profileId, missing: false }).select('_id sectionId');
      const progressDocs = await Progress.find({ profileId }).select('videoId completed');

      const completedVideoIds = new Set(
        progressDocs.filter((p) => p.completed).map((p) => p.videoId.toString())
      );

      sectionProgress = sections.map((sec) => {
        const secVideos = videos.filter((v) => v.sectionId?.toString() === sec._id.toString());
        const total = secVideos.length;
        const completed = secVideos.filter((v) => completedVideoIds.has(v._id.toString())).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        return {
          _id: sec._id.toString(),
          name: sec.name,
          order: sec.order,
          totalVideos: total,
          completedVideos: completed,
          percent
        };
      });
    }

    return reply.send({
      secondsToday,
      minutesToday: Math.round(secondsToday / 60),
      secondsWeek,
      minutesWeek: Math.round(secondsWeek / 60),
      totalMinutesAllTime: Math.round(totalSecondsAllTime / 60),
      totalHoursAllTime: Number((totalSecondsAllTime / 3600).toFixed(1)),
      streak,
      bestStreak,
      activeDaysCount,
      completionPercent,
      totalVideos,
      completedVideos: completedProgress,
      past7Days,
      heatmap,
      sectionProgress
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
