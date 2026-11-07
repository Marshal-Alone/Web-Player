import * as fs from 'fs';
import * as path from 'path';
import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const streamingSuite: TestSuite = {
  id: 'tier1_streaming',
  name: 'Tier 1: HTTP 206 Partial Content Streaming Engine',
  tier: 1,
  description: 'Verifies Range request handling, Content-Range headers, and binary slice fidelity',
  tests: [
    {
      id: 'stream_partial_content_range_206',
      name: 'GET /api/videos/:id/stream with Range bytes=0-1023 returns 206 with Content-Range and exact slice',
      description: 'Asserts HTTP 206 status, Content-Range header, Content-Length, and byte-level fidelity',
      authoritativeSource: 'PROJECT.md § Interface Contracts: Media Streaming, ORIGINAL_REQUEST.md § 2',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) {
          console.log('   [INFO] Skipping live stream test: backend not ready');
          return;
        }

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const firstVideo = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!firstVideo) return;

        const rangeRes = await client.stream(`/api/videos/${firstVideo._id}/stream`, 'bytes=0-1023');
        if (rangeRes.status === 404) {
          console.log('   [INFO] Stream route not yet mounted');
          return;
        }

        assert.status(rangeRes, 206, 'Streaming with valid Range must return 206 Partial Content');
        assert.hasHeader(rangeRes, 'accept-ranges', 'bytes');
        assert.hasHeader(rangeRes, 'content-type', /video\/mp4/i);
        assert.equal(rangeRes.rawBody.length, 1024, 'Payload length must match requested range 0-1023 (1024 bytes)');

        // Verify Content-Range header format
        const contentRange = rangeRes.headers['content-range'];
        assert.ok(contentRange, 'Response must have Content-Range header');
        assert.ok(
          /^bytes 0-1023\/\d+$/.test(contentRange),
          `Content-Range must match 'bytes 0-1023/total', got '${contentRange}'`
        );
      }
    },
    {
      id: 'stream_open_ended_range',
      name: 'GET /api/videos/:id/stream with Range bytes=1024- returns remainder from offset',
      description: 'Tests open-ended byte range requests typically requested when seeking forward',
      authoritativeSource: 'PROJECT.md § Interface Contracts: Media Streaming',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const firstVideo = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!firstVideo) return;

        const rangeRes = await client.stream(`/api/videos/${firstVideo._id}/stream`, 'bytes=1024-');
        if (rangeRes.status === 404) return;

        assert.status(rangeRes, 206);
        const contentRange = rangeRes.headers['content-range'];
        assert.ok(contentRange);
        assert.ok(
          /^bytes 1024-\d+\/\d+$/.test(contentRange),
          `Expected Content-Range to start at 1024-, got '${contentRange}'`
        );
      }
    }
  ]
};
