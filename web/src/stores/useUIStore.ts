import { create } from 'zustand';
import { AppTheme, AppView } from '../types/index.js';

interface UIState {
  currentView: AppView;
  theme: AppTheme;
  isShortcutsModalOpen: boolean;
  isNotesDrawerOpen: boolean;
  isBookmarksDrawerOpen: boolean;
  isResourcesDrawerOpen: boolean;
  setCurrentView: (view: AppView) => void;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setNotesDrawerOpen: (open: boolean) => void;
  setBookmarksDrawerOpen: (open: boolean) => void;
  setResourcesDrawerOpen: (open: boolean) => void;
}

const getInitialTheme = (): AppTheme => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('course_player_theme') as AppTheme;
    if (saved === 'light' || saved === 'dark') return saved;
  }
  return 'dark';
};

const getInitialView = (): AppView => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const videoId = params.get('v') || params.get('video');
    if (videoId) return 'player';

    const view = params.get('view') as AppView;
    if (view && ['library', 'player', 'settings', 'stats'].includes(view)) return view;

    const saved = localStorage.getItem('course_player_view') as AppView;
    if (saved && ['library', 'player', 'settings', 'stats'].includes(saved)) {
      if (saved === 'player' && !localStorage.getItem('course_player_current_video')) {
        return 'library';
      }
      return saved;
    }
  }
  return 'library';
};

export const useUIStore = create<UIState>((set) => ({
  currentView: getInitialView(),
  theme: getInitialTheme(),
  isShortcutsModalOpen: false,
  isNotesDrawerOpen: false,
  isBookmarksDrawerOpen: false,
  isResourcesDrawerOpen: false,

  setCurrentView: (view) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_view', view);
      try {
        const url = new URL(window.location.href);
        if (view === 'player') {
          const currentVid = localStorage.getItem('course_player_current_video');
          if (currentVid) url.searchParams.set('v', currentVid);
          url.searchParams.delete('view');
        } else {
          url.searchParams.delete('v');
          url.searchParams.delete('video');
          if (view === 'library') {
            url.searchParams.delete('view');
          } else {
            url.searchParams.set('view', view);
          }
        }
        window.history.replaceState({}, '', url.pathname + url.search);
      } catch {}
    }
    set({ currentView: view });
  },

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_theme', theme);
      if (theme === 'light') {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.classList.remove('light');
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
    set({ theme });
  },

  toggleTheme: () => {
    set((state) => {
      const nextTheme = state.theme === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        localStorage.setItem('course_player_theme', nextTheme);
        if (nextTheme === 'light') {
          document.documentElement.classList.remove('dark');
          document.documentElement.classList.add('light');
          document.documentElement.setAttribute('data-theme', 'light');
        } else {
          document.documentElement.classList.remove('light');
          document.documentElement.classList.add('dark');
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      }
      return { theme: nextTheme };
    });
  },

  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
  setNotesDrawerOpen: (open) => set({ isNotesDrawerOpen: open }),
  setBookmarksDrawerOpen: (open) => set({ isBookmarksDrawerOpen: open }),
  setResourcesDrawerOpen: (open) => set({ isResourcesDrawerOpen: open })
}));
