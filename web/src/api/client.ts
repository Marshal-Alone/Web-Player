const API_BASE = '/api';

export async function fetchProfiles() {
  const res = await fetch(`${API_BASE}/profiles`);
  if (!res.ok) throw new Error('Failed to load profiles');
  return res.json();
}

export async function updateProfile(id: string, data: { name?: string; rootPath?: string }) {
  const res = await fetch(`${API_BASE}/profiles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

export async function validateProfilePath(id: string, rootPath?: string) {
  const res = await fetch(`${API_BASE}/profiles/${id}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rootPath })
  });
  if (!res.ok) throw new Error('Validation failed');
  return res.json();
}

export async function scanProfile(id: string) {
  const res = await fetch(`${API_BASE}/profiles/${id}/scan`, {
    method: 'POST'
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Scan failed');
  }
  return res.json();
}

export async function fetchLibrary(id: string) {
  const res = await fetch(`${API_BASE}/profiles/${id}/library`);
  if (!res.ok) throw new Error('Failed to load course library');
  return res.json();
}

export async function fetchContinue(id: string) {
  const res = await fetch(`${API_BASE}/profiles/${id}/continue`);
  if (!res.ok) throw new Error('Failed to load continue watching');
  return res.json();
}

export async function fetchVideoDetails(id: string) {
  const res = await fetch(`${API_BASE}/videos/${id}`);
  if (!res.ok) throw new Error('Failed to load video details');
  return res.json();
}

export async function saveProgress(
  id: string,
  data: { currentTime: number; duration: number; completed?: boolean }
) {
  const res = await fetch(`${API_BASE}/videos/${id}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to save progress');
  return res.json();
}

export function beaconProgress(
  id: string,
  data: { currentTime: number; duration: number; completed?: boolean }
) {
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    navigator.sendBeacon(`${API_BASE}/videos/${id}/progress/beacon`, blob);
  }
}

export async function updateVideoDuration(id: string, duration: number) {
  const res = await fetch(`${API_BASE}/videos/${id}/duration`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration })
  });
  return res.json();
}

export async function toggleComplete(id: string) {
  const res = await fetch(`${API_BASE}/videos/${id}/toggle-complete`, {
    method: 'PUT'
  });
  if (!res.ok) throw new Error('Failed to toggle completion');
  return res.json();
}

export async function fetchNotes(videoId: string) {
  const res = await fetch(`${API_BASE}/videos/${videoId}/notes`);
  return res.json();
}

export async function addNote(videoId: string, data: { timestamp: number; content: string }) {
  const res = await fetch(`${API_BASE}/videos/${videoId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteNote(noteId: string) {
  const res = await fetch(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchBookmarks(videoId: string) {
  const res = await fetch(`${API_BASE}/videos/${videoId}/bookmarks`);
  return res.json();
}

export async function addBookmark(videoId: string, data: { timestamp: number; title?: string }) {
  const res = await fetch(`${API_BASE}/videos/${videoId}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
}

export async function deleteBookmark(bookmarkId: string) {
  const res = await fetch(`${API_BASE}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchStats(profileId?: string) {
  const query = profileId ? `?profileId=${profileId}` : '';
  const res = await fetch(`${API_BASE}/stats${query}`);
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function updateSettings(settings: Record<string, any>) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings)
  });
  return res.json();
}

export async function fetchResources(sectionId: string) {
  const res = await fetch(`${API_BASE}/sections/${sectionId}/resources`);
  return res.json();
}

export async function bulkMarkProgress(
  profileId: string,
  data: {
    action: 'mark-all-completed' | 'mark-all-uncompleted' | 'mark-section-completed' | 'mark-up-to-lesson';
    sectionId?: string;
    videoId?: string;
  }
) {
  const res = await fetch(`${API_BASE}/profiles/${profileId}/bulk-progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Bulk operation failed');
  }
  return res.json();
}
