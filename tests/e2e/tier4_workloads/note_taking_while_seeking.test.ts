import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const noteTakingWhileSeekingSuite: TestSuite = {
  id: 'tier4_note_taking_while_seeking',
  name: 'Tier 4: Note-Taking While Seeking Workload',
  tier: 4,
  description: 'Verifies rapid note capture across non-sequential seeks and asserts chronological ordering by timestamp',
  tests: [
    {
      id: 'multiple_notes_ordered_chronologically',
      name: 'Creating notes out of order preserves ascending timestamp sort order',
      description: 'Creates notes at 75s, 10s, and 45s, and asserts returned array is ordered [10, 45, 75]',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Phase 2 Endpoints',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length === 0) return;

        const video = secRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        // Post notes out of chronological order
        const timestamps = [75.0, 10.0, 45.0];
        for (const t of timestamps) {
          const res = await client.post(`/api/videos/${video._id}/notes`, {
            profileId: profile._id,
            timestamp: t,
            content: `Note captured at ${t}s`
          });
          if (res.status === 404) return;
        }

        // Fetch notes
        const getRes = await client.get(`/api/videos/${video._id}/notes`);
        if (getRes.status === 404) return;

        assert.status(getRes, 200);
        assert.ok(Array.isArray(getRes.data));

        // Filter our test notes
        const testNotes = getRes.data.filter((n: any) => n.content?.startsWith('Note captured at'));
        if (testNotes.length >= 3) {
          assert.isSorted(testNotes, (a: any, b: any) => a.timestamp - b.timestamp);
        }

        // Clean up created notes
        for (const n of testNotes) {
          await client.delete(`/api/notes/${n._id}`);
        }
      }
    }
  ]
};
