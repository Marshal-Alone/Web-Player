import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { fetchBookmarks, addBookmark, deleteBookmark } from '../../api/client.js';
import { X, Bookmark as BookmarkIcon, Plus, Trash2, Clock } from 'lucide-react';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const BookmarksDrawer: React.FC = () => {
  const { isBookmarksDrawerOpen, setBookmarksDrawerOpen } = useUIStore();
  const { currentVideoId } = usePlayerStore();

  const [bookmarks, setBookmarks] = useState<any[]>([]);
  const [title, setTitle] = useState('');

  const loadBookmarks = () => {
    if (currentVideoId) {
      fetchBookmarks(currentVideoId).then((data) => setBookmarks(data || []));
    }
  };

  useEffect(() => {
    if (isBookmarksDrawerOpen && currentVideoId) {
      loadBookmarks();
    }
  }, [isBookmarksDrawerOpen, currentVideoId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVideoId) return;

    const videoElem = document.querySelector('video');
    const timestamp = Math.floor(videoElem?.currentTime || 0);

    await addBookmark(currentVideoId, {
      timestamp,
      title: title.trim() || `Bookmark at ${formatTime(timestamp)}`
    });
    setTitle('');
    loadBookmarks();
  };

  const handleDelete = async (bookmarkId: string) => {
    await deleteBookmark(bookmarkId);
    loadBookmarks();
  };

  const handleJump = (timestamp: number) => {
    const videoElem = document.querySelector('video');
    if (videoElem) {
      videoElem.currentTime = timestamp;
      videoElem.play().catch(() => {});
    }
  };

  if (!isBookmarksDrawerOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookmarkIcon className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-text-main">Bookmarks</h3>
        </div>
        <button
          onClick={() => setBookmarksDrawerOpen(false)}
          className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-main"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleAdd} className="p-4 border-b border-border space-y-2">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bookmark label (optional)..."
          className="w-full p-2.5 rounded-xl bg-card border border-border text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          className="w-full py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Bookmark Current Second (B)
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {bookmarks.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-dim">
            No bookmarks saved for this video. Press 'B' to bookmark key moments!
          </div>
        ) : (
          bookmarks.map((b) => (
            <div
              key={b._id}
              onClick={() => handleJump(b.timestamp)}
              className="p-3 rounded-xl bg-card border border-border flex items-center justify-between cursor-pointer hover:border-accent/40 transition-colors group"
            >
              <div className="flex items-center gap-2.5 truncate">
                <span className="flex items-center gap-1 text-[11px] font-mono font-bold text-accent">
                  <Clock className="w-3 h-3" />
                  {formatTime(b.timestamp)}
                </span>
                <span className="text-xs text-text-main truncate font-medium">{b.title}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(b._id);
                }}
                className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                title="Delete Bookmark"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
