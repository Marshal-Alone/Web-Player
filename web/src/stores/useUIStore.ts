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

export const useUIStore = create<UIState>((set) => ({
  currentView: 'library',
  theme: getInitialTheme(),
  isShortcutsModalOpen: false,
  isNotesDrawerOpen: false,
  isBookmarksDrawerOpen: false,
  isResourcesDrawerOpen: false,

  setCurrentView: (view) => set({ currentView: view }),

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
