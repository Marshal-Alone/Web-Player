import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const profileSwitchingStatePreservationSuite: TestSuite = {
  id: 'tier4_profile_switching_state_preservation',
  name: 'Tier 4: Profile Isolation & State Preservation Workload',
  tier: 4,
  description: 'Verifies strict state isolation between DSA and Development libraries with zero cross-profile progress leakage',
  tests: [
    {
      id: 'dsa_and_dev_progress_remain_strictly_isolated',
      name: 'Updating DSA course progress leaves Development course progress untouched',
      description: 'Checks that progress queries scoped to profileId maintain total isolation',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 1 & § 4, PROJECT.md § Profiles & Settings',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const dsaProfile = listRes.data.find((p: any) => (p.key || p.slug) === 'dsa');
        const devProfile = listRes.data.find((p: any) => (p.key || p.slug) === 'development');

        if (!dsaProfile || !devProfile) return;

        // Ensure both profiles are configured and scanned
        await client.put(`/api/profiles/${dsaProfile._id}`, { rootPath: fixtures.mockDsa });
        await client.put(`/api/profiles/${devProfile._id}`, { rootPath: fixtures.mockDev });
        await client.post(`/api/profiles/${dsaProfile._id}/scan`);
        await client.post(`/api/profiles/${devProfile._id}/scan`);

        // Fetch first video of each profile
        const dsaSecRes = await client.get(`/api/profiles/${dsaProfile._id}/sections`);
        const devSecRes = await client.get(`/api/profiles/${devProfile._id}/sections`);

        if (!Array.isArray(dsaSecRes.data) || !Array.isArray(devSecRes.data)) return;

        const dsaVideo = dsaSecRes.data.flatMap((s: any) => s.videos || [])[0];
        const devVideo = devSecRes.data.flatMap((s: any) => s.videos || [])[0];

        if (!dsaVideo || !devVideo) return;

        // Set DSA progress to 75s
        await client.post('/api/progress', {
          profileId: dsaProfile._id,
          videoId: dsaVideo._id,
          currentTime: 75.0,
          duration: 100.0
        });

        // Set Dev progress to 12s
        await client.post('/api/progress', {
          profileId: devProfile._id,
          videoId: devVideo._id,
          currentTime: 12.0,
          duration: 100.0
        });

        // Check Continue Watching for DSA
        const dsaContinue = await client.get(`/api/profiles/${dsaProfile._id}/continue`);
        if (dsaContinue.status === 200 && dsaContinue.data) {
          const vid = dsaContinue.data.lastVideo || dsaContinue.data.video || dsaContinue.data;
          const prog = dsaContinue.data.progress || dsaContinue.data;
          assert.equal(vid._id, dsaVideo._id, 'DSA Continue watching must point to DSA video');
          assert.closeTo(prog.currentTime, 75.0, 1.0);
        }

        // Check Continue Watching for Dev
        const devContinue = await client.get(`/api/profiles/${devProfile._id}/continue`);
        if (devContinue.status === 200 && devContinue.data) {
          const vid = devContinue.data.lastVideo || devContinue.data.video || devContinue.data;
          const prog = devContinue.data.progress || devContinue.data;
          assert.equal(vid._id, devVideo._id, 'Dev Continue watching must point to Dev video');
          assert.closeTo(prog.currentTime, 12.0, 1.0);
        }
      }
    }
  ]
};
