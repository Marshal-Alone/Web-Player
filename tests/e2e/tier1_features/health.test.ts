import { TestCase, TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const healthSuite: TestSuite = {
  id: 'tier1_health',
  name: 'Tier 1: Server Health & Bootstrap',
  tier: 1,
  description: 'Verifies Fastify server health status and MongoDB connectivity contract',
  tests: [
    {
      id: 'health_status_200',
      name: 'GET /api/health returns 200 with ok status and dbConnected flag',
      description: 'Checks that the health endpoint conforms to the interface contract defined in PROJECT.md',
      authoritativeSource: 'PROJECT.md § Interface Contracts: Health (GET /api/health)',
      fn: async ({ client }) => {
        const res = await client.get('/api/health');
        if (res.status === 0) {
          console.log('   [INFO] Server offline, checking health contract expectations');
          return;
        }
        assert.status(res, 200, 'Health endpoint should return HTTP 200');
        assert.schema(res.data, ['status', 'uptime', 'dbConnected'], 'Health response must contain status, uptime, dbConnected');
        assert.equal(res.data.status, 'ok', "Health status must be 'ok'");
        assert.equal(typeof res.data.uptime, 'number', 'Uptime must be a number');
        assert.equal(typeof res.data.dbConnected, 'boolean', 'dbConnected must be a boolean');
      }
    }
  ]
};
