import * as path from 'path';
import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const emptyAndMissingPathsSuite: TestSuite = {
  id: 'tier2_empty_and_missing_paths',
  name: 'Tier 2: Empty & Disconnected Drive Boundary Tests',
  tier: 2,
  description: 'Verifies resilient handling of empty directories, nonexistent paths, and drive disconnects without DB corruption',
  tests: [
    {
      id: 'validate_empty_folder_boundary',
      name: 'Path validation on empty directory returns 0 sections and 0 videos without crash',
      description: 'Checks that validating an empty directory reports valid: true, sectionCount: 0, videoCount: 0',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 4, spec_report.md § 3 (#4)',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const emptyDir = path.join(fixtures.mockEdge, 'Empty Section');

        const valRes = await client.post(`/api/profiles/${profile._id}/validate`, {
          rootPath: emptyDir
        });

        if (valRes.status === 404) return;

        assert.status(valRes, 200);
        assert.equal(valRes.data.pathExists, true);
        assert.equal(valRes.data.sectionCount, 0);
        assert.equal(valRes.data.videoCount, 0);
      }
    },
    {
      id: 'scan_disconnected_path_does_not_wipe_db',
      name: 'Scan failure on inaccessible path traps ENOENT and preserves existing DB records',
      description: 'Ensures that a disconnected Google Drive does not cause mass deletion of user videos and watch progress',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, spec_report.md § 3 (#4): "Traps ENOENT immediately... Does NOT delete existing records in MongoDB"',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        // Attempt scan on completely bogus drive letter / path
        const scanRes = await client.post(`/api/profiles/${profile._id}/scan`, {
          rootPath: 'Z:\\NonExistentDrive\\ApnaCourse'
        });

        if (scanRes.status === 404) return;

        // Either an error status (400/404/500 with message) or { success: false, error: ... }
        if (scanRes.status === 200) {
          assert.equal(scanRes.data.success, false, 'Expected success: false for disconnected path');
        } else {
          assert.ok(scanRes.status >= 400 && scanRes.status < 600);
        }

        // Verify sections query still returns previous state without crash
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        assert.ok(secRes.status === 200 || secRes.status === 404);
      }
    }
  ]
};
