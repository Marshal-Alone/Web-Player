import { buildApp } from '../../server/src/app.js';
import { connectDB, disconnectDB, isDbConnected } from '../../server/src/config/db.js';
import { Profile } from '../../server/src/models/Profile.js';
import { Section } from '../../server/src/models/Section.js';
import { Video } from '../../server/src/models/Video.js';
import { Progress } from '../../server/src/models/Progress.js';
import { Note } from '../../server/src/models/Note.js';
import { Bookmark } from '../../server/src/models/Bookmark.js';
import { WatchLog } from '../../server/src/models/WatchLog.js';
import { Setting } from '../../server/src/models/Setting.js';
import { Types } from 'mongoose';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

async function runTest(suite: string, name: string, fn: () => Promise<void>) {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: true, durationMs });
    console.log(`  ✔ [PASS] ${name} (${durationMs}ms)`);
  } catch (err: any) {
    const durationMs = Date.now() - start;
    results.push({ suite, name, passed: false, error: err?.message || String(err), durationMs });
    console.error(`  ✖ [FAIL] ${name} (${durationMs}ms): ${err?.message || err}`);
  }
}

function assert(condition: boolean, msg: string) {
  if (!condition) throw new Error(msg);
}

async function main() {
  console.log('================================================================');
  console.log('       ADVERSARIAL STRESS & INTEGRITY TEST HARNESS (M1)         ');
  console.log('================================================================\n');

  // ============================================================================
  // SUITE 1: Fastify Health & Concurrency Stress
  // ============================================================================
  console.log('▶ Suite 1: Fastify Server Concurrency & HTTP Stress');
  // Silence Fastify internal logger for stress harness to prevent stdout pollution
  const app = buildApp({ logger: false });
  await app.ready();

  await runTest('Fastify Stress', '500 concurrent requests to /api/health', async () => {
    const concurrency = 500;
    const promises = Array.from({ length: concurrency }, () =>
      app.inject({ method: 'GET', url: '/api/health' })
    );
    const responses = await Promise.all(promises);
    assert(responses.length === concurrency, `Expected ${concurrency} responses`);
    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      assert(res.statusCode === 200, `Request ${i} returned status ${res.statusCode}`);
      const body = JSON.parse(res.body);
      assert(body.status === 'ok', `Request ${i} body status not 'ok'`);
      assert(typeof body.uptime === 'number' && body.uptime >= 0, `Invalid uptime`);
      assert(typeof body.dbConnected === 'boolean', `Invalid dbConnected`);
    }
  });

  await runTest('Fastify Stress', 'HTTP verb matrix on /api/health (POST, PUT, DELETE, PATCH return 404)', async () => {
    const invalidVerbs: Array<'POST' | 'PUT' | 'DELETE' | 'PATCH'> = ['POST', 'PUT', 'DELETE', 'PATCH'];
    for (const method of invalidVerbs) {
      const res = await app.inject({ method, url: '/api/health' });
      assert(res.statusCode === 404, `Method ${method} expected 404 but got ${res.statusCode}`);
    }
  });

  await runTest('Fastify Stress', 'Malformed / edge-case query parameters and headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health?query=malicious%22%3Bdrop%20table%3B--&long=' + 'A'.repeat(500),
      headers: {
        'x-custom-stress': 'B'.repeat(1000)
      }
    });
    assert(res.statusCode === 200, `Expected 200 on query stress, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.status === 'ok', 'Status was not ok');
  });

  await runTest('Fastify Stress', 'CORS headers present on preflight and GET request', async () => {
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/health',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET'
      }
    });
    assert(preflight.statusCode === 204, `Preflight returned status ${preflight.statusCode}`);
    assert(
      preflight.headers['access-control-allow-origin'] === 'http://localhost:5173',
      `CORS origin mismatch`
    );

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'http://localhost:5173' }
    });
    assert(
      getRes.headers['access-control-allow-origin'] === 'http://localhost:5173',
      `GET CORS origin mismatch`
    );
  });

  await runTest('Fastify Stress', 'Global error handler formatting', async () => {
    const testApp = buildApp({ logger: false });
    testApp.get('/api/test-failure', async () => {
      throw new Error('Simulated fault injection');
    });
    await testApp.ready();
    const res = await testApp.inject({ method: 'GET', url: '/api/test-failure' });
    assert(res.statusCode === 500, `Expected 500, got ${res.statusCode}`);
    const body = JSON.parse(res.body);
    assert(body.statusCode === 500, `Body statusCode not 500`);
    assert(body.message === 'Simulated fault injection', `Message mismatch: ${body.message}`);
    assert(body.error === 'Error' || body.error === 'InternalServerError', `Unexpected error name: ${body.error}`);
    await testApp.close();
  });

  await app.close();

  // ============================================================================
  // SUITE 2: Mongoose Schema Validation Adversarial Harness
  // ============================================================================
  console.log('\n▶ Suite 2: Mongoose Schema Validator Rejections & Boundary Tests');

  await runTest('Schema Validation', 'Profile: rejects missing key, missing name, invalid enum; checks defaults', async () => {
    const invalidProfile1 = new Profile({});
    let err = invalidProfile1.validateSync();
    assert(!!err && !!err.errors['key'], 'Expected key validation error');
    assert(!!err && !!err.errors['name'], 'Expected name validation error');

    const invalidProfile2 = new Profile({ key: 'invalid_key' as any, name: 'Test' });
    err = invalidProfile2.validateSync();
    assert(!!err && !!err.errors['key'], 'Expected enum rejection on key');

    const validProfile = new Profile({ key: 'dsa', name: 'DSA Course' });
    err = validProfile.validateSync();
    assert(!err, `Expected valid profile, got error: ${err?.message}`);
    assert(validProfile.rootPath === '', 'Default rootPath should be empty string');
    assert(validProfile.order === 0, 'Default order should be 0');
    assert(validProfile.stats.totalSections === 0, 'Default totalSections should be 0');
    assert(validProfile.stats.totalVideos === 0, 'Default totalVideos should be 0');
  });

  await runTest('Schema Validation', 'Section: rejects missing required fields and verifies defaults', async () => {
    const invalidSection = new Section({});
    let err = invalidSection.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['name'], 'Expected name error');
    assert(!!err.errors['folderName'], 'Expected folderName error');
    assert(!!err.errors['order'], 'Expected order error');
    assert(!!err.errors['relPath'], 'Expected relPath error');

    const validSection = new Section({
      profileId: new Types.ObjectId(),
      name: '01. Introduction',
      folderName: '01. Introduction',
      order: 1,
      relPath: '01. Introduction'
    });
    err = validSection.validateSync();
    assert(!err, `Expected valid section, got error: ${err?.message}`);
    assert(validSection.badge === '', 'Default badge should be empty string');
    assert(validSection.videoCount === 0, 'Default videoCount should be 0');
    assert(validSection.totalDuration === 0, 'Default totalDuration should be 0');
  });

  await runTest('Schema Validation', 'Video: rejects missing fields, type errors, verifies defaults', async () => {
    const invalidVideo = new Video({});
    let err = invalidVideo.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['sectionId'], 'Expected sectionId error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['title'], 'Expected title error');
    assert(!!err.errors['fileName'], 'Expected fileName error');
    assert(!!err.errors['relPath'], 'Expected relPath error');
    assert(!!err.errors['fullPath'], 'Expected fullPath error');
    assert(!!err.errors['order'], 'Expected order error');
    assert(!!err.errors['size'], 'Expected size error');
    assert(!!err.errors['mtime'], 'Expected mtime error');

    // Type error test
    const typeErrorVideo = new Video({
      sectionId: new Types.ObjectId(),
      profileId: new Types.ObjectId(),
      title: 'Intro',
      fileName: '01.mp4',
      relPath: 'sec/01.mp4',
      fullPath: '/path/sec/01.mp4',
      order: 'not-a-number' as any,
      size: 'bad-size' as any,
      mtime: 'not-a-date' as any
    });
    err = typeErrorVideo.validateSync();
    assert(!!err && !!err.errors['order'], 'Expected CastError on order');
    assert(!!err && !!err.errors['size'], 'Expected CastError on size');
    assert(!!err && !!err.errors['mtime'], 'Expected CastError on mtime');

    const validVideo = new Video({
      sectionId: new Types.ObjectId(),
      profileId: new Types.ObjectId(),
      title: '01 - Welcome',
      fileName: '01 - Welcome.mp4',
      relPath: '01. Intro/01 - Welcome.mp4',
      fullPath: 'G:\\Drive\\01. Intro\\01 - Welcome.mp4',
      order: 1,
      size: 1048576,
      mtime: new Date()
    });
    err = validVideo.validateSync();
    assert(!err, `Expected valid video, got error: ${err?.message}`);
    assert(validVideo.duration === null, 'Default duration should be null');
    assert(validVideo.missing === false, 'Default missing should be false');
    assert(validVideo.hasSubtitles === false, 'Default hasSubtitles should be false');
    assert(validVideo.badge === '', 'Default badge should be empty string');
  });

  await runTest('Schema Validation', 'Progress: rejects missing profileId & videoId, asserts defaults', async () => {
    const invalidProgress = new Progress({});
    let err = invalidProgress.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['videoId'], 'Expected videoId error');

    const validProgress = new Progress({
      profileId: new Types.ObjectId(),
      videoId: new Types.ObjectId()
    });
    err = validProgress.validateSync();
    assert(!err, `Expected valid progress, got error: ${err?.message}`);
    assert(validProgress.currentTime === 0, 'Default currentTime should be 0');
    assert(validProgress.duration === 0, 'Default duration should be 0');
    assert(validProgress.completed === false, 'Default completed should be false');
    assert(validProgress.lastWatched instanceof Date, 'Default lastWatched should be a Date');
  });

  await runTest('Schema Validation', 'Note: rejects missing videoId, profileId, timestamp, content', async () => {
    const invalidNote = new Note({});
    let err = invalidNote.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['videoId'], 'Expected videoId error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['timestamp'], 'Expected timestamp error');
    assert(!!err.errors['content'], 'Expected content error');
  });

  await runTest('Schema Validation', 'Bookmark: rejects missing videoId, profileId, timestamp; defaults title to empty string', async () => {
    const invalidBookmark = new Bookmark({});
    let err = invalidBookmark.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['videoId'], 'Expected videoId error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['timestamp'], 'Expected timestamp error');

    const validBookmark = new Bookmark({
      videoId: new Types.ObjectId(),
      profileId: new Types.ObjectId(),
      timestamp: 120
    });
    err = validBookmark.validateSync();
    assert(!err, `Expected valid bookmark, got error: ${err?.message}`);
    assert(validBookmark.title === '', 'Bookmark title should default to empty string');
  });

  await runTest('Schema Validation', 'WatchLog: rejects missing profileId, videoId; defaults secondsWatched to 0, watchedAt to now', async () => {
    const invalidWatchLog = new WatchLog({});
    let err = invalidWatchLog.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['profileId'], 'Expected profileId error');
    assert(!!err.errors['videoId'], 'Expected videoId error');

    const validWatchLog = new WatchLog({
      profileId: new Types.ObjectId(),
      videoId: new Types.ObjectId()
    });
    err = validWatchLog.validateSync();
    assert(!err, `Expected valid watchlog, got error: ${err?.message}`);
    assert(validWatchLog.secondsWatched === 0, 'secondsWatched should default to 0');
    assert(validWatchLog.watchedAt instanceof Date, 'watchedAt should default to Date');
  });

  await runTest('Schema Validation', 'Setting: rejects missing key and missing value', async () => {
    const invalidSetting = new Setting({});
    let err = invalidSetting.validateSync();
    assert(!!err, 'Expected validation error');
    assert(!!err.errors['key'], 'Expected key error');
    assert(!!err.errors['value'], 'Expected value error');
  });

  // ============================================================================
  // SUITE 3: MongoDB Atlas Live Connection & Unique Compound Index Integrity
  // ============================================================================
  console.log('\n▶ Suite 3: MongoDB Atlas Compound Unique Index Constraint');

  await runTest('Database & Indexes', 'Connect to MongoDB Atlas and verify connection state', async () => {
    await connectDB();
    assert(isDbConnected(), 'Database should report isDbConnected() === true');
  });

  await runTest('Database & Indexes', 'Progress schema index declaration contains compound unique index', async () => {
    const indexes = Progress.schema.indexes();
    const compoundUnique = indexes.find((idx: any) => {
      const fields = idx[0];
      const options = idx[1];
      return fields.profileId === 1 && fields.videoId === 1 && options?.unique === true;
    });
    assert(!!compoundUnique, 'Compound unique index { profileId: 1, videoId: 1 } must exist in Progress schema');
  });

  await runTest('Database & Indexes', 'Empirical Atlas constraint: duplicate (profileId, videoId) throws E11000', async () => {
    // Sync indexes to ensure MongoDB has created the unique constraint
    await Progress.syncIndexes();

    const testProfileId = new Types.ObjectId();
    const testVideoId = new Types.ObjectId();

    // Insert first progress document
    const doc1 = await Progress.create({
      profileId: testProfileId,
      videoId: testVideoId,
      currentTime: 10,
      duration: 100,
      completed: false
    });
    assert(!!doc1._id, 'First document should be successfully created');

    // Attempt inserting duplicate document with identical profileId and videoId
    let duplicateRejected = false;
    let errorCode: any = null;
    try {
      await Progress.create({
        profileId: testProfileId,
        videoId: testVideoId,
        currentTime: 20,
        duration: 100,
        completed: false
      });
    } catch (err: any) {
      duplicateRejected = true;
      errorCode = err?.code;
    } finally {
      // Clean up test document
      await Progress.deleteMany({ profileId: testProfileId });
    }

    assert(duplicateRejected, 'Duplicate progress record should have thrown an error');
    assert(errorCode === 11000, `Expected MongoDB duplicate key error code 11000, got: ${errorCode}`);
  });

  await runTest('Database & Indexes', 'Profile key uniqueness: duplicate key throws E11000', async () => {
    await Profile.syncIndexes();

    // Check if dsa already exists
    const existing = await Profile.findOne({ key: 'dsa' });
    if (!existing) {
      await Profile.create({ key: 'dsa', name: 'DSA Test' });
    }

    let duplicateRejected = false;
    let errorCode: any = null;
    try {
      await Profile.create({ key: 'dsa', name: 'Duplicate DSA' });
    } catch (err: any) {
      duplicateRejected = true;
      errorCode = err?.code;
    }

    assert(duplicateRejected, 'Duplicate profile key should have thrown an error');
    assert(errorCode === 11000, `Expected MongoDB duplicate key error code 11000, got: ${errorCode}`);
  });

  await runTest('Database & Indexes', 'Disconnect MongoDB cleanly and verify disconnection state', async () => {
    await disconnectDB();
    assert(!isDbConnected(), 'isDbConnected() should return false after disconnect');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log('                 ADVERSARIAL TEST SUMMARY                       ');
  console.log('================================================================');
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  console.log(` TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('Unhandled fatal error in adversarial test harness:', err);
  process.exit(1);
});
