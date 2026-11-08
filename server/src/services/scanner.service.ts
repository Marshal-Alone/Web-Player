import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { Profile, Section, Video, IProfile, ISection, IVideo } from '../models/index.js';
import { resolveGDriveUrlToLocalPath, extractGDriveFolderId } from './gdrive.service.js';

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
  resolvedPath?: string;
  isDriveUrl?: boolean;
  folderName?: string;
  error?: string;
}

/**
 * Resilient profile finder:
 * Matches by MongoDB _id, key ('dsa' or 'development'), name, or known curriculum ID.
 * Falls back to case-insensitive substring and guarantees finding the profile.
 */
export async function findProfileByIdOrKey(id: string): Promise<IProfile | null> {
  if (!id) return null;
  const cleanId = String(id).trim();

  // 1. Valid MongoDB ObjectId lookup
  if (mongoose.Types.ObjectId.isValid(cleanId)) {
    const profile = await Profile.findById(cleanId);
    if (profile) return profile;
  }

  // 2. Exact key lookup ('dsa' or 'development')
  const byKey = await Profile.findOne({ key: cleanId.toLowerCase() });
  if (byKey) return byKey;

  // 3. Known static curriculum.json IDs
  if (cleanId === '6aef1ffa40ee2964803d0e32') {
    const dsa = await Profile.findOne({ key: 'dsa' });
    if (dsa) return dsa;
  }
  if (cleanId === '6aef1ffa40ee2964803d0e46') {
    const dev = await Profile.findOne({ key: 'development' });
    if (dev) return dev;
  }

  // 4. Exact name lookup (case-insensitive)
  const byName = await Profile.findOne({ name: new RegExp(`^${cleanId}$`, 'i') });
  if (byName) return byName;

  // 5. Substring key matching
  if (cleanId.toLowerCase().includes('dsa')) {
    const dsa = await Profile.findOne({ key: 'dsa' });
    if (dsa) return dsa;
  }
  if (cleanId.toLowerCase().includes('dev')) {
    const dev = await Profile.findOne({ key: 'development' });
    if (dev) return dev;
  }

  // 6. Final fallback: return the first available profile
  return await Profile.findOne().sort({ order: 1 });
}

/**
 * Non-invasive validation: checks directory existence and counts sections & videos.
 * Supports both local paths (e.g. G:\My Drive\Apna College...) AND direct Google Drive folder links!
 */
export async function validateProfilePath(rootPath: string, profileKey?: string): Promise<ValidationResult> {
  let effectivePath = (rootPath || '').trim();
  if (!effectivePath && profileKey) {
    effectivePath = profileKey === 'dsa' ? 'G:\\My Drive\\Apna College DSA' : 'G:\\My Drive\\Apna College Development';
  }
  if (!effectivePath) {
    return { valid: false, pathExists: false, sectionCount: 0, videoCount: 0, error: 'Path is empty' };
  }

  let isDriveUrl = false;
  let folderName: string | undefined;

  // Check if user passed a direct Google Drive link
  if (extractGDriveFolderId(effectivePath) || effectivePath.includes('drive.google.com')) {
    isDriveUrl = true;
    const gdriveResult = await resolveGDriveUrlToLocalPath(effectivePath);
    if (gdriveResult.localPath) {
      effectivePath = gdriveResult.localPath;
      folderName = gdriveResult.folderName;
    } else {
      return {
        valid: false,
        pathExists: false,
        sectionCount: 0,
        videoCount: 0,
        isDriveUrl: true,
        error: gdriveResult.error || 'Could not resolve Google Drive link to a local folder.'
      };
    }
  }

  try {
    const stat = await fs.promises.stat(effectivePath);
    if (!stat.isDirectory()) {
      return { valid: false, pathExists: false, sectionCount: 0, videoCount: 0, error: 'Path is not a directory' };
    }

    const entries = await fs.promises.readdir(effectivePath, { withFileTypes: true });
    let sectionCount = 0;
    let videoCount = 0;

    for (const entry of entries) {
      if (entry.isDirectory()) {
        sectionCount++;
        const subPath = path.join(effectivePath, entry.name);
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
      videoCount,
      resolvedPath: effectivePath,
      isDriveUrl,
      folderName
    };
  } catch (err: any) {
    return {
      valid: false,
      pathExists: false,
      sectionCount: 0,
      videoCount: 0,
      isDriveUrl,
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
  const profile = await findProfileByIdOrKey(profileId);
  if (!profile) {
    throw new Error('Profile not found');
  }

  let rootPath = (profile.resolvedLocalPath || profile.rootPath || '').trim();

  // If path is not set or empty, assign standard default based on profile key
  if (!rootPath) {
    rootPath = profile.key === 'dsa' ? 'G:\\My Drive\\Apna College DSA' : 'G:\\My Drive\\Apna College Development';
    profile.rootPath = rootPath;
    profile.resolvedLocalPath = rootPath;
    await profile.save();
  }

  // If user provided a direct Google Drive URL, resolve to local Google Drive for Desktop path
  if (extractGDriveFolderId(rootPath) || rootPath.includes('drive.google.com')) {
    const gdriveResult = await resolveGDriveUrlToLocalPath(rootPath);
    if (gdriveResult.localPath) {
      profile.resolvedLocalPath = gdriveResult.localPath;
      profile.gdriveUrl = rootPath;
      await profile.save();
      rootPath = gdriveResult.localPath;
    } else {
      // Fallback: check standard local paths
      const fallbackPath =
        profile.key === 'dsa' ? 'G:\\My Drive\\Apna College DSA' : 'G:\\My Drive\\Apna College Development';
      if (fs.existsSync(fallbackPath)) {
        profile.resolvedLocalPath = fallbackPath;
        await profile.save();
        rootPath = fallbackPath;
      } else {
        throw new Error(
          gdriveResult.error ||
            'Could not resolve Google Drive link to local drive. Please ensure Google Drive for Desktop is running and folder path exists.'
        );
      }
    }
  }

  // If path doesn't exist on G:\, check candidate drives (H:\, F:\, D:\, C:\)
  if (!fs.existsSync(rootPath)) {
    const folderBaseName = path.basename(rootPath);
    const candidateDrives = ['G:\\My Drive', 'G:\\', 'H:\\My Drive', 'H:\\', 'F:\\My Drive', 'D:\\My Drive'];
    for (const cand of candidateDrives) {
      const alt = path.join(cand, folderBaseName);
      if (fs.existsSync(alt)) {
        rootPath = alt;
        profile.resolvedLocalPath = alt;
        await profile.save();
        break;
      }
    }
  }

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
  const videoBulkOps: any[] = [];

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
        foundVideoIds.add(match._id.toString());
        videoBulkOps.push({
          updateOne: {
            filter: { _id: match._id },
            update: {
              $set: {
                fullPath,
                relPath,
                title: parsed.cleanTitle,
                badge: parsed.badge,
                order: lessonOrder++,
                size: fileStat.size,
                mtime: fileStat.mtime,
                missing: false
              }
            }
          }
        });
      } else {
        videoBulkOps.push({
          insertOne: {
            document: {
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
            }
          }
        });
      }
      totalVideosCount++;
    }
  }

  // Process sub-directories (Sections)
  for (const dir of dirEntries) {
    const sectionRelPath = dir.name;
    const sectionFullPath = path.join(rootPath, dir.name);
    const parsedSection = parseNameAndBadge(dir.name, false);
    const currentOrder = globalSectionOrder++;

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

    let sectionDoc = sectionByRelPath.get(sectionRelPath);
    if (!sectionDoc) {
      sectionDoc = await Section.create({
        profileId: profile._id,
        name: parsedSection.cleanTitle,
        folderName: dir.name,
        order: currentOrder,
        badge: parsedSection.badge,
        relPath: sectionRelPath,
        videoCount: videoFiles.length,
        totalDuration: 0
      });
      sectionByRelPath.set(sectionRelPath, sectionDoc);
    } else {
      sectionDoc.name = parsedSection.cleanTitle;
      sectionDoc.order = currentOrder;
      sectionDoc.badge = parsedSection.badge;
      sectionDoc.videoCount = videoFiles.length;
      await sectionDoc.save();
    }

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
        foundVideoIds.add(match._id.toString());
        videoBulkOps.push({
          updateOne: {
            filter: { _id: match._id },
            update: {
              $set: {
                fullPath: fullVideoPath,
                relPath: relVideoPath,
                title: parsedVideo.cleanTitle,
                badge: parsedVideo.badge,
                order: videoOrder++,
                size: vstat.size,
                mtime: vstat.mtime,
                sectionId: sectionDoc._id,
                missing: false,
                hasSubtitles: !!subPath,
                subtitlePath: subPath || undefined
              }
            }
          }
        });
      } else {
        videoBulkOps.push({
          insertOne: {
            document: {
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
            }
          }
        });
      }
      totalVideosCount++;
    }
  }

  // Execute bulk operations in MongoDB
  if (videoBulkOps.length > 0) {
    await Video.bulkWrite(videoBulkOps, { ordered: false });
  }

  // Mark missing videos in bulk (preserves watch progress)
  const missingIds = existingVideos
    .filter((v) => !foundVideoIds.has(v._id.toString()))
    .map((v) => v._id);
  if (missingIds.length > 0) {
    await Video.updateMany({ _id: { $in: missingIds } }, { $set: { missing: true } });
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
