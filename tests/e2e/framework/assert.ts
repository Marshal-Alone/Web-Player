import { TestResponse } from './types';

export class AssertionError extends Error {
  actual: any;
  expected: any;

  constructor(message: string, actual?: any, expected?: any) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export const assert = {
  ok(value: any, message?: string): void {
    if (!value) {
      throw new AssertionError(
        message || `Expected truthy value, but received: ${JSON.stringify(value)}`,
        value,
        true
      );
    }
  },

  equal(actual: any, expected: any, message?: string): void {
    if (actual !== expected) {
      throw new AssertionError(
        message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
        actual,
        expected
      );
    }
  },

  notEqual(actual: any, expected: any, message?: string): void {
    if (actual === expected) {
      throw new AssertionError(
        message || `Expected values not to equal: ${JSON.stringify(actual)}`,
        actual,
        expected
      );
    }
  },

  deepEqual(actual: any, expected: any, message?: string): void {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      throw new AssertionError(
        message || `Deep equality mismatch.\nExpected: ${expStr}\nReceived: ${actStr}`,
        actual,
        expected
      );
    }
  },

  status(res: TestResponse, expectedStatus: number, message?: string): void {
    if (res.status !== expectedStatus) {
      const bodySnippet =
        typeof res.data === 'object' ? JSON.stringify(res.data) : (res.rawBody?.toString().slice(0, 200) || '');
      throw new AssertionError(
        message ||
          `Expected HTTP status ${expectedStatus}, but got ${res.status} (${res.statusText}).\nResponse body: ${bodySnippet}`,
        res.status,
        expectedStatus
      );
    }
  },

  hasHeader(res: TestResponse, headerKey: string, expectedVal?: string | RegExp): void {
    const keyLower = headerKey.toLowerCase();
    const actualVal = res.headers[keyLower];
    if (actualVal === undefined) {
      throw new AssertionError(
        `Expected header '${headerKey}' to be present in response headers: ${JSON.stringify(res.headers)}`,
        undefined,
        headerKey
      );
    }
    if (expectedVal !== undefined) {
      if (expectedVal instanceof RegExp) {
        if (!expectedVal.test(actualVal)) {
          throw new AssertionError(
            `Header '${headerKey}' (${actualVal}) did not match expected regex: ${expectedVal}`,
            actualVal,
            expectedVal.toString()
          );
        }
      } else if (actualVal.toLowerCase() !== expectedVal.toLowerCase()) {
        throw new AssertionError(
          `Header '${headerKey}' value mismatch. Expected '${expectedVal}', got '${actualVal}'`,
          actualVal,
          expectedVal
        );
      }
    }
  },

  rangeHeader(res: TestResponse, expected: { start: number; end: number; total: number }): void {
    const contentRange = res.headers['content-range'];
    if (!contentRange) {
      throw new AssertionError(
        `Expected 'Content-Range' header on partial content response, but none found. Headers: ${JSON.stringify(res.headers)}`,
        undefined,
        'Content-Range'
      );
    }
    const expectedStr = `bytes ${expected.start}-${expected.end}/${expected.total}`;
    if (contentRange !== expectedStr) {
      throw new AssertionError(
        `Content-Range header mismatch. Expected '${expectedStr}', received '${contentRange}'`,
        contentRange,
        expectedStr
      );
    }
  },

  schema(obj: any, requiredFields: string[], message?: string): void {
    if (!obj || typeof obj !== 'object') {
      throw new AssertionError(
        message || `Expected an object for schema check, got: ${typeof obj}`,
        obj,
        'object'
      );
    }
    for (const field of requiredFields) {
      if (!(field in obj) || obj[field] === undefined) {
        throw new AssertionError(
          message || `Schema missing required field '${field}'. Keys present: ${Object.keys(obj).join(', ')}`,
          Object.keys(obj),
          requiredFields
        );
      }
    }
  },

  closeTo(actual: number, expected: number, delta: number = 0.01, message?: string): void {
    if (Math.abs(actual - expected) > delta) {
      throw new AssertionError(
        message || `Expected ${actual} to be within ${delta} of ${expected}`,
        actual,
        expected
      );
    }
  },

  isSorted<T>(arr: T[], compareFn: (a: T, b: T) => number, message?: string): void {
    for (let i = 0; i < arr.length - 1; i++) {
      if (compareFn(arr[i], arr[i + 1]) > 0) {
        throw new AssertionError(
          message ||
            `Array is not sorted at index ${i}: [${JSON.stringify(arr[i])}] should precede [${JSON.stringify(arr[i + 1])}]`,
          arr[i],
          arr[i + 1]
        );
      }
    }
  }
};
