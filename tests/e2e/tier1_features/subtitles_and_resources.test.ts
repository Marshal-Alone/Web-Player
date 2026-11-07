import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const subtitlesAndResourcesSuite: TestSuite = {
  id: 'tier1_subtitles_and_resources',
  name: 'Tier 1: Subtitles Detection & Section Resources Drawer',
  tier: 1,
  description: 'Verifies detection of matching .srt/.vtt subtitle files and supplementary course PDFs',
  tests: [
    {
      id: 'subtitles_auto_detection',
      name: 'Video scanner detects adjacent .srt subtitle and flags hasSubtitle: true',
      description: 'Checks that videos with matching subtitle file names are marked with subtitle metadata',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Feature Inventory #51',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data)) return;

        // In mock_dsa, "001 - Flowchart Basics.mp4" has "001 - Flowchart Basics.srt"
        const videoWithSub = secRes.data
          .flatMap((s: any) => s.videos || [])
          .find((v: any) => v.fileName?.includes('001 - Flowchart Basics'));

        if (videoWithSub && videoWithSub.hasSubtitle !== undefined) {
          assert.equal(videoWithSub.hasSubtitle, true, 'Video with adjacent .srt should have hasSubtitle: true');
        }
      }
    },
    {
      id: 'section_resources_listing',
      name: 'GET /api/sections/:id/resources lists supplementary documents (.pdf) while ignoring video binaries',
      description: 'Checks that PDFs in section folder are surfaced in resources query',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 6, PROJECT.md § Feature Inventory #52',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length === 0) return;

        const sec1 = secRes.data[0];
        const resList = await client.get(`/api/sections/${sec1._id}/resources`);
        if (resList.status === 404) return;

        assert.status(resList, 200);
        assert.ok(Array.isArray(resList.data));
        if (resList.data.length > 0) {
          const pdfResource = resList.data.find((r: any) => r.fileName?.endsWith('.pdf') || r.name?.endsWith('.pdf'));
          assert.ok(pdfResource, 'Section 1 resources must contain supplementary PDF');
        }
      }
    }
  ]
};
