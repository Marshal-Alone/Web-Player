import curriculumData from '../data/curriculum.json';
import { Profile, Section, Video, Progress } from '../types/index.js';

export const GDRIVE_DEFAULTS = {
  dsa: 'https://drive.google.com/drive/folders/1rcy3AgCQAX-x8amkpjP1AifrhOhC0eO3?usp=drive_link',
  development: 'https://drive.google.com/drive/folders/1ibiPith7qMfWpeS3Vzh6YX747hBga8bs?usp=sharing'
};

const PROFILES_KEY = 'course_player_profiles';
const SETTINGS_KEY = 'course_player_settings';
const ACTIVITY_LOG_KEY = 'course_player_activity_log';
const ALL_NOTES_KEY = 'course_player_all_notes';
const ALL_BOOKMARKS_KEY = 'course_player_all_bookmarks';

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// --- PROFILES ---
export function getLocalProfiles(): Profile[] {
  if (typeof window === 'undefined') return curriculumData.profiles as Profile[];
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}

  const defaults = (curriculumData.profiles as Profile[]).map((p) => ({
    ...p,
    rootPath: p.key === 'dsa' ? GDRIVE_DEFAULTS.dsa : GDRIVE_DEFAULTS.development,
    gdriveUrl: p.key === 'dsa' ? GDRIVE_DEFAULTS.dsa : GDRIVE_DEFAULTS.development
  }));
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(defaults));
  } catch {}
  return defaults;
}

export function saveLocalProfiles(profiles: Profile[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {}
}

export function updateLocalProfile(id: string, updates: Partial<Profile>): Profile {
  const profiles = getLocalProfiles();
  let index = profiles.findIndex((p) => p._id === id || p.key === id);
  if (index === -1 && (updates as any)?.key) {
    index = profiles.findIndex((p) => p.key === (updates as any).key);
  }
  if (index === -1) {
    const clean = String(id).toLowerCase();
    if (clean.includes('dsa') || (updates.name && updates.name.toLowerCase().includes('dsa'))) {
      index = profiles.findIndex((p) => p.key === 'dsa');
    } else if (clean.includes('dev') || (updates.name && updates.name.toLowerCase().includes('dev'))) {
      index = profiles.findIndex((p) => p.key === 'development');
    }
  }
  if (index === -1) {
    if (profiles.length > 0) {
      index = 0;
    } else {
      const newProf: Profile = {
        _id: id,
        name: updates.name || 'Course',
        key: 'dsa',
        rootPath: updates.rootPath || '',
        order: 0,
        stats: { totalSections: 0, totalVideos: 0, totalDuration: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      profiles.push(newProf);
      saveLocalProfiles(profiles);
      return newProf;
    }
  }

  profiles[index] = { ...profiles[index], ...updates };
  saveLocalProfiles(profiles);
  return profiles[index];
}

// --- PROGRESS ---
export function getLocalVideoProgress(videoId: string): Progress | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`course_player_progress_${videoId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveLocalVideoProgress(
  videoId: string,
  data: { currentTime: number; duration: number; completed?: boolean }
): Progress {
  const existing = getLocalVideoProgress(videoId);
  const updated: Progress = {
    profileId: existing?.profileId || '',
    videoId,
    currentTime: data.currentTime,
    duration: data.duration || existing?.duration || 0,
    completed: data.completed !== undefined ? Boolean(data.completed) : existing?.completed || false,
    lastWatched: new Date().toISOString()
  };

  try {
    localStorage.setItem(`course_player_progress_${videoId}`, JSON.stringify(updated));

    // Record activity log for study heatmap & streaks
    const today = getLocalDateString();
    const rawLogs = localStorage.getItem(ACTIVITY_LOG_KEY);
    const logs: Record<string, number> = rawLogs ? JSON.parse(rawLogs) : {};
    logs[today] = (logs[today] || 0) + 5; // record incremental heartbeat
    localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(logs));
  } catch {}

  return updated;
}

export function toggleLocalVideoComplete(videoId: string): { videoId: string; completed: boolean } {
  const existing = getLocalVideoProgress(videoId);
  const newCompleted = !(existing?.completed || false);
  const updated: Progress = {
    profileId: existing?.profileId || '',
    videoId,
    currentTime: existing?.currentTime || 0,
    duration: existing?.duration || 0,
    completed: newCompleted,
    lastWatched: new Date().toISOString()
  };

  try {
    localStorage.setItem(`course_player_progress_${videoId}`, JSON.stringify(updated));
  } catch {}

  return { videoId, completed: newCompleted };
}

// --- LIBRARY ---
export function getLocalLibrary(profileId: string) {
  const profiles = getLocalProfiles();
  const profile =
    profiles.find((p) => p._id === profileId || p.key === profileId) ||
    (String(profileId).toLowerCase().includes('dsa')
      ? profiles.find((p) => p.key === 'dsa')
      : profiles.find((p) => p.key === 'development')) ||
    profiles[0];
  const targetId = profile?._id;

  const isDsa =
    profile?.key === 'dsa' ||
    String(profileId).toLowerCase().includes('dsa') ||
    targetId === '6aef1ffa40ee2964803d0e32';
  const curriculumProfileId = isDsa ? '6aef1ffa40ee2964803d0e32' : '6aef1ffa40ee2964803d0e46';

  const sections = (curriculumData.sections as Section[]).filter(
    (s) => s.profileId === targetId || s.profileId === curriculumProfileId
  );
  const videos = (curriculumData.videos as Video[]).filter(
    (v) => v.profileId === targetId || v.profileId === curriculumProfileId
  );

  let totalCompleted = 0;
  const sectionsWithVideos = sections.map((sec) => {
    const secVideos = videos
      .filter((v) => v.sectionId === sec._id)
      .map((v) => {
        const prog = getLocalVideoProgress(v._id);
        const completed = prog?.completed || false;
        if (completed) totalCompleted++;
        return {
          ...v,
          completed,
          progress: prog || { currentTime: 0, duration: v.duration || 0, completed: false }
        };
      });

    const completedCount = secVideos.filter((v) => v.completed).length;
    return {
      ...sec,
      completedCount,
      videoCount: secVideos.length,
      videos: secVideos
    };
  });

  const totalVideos = videos.length;
  const percentage = totalVideos > 0 ? Math.round((totalCompleted / totalVideos) * 100) : 0;

  return {
    profile,
    sections: sectionsWithVideos,
    totalVideos,
    totalCompleted,
    percentage
  };
}

// --- VIDEO DETAILS ---
export function getLocalVideoDetails(videoId: string) {
  const allVideos = curriculumData.videos as Video[];
  const allSections = curriculumData.sections as Section[];

  const video = allVideos.find((v) => v._id === videoId);
  if (!video) throw new Error('Video not found');

  const section = allSections.find((s) => s._id === video.sectionId) || null;
  const profileVideos = allVideos.filter((v) => v.profileId === video.profileId);

  const currentIndex = profileVideos.findIndex((v) => v._id === video._id);
  const prev = currentIndex > 0 ? profileVideos[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < profileVideos.length - 1 ? profileVideos[currentIndex + 1] : null;

  const progress = getLocalVideoProgress(videoId) || {
    currentTime: 0,
    duration: video.duration || 0,
    completed: false
  };

  return {
    video: {
      ...video,
      completed: progress.completed,
      progress
    },
    section,
    progress,
    prevVideo: prev ? { _id: prev._id, title: prev.title, badge: prev.badge } : null,
    nextVideo: next ? { _id: next._id, title: next.title, badge: next.badge } : null
  };
}

// --- NOTES ---
export function getLocalNotes(videoId: string) {
  try {
    const raw = localStorage.getItem(`course_player_notes_${videoId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addLocalNote(videoId: string, data: { timestamp: number; content: string }) {
  const notes = getLocalNotes(videoId);
  const newNote = {
    _id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    timestamp: Math.round(data.timestamp || 0),
    content: data.content.trim(),
    createdAt: new Date().toISOString()
  };
  notes.push(newNote);
  notes.sort((a: any, b: any) => a.timestamp - b.timestamp);
  localStorage.setItem(`course_player_notes_${videoId}`, JSON.stringify(notes));

  // Also maintain all notes list
  try {
    const all = JSON.parse(localStorage.getItem(ALL_NOTES_KEY) || '[]');
    all.push(newNote);
    localStorage.setItem(ALL_NOTES_KEY, JSON.stringify(all));
  } catch {}

  return newNote;
}

export function deleteLocalNote(noteId: string) {
  // Find in all video keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('course_player_notes_')) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const notes = JSON.parse(raw);
        const filtered = notes.filter((n: any) => n._id !== noteId);
        if (filtered.length !== notes.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  }
  return { success: true };
}

// --- BOOKMARKS ---
export function getLocalBookmarks(videoId: string) {
  try {
    const raw = localStorage.getItem(`course_player_bookmarks_${videoId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function addLocalBookmark(videoId: string, data: { timestamp: number; title?: string }) {
  const bookmarks = getLocalBookmarks(videoId);
  const newBm = {
    _id: `bm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    videoId,
    timestamp: Math.round(data.timestamp || 0),
    title: data.title?.trim() || `Bookmark at ${data.timestamp}s`,
    createdAt: new Date().toISOString()
  };
  bookmarks.push(newBm);
  bookmarks.sort((a: any, b: any) => a.timestamp - b.timestamp);
  localStorage.setItem(`course_player_bookmarks_${videoId}`, JSON.stringify(bookmarks));

  try {
    const all = JSON.parse(localStorage.getItem(ALL_BOOKMARKS_KEY) || '[]');
    all.push(newBm);
    localStorage.setItem(ALL_BOOKMARKS_KEY, JSON.stringify(all));
  } catch {}

  return newBm;
}

export function deleteLocalBookmark(bookmarkId: string) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('course_player_bookmarks_')) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const bms = JSON.parse(raw);
        const filtered = bms.filter((b: any) => b._id !== bookmarkId);
        if (filtered.length !== bms.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
        }
      }
    }
  }
  return { success: true };
}

// --- STATS & HEATMAP ---
export function getLocalStats(profileId?: string) {
  const today = new Date();
  const todayStr = getLocalDateString(today);

  let logs: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(ACTIVITY_LOG_KEY);
    if (raw) logs = JSON.parse(raw);
  } catch {}

  const secondsToday = logs[todayStr] || 0;
  const minutesToday = Math.round(secondsToday / 60);

  // 7-day watch time
  let secondsWeek = 0;
  const past7Days: Array<{ date: string; day: string; minutes: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const dStr = getLocalDateString(d);
    const sec = logs[dStr] || 0;
    secondsWeek += sec;
    past7Days.push({
      date: dStr,
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: Math.round(sec / 60)
    });
  }
  const minutesWeek = Math.round(secondsWeek / 60);

  // Active days & streak
  const activeDays = Object.keys(logs).filter((d) => (logs[d] || 0) > 30);
  const activeDaysCount = activeDays.length;

  let streak = 0;
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if ((logs[todayStr] || 0) > 30) {
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  } else {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const dStr = getLocalDateString(checkDate);
    if ((logs[dStr] || 0) > 30) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  let bestStreak = streak;

  // Aligned 52-week heatmap (Sunday to Saturday)
  const todayDayOfWeek = today.getDay(); // 0 Sunday, 6 Saturday
  const calendarStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() - (51 * 7 + todayDayOfWeek)
  );

  const heatmap: Array<{ date: string; minutes: number; dayOfWeek: number }> = [];
  const totalDays = 51 * 7 + todayDayOfWeek + 1;
  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(
      calendarStart.getFullYear(),
      calendarStart.getMonth(),
      calendarStart.getDate() + i
    );
    const curStr = getLocalDateString(cur);
    const mins = Math.round((logs[curStr] || 0) / 60);
    heatmap.push({
      date: curStr,
      minutes: mins,
      dayOfWeek: cur.getDay()
    });
  }

  // Completion stats for active profile
  const profiles = getLocalProfiles();
  const activeProf = profiles.find((p) => p._id === profileId || p.key === profileId) || profiles[0];
  const targetVideos = (curriculumData.videos as Video[]).filter((v) => v.profileId === activeProf._id);

  let completedCount = 0;
  targetVideos.forEach((v) => {
    const prog = getLocalVideoProgress(v._id);
    if (prog?.completed) completedCount++;
  });

  const completionPercent = targetVideos.length > 0 ? Math.round((completedCount / targetVideos.length) * 100) : 0;

  // Section breakdown
  const targetSections = (curriculumData.sections as Section[]).filter((s) => s.profileId === activeProf._id);
  const sectionProgress = targetSections.map((sec) => {
    const secVids = targetVideos.filter((v) => v.sectionId === sec._id);
    const secCompleted = secVids.filter((v) => getLocalVideoProgress(v._id)?.completed).length;
    return {
      _id: sec._id,
      name: sec.name,
      order: sec.order,
      totalVideos: secVids.length,
      completedVideos: secCompleted,
      percent: secVids.length > 0 ? Math.round((secCompleted / secVids.length) * 100) : 0
    };
  });

  let totalSecondsAllTime = 0;
  Object.values(logs).forEach((sec) => {
    totalSecondsAllTime += sec;
  });

  return {
    secondsToday,
    minutesToday,
    secondsWeek,
    minutesWeek,
    totalMinutesAllTime: Math.round(totalSecondsAllTime / 60),
    totalHoursAllTime: Number((totalSecondsAllTime / 3600).toFixed(1)),
    streak,
    bestStreak,
    activeDaysCount,
    completionPercent,
    totalVideos: targetVideos.length,
    completedVideos: completedCount,
    past7Days,
    heatmap,
    sectionProgress
  };
}

// --- SETTINGS ---
export function getLocalSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { autoplay: true, autoplayDelay: 5, completeThreshold: 95 };
}

export function updateLocalSettings(updates: Record<string, any>) {
  const current = getLocalSettings();
  const next = { ...current, ...updates };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

// --- BULK OPERATIONS ---
export function bulkMarkLocalProgress(
  profileId: string,
  options: {
    action: 'mark-all-completed' | 'mark-all-uncompleted' | 'mark-section-completed' | 'mark-up-to-lesson';
    sectionId?: string;
    videoId?: string;
  }
) {
  const profiles = getLocalProfiles();
  const profile = profiles.find((p) => p._id === profileId || p.key === profileId) || profiles[0];
  const targetId = profile._id;

  const allVideos = (curriculumData.videos as Video[]).filter((v) => v.profileId === targetId);
  let count = 0;

  if (options.action === 'mark-all-completed') {
    allVideos.forEach((v) => {
      saveLocalVideoProgress(v._id, { currentTime: v.duration || 600, duration: v.duration || 600, completed: true });
      count++;
    });
  } else if (options.action === 'mark-all-uncompleted') {
    allVideos.forEach((v) => {
      saveLocalVideoProgress(v._id, { currentTime: 0, duration: v.duration || 0, completed: false });
      count++;
    });
  } else if (options.action === 'mark-section-completed' && options.sectionId) {
    allVideos
      .filter((v) => v.sectionId === options.sectionId)
      .forEach((v) => {
        saveLocalVideoProgress(v._id, { currentTime: v.duration || 600, duration: v.duration || 600, completed: true });
        count++;
      });
  } else if (options.action === 'mark-up-to-lesson' && options.videoId) {
    const idx = allVideos.findIndex((v) => v._id === options.videoId);
    if (idx !== -1) {
      for (let i = 0; i <= idx; i++) {
        const v = allVideos[i];
        saveLocalVideoProgress(v._id, { currentTime: v.duration || 600, duration: v.duration || 600, completed: true });
        count++;
      }
    }
  }

  return { success: true, count };
}
