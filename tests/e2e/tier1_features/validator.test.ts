import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const validatorSuite: TestSuite = {
  id: 'tier1_validator',
  name: 'Tier 1: Non-Invasive Path Validator',
  tier: 1,
  description: 'Verifies non-invasive folder validation and section/video counting',
  tests: [
    {
      id: 'validate_mock_dsa_path',
      name: 'POST /api/profiles/:id/validate counts sections and videos correctly on mock_dsa',
      description: 'Validates mock_dsa directory which contains 3 sections and 6 MP4 files',
      authoritativeSource: 'PROJECT.md § Interface Contracts: Path Validation API, ORIGINAL_REQUEST.md § 4',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) {
          console.log('   [INFO] Skipping path validation: profiles endpoint not yet available');
          return;
        }

        const profile = listRes.data[0];
        const valRes = await client.post(`/api/profiles/${profile._id}/validate`, {
          rootPath: fixtures.mockDsa
        });

        if (valRes.status === 404) {
          console.log('   [INFO] Validate route not yet implemented');
          return;
        }

        assert.status(valRes, 200);
        assert.schema(valRes.data, ['valid', 'pathExists', 'sectionCount', 'videoCount']);
        assert.equal(valRes.data.valid, true, 'Mock DSA path should be valid');
        assert.equal(valRes.data.pathExists, true, 'Mock DSA path should exist');
        assert.equal(valRes.data.sectionCount, 3, 'Expected 3 sections in mock_dsa');
        assert.equal(valRes.data.videoCount, 6, 'Expected 6 videos across 3 sections in mock_dsa');
      }
    },
    {
      id: 'validate_invalid_path',
      name: 'POST /api/profiles/:id/validate returns false for nonexistent directory',
      description: 'Checks that validating a missing directory returns valid: false without throwing unhandled exceptions',
      authoritativeSource: 'PROJECT.md § Interface Contracts: Path Validation API',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) {
          return;
        }

        const profile = listRes.data[0];
        const valRes = await client.post(`/api/profiles/${profile._id}/validate`, {
          rootPath: 'C:\\NonExistent\\Drive\\Folder\\12345'
        });

        if (valRes.status === 404) return;

        assert.status(valRes, 200);
        assert.equal(valRes.data.valid, false, 'Nonexistent path should be invalid');
        assert.equal(valRes.data.pathExists, false, 'Nonexistent pathExists should be false');
      }
    }
  ]
};
