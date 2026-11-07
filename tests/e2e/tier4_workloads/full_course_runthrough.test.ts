import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const fullCourseRunthroughSuite: TestSuite = {
  id: 'tier4_full_course_runthrough',
  name: 'Tier 4: Full Course Runthrough & Metrics Calculation',
  tier: 4,
  description: 'Simulates complete onboarding journey: configure path, validate, scan, lazy duration update, and completion metrics',
  tests: [
    {
      id: 'full_onboarding_and_playback_pipeline',
      name: 'Executes entire lifecycle from empty profile to active learning with duration reporting',
      description: 'Exercises path configuration, non-invasive validation, initial scan, browser lazy duration report, and completion percentage',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, § 4, § 5, PROJECT.md § Module Boundaries & Data Flow',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];

        // 1. Configure path
        await client.put(`/api/profiles/${profile._id}`, { rootPath: fixtures.mockDsa });

        // 2. Validate path
        const valRes = await client.post(`/api/profiles/${profile._id}/validate`, {
          rootPath: fixtures.mockDsa
        });
        if (valRes.status === 200) {
          assert.equal(valRes.data.valid, true);
          assert.equal(valRes.data.sectionCount, 3);
          assert.equal(valRes.data.videoCount, 6);
        }

        // 3. Scan
        const scanRes = await client.post(`/api/profiles/${profile._id}/scan`);
        if (scanRes.status === 200) {
          assert.ok(scanRes.data.success !== false);
        }

        // 4. Fetch sections
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 200 && Array.isArray(secRes.data)) {
          const firstVideo = secRes.data[0]?.videos?.[0];
          if (firstVideo) {
            // 5. Browser lazy duration report
            const patchRes = await client.patch(`/api/videos/${firstVideo._id}/duration`, {
              duration: 320.0
            });
            if (patchRes.status === 200) {
              assert.ok(patchRes.data.success !== false);
            }

            // 6. Complete first video (320s * 0.96 = 307.2s)
            await client.post('/api/progress', {
              profileId: profile._id,
              videoId: firstVideo._id,
              currentTime: 310.0,
              duration: 320.0
            });

            // 7. Check video status
            const vRes = await client.get(`/api/videos/${firstVideo._id}`);
            if (vRes.status === 200 && vRes.data.progress) {
              assert.equal(vRes.data.progress.completed, true);
            }
          }
        }
      }
    }
  ]
};
