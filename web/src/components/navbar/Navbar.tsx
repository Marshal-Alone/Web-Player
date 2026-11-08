import React from 'react';
import { useProfileStore } from '../../stores/useProfileStore.js';
import { useUIStore } from '../../stores/useUIStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { ProfileKey } from '../../types/index.js';
import { PlayCircle, BarChart3, Settings, Sun, Moon, HelpCircle, BookOpen } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeProfileKey, setActiveProfileKey } = useProfileStore();
  const { currentView, setCurrentView, theme, toggleTheme, setShortcutsModalOpen } = useUIStore();
  const { currentVideoId } = usePlayerStore();

  const handleProfileSwitch = (key: ProfileKey) => {
    setActiveProfileKey(key);
    // If switching profiles, return to library to see the new profile's courses
    if (currentView === 'player') {
      setCurrentView('library');
    }
  };

  return (
    <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Profile Switcher */}
      <div className="flex items-center gap-6">
        <div
          onClick={() => setCurrentView('library')}
          className="flex items-center gap-2 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
            ▶
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-text-main group-hover:text-accent transition-colors">
              Apna Course Player
            </span>
            <span className="text-[10px] text-text-dim tracking-wider uppercase font-medium">
              Offline Path Player
            </span>
          </div>
        </div>

        {/* Profile Tabs: DSA | Development */}
        <div className="flex items-center bg-card rounded-lg p-0.5 border border-border">
          <button
            onClick={() => handleProfileSwitch('dsa')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeProfileKey === 'dsa'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            DSA
          </button>
          <button
            onClick={() => handleProfileSwitch('development')}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
              activeProfileKey === 'development'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-main'
            }`}
          >
            Development
          </button>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCurrentView('player')}
          title={currentVideoId ? 'Resume active lesson' : 'Open course player'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentView === 'player'
              ? 'bg-accent text-white shadow-sm font-semibold'
              : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <PlayCircle className="w-3.5 h-3.5" />
          {currentVideoId ? 'Resume' : 'Player'}
        </button>

        <button
          onClick={() => setCurrentView('library')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentView === 'library'
              ? 'bg-accent text-white shadow-sm font-semibold'
              : 'text-text-muted hover:text-text-main hover:bg-surface-hover'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Library
        </button>

        <button
          onClick={() => setCurrentView('stats')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentView === 'stats'
              ? 'bg-surface-hover text-text-main border border-border'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Stats
        </button>

        <button
          onClick={() => setCurrentView('settings')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            currentView === 'settings'
              ? 'bg-surface-hover text-text-main border border-border'
              : 'text-text-muted hover:text-text-main'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>

        <div className="w-[1px] h-4 bg-border mx-1" />

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Keyboard Shortcuts */}
        <button
          onClick={() => setShortcutsModalOpen(true)}
          title="Keyboard Shortcuts (?)"
          className="w-8 h-8 rounded-md flex items-center justify-center text-text-muted hover:text-text-main hover:bg-surface-hover transition-colors"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
