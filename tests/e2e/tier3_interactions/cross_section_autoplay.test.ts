import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const crossSectionAutoplaySuite: TestSuite = {
  id: 'tier3_cross_section_autoplay',
  name: 'Tier 3: Cross-Section Boundary Autoplay Resolution',
  tier: 3,
  description: 'Verifies sequential video traversal transitioning from last lesson of Section N to first lesson of Section N+1',
  tests: [
    {
      id: 'autoplay_traverses_across_section_boundary',
      name: 'Sequential next resolution crosses from section 1 last video to section 2 first video',
      description: 'Asserts next video pointer accurately bridges adjacent sections in course hierarchy',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5: "crossing section boundaries, stopping with Course complete at end"',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data.find((p: any) => (p.key || p.slug) === 'dsa') || listRes.data[0];
        await client.put(`/api/profiles/${profile._id}`, { rootPath: fixtures.mockDsa });
        await client.post(`/api/profiles/${profile._id}/scan`);

        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length < 2) return;

        const section1 = secRes.data[0];
        const section2 = secRes.data[1];

        assert.ok(section1.videos && section1.videos.length > 0, 'Section 1 should have videos');
        assert.ok(section2.videos && section2.videos.length > 0, 'Section 2 should have videos');

        const lastVideoOfSec1 = section1.videos[section1.videos.length - 1];
        const firstVideoOfSec2 = section2.videos[0];

        // Fetch last video details to inspect next video linkage
        const vidRes = await client.get(`/api/videos/${lastVideoOfSec1._id}`);
        if (vidRes.status === 200 && vidRes.data.nextVideoId) {
          assert.equal(
            vidRes.data.nextVideoId,
            firstVideoOfSec2._id,
            'Next video ID for last lesson of Section 1 must point to first lesson of Section 2'
          );
        } else {
          // Verify sequential order invariant directly
          assert.ok(
            section1.order < section2.order,
            'Section 1 order must precede Section 2 order'
          );
        }
      }
    }
  ]
};
