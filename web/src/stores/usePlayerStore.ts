import { create } from 'zustand';
import { Video, Section } from '../types/index.js';

interface PlayerState {
  currentVideoId: string | null;
  video: Video | null;
  section: Section | null;
  prevVideo: { _id: string; title: string; badge: string } | null;
  nextVideo: { _id: string; title: string; badge: string } | null;
  isPlaying: boolean;
  isTheatreMode: boolean;
  isSidebarCollapsed: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  autoplayEnabled: boolean;
  isAutoplayCountdownActive: boolean;
  autoplayCountdownRemaining: number;
  isCourseComplete: boolean;
  isDriveLoading: boolean;

  setCurrentVideoId: (id: string | null) => void;
  setVideoData: (data: {
    video: Video;
    section: Section | null;
    prevVideo: any;
    nextVideo: any;
  }) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsTheatreMode: (theatre: boolean) => void;
  toggleTheatreMode: () => void;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  setIsMuted: (muted: boolean) => void;
  setAutoplayEnabled: (enabled: boolean) => void;
  startAutoplayCountdown: () => void;
  cancelAutoplayCountdown: () => void;
  setAutoplayCountdownRemaining: (sec: number) => void;
  setIsCourseComplete: (complete: boolean) => void;
  setIsDriveLoading: (loading: boolean) => void;
}

const getStoredNumber = (key: string, fallback: number): number => {
  if (typeof window !== 'undefined') {
    const val = localStorage.getItem(key);
    if (val !== null) {
      const num = parseFloat(val);
      if (!isNaN(num)) return num;
    }
  }
  return fallback;
};

const getStoredBool = (key: string, fallback: boolean): boolean => {
  if (typeof window !== 'undefined') {
    const val = localStorage.getItem(key);
    if (val !== null) return val === 'true';
  }
  return fallback;
};

const getInitialVideoId = (): string | null => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('v') || params.get('video');
    if (v) return v;
    const saved = localStorage.getItem('course_player_current_video');
    if (saved) return saved;
  }
  return null;
};

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentVideoId: getInitialVideoId(),
  video: null,
  section: null,
  prevVideo: null,
  nextVideo: null,
  isPlaying: false,
  isTheatreMode: false,
  isSidebarCollapsed: getStoredBool('course_player_sidebar_collapsed', false),
  playbackSpeed: getStoredNumber('course_player_playback_speed', 1.0),
  volume: getStoredNumber('course_player_volume', 1.0),
  isMuted: getStoredBool('course_player_muted', false),
  autoplayEnabled: getStoredBool('course_player_autoplay', true),
  isAutoplayCountdownActive: false,
  autoplayCountdownRemaining: 5,
  isCourseComplete: false,
  isDriveLoading: false,

  setCurrentVideoId: (id) => {
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem('course_player_current_video', id);
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('v', id);
          url.searchParams.delete('view');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch {}
      } else {
        localStorage.removeItem('course_player_current_video');
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete('v');
          url.searchParams.delete('video');
          window.history.replaceState({}, '', url.pathname + url.search);
        } catch {}
      }
    }
    set({ currentVideoId: id });
  },

  setVideoData: ({ video, section, prevVideo, nextVideo }) => {
    if (typeof window !== 'undefined' && video?._id) {
      localStorage.setItem('course_player_current_video', video._id);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('v', video._id);
        url.searchParams.delete('view');
        window.history.replaceState({}, '', url.pathname + url.search);
      } catch {}
    }
    set({
      video,
      section,
      prevVideo,
      nextVideo,
      currentVideoId: video._id,
      isCourseComplete: false,
      isAutoplayCountdownActive: false
    });
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsTheatreMode: (theatre) => set({ isTheatreMode: theatre }),

  toggleTheatreMode: () => set((s) => ({ isTheatreMode: !s.isTheatreMode })),

  setIsSidebarCollapsed: (collapsed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_sidebar_collapsed', String(collapsed));
    }
    set({ isSidebarCollapsed: collapsed });
  },

  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_sidebar_collapsed', String(next));
    }
    set({ isSidebarCollapsed: next });
  },

  setPlaybackSpeed: (speed) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_playback_speed', String(speed));
    }
    set({ playbackSpeed: speed });
  },

  setVolume: (volume) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_volume', String(volume));
    }
    set({ volume });
  },

  setIsMuted: (isMuted) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_muted', String(isMuted));
    }
    set({ isMuted });
  },

  setAutoplayEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_autoplay', String(enabled));
    }
    set({ autoplayEnabled: enabled });
  },

  startAutoplayCountdown: () =>
    set({ isAutoplayCountdownActive: true, autoplayCountdownRemaining: 5 }),

  cancelAutoplayCountdown: () =>
    set({ isAutoplayCountdownActive: false }),

  setAutoplayCountdownRemaining: (sec) =>
    set({ autoplayCountdownRemaining: sec }),

  setIsCourseComplete: (complete) =>
    set({ isCourseComplete: complete, isAutoplayCountdownActive: false }),

  setIsDriveLoading: (loading) =>
    set({ isDriveLoading: loading })
}));
