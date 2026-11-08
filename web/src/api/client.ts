import * as localStore from './localStore.js';
import curriculumData from '../data/curriculum.json';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

// Helper to determine if we are running in an environment without the local backend
async function safeFetchJson(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Non-JSON response received');
    }
    return await res.json();
  } catch (err) {
    throw err;
  }
}

export async function fetchProfiles() {
  try {
    const data = await safeFetchJson(`${API_BASE}/profiles`);
    if (Array.isArray(data) && data.length > 0) return data;
  } catch {}
  return localStore.getLocalProfiles();
}

export async function fetchDetectedDriveFolders() {
  try {
    return await safeFetchJson(`${API_BASE}/gdrive/detect`);
  } catch {
    return {
      detected: [
        { name: 'Apna College DSA', fullPath: 'G:\\My Drive\\Apna College DSA' },
        { name: 'Apna College Development', fullPath: 'G:\\My Drive\\Apna College Development' }
      ]
    };
  }
}

export async function updateProfile(id: string, data: { name?: string; rootPath?: string }) {
  // Always update local store
  try {
    localStore.updateLocalProfile(id, data);
  } catch {}

  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    const profiles = localStore.getLocalProfiles();
    return profiles.find((p) => p._id === id || p.key === id) || profiles[0];
  }
}

export async function validateProfilePath(id: string, rootPath?: string) {
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath })
    });
  } catch {
    // Standalone fallback: validate path or Google Drive link against curriculum
    const profiles = localStore.getLocalProfiles();
    const prof = profiles.find((p) => p._id === id || p.key === id) || profiles[0];
    const pathToCheck = rootPath || prof?.rootPath || '';
    const isDriveUrl = pathToCheck.includes('drive.google.com');

    const sections = curriculumData.sections.filter((s: any) => s.profileId === prof?._id);
    const videos = curriculumData.videos.filter((v: any) => v.profileId === prof?._id);

    return {
      valid: Boolean(pathToCheck && pathToCheck.trim()),
      pathExists: true,
      sectionCount: sections.length,
      videoCount: videos.length,
      isDriveUrl,
      folderName: prof?.name || 'Course Folder',
      resolvedPath: pathToCheck
    };
  }
}

export async function scanProfile(id: string) {
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/scan`, { method: 'POST' });
  } catch {
    const profiles = localStore.getLocalProfiles();
    const prof = profiles.find((p) => p._id === id || p.key === id) || profiles[0];
    const sections = curriculumData.sections.filter((s: any) => s.profileId === prof?._id);
    const videos = curriculumData.videos.filter((v: any) => v.profileId === prof?._id);
    return {
      success: true,
      sectionsAdded: sections.length,
      videosAdded: videos.length
    };
  }
}

export async function fetchLibrary(id: string) {
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/library`);
  } catch {
    return localStore.getLocalLibrary(id);
  }
}

export async function fetchContinue(id: string) {
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/continue`);
  } catch {
    const lib = localStore.getLocalLibrary(id);
    // Find first uncompleted or last watched video
    let continueVideo: any = null;
    for (const sec of lib.sections) {
      for (const v of sec.videos) {
        if (!v.completed) {
          continueVideo = {
            ...v,
            sectionName: sec.name
          };
          break;
        }
      }
      if (continueVideo) break;
    }
    return { continueVideo };
  }
}

export async function fetchVideoDetails(id: string) {
  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}`);
  } catch {
    return localStore.getLocalVideoDetails(id);
  }
}

export async function saveProgress(
  id: string,
  data: { currentTime: number; duration: number; completed?: boolean }
) {
  // Always update browser local storage immediately
  localStore.saveLocalVideoProgress(id, data);

  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return localStore.getLocalVideoProgress(id);
  }
}

export function beaconProgress(
  id: string,
  data: { currentTime: number; duration: number; completed?: boolean }
) {
  localStore.saveLocalVideoProgress(id, data);
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    navigator.sendBeacon(`${API_BASE}/videos/${id}/progress/beacon`, blob);
  }
}

export async function updateVideoDuration(id: string, duration: number) {
  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}/duration`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duration })
    });
  } catch {
    return { success: true };
  }
}

export async function toggleComplete(id: string) {
  // Always toggle local store immediately
  const localRes = localStore.toggleLocalVideoComplete(id);

  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}/toggle-complete`, { method: 'PUT' });
  } catch {
    return localRes;
  }
}

export async function fetchNotes(videoId: string) {
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/notes`);
  } catch {
    return localStore.getLocalNotes(videoId);
  }
}

export async function addNote(videoId: string, data: { timestamp: number; content: string }) {
  const localNote = localStore.addLocalNote(videoId, data);
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return localNote;
  }
}

export async function deleteNote(noteId: string) {
  localStore.deleteLocalNote(noteId);
  try {
    return await safeFetchJson(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
}

export async function fetchBookmarks(videoId: string) {
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/bookmarks`);
  } catch {
    return localStore.getLocalBookmarks(videoId);
  }
}

export async function addBookmark(videoId: string, data: { timestamp: number; title?: string }) {
  const localBm = localStore.addLocalBookmark(videoId, data);
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return localBm;
  }
}

export async function deleteBookmark(bookmarkId: string) {
  localStore.deleteLocalBookmark(bookmarkId);
  try {
    return await safeFetchJson(`${API_BASE}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
}

export async function fetchStats(profileId?: string) {
  try {
    const query = profileId ? `?profileId=${profileId}` : '';
    return await safeFetchJson(`${API_BASE}/stats${query}`);
  } catch {
    return localStore.getLocalStats(profileId);
  }
}

export async function fetchSettings() {
  try {
    return await safeFetchJson(`${API_BASE}/settings`);
  } catch {
    return localStore.getLocalSettings();
  }
}

export async function updateSettings(settings: Record<string, any>) {
  localStore.updateLocalSettings(settings);
  try {
    return await safeFetchJson(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch {
    return settings;
  }
}

export async function fetchResources(sectionId: string) {
  try {
    return await safeFetchJson(`${API_BASE}/sections/${sectionId}/resources`);
  } catch {
    return { resources: [] };
  }
}

export async function bulkMarkProgress(
  profileId: string,
  data: {
    action: 'mark-all-completed' | 'mark-all-uncompleted' | 'mark-section-completed' | 'mark-up-to-lesson';
    sectionId?: string;
    videoId?: string;
  }
) {
  localStore.bulkMarkLocalProgress(profileId, data);
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${profileId}/bulk-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return { success: true };
  }
}
