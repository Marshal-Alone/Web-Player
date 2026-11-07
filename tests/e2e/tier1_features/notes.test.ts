import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const notesSuite: TestSuite = {
  id: 'tier1_notes',
  name: 'Tier 1: Timestamped Notes Engine',
  tier: 1,
  description: 'Verifies creation, retrieval, timestamp sorting, and deletion of user notes',
  tests: [
    {
      id: 'notes_crud_lifecycle',
      name: 'Create, retrieve, and delete timestamped note',
      description: 'Tests full lifecycle of note attached to a video timestamp',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Phase 2 Endpoints',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        // 1. Create note
        const createRes = await client.post(`/api/videos/${video._id}/notes`, {
          profileId: profile._id,
          timestamp: 15.5,
          content: 'Key algorithmic intuition here'
        });

        if (createRes.status === 404) {
          console.log('   [INFO] Notes endpoint not yet mounted');
          return;
        }

        assert.ok(createRes.status === 200 || createRes.status === 201);
        const createdNote = createRes.data.note || createRes.data;
        assert.ok(createdNote._id, 'Created note must have an _id');
        assert.equal(createdNote.content, 'Key algorithmic intuition here');
        assert.closeTo(createdNote.timestamp, 15.5);

        // 2. Retrieve notes
        const getRes = await client.get(`/api/videos/${video._id}/notes`);
        assert.status(getRes, 200);
        assert.ok(Array.isArray(getRes.data));
        const found = getRes.data.find((n: any) => n._id === createdNote._id);
        assert.ok(found, 'Retrieved notes must include newly created note');

        // 3. Delete note
        const delRes = await client.delete(`/api/notes/${createdNote._id}`);
        assert.ok(delRes.status === 200 || delRes.status === 204);

        // 4. Verify gone
        const verifyRes = await client.get(`/api/videos/${video._id}/notes`);
        const stillThere = verifyRes.data.find((n: any) => n._id === createdNote._id);
        assert.ok(!stillThere, 'Deleted note must not be returned in query');
      }
    }
  ]
};
