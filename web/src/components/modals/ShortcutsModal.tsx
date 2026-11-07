import React from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { X, Keyboard } from 'lucide-react';

const SHORTCUTS = [
  { key: 'Space / K', desc: 'Toggle play / pause' },
  { key: 'J / L', desc: 'Skip backward / forward 10s' },
  { key: '← / →', desc: 'Skip backward / forward 5s' },
  { key: '↑ / ↓', desc: 'Volume up / down' },
  { key: 'M', desc: 'Mute / unmute audio' },
  { key: 'F', desc: 'Toggle fullscreen mode' },
  { key: 'T', desc: 'Toggle theatre mode' },
  { key: 'Shift + N', desc: 'Next lesson in course' },
  { key: 'Shift + P', desc: 'Previous lesson in course' },
  { key: 'N', desc: 'Add timestamped note at current second' },
  { key: 'B', desc: 'Bookmark current timestamp' },
  { key: '?', desc: 'Show this shortcuts cheatsheet' }
];

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsModalOpen, setShortcutsModalOpen } = useUIStore();

  if (!isShortcutsModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-accent" />
            <h3 className="text-base font-bold text-text-main">Keyboard Shortcuts</h3>
          </div>
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="p-1 rounded-lg hover:bg-surface-hover text-text-muted hover:text-text-main"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-card/60 text-xs"
            >
              <span className="text-text-muted">{item.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-surface border border-border font-mono font-semibold text-text-main shadow-xs">
                {item.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="text-center pt-2 border-t border-border">
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="w-full py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
