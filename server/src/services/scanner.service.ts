import fs from 'fs';
import path from 'path';
import { Profile, Section, Video, IProfile, ISection, IVideo } from '../models/index.js';

// Natural numeric sorting comparator: e.g. "57. Section" before "100. Section", "672 - Lesson" before "1001 - Lesson"
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export interface ParsedItem {
  badge: string;
  cleanTitle: string;
  orderNumber: number;
}

// Parses "672 - Connecting Login Route.mp4" -> badge: "672", cleanTitle: "Connecting Login Route", orderNumber: 672
// Parses "57. Project - Phase 2 (Part e)" -> badge: "57", cleanTitle: "Project - Phase 2 (Part e)", orderNumber: 57
export function parseNameAndBadge(rawName: string, isFile = false): ParsedItem {
  let nameWithoutExt = rawName;
  if (isFile) {
    const ext = path.extname(rawName);
    nameWithoutExt = path.basename(rawName, ext);
  }

  // Matches leading digits: e.g. "57. ", "672 - ", "01_", "[02] "
  const match = nameWithoutExt.match(/^\s*(?:\[|\()?(\d+)(?:\]|\))?\s*[-._\s:]*\s*(.*)$/);
  if (match) {
    const orderNumber = parseInt(match[1], 10);
    const badge = match[1];
    const cleanTitle = match[2]?.trim() || nameWithoutExt;
    return { badge, cleanTitle, orderNumber };
  }

  return {
    badge: '',
    cleanTitle: nameWithoutExt.trim(),
    orderNumber: 999999
  };
}

const SUPPORTED_VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v', '.avi']);
const SUBTITLE_EXTS = new Set(['.srt', '.vtt']);

export interface ValidationResult {
  valid: boolean;
  pathExists: boolean;
  sectionCount: number;
  videoCount: number;
  error?: string;
}

/**
 * Non-invasive validation: checks directory existence and counts sections & videos
 * Reads file names and stats ONLY. Never reads file contents (protects Google Drive).
 */
export async function validateProfilePath(rootPath: string): Promise<ValidationResult> {
  if (!rootPath || !rootPath.trim()) {
    return { valid: false, pathExists: false, sectionCount: 0, videoCount: 0, error: 'Path is empty' };
  }

  try {
    const stat = await fs.promises.stat(rootPath);
    if (!stat.isDirectory()) {
      return { valid: false, pathExists: false, sectionCount: 0, videoCount: 0, error: 'Path is not a directory' };
    }

    const entries = await fs.promises.readdir(rootPath, { withFileTypes: true });
    let sectionCount = 0;
    let videoCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        sectionCount++;
        const subPath = path.join(rootPath, entry.name);
        try {
          const subEntries = await fs.promises.readdir(subPath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (sub.isFile()) {
              const ext = path.extname(sub.name).toLowerCase();
              if (SUPPORTED_VIDEO_EXTS.has(ext)) {
                videoCount++;
              }
            }
          }
        } catch {
          // ignore unreadable subfolders
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_VIDEO_EXTS.has(ext)) {
          videoCount++;
        }
      }
    }

    return {
      valid: true,
      pathExists: true,
      sectionCount,
      videoCount
    };
  } catch (err: any) {
    return {
      valid: false,
      pathExists: false,
      sectionCount: 0,
      videoCount: 0,
      error: err.message || 'Directory not accessible'
    };
  }
}

/**
 * Non-invasive scanner:
 * - Scans folders into sections
 * - Scans video files into lessons
 * - Never reads file bodies
 * - Natural sorting
 * - Matches by relPath first, falls back to (size + mtime) on rename to preserve progress
 * - Marks missing files with missing: true
 */
export async function scanProfileLibrary(profileId: string): Promise<{ sectionsAdded: number; videosAdded: number }> {
  const profile = await Profile.findById(profileId);
  if (!profile || !profile.rootPath) {
    throw new Error('Profile not found or rootPath not set');
  }

  const rootPath = profile.rootPath;
  const stat = await fs.promises.stat(rootPath);
  if (!stat.isDirectory()) {
    throw new Error(`Profile rootPath "${rootPath}" is not a directory`);
  }

  // Load existing records for this profile
  const existingSections = await Section.find({ profileId: profile._id });
  const existingVideos = await Video.find({ profileId: profile._id });

  // Maps for fast matching
  const sectionByRelPath = new Map<string, typeof existingSections[0]>();
  for (const s of existingSections) {
    sectionByRelPath.set(s.relPath, s);
  }

  const videoByRelPath = new Map<string, typeof existingVideos[0]>();
  const videoBySizeMtime = new Map<string, typeof existingVideos[0]>();
  for (const v of existingVideos) {
    videoByRelPath.set(v.relPath, v);
    if (v.size && v.mtime) {
      const key = `${v.size}_${new Date(v.mtime).getTime()}`;
      videoBySizeMtime.set(key, v);
    }
  }

  const foundVideoIds = new Set<string>();
  const topEntries = await fs.promises.readdir(rootPath, { withFileTypes: true });

  // Separate sections (sub-directories) and root files
  const dirEntries: fs.Dirent[] = [];
  const rootVideoEntries: fs.Dirent[] = [];

  for (const entry of topEntries) {
    if (entry.isDirectory()) {
      dirEntries.push(entry);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_VIDEO_EXTS.has(ext)) {
        rootVideoEntries.push(entry);
      }
    }
  }

  // Natural sort sections by folder name
  dirEntries.sort((a, b) => naturalCompare(a.name, b.name));

  let globalSectionOrder = 0;
  let totalVideosCount = 0;

  // Process root videos into "General" section if any exist
  if (rootVideoEntries.length > 0) {
    rootVideoEntries.sort((a, b) => naturalCompare(a.name, b.name));
    let generalSection = sectionByRelPath.get('');
    if (!generalSection) {
      generalSection = await Section.create({
        profileId: profile._id,
        name: 'General',
        folderName: '',
        order: globalSectionOrder++,
        badge: '0',
        relPath: '',
        videoCount: rootVideoEntries.length,
        totalDuration: 0
      });
    }

    let lessonOrder = 0;
    for (const ventry of rootVideoEntries) {
      const fullPath = path.join(rootPath, ventry.name);
      const fileStat = await fs.promises.stat(fullPath);
      const relPath = ventry.name;
      const parsed = parseNameAndBadge(ventry.name, true);
      const sizeMtimeKey = `${fileStat.size}_${fileStat.mtime.getTime()}`;

      let match = videoByRelPath.get(relPath) || videoBySizeMtime.get(sizeMtimeKey);

      if (match) {
        match.fullPath = fullPath;
        match.relPath = relPath;
        match.title = parsed.cleanTitle;
        match.badge = parsed.badge;
        match.order = lessonOrder++;
        match.size = fileStat.size;
        match.mtime = fileStat.mtime;
        match.missing = false;
        await match.save();
        foundVideoIds.add(match._id.toString());
      } else {
        const created = await Video.create({
          sectionId: generalSection._id,
          profileId: profile._id,
          title: parsed.cleanTitle,
          fileName: ventry.name,
          badge: parsed.badge,
          relPath,
          fullPath,
          order: lessonOrder++,
          size: fileStat.size,
          mtime: fileStat.mtime,
          duration: null,
          missing: false,
          hasSubtitles: false
        });
        foundVideoIds.add(created._id.toString());
      }
      totalVideosCount++;
    }
  }

  // Process sub-directories (Sections)
  for (const dir of dirEntries) {
    const sectionRelPath = dir.name;
    const sectionFullPath = path.join(rootPath, dir.name);
    const parsedSection = parseNameAndBadge(dir.name, false);

    let sectionDoc = sectionByRelPath.get(sectionRelPath);
    if (!sectionDoc) {
      sectionDoc = await Section.create({
        profileId: profile._id,
        name: parsedSection.cleanTitle,
        folderName: dir.name,
        order: globalSectionOrder++,
        badge: parsedSection.badge,
        relPath: sectionRelPath,
        videoCount: 0,
        totalDuration: 0
      });
      sectionByRelPath.set(sectionRelPath, sectionDoc);
    } else {
      sectionDoc.name = parsedSection.cleanTitle;
      sectionDoc.order = globalSectionOrder++;
      sectionDoc.badge = parsedSection.badge;
      await sectionDoc.save();
    }

    // Read files inside this section
    const subEntries = await fs.promises.readdir(sectionFullPath, { withFileTypes: true });
    const videoFiles: fs.Dirent[] = [];
    const subtitleFiles = new Map<string, string>(); // baseName -> fullPath

    for (const sub of subEntries) {
      if (sub.isFile()) {
        const ext = path.extname(sub.name).toLowerCase();
        const base = path.basename(sub.name, ext);
        if (SUPPORTED_VIDEO_EXTS.has(ext)) {
          videoFiles.push(sub);
        } else if (SUBTITLE_EXTS.has(ext)) {
          subtitleFiles.set(base, path.join(sectionFullPath, sub.name));
        }
      }
    }

    // Natural sort videos
    videoFiles.sort((a, b) => naturalCompare(a.name, b.name));
    sectionDoc.videoCount = videoFiles.length;
    await sectionDoc.save();

    let videoOrder = 0;
    for (const vfile of videoFiles) {
      const fullVideoPath = path.join(sectionFullPath, vfile.name);
      const vstat = await fs.promises.stat(fullVideoPath);
      const relVideoPath = path.join(sectionRelPath, vfile.name).replace(/\\/g, '/');
      const parsedVideo = parseNameAndBadge(vfile.name, true);
      const baseName = path.basename(vfile.name, path.extname(vfile.name));
      const subPath = subtitleFiles.get(baseName);
      const sizeMtimeKey = `${vstat.size}_${vstat.mtime.getTime()}`;

      let match = videoByRelPath.get(relVideoPath) || videoBySizeMtime.get(sizeMtimeKey);

      if (match) {
        match.fullPath = fullVideoPath;
        match.relPath = relVideoPath;
        match.title = parsedVideo.cleanTitle;
        match.badge = parsedVideo.badge;
        match.order = videoOrder++;
        match.size = vstat.size;
        match.mtime = vstat.mtime;
        match.sectionId = sectionDoc._id;
        match.missing = false;
        if (subPath) {
          match.hasSubtitles = true;
          match.subtitlePath = subPath;
        }
        await match.save();
        foundVideoIds.add(match._id.toString());
      } else {
        const newVid = await Video.create({
          sectionId: sectionDoc._id,
          profileId: profile._id,
          title: parsedVideo.cleanTitle,
          fileName: vfile.name,
          badge: parsedVideo.badge,
          relPath: relVideoPath,
          fullPath: fullVideoPath,
          order: videoOrder++,
          size: vstat.size,
          mtime: vstat.mtime,
          duration: null,
          missing: false,
          hasSubtitles: !!subPath,
          subtitlePath: subPath || undefined
        });
        foundVideoIds.add(newVid._id.toString());
      }
      totalVideosCount++;
    }
  }

  // Mark missing videos that were not encountered in this scan (keeps their progress intact)
  for (const v of existingVideos) {
    if (!foundVideoIds.has(v._id.toString())) {
      v.missing = true;
      await v.save();
    }
  }

  // Update profile stats & scan timestamp
  profile.lastScannedAt = new Date();
  profile.stats = {
    totalSections: globalSectionOrder,
    totalVideos: totalVideosCount,
    totalDuration: 0
  };
  await profile.save();

  return {
    sectionsAdded: globalSectionOrder,
    videosAdded: totalVideosCount
  };
}
