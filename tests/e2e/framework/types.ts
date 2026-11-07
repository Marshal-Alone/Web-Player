/**
 * Type definitions for the Local Course Player E2E Test Framework.
 */

export interface TestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  rawBody: Buffer;
}

export interface ApiClient {
  baseUrl: string;
  get(endpoint: string, headers?: Record<string, string>): Promise<TestResponse>;
  post(endpoint: string, body?: any, headers?: Record<string, string>): Promise<TestResponse>;
  put(endpoint: string, body?: any, headers?: Record<string, string>): Promise<TestResponse>;
  patch(endpoint: string, body?: any, headers?: Record<string, string>): Promise<TestResponse>;
  delete(endpoint: string, headers?: Record<string, string>): Promise<TestResponse>;
  stream(endpoint: string, range?: string): Promise<TestResponse>;
  beacon(endpoint: string, payload: any, contentType?: string): Promise<TestResponse>;
  isServerReachable(): Promise<boolean>;
}

export interface TestContext {
  baseUrl: string;
  client: ApiClient;
  fixtures: {
    mockDsa: string;
    mockDev: string;
    mockEdge: string;
    mockRename: string;
  };
}

export type TestFn = (ctx: TestContext) => Promise<void> | void;

export interface TestCase {
  id: string;
  name: string;
  description: string;
  authoritativeSource: string; // e.g. "PROJECT.md § Interface Contracts", "ORIGINAL_REQUEST.md §3"
  fn: TestFn;
}

export interface TestSuite {
  id: string;
  name: string;
  tier: 1 | 2 | 3 | 4;
  description: string;
  beforeAll?: (ctx: TestContext) => Promise<void> | void;
  afterAll?: (ctx: TestContext) => Promise<void> | void;
  tests: TestCase[];
}

export interface TestResult {
  suiteId: string;
  suiteName: string;
  tier: number;
  testId: string;
  testName: string;
  authoritativeSource: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: string;
  stack?: string;
}

export interface RunnerOptions {
  tier?: number;
  suite?: string;
  test?: string;
  baseUrl?: string;
  bail?: boolean;
  verbose?: boolean;
  jsonOutput?: boolean;
}

export interface RunnerSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestResult[];
}
