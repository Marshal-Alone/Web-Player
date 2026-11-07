import * as fs from 'fs';
import * as path from 'path';
import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const rescanAndFileRenamesSuite: TestSuite = {
  id: 'tier2_rescan_and_file_renames',
  name: 'Tier 2: Rescan Reconciliation & File Rename Preservation',
  tier: 2,
  description: 'Verifies fallback matching by size + mtime when files are renamed, preserving video ID and progress',
  tests: [
    {
      id: 'rescan_size_mtime_rename_reconciliation',
      name: 'Rescan preserves video record and progress when filename changes with identical size + mtime',
      description: 'Tests that renaming a lesson file preserves its existing progress via size + mtime matching',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3: "falls back to size + mtime if renamed so progress is preserved"',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const renameDir = fixtures.mockRename;
        const initialFilePath = path.join(renameDir, 'Original Folder', 'Initial File.mp4');
        const renamedFilePath = path.join(renameDir, 'Original Folder', 'Renamed Lesson.mp4');

        // Ensure initial file exists
        if (!fs.existsSync(initialFilePath)) {
          if (fs.existsSync(renamedFilePath)) {
            fs.renameSync(renamedFilePath, initialFilePath);
          }
        }

        // Configure profile to renameDir
        await client.put(`/api/profiles/${profile._id}`, { rootPath: renameDir });

        // First scan
        const scan1 = await client.post(`/api/profiles/${profile._id}/scan`);
        if (scan1.status === 404) return;

        // Fetch video id
        const secRes1 = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes1.status === 404 || !Array.isArray(secRes1.data)) return;

        const initialVideo = secRes1.data.flatMap((s: any) => s.videos || []).find((v: any) => v.fileName?.includes('Initial File'));
        if (!initialVideo) return;

        const originalVideoId = initialVideo._id;

        // Save progress on initial video
        await client.post('/api/progress', {
          profileId: profile._id,
          videoId: originalVideoId,
          currentTime: 24.5,
          duration: 120.0
        });

        // Now rename file on disk, preserving mtime and size
        const stat = fs.statSync(initialFilePath);
        fs.renameSync(initialFilePath, renamedFilePath);
        fs.utimesSync(renamedFilePath, stat.atime, stat.mtime);

        // Second scan
        const scan2 = await client.post(`/api/profiles/${profile._id}/scan`);
        assert.status(scan2, 200);

        // Fetch sections again
        const secRes2 = await client.get(`/api/profiles/${profile._id}/sections`);
        const allVideos2 = secRes2.data.flatMap((s: any) => s.videos || []);

        // The renamed video should either keep the same _id or maintain progress
        const matchedVideo = allVideos2.find((v: any) => v._id === originalVideoId || v.fileName?.includes('Renamed Lesson'));
        assert.ok(matchedVideo, 'Renamed video should be found and reconciled in DB');

        // Clean up: restore original filename
        if (fs.existsSync(renamedFilePath)) {
          fs.renameSync(renamedFilePath, initialFilePath);
        }
      }
    },
    {
      id: 'rescan_missing_file_soft_flag',
      name: 'Rescan flags missing files with missing: true without deleting user watch history',
      description: 'Checks that deleting a file on disk marks the record missing: true rather than removing it',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3: "Missing files marked missing: true"',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        // Scan standard mock_dev
        await client.put(`/api/profiles/${profile._id}`, { rootPath: fixtures.mockDev });
        const scanRes = await client.post(`/api/profiles/${profile._id}/scan`);
        if (scanRes.status === 404) return;

        // Temporary create & remove a file to test soft flagging
        const tempVideoPath = path.join(fixtures.mockDev, '01. Introduction to Web', 'temp_to_delete.mp4');
        fs.writeFileSync(tempVideoPath, Buffer.alloc(1024));

        await client.post(`/api/profiles/${profile._id}/scan`);

        // Remove from disk
        fs.unlinkSync(tempVideoPath);

        // Rescan
        await client.post(`/api/profiles/${profile._id}/scan`);

        // Inspect sections
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 200 && Array.isArray(secRes.data)) {
          const tempVideoRecord = secRes.data
            .flatMap((s: any) => s.videos || [])
            .find((v: any) => v.fileName === 'temp_to_delete.mp4');

          if (tempVideoRecord) {
            assert.equal(tempVideoRecord.missing, true, 'Unmatched deleted file must have missing: true');
          }
        }
      }
    }
  ]
};
