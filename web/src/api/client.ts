import * as localStore from './localStore.js';
import curriculumData from '../data/curriculum.json';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export const isStandaloneMode =
  typeof window !== 'undefined' &&
  (window.location.hostname.includes('netlify.app') ||
    window.location.hostname.includes('github.io') ||
    (window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1' &&
      !(import.meta as any).env?.VITE_API_URL));

async function safeFetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.error) errMsg = errJson.error;
      else if (errJson?.message) errMsg = errJson.message;
    } catch {}
    throw new Error(errMsg);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Non-JSON response received');
  }
  return await res.json();
}

export async function fetchProfiles() {
  if (isStandaloneMode) {
    return localStore.getLocalProfiles();
  }
  try {
    const data = await safeFetchJson(`${API_BASE}/profiles`);
    if (Array.isArray(data) && data.length > 0) {
      localStore.saveLocalProfiles(data);
      return data;
    }
  } catch {}
  return localStore.getLocalProfiles();
}

export async function fetchDetectedDriveFolders() {
  if (isStandaloneMode) {
    return {
      detected: [
        { name: 'Apna College DSA', fullPath: 'G:\\My Drive\\Apna College DSA' },
        { name: 'Apna College Development', fullPath: 'G:\\My Drive\\Apna College Development' }
      ]
    };
  }
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

export async function updateProfile(id: string, data: { name?: string; rootPath?: string; key?: any }) {
  let localRes: any = null;
  try {
    localRes = localStore.updateLocalProfile(id, data);
  } catch (err) {
    console.warn('Could not update local profile cache:', err);
  }

  if (isStandaloneMode) {
    return localRes;
  }
  try {
    const remote = await safeFetchJson(`${API_BASE}/profiles/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (remote && remote._id) {
      try {
        localStore.updateLocalProfile(remote._id, remote);
      } catch {}
    }
    return remote;
  } catch {
    return localRes;
  }
}

export async function validateProfilePath(id: string, rootPath?: string) {
  if (isStandaloneMode) {
    return validateProfilePathLocally(id, rootPath);
  }
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath })
    });
  } catch {
    return validateProfilePathLocally(id, rootPath);
  }
}

function validateProfilePathLocally(id: string, rootPath?: string) {
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

export async function scanProfile(id: string, rootPath?: string) {
  const profiles = localStore.getLocalProfiles();
  const prof = profiles.find((p) => p._id === id || p.key === id) || profiles[0];
  const targetId = prof?.key === 'dsa' ? '6aef1ffa40ee2964803d0e32' : '6aef1ffa40ee2964803d0e46';
  const sections = curriculumData.sections.filter((s: any) => s.profileId === prof?._id || s.profileId === targetId);
  const videos = curriculumData.videos.filter((v: any) => v.profileId === prof?._id || v.profileId === targetId);
  const localScanRes = {
    success: true,
    sectionsAdded: sections.length,
    videosAdded: videos.length
  };

  if (isStandaloneMode) {
    return localScanRes;
  }
  try {
    const remote = await safeFetchJson(`${API_BASE}/profiles/${id}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rootPath })
    });
    return remote;
  } catch (err: any) {
    console.warn('[Scan] Remote scan error:', err);
    throw err;
  }
}

export async function fetchLibrary(id: string) {
  if (isStandaloneMode) {
    return localStore.getLocalLibrary(id);
  }
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/library`);
  } catch {
    return localStore.getLocalLibrary(id);
  }
}

function getLocalContinue(id: string) {
  const lib = localStore.getLocalLibrary(id);
  let continueVideo: any = null;
  for (const sec of lib.sections) {
    for (const v of sec.videos) {
      if (!v.completed) {
        const dur = v.duration || 0;
        continueVideo = {
          video: v,
          section: { _id: sec._id, name: sec.name, badge: sec.badge },
          currentTime: v.progress?.currentTime || 0,
          duration: dur,
          percent: dur > 0 ? Math.round(((v.progress?.currentTime || 0) / dur) * 100) : 0,
          completed: false
        };
        break;
      }
    }
    if (continueVideo) break;
  }
  return { continueVideo };
}

export async function fetchContinue(id: string) {
  if (isStandaloneMode) {
    return getLocalContinue(id);
  }
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${id}/continue`);
  } catch {
    return getLocalContinue(id);
  }
}

export async function fetchVideoDetails(id: string) {
  if (isStandaloneMode) {
    return localStore.getLocalVideoDetails(id);
  }
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
  const localRes = localStore.saveLocalVideoProgress(id, data);
  if (isStandaloneMode) {
    return localRes;
  }
  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return localRes;
  }
}

export function beaconProgress(
  id: string,
  data: { currentTime: number; duration: number; completed?: boolean }
) {
  localStore.saveLocalVideoProgress(id, data);
  if (!isStandaloneMode && typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(data)], { type: 'text/plain' });
    navigator.sendBeacon(`${API_BASE}/videos/${id}/progress/beacon`, blob);
  }
}

export async function updateVideoDuration(id: string, duration: number) {
  if (isStandaloneMode) {
    return { success: true };
  }
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
  const localRes = localStore.toggleLocalVideoComplete(id);
  if (isStandaloneMode) {
    return localRes;
  }
  try {
    return await safeFetchJson(`${API_BASE}/videos/${id}/toggle-complete`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
  } catch {
    return localRes;
  }
}

export async function fetchNotes(videoId: string) {
  if (isStandaloneMode) {
    return localStore.getLocalNotes(videoId);
  }
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/notes`);
  } catch {
    return localStore.getLocalNotes(videoId);
  }
}

export async function addNote(videoId: string, data: { timestamp: number; content: string }) {
  const localNote = localStore.addLocalNote(videoId, data);
  if (isStandaloneMode) {
    return localNote;
  }
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
  if (isStandaloneMode) {
    return { success: true };
  }
  try {
    return await safeFetchJson(`${API_BASE}/notes/${noteId}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
}

export async function fetchBookmarks(videoId: string) {
  if (isStandaloneMode) {
    return localStore.getLocalBookmarks(videoId);
  }
  try {
    return await safeFetchJson(`${API_BASE}/videos/${videoId}/bookmarks`);
  } catch {
    return localStore.getLocalBookmarks(videoId);
  }
}

export async function addBookmark(videoId: string, data: { timestamp: number; title?: string }) {
  const localBm = localStore.addLocalBookmark(videoId, data);
  if (isStandaloneMode) {
    return localBm;
  }
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
  if (isStandaloneMode) {
    return { success: true };
  }
  try {
    return await safeFetchJson(`${API_BASE}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
  } catch {
    return { success: true };
  }
}

export async function fetchStats(profileId?: string) {
  if (isStandaloneMode) {
    return localStore.getLocalStats(profileId);
  }
  try {
    const query = profileId ? `?profileId=${profileId}` : '';
    return await safeFetchJson(`${API_BASE}/stats${query}`);
  } catch {
    return localStore.getLocalStats(profileId);
  }
}

export async function fetchSettings() {
  if (isStandaloneMode) {
    return localStore.getLocalSettings();
  }
  try {
    return await safeFetchJson(`${API_BASE}/settings`);
  } catch {
    return localStore.getLocalSettings();
  }
}

export async function updateSettings(settings: Record<string, any>) {
  localStore.updateLocalSettings(settings);
  if (isStandaloneMode) {
    return settings;
  }
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
  if (isStandaloneMode) {
    return { resources: [] };
  }
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
  const localRes = localStore.bulkMarkLocalProgress(profileId, data);
  if (isStandaloneMode) {
    return localRes;
  }
  try {
    return await safeFetchJson(`${API_BASE}/profiles/${profileId}/bulk-progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {
    return localRes;
  }
}
