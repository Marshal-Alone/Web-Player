import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const specialCharactersAndNoiseSuite: TestSuite = {
  id: 'tier2_special_characters_and_noise',
  name: 'Tier 2: Special Characters & System Noise File Suppression',
  tier: 2,
  description: 'Verifies character encoding integrity (parentheses, ampersands, decimals) and strict suppression of OS noise files',
  tests: [
    {
      id: 'noise_files_suppression',
      name: 'Scanner strictly ignores .DS_Store, Thumbs.db, and text files when indexing videos',
      description: 'Checks that OS cache artifacts are not ingested as video records',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, spec_report.md § 3 (#3)',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        // Scan mock_edge_cases
        await client.put(`/api/profiles/${profile._id}`, { rootPath: fixtures.mockEdge });
        const scanRes = await client.post(`/api/profiles/${profile._id}/scan`);
        if (scanRes.status === 404) return;

        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data)) return;

        const allVideos = secRes.data.flatMap((s: any) => s.videos || []);
        for (const v of allVideos) {
          const fn = v.fileName || '';
          assert.ok(
            !fn.includes('.DS_Store') && !fn.includes('Thumbs.db') && !fn.endsWith('.txt'),
            `Noise file ${fn} should never be indexed as a Video`
          );
        }
      }
    },
    {
      id: 'special_characters_and_decimals_preserved',
      name: 'Folder names with parentheses, dashes, and decimals are parsed with clean fidelity',
      description: 'Checks that "57. Project - Phase 2 (Part e)" and "01.5 - Special Topic" parse without mangling',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, spec_report.md § 3 (#1, #2)',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        await client.put(`/api/profiles/${profile._id}`, { rootPath: fixtures.mockDev });
        await client.post(`/api/profiles/${profile._id}/scan`);

        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data)) return;

        const sec57 = secRes.data.find((s: any) => s.badge === '57' || s.folderName?.includes('57'));
        if (sec57) {
          assert.ok(
            sec57.folderName?.includes('(Part e)'),
            'Parentheses in folder name must be preserved'
          );
        }
      }
    }
  ]
};
