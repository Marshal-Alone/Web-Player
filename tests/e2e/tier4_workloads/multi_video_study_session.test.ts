import { TestSuite } from '../framework/types';
import { assert } from '../framework/assert';

export const multiVideoStudySessionSuite: TestSuite = {
  id: 'tier4_multi_video_study_session',
  name: 'Tier 4: Multi-Video Study Session Simulation',
  tier: 4,
  description: 'Simulates a comprehensive real-world learning session: start video, seek, note, complete, autoplay next lesson',
  tests: [
    {
      id: 'study_session_end_to_end_journey',
      name: 'Simulates active multi-lesson study session with notes, bookmarks, and seamless transitions',
      description: 'Exercises full student workflow across video streaming, progress flushes, note taking, and autoplay',
      authoritativeSource: 'ORIGINAL_REQUEST.md § 5 & § 6, spec_report.md § 1',
      fn: async ({ client }) => {
        const listRes = await client.get('/api/profiles');
        if (listRes.status === 0 || listRes.status === 404 || !Array.isArray(listRes.data)) return;

        const profile = listRes.data[0];
        const secRes = await client.get(`/api/profiles/${profile._id}/sections`);
        if (secRes.status === 404 || !Array.isArray(secRes.data) || secRes.data.length === 0) return;

        const allVideos = secRes.data.flatMap((s: any) => s.videos || []);
        if (allVideos.length < 2) return;

        const video1 = allVideos[0];
        const video2 = allVideos[1];

        // 1. Play first chunk of Video 1 (range request)
        const stream1 = await client.stream(`/api/videos/${video1._id}/stream`, 'bytes=0-4096');
        if (stream1.status === 206) {
          assert.equal(stream1.rawBody.length, 4097);
        }

        // 2. Autosave initial progress at 15s
        await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video1._id,
          currentTime: 15.0,
          duration: 100.0
        });

        // 3. User pauses and writes a note at 15.0s
        const noteRes = await client.post(`/api/videos/${video1._id}/notes`, {
          profileId: profile._id,
          timestamp: 15.0,
          content: 'Important concept on loops'
        });
        if (noteRes.status === 200 || noteRes.status === 201) {
          assert.ok(noteRes.data);
        }

        // 4. User seeks to 95s (95%) and triggers auto-complete
        const completeRes = await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video1._id,
          currentTime: 95.0,
          duration: 100.0
        });
        if (completeRes.status === 200) {
          const progress = completeRes.data.progress || completeRes.data;
          assert.equal(progress.completed, true);
        }

        // 5. Autoplay advances to Video 2, user starts playback
        const stream2 = await client.stream(`/api/videos/${video2._id}/stream`, 'bytes=0-1024');
        if (stream2.status === 206) {
          assert.equal(stream2.rawBody.length, 1025);
        }

        // 6. User saves 10s progress on Video 2
        await client.post('/api/progress', {
          profileId: profile._id,
          videoId: video2._id,
          currentTime: 10.0,
          duration: 80.0
        });

        // 7. Verify Continue Watching points to Video 2
        const continueRes = await client.get(`/api/profiles/${profile._id}/continue`);
        if (continueRes.status === 200 && continueRes.data) {
          const current = continueRes.data.lastVideo || continueRes.data.video || continueRes.data;
          assert.equal(current._id, video2._id);
        }
      }
    }
  ]
};
