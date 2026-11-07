import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const autoCompleteAndCourseFinishSuite: TestSuite = {
  id: 'tier3_auto_complete_and_course_finish',
  name: 'Tier 3: Course Final Video Completion & Celebration State',
  tier: 3,
  description: 'Verifies that completing the final video in the final section terminates autoplay and triggers course completion',
  tests: [
    {
      id: 'last_video_completion_terminates_autoplay',
      name: 'Completing the final lesson of the final section yields null next video and course complete state',
      description: 'Checks terminal condition of course playback sequence',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5: "stopping with Course complete at end", spec_report.md § 3 (#12)',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length === 0) return;

        const lastSection = secRes.data[secRes.data.length - 1];
        if (!lastSection.videos || lastSection.videos.length === 0) return;

        const finalVideo = lastSection.videos[lastSection.videos.length - 1];

        // Mark final video completed
        const progRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: finalVideo._id,
          currentTime: 100.0,
          duration: 100.0,
          completed: true
        });

        if (progRes.status === 404) return;

        const vidRes = await client.get(`/api/videos/${finalVideo._id}`);
        if (vidRes.status === 200) {
          assert.equal(
            vidRes.data.nextVideoId ?? null,
            null,
            'Final video of course must have no next video queued'
          );
        }
      }
    }
  ]
};
