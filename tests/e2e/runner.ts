import * as path from 'path';
import * as fs from 'fs';
import {
  TestSuite,
  TestResult,
  TestContext,
  RunnerOptions,
  RunnerSummary
} from './framework/types';
import { HttpClient } from './framework/client';
import {
  FIXTURES_ROOT,
  MOCK_DSA_PATH,
  MOCK_DEV_PATH,
  MOCK_EDGE_PATH,
  MOCK_RENAME_PATH,
  generateFixtures
} from '../fixtures/generator';

// Tier 1 Suites
import { healthSuite } from './tier1_features/health.test';
import { profilesSuite } from './tier1_features/profiles.test';
import { validatorSuite } from './tier1_features/validator.test';
import { scannerSuite } from './tier1_features/scanner.test';
import { streamingSuite } from './tier1_features/streaming.test';
import { progressSuite } from './tier1_features/progress.test';
import { notesSuite } from './tier1_features/notes.test';
import { bookmarksSuite } from './tier1_features/bookmarks.test';
import { statsSuite } from './tier1_features/stats.test';
import { subtitlesAndResourcesSuite } from './tier1_features/subtitles_and_resources.test';
import { backupSuite } from './tier1_features/backup.test';

// Tier 2 Suites
import { emptyAndMissingPathsSuite } from './tier2_boundaries/empty_and_missing_paths.test';
import { corruptedRangeRequestsSuite } from './tier2_boundaries/corrupted_range_requests.test';
import { rescanAndFileRenamesSuite } from './tier2_boundaries/rescan_and_file_renames.test';
import { negativeAndOutOfBoundsSuite } from './tier2_boundaries/negative_and_out_of_bounds.test';
import { specialCharactersAndNoiseSuite } from './tier2_boundaries/special_characters_and_noise.test';

// Tier 3 Suites
import { crossSectionAutoplaySuite } from './tier3_interactions/cross_section_autoplay.test';
import { autoCompleteAndCourseFinishSuite } from './tier3_interactions/auto_complete_and_course_finish.test';
import { continueWatchingHeroSuite } from './tier3_interactions/continue_watching_hero.test';

// Tier 4 Suites
import { multiVideoStudySessionSuite } from './tier4_workloads/multi_video_study_session.test';
import { noteTakingWhileSeekingSuite } from './tier4_workloads/note_taking_while_seeking.test';
import { profileSwitchingStatePreservationSuite } from './tier4_workloads/profile_switching_state_preservation.test';
import { fullCourseRunthroughSuite } from './tier4_workloads/full_course_runthrough.test';

const ALL_SUITES: TestSuite[] = [
  // Tier 1
  healthSuite,
  profilesSuite,
  validatorSuite,
  scannerSuite,
  streamingSuite,
  progressSuite,
  notesSuite,
  bookmarksSuite,
  statsSuite,
  subtitlesAndResourcesSuite,
  backupSuite,

  // Tier 2
  emptyAndMissingPathsSuite,
  corruptedRangeRequestsSuite,
  rescanAndFileRenamesSuite,
  negativeAndOutOfBoundsSuite,
  specialCharactersAndNoiseSuite,

  // Tier 3
  crossSectionAutoplaySuite,
  autoCompleteAndCourseFinishSuite,
  continueWatchingHeroSuite,

  // Tier 4
  multiVideoStudySessionSuite,
  noteTakingWhileSeekingSuite,
  profileSwitchingStatePreservationSuite,
  fullCourseRunthroughSuite
];

function parseArgs(args: string[]): RunnerOptions {
  const options: RunnerOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tier' && i + 1 < args.length) {
      options.tier = parseInt(args[++i], 10);
    } else if (arg === '--suite' && i + 1 < args.length) {
      options.suite = args[++i].toLowerCase();
    } else if (arg === '--test' && i + 1 < args.length) {
      options.test = args[++i].toLowerCase();
    } else if (arg === '--url' && i + 1 < args.length) {
      options.baseUrl = args[++i];
    } else if (arg === '--bail') {
      options.bail = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.jsonOutput = true;
    }
  }
  return options;
}

export async function runTests(options: RunnerOptions = {}): Promise<RunnerSummary> {
  const baseUrl = options.baseUrl || process.env.TEST_SERVER_URL || 'http://127.0.0.1:4000';
  const client = new HttpClient(baseUrl);

  // Ensure fixtures exist
  if (!fs.existsSync(MOCK_DSA_PATH) || !fs.existsSync(MOCK_DEV_PATH)) {
    console.log('[Runner] Generating mock course fixtures...');
    generateFixtures();
  }

  const ctx: TestContext = {
    baseUrl,
    client,
    fixtures: {
      mockDsa: MOCK_DSA_PATH,
      mockDev: MOCK_DEV_PATH,
      mockEdge: MOCK_EDGE_PATH,
      mockRename: MOCK_RENAME_PATH
    }
  };

  const isReachable = await client.isServerReachable();

  if (!options.jsonOutput) {
    console.log('================================================================');
    console.log('       LOCAL COURSE PLAYER — E2E TEST SUITE RUNNER              ');
    console.log('================================================================');
    console.log(`Target Server:   ${baseUrl} [${isReachable ? 'CONNECTED' : 'OFFLINE / PENDING'}]`);
    console.log(`Fixtures Root:   ${FIXTURES_ROOT}`);
    console.log(`Selected Tier:   ${options.tier ? `Tier ${options.tier}` : 'All Tiers (1 - 4)'}`);
    if (options.suite) console.log(`Selected Suite:  ${options.suite}`);
    console.log('----------------------------------------------------------------\n');
  }

  // Filter suites
  let suites = ALL_SUITES;
  if (options.tier) {
    suites = suites.filter((s) => s.tier === options.tier);
  }
  if (options.suite) {
    suites = suites.filter(
      (s) =>
        s.id.toLowerCase().includes(options.suite!) ||
        s.name.toLowerCase().includes(options.suite!)
    );
  }

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const suite of suites) {
    if (!options.jsonOutput) {
      console.log(`\n▶ [Tier ${suite.tier}] ${suite.name}`);
      console.log(`  Description: ${suite.description}`);
    }

    if (suite.beforeAll) {
      try {
        await suite.beforeAll(ctx);
      } catch (err: any) {
        console.error(`  [ERROR in beforeAll]: ${err.message}`);
      }
    }

    for (const test of suite.tests) {
      if (
        options.test &&
        !test.id.toLowerCase().includes(options.test) &&
        !test.name.toLowerCase().includes(options.test)
      ) {
        continue;
      }

      const tStart = Date.now();
      let status: 'passed' | 'failed' | 'skipped' = 'passed';
      let error: string | undefined;
      let stack: string | undefined;

      try {
        await test.fn(ctx);
      } catch (err: any) {
        status = 'failed';
        error = err.message || String(err);
        stack = err.stack;
      }

      const tDuration = Date.now() - tStart;

      results.push({
        suiteId: suite.id,
        suiteName: suite.name,
        tier: suite.tier,
        testId: test.id,
        testName: test.name,
        authoritativeSource: test.authoritativeSource,
        status,
        durationMs: tDuration,
        error,
        stack
      });

      if (!options.jsonOutput) {
        const badge =
          status === 'passed'
            ? '\x1b[32m✔ PASS\x1b[0m'
            : '\x1b[31m✖ FAIL\x1b[0m';
        console.log(`   ${badge} ${test.name} (${tDuration}ms)`);
        console.log(`     \x1b[90mSource: ${test.authoritativeSource}\x1b[0m`);
        if (error) {
          console.log(`     \x1b[31mError: ${error}\x1b[0m`);
          if (options.verbose && stack) {
            console.log(`     \x1b[90m${stack}\x1b[0m`);
          }
        }
      }

      if (status === 'failed' && options.bail) {
        break;
      }
    }

    if (suite.afterAll) {
      try {
        await suite.afterAll(ctx);
      } catch (err: any) {
        console.error(`  [ERROR in afterAll]: ${err.message}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const passed = results.filter((r) => r.status === 'passed').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const summary: RunnerSummary = {
    total: results.length,
    passed,
    failed,
    skipped,
    durationMs,
    results
  };

  if (options.jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log('\n================================================================');
    console.log('                      TEST EXECUTION SUMMARY                    ');
    console.log('================================================================');
    for (let t = 1; t <= 4; t++) {
      const tierResults = results.filter((r) => r.tier === t);
      if (tierResults.length > 0) {
        const tierPassed = tierResults.filter((r) => r.status === 'passed').length;
        const tierFailed = tierResults.filter((r) => r.status === 'failed').length;
        console.log(
          ` Tier ${t}: ${tierPassed} passed, ${tierFailed} failed out of ${tierResults.length} tests`
        );
      }
    }
    console.log('----------------------------------------------------------------');
    console.log(
      ` TOTAL: ${results.length} tests | \x1b[32m${passed} passed\x1b[0m | \x1b[31m${failed} failed\x1b[0m | ${skipped} skipped (${durationMs}ms)`
    );
    console.log('================================================================\n');
  }

  return summary;
}

// CLI invocation entry
if (require.main === module) {
  const options = parseArgs(process.argv.slice(2));
  runTests(options)
    .then((summary) => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}
