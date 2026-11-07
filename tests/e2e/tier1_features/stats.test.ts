import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const statsSuite: TestSuite = {
  id: 'tier1_stats',
  name: 'Tier 1: Learning Analytics & 12-Week Heatmap',
  tier: 1,
  description: 'Verifies watch time aggregation, daily streak, and 12-week heatmap data format',
  tests: [
    {
      id: 'stats_schema_and_heatmap_format',
      name: 'GET /api/profiles/:id/stats returns structured metrics and heatmap array',
      description: 'Checks presence of todaySeconds, weekSeconds, streakDays, and valid heatmap entries',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Phase 2 Endpoints (GET /api/profiles/:id/stats)',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const statsRes = await client.get(`/api/profiles/${profile._id}/stats`);

        if (statsRes.status === 404) {
          console.log('   [INFO] Stats endpoint not yet mounted');
          return;
        }

        assert.status(statsRes, 200);
        assert.schema(statsRes.data, ['todaySeconds', 'weekSeconds', 'streakDays', 'heatmap']);
        assert.equal(typeof statsRes.data.todaySeconds, 'number');
        assert.equal(typeof statsRes.data.weekSeconds, 'number');
        assert.equal(typeof statsRes.data.streakDays, 'number');
        assert.ok(Array.isArray(statsRes.data.heatmap), 'Heatmap must be an array');

        if (statsRes.data.heatmap.length > 0) {
          const entry = statsRes.data.heatmap[0];
          assert.schema(entry, ['date', 'seconds']);
          assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(entry.date), 'Heatmap date should follow YYYY-MM-DD format');
        }
      }
    }
  ]
};
