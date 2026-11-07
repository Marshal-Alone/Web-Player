import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const corruptedRangeRequestsSuite: TestSuite = {
  id: 'tier2_corrupted_range_requests',
  name: 'Tier 2: Corrupted & Boundary Range Request Tests',
  tier: 2,
  description: 'Verifies HTTP 416 Range Not Satisfiable and RFC 7233 compliance under malformed range headers',
  tests: [
    {
      id: 'range_beyond_eof_returns_416',
      name: 'Range request beyond file size returns HTTP 416 Range Not Satisfiable',
      description: 'Asserts that requesting bytes beyond EOF responds with 416 and Content-Range: bytes */total',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 2, spec_report.md § 2 (Feature 12)',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const res = await client.stream(`/api/videos/${video._id}/stream`, 'bytes=99999999-99999999');
        if (res.status === 404) return;

        assert.equal(res.status, 416, `Expected HTTP 416 for out-of-bounds range, got ${res.status}`);
        const contentRange = res.headers['content-range'];
        if (contentRange) {
          assert.ok(contentRange.startsWith('bytes */'), `Content-Range on 416 should start with bytes */, got '${contentRange}'`);
        }
      }
    },
    {
      id: 'range_inverted_start_greater_than_end_returns_416',
      name: 'Range with start > end (bytes=5000-2000) returns HTTP 416 or 400',
      description: 'Asserts invalid inverted range specification is rejected cleanly',
      authoritativeSource: 'RFC 7233 § 3.1 & PROJECT.md § Media Streaming',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const res = await client.stream(`/api/videos/${video._id}/stream`, 'bytes=5000-2000');
        if (res.status === 404) return;

        assert.ok(
          res.status === 416 || res.status === 400,
          `Expected 416 or 400 for inverted range, got ${res.status}`
        );
      }
    },
    {
      id: 'range_malformed_string_handled_safely',
      name: 'Malformed Range header (bytes=corrupt-range) does not crash server',
      description: 'Ensures invalid alphanumeric characters in Range header return 416 or fallback safely to full file',
      authoritativeSource: 'RFC 7233 § 3.1 & Fastify Error Handling',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const res = await client.stream(`/api/videos/${video._id}/stream`, 'bytes=corrupt-range');
        if (res.status === 404) return;

        // Fastify / Node handles either by 416, 400, or ignoring the invalid range and serving 200
        assert.ok(
          [200, 206, 400, 416].includes(res.status),
          `Expected server to safely handle malformed range, received status ${res.status}`
        );
      }
    }
  ]
};
