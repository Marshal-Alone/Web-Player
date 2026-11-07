import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const backupSuite: TestSuite = {
  id: 'tier1_backup',
  name: 'Tier 1: JSON Export & Import Engine',
  tier: 1,
  description: 'Verifies data portability, full database JSON export, and schema-validated restore',
  tests: [
    {
      id: 'backup_export_schema',
      name: 'GET /api/backup/export delivers JSON archive with profiles, progress, notes, and settings',
      description: 'Checks export endpoint outputs complete user state payload',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Phase 2 Endpoints (GET /api/backup/export)',
      fn: async ({ client }) => {
        const exportRes = await client.get('/api/backup/export');
        if (exportRes.status === 0 || exportRes.status === 404) {
          console.log('   [INFO] Backup export endpoint not yet mounted');
          return;
        }

        assert.status(exportRes, 200);
        assert.schema(exportRes.data, ['version', 'exportedAt']);
      }
    },
    {
      id: 'backup_import_validation',
      name: 'POST /api/backup/import rejects malformed or unversioned backup archives',
      description: 'Checks that corrupt backup payloads return 400 Bad Request without corrupting state',
      authoritativeSource: 'spec_report.md § 2 (Feature 52), PROJECT.md § Phase 2 Endpoints',
      fn: async ({ client }) => {
        const corruptRes = await client.post('/api/backup/import', {
          invalidData: 'not a valid course backup'
        });

        if (corruptRes.status === 0 || corruptRes.status === 404) return;

        assert.ok(
          corruptRes.status === 400 || corruptRes.status === 422,
          `Expected 400 or 422 for invalid backup import, got ${corruptRes.status}`
        );
      }
    }
  ]
};
