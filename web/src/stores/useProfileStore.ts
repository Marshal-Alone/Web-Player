import { create } from 'zustand';
import { Profile, ProfileKey } from '../types/index.js';

interface ProfileState {
  activeProfileKey: ProfileKey;
  profiles: Profile[];
  isLoading: boolean;
  error: string | null;
  setActiveProfileKey: (key: ProfileKey) => void;
  setProfiles: (profiles: Profile[]) => void;
  setIsLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  getActiveProfile: () => Profile | undefined;
}

const getInitialProfileKey = (): ProfileKey => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('course_player_active_profile') as ProfileKey;
    if (saved === 'dsa' || saved === 'development') return saved;
  }
  return 'dsa';
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  activeProfileKey: getInitialProfileKey(),
  profiles: [],
  isLoading: false,
  error: null,

  setActiveProfileKey: (key) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('course_player_active_profile', key);
      document.documentElement.setAttribute('data-profile', key);
    }
    set({ activeProfileKey: key });
  },

  setProfiles: (profiles) => {
    set({ profiles });
  },

  setIsLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  getActiveProfile: () => {
    const { profiles, activeProfileKey } = get();
    return profiles.find((p) => p.key === activeProfileKey);
  }
}));
