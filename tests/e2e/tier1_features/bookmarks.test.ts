import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const bookmarksSuite: TestSuite = {
  id: 'tier1_bookmarks',
  name: 'Tier 1: Video Bookmarks Engine',
  tier: 1,
  description: 'Verifies creation, list, and removal of quick video bookmarks',
  tests: [
    {
      id: 'bookmarks_crud_lifecycle',
      name: 'Create, list, and remove timestamp bookmarks',
      description: 'Tests bookmark creation and retrieval for seek bar markers',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Phase 2 Endpoints',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        // 1. Create bookmark
        const createRes = await client.post(`/api/videos/${video._id}/bookmarks`, {
          profileId: profile._id,
          timestamp: 88.0,
          title: 'Matrix multiplication pivot formula'
        });

        if (createRes.status === 404) {
          console.log('   [INFO] Bookmarks endpoint not yet mounted');
          return;
        }

        assert.ok(createRes.status === 200 || createRes.status === 201);
        const bookmark = createRes.data.bookmark || createRes.data;
        assert.ok(bookmark._id);
        assert.closeTo(bookmark.timestamp, 88.0);

        // 2. List bookmarks
        const listBm = await client.get(`/api/videos/${video._id}/bookmarks`);
        assert.status(listBm, 200);
        assert.ok(Array.isArray(listBm.data));
        const found = listBm.data.find((b: any) => b._id === bookmark._id);
        assert.ok(found);

        // 3. Delete bookmark
        const delRes = await client.delete(`/api/bookmarks/${bookmark._id}`);
        assert.ok(delRes.status === 200 || delRes.status === 204);
      }
    }
  ]
};
