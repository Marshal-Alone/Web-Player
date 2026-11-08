export type ProfileKey = 'dsa' | 'development';
export type AppView = 'library' | 'player' | 'settings' | 'stats';
export type AppTheme = 'dark' | 'light';

export interface ProfileStats {
  totalSections: number;
  totalVideos: number;
  totalDuration: number;
}

export interface Profile {
  _id: string;
  key: ProfileKey;
  name: string;
  rootPath: string;
  gdriveUrl?: string;
  resolvedLocalPath?: string;
  order: number;
  lastScannedAt?: string;
  stats?: ProfileStats;
  createdAt?: string;
  updatedAt?: string;
}

export interface Section {
  _id: string;
  profileId: string;
  name: string;
  folderName: string;
  order: number;
  badge: string;
  relPath: string;
  videoCount: number;
  totalDuration: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Progress {
  _id?: string;
  profileId: string;
  videoId: string;
  sectionId?: string;
  currentTime: number;
  duration: number;
  completed: boolean;
  lastWatched?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Video {
  _id: string;
  sectionId: string;
  profileId: string;
  title: string;
  fileName: string;
  badge: string;
  relPath: string;
  fullPath: string;
  order: number;
  size: number;
  mtime: string;
  duration: number | null;
  missing: boolean;
  hasSubtitles: boolean;
  subtitlePath?: string;
  progress?: Progress;
  createdAt?: string;
  updatedAt?: string;
}

export interface SectionWithVideos extends Section {
  videos: Video[];
}

export interface Note {
  _id: string;
  videoId: string;
  profileId: string;
  sectionId?: string;
  timestamp: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  _id: string;
  videoId: string;
  profileId: string;
  timestamp: number;
  title: string;
  createdAt: string;
}

export interface WatchLog {
  _id: string;
  profileId: string;
  videoId: string;
  watchedAt: string;
  date?: string;
  secondsWatched: number;
}

export interface Setting {
  _id?: string;
  key: string;
  value: unknown;
}

export interface ContinueWatchingData {
  lastVideo: Video;
  progress: Progress;
  section: Section;
}

export interface StatsResponse {
  todaySeconds: number;
  weekSeconds: number;
  streakDays: number;
  heatmap: Array<{ date: string; seconds: number }>;
}
