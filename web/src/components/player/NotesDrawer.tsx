import React, { useState, useEffect } from 'react';
import { useUIStore } from '../../stores/useUIStore.js';
import { usePlayerStore } from '../../stores/usePlayerStore.js';
import { fetchNotes, addNote, deleteNote } from '../../api/client.js';
import { X, FileText, Plus, Trash2, Clock } from 'lucide-react';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const NotesDrawer: React.FC = () => {
  const { isNotesDrawerOpen, setNotesDrawerOpen } = useUIStore();
  const { currentVideoId } = usePlayerStore();

  const [notes, setNotes] = useState<any[]>([]);
  const [content, setContent] = useState('');

  const loadNotes = () => {
    if (currentVideoId) {
      fetchNotes(currentVideoId).then((data) => setNotes(data || []));
    }
  };

  useEffect(() => {
    if (isNotesDrawerOpen && currentVideoId) {
      loadNotes();
    }
  }, [isNotesDrawerOpen, currentVideoId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !currentVideoId) return;

    // Get current video timestamp from DOM video element
    const videoElem = document.querySelector('video');
    const timestamp = Math.floor(videoElem?.currentTime || 0);

    await addNote(currentVideoId, { timestamp, content });
    setContent('');
    loadNotes();
  };

  const handleDelete = async (noteId: string) => {
    await deleteNote(noteId);
    loadNotes();
  };

  const handleJumpToTime = (timestamp: number) => {
    const videoElem = document.querySelector('video');
    if (videoElem) {
      videoElem.currentTime = timestamp;
      videoElem.play().catch(() => {});
    }
  };

  if (!isNotesDrawerOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 md:w-96 bg-surface border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-text-main truncate max-w-[200px]">
            Lesson Notes
          </h3>
        </div>
        <button
          onClick={() => setNotesDrawerOpen(false)}
          className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-main"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Add Note Form */}
      <form onSubmit={handleAddNote} className="p-4 border-b border-border space-y-2">
        <textarea
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a timestamped note (press 'N' during video)..."
          className="w-full p-2.5 rounded-xl bg-card border border-border text-xs text-text-main placeholder:text-text-dim focus:outline-none focus:border-accent resize-none"
        />
        <button
          type="submit"
          className="w-full py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Note at Current Second
        </button>
      </form>

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {notes.length === 0 ? (
          <div className="text-center py-8 text-xs text-text-dim">
            No notes yet. Add your thoughts or code snippets while studying!
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note._id}
              className="p-3 rounded-xl bg-card border border-border space-y-2 group"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => handleJumpToTime(note.timestamp)}
                  className="flex items-center gap-1 text-[11px] font-mono font-bold text-accent hover:underline"
                >
                  <Clock className="w-3 h-3" />
                  {formatTime(note.timestamp)}
                </button>
                <button
                  onClick={() => handleDelete(note._id)}
                  className="text-text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete Note"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-text-main whitespace-pre-wrap leading-relaxed">
                {note.content}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
