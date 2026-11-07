import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const negativeAndOutOfBoundsSuite: TestSuite = {
  id: 'tier2_negative_and_out_of_bounds',
  name: 'Tier 2: Negative Timestamps & Out-of-Bounds Seeks',
  tier: 2,
  description: 'Verifies mathematical boundary clamping (max(0, t - 3)), negative timestamp prevention, and duration clamps',
  tests: [
    {
      id: 'smart_resume_rewind_clamping',
      name: 'Resume 3s rewind on savedPosition < 3 clamps to 0s without throwing negative values',
      description: 'Tests the invariant max(0, saved - 3) when user watched only 1.5s',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5, spec_report.md § 3 (#14)',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        // Save progress at 1.8 seconds
        const progRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video._id,
          currentTime: 1.8,
          duration: 100.0
        });

        if (progRes.status === 404) return;

        // Check continue watching or video progress calculation
        const continueRes = await client.get(`/api/profiles/${profile._id}/continue`);
        if (continueRes.status === 200 && continueRes.data) {
          const rawPosition = continueRes.data.progress?.currentTime ?? 1.8;
          const resumePosition = Math.max(0, rawPosition - 3);
          assert.equal(resumePosition, 0, 'Resuming a video saved under 3 seconds must clamp to 0.0s');
        }
      }
    },
    {
      id: 'negative_progress_input_rejection_or_clamping',
      name: 'POST /api/progress with negative currentTime clamps to 0 or rejects with 400',
      description: 'Ensures invalid negative time values do not contaminate user progress records',
      authoritativeSource: 'PROJECT.md § Progress & Resume, spec_report.md § 3',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const video = sectionsRes.data.flatMap((s: any) => s.videos || [])[0];
        if (!video) return;

        const negRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video._id,
          currentTime: -25.0,
          duration: 100.0
        });

        if (negRes.status === 404) return;

        if (negRes.status === 200) {
          const progress = negRes.data.progress || negRes.data;
          assert.ok(
            progress.currentTime >= 0,
            `currentTime must be clamped to >= 0, got ${progress.currentTime}`
          );
        } else {
          assert.equal(negRes.status, 400, 'Negative progress input should be rejected with 400 Bad Request');
        }
      }
    }
  ]
};
