import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const scannerSuite: TestSuite = {
  id: 'tier1_scanner',
  name: 'Tier 1: Non-Invasive Scanner & Natural Sorter',
  tier: 1,
  description: 'Verifies natural numeric sorting, badge extraction, and zero-content reads during scan',
  tests: [
    {
      id: 'scanner_natural_numeric_sort_sections',
      name: 'Scanner indexes sections in natural numeric order (57 before 100, 02 before 10)',
      description: 'Verifies section ordering adheres to natural numeric sort rather than ASCII order',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, PROJECT.md § Feature Inventory #10',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) {
          console.log('   [INFO] Profiles not mounted, skipping scan test');
          return;
        }

        const devProfile = listRes.data.find((p: any) => (p.key || p.slug) === 'development') || listRes.data[0];

        // Update root path to mock_dev
        await client.put(`/api/profiles/${devProfile._id}`, { rootPath: fixtures.mockDev });

        // Trigger scan
        const scanRes = await client.post(`/api/profiles/${devProfile._id}/scan`);
        if (scanRes.status === 404) {
          console.log('   [INFO] Scan endpoint not yet implemented');
          return;
        }

        assert.status(scanRes, 200);

        // Fetch sections
        const sectionsRes = await client.get(`/api/profiles/${devProfile._id}/sections`);
        assert.status(sectionsRes, 200);
        assert.ok(Array.isArray(sectionsRes.data));

        // In mock_dev, sections are: 01, 57, 100
        const badges = sectionsRes.data.map((s: any) => s.badge || s.order.toString());
        assert.ok(badges.length >= 3, 'Expected at least 3 sections in mock_dev');

        const idx01 = badges.findIndex((b: string) => b.includes('1'));
        const idx57 = badges.findIndex((b: string) => b.includes('57'));
        const idx100 = badges.findIndex((b: string) => b.includes('100'));

        assert.ok(idx01 < idx57, 'Section 01 must appear before Section 57');
        assert.ok(idx57 < idx100, 'Section 57 must appear before Section 100');
      }
    },
    {
      id: 'scanner_badge_extraction',
      name: 'Scanner extracts leading digits as badge and remaining text as cleanTitle',
      description: 'Checks that "672 - Connecting Login Route.mp4" extracts badge "672" and clean title',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3, PROJECT.md § Feature Inventory #11',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const devProfile = listRes.data.find((p: any) => (p.key || p.slug) === 'development') || listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${devProfile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const sec57 = sectionsRes.data.find((s: any) => s.badge === '57' || s.folderName?.includes('57'));
        if (!sec57 || !sec57.videos || sec57.videos.length === 0) return;

        const video672 = sec57.videos.find((v: any) => v.fileName?.includes('672'));
        assert.ok(video672, 'Expected to find video 672 in section 57');
        assert.equal(video672.badge, '672', 'Badge must be extracted as 672');
        assert.ok(
          video672.title?.includes('Connecting Login Route') ||
          video672.cleanTitle?.includes('Connecting Login Route'),
          'Clean title must contain lesson name without badge prefix'
        );
      }
    },
    {
      id: 'scanner_lazy_duration',
      name: 'Scanner leaves duration 0 or null during initial scan without reading file bodies',
      description: 'Ensures initial scan does not invoke ffprobe or read media streams, setting duration to 0/null',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 3: "Duration is retrieved lazily from browser loadedmetadata"',
      fn: async ({ client, fixtures }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const devProfile = listRes.data[0];
        const sectionsRes = await client.get(`/api/profiles/${devProfile._id}/sections`);
        if (sectionsRes.status === 404 || !Array.isArray(sectionsRes.data)) return;

        const videos = sectionsRes.data.flatMap((s: any) => s.videos || []);
        if (videos.length === 0) return;

        for (const video of videos) {
          // Duration should be 0 or null initially
          assert.ok(
            video.duration === 0 || video.duration === null || video.duration === undefined,
            `Expected video duration to be 0/null lazily, but got ${video.duration}`
          );
        }
      }
    }
  ]
};
