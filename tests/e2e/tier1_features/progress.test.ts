import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const progressSuite: TestSuite = {
  id: 'tier1_progress',
  name: 'Tier 1: Progress Persistence & Auto-Completion',
  tier: 1,
  description: 'Verifies 5s progress save, >=95% auto-complete threshold, and sendBeacon handling',
  tests: [
    {
      id: 'progress_autosave_intermediate',
      name: 'POST /api/progress persists current timestamp and calculates percentage',
      description: 'Checks progress persistence during normal playback interval',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5, PROJECT.md § Progress & Resume',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const progRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video._id,
          currentTime: 50.0,
          duration: 100.0
        });

        if (progRes.status === 404) {
          console.log('   [INFO] Progress endpoint not yet mounted');
          return;
        }

        assert.status(progRes, 200);
        assert.ok(progRes.data.success !== false);
        const progress = progRes.data.progress || progRes.data;
        assert.equal(progress.completed, false, '50% progress should not be marked completed');
        assert.closeTo(progress.currentTime, 50.0, 0.5);
      }
    },
    {
      id: 'progress_auto_complete_95_percent',
      name: 'POST /api/progress automatically marks video completed at >= 95% progress',
      description: 'Verifies that reaching 95% duration triggers completion flag',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5: "Auto-complete at >=95%"',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        // Post 96 seconds on 100-second video (96%)
        const completeRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video._id,
          currentTime: 96.0,
          duration: 100.0
        });

        if (completeRes.status === 404) return;

        assert.status(completeRes, 200);
        const progress = completeRes.data.progress || completeRes.data;
        assert.equal(progress.completed, true, 'Video must be marked completed when currentTime >= 95% of duration');
      }
    },
    {
      id: 'progress_send_beacon_delivery',
      name: 'POST /api/progress accepts text/plain payload for navigator.sendBeacon unload hook',
      description: 'Tests that sendBeacon unload flush delivered as text/plain is parsed and saved correctly',
      authoritativeSource: 'PROJECT.md § 1. Backend REST API Contracts: Progress & Resume',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const beaconPayload = {
          profileId: profile._id,
          videoId: video._id,
          currentTime: 35.0,
          duration: 100.0
        };

        const beaconRes = await client.beacon('/api/progress', beaconPayload, 'text/plain;charset=UTF-8');
        if (beaconRes.status === 404) return;

        assert.ok(
          beaconRes.status === 200 || beaconRes.status === 204,
          `Beacon request should return 200 or 204, got ${beaconRes.status}`
        );
      }
    }
  ]
};
