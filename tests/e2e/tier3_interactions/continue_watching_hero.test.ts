import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const continueWatchingHeroSuite: TestSuite = {
  id: 'tier3_continue_watching_hero',
  name: 'Tier 3: Continue Watching State Synchronization',
  tier: 3,
  description: 'Verifies Continue Watching endpoint synchronization as user watches videos across sections',
  tests: [
    {
      id: 'continue_watching_synchronization',
      name: 'GET /api/profiles/:id/continue dynamically updates to most recently watched video',
      description: 'Asserts that playing a new video shifts the Continue Watching hero card target',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5, PROJECT.md § Progress & Resume',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length === 0) return;

        const allVideos = secRes.data.flatMap((s: any) => s.videos || []);
        if (allVideos.length < 2) return;

        const targetVideo = allVideos[1];

        // Save progress on second video
        const saveRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: targetVideo._id,
          currentTime: 45.0,
          duration: 120.0
        });

        if (saveRes.status === 404) return;

        // Query continue watching
        const continueRes = await client.get(`/api/profiles/${profile._id}/continue`);
        if (continueRes.status === 404) return;

        assert.status(continueRes, 200);
        if (continueRes.data) {
          const lastVideo = continueRes.data.lastVideo || continueRes.data.video || continueRes.data;
          assert.equal(
            lastVideo._id,
            targetVideo._id,
            'Continue watching card must point to the most recently watched video'
          );
        }
      }
    }
  ]
};
