/**
 * k6 Smoke Test — 10 concurrent users, 1 minute
 *
 * Simulates light traffic to validate API availability and basic performance
 * before running full load tests. Runs on every PR in CI.
 *
 * Usage:
 *   k6 run tests/load/k6-smoke.js
 *   k6 run -e BASE_URL=http://localhost:3001 tests/load/k6-smoke.js
 *
 * Performance budgets:
 *   - p95 latency < 500ms
 *   - error rate < 1%
 *   - throughput > 50 req/s
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_DATA_PATH = __ENV.TEST_DATA_PATH || './test-data.json';

// Custom metrics
const courseBrowsingDuration = new Trend('course_browsing_duration', true);
const credentialVerificationDuration = new Trend('credential_verification_duration', true);
const enrollmentDuration = new Trend('enrollment_duration', true);
const errorRate = new Rate('errors');

// ---------------------------------------------------------------------------
// Test data (loaded once, shared across VUs)
// ---------------------------------------------------------------------------

let testData = { courseIds: [], credentialIds: [], userIds: [] };

try {
  const rawData = new SharedArray('testData', function () {
    // k6 SharedArray expects a function returning an array
    // We wrap our JSON so it works even if file is missing
    try {
      const data = JSON.parse(open(TEST_DATA_PATH));
      return [data];
    } catch {
      return [{ courseIds: ['test-course-1'], credentialIds: ['test-cred-1'], userIds: ['test-user-1'] }];
    }
  });
  testData = rawData[0];
} catch {
  // Fallback IDs if test-data.json doesn't exist
  testData = {
    courseIds: ['00000000-0000-0000-0000-000000000001'],
    credentialIds: ['00000000-0000-0000-0000-000000000001'],
    userIds: ['00000000-0000-0000-0000-000000000001'],
  };
}

function randomItem(arr) {
  if (!arr || arr.length === 0) return 'unknown';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options = {
  scenarios: {
    smoke_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 5 },
        { duration: '20s', target: 10 },
        { duration: '20s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },

  thresholds: {
    // Overall thresholds
    http_req_duration: ['p(95)<500', 'p(50)<200'],
    http_req_failed: ['rate<0.01'],
    http_reqs: ['rate>50'],

    // Per-scenario thresholds
    course_browsing_duration: ['p(95)<400'],
    credential_verification_duration: ['p(95)<500'],
    enrollment_duration: ['p(95)<600'],
    errors: ['rate<0.01'],
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

const params = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: '10s',
};

function courseBrowsing() {
  group('Course Browsing', () => {
    // 1. Health check
    const healthRes = http.get(`${BASE_URL}/api/health`, params);
    check(healthRes, {
      'health: status is 200': (r) => r.status === 200,
      'health: response time < 200ms': (r) => r.timings.duration < 200,
    });
    courseBrowsingDuration.add(healthRes.timings.duration);
    errorRate.add(healthRes.status !== 200);

    sleep(Math.random() * 0.5 + 0.2);

    // 2. Analytics overview (course listing proxy)
    const overviewRes = http.get(`${BASE_URL}/api/analytics/overview`, params);
    check(overviewRes, {
      'analytics overview: status 200': (r) => r.status === 200,
      'analytics overview: has body': (r) => r.body && r.body.length > 0,
    });
    courseBrowsingDuration.add(overviewRes.timings.duration);
    errorRate.add(overviewRes.status !== 200);

    sleep(Math.random() * 0.5 + 0.2);

    // 3. Course analytics
    const coursesRes = http.get(`${BASE_URL}/api/analytics/courses`, params);
    check(coursesRes, {
      'courses: status 200': (r) => r.status === 200,
    });
    courseBrowsingDuration.add(coursesRes.timings.duration);
    errorRate.add(coursesRes.status !== 200);

    sleep(Math.random() * 0.5 + 0.2);

    // 4. Engagement metrics
    const engagementRes = http.get(`${BASE_URL}/api/analytics/engagement`, params);
    check(engagementRes, {
      'engagement: status 200': (r) => r.status === 200,
    });
    courseBrowsingDuration.add(engagementRes.timings.duration);
    errorRate.add(engagementRes.status !== 200);
  });
}

function credentialVerification() {
  group('Credential Verification', () => {
    const credentialId = randomItem(testData.credentialIds);

    // 1. Get credential status
    const statusRes = http.get(`${BASE_URL}/api/time-lock/${credentialId}/status`, params);
    check(statusRes, {
      'credential status: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    credentialVerificationDuration.add(statusRes.timings.duration);
    errorRate.add(statusRes.status >= 500);

    sleep(Math.random() * 0.5 + 0.3);

    // 2. Get credential details
    const credRes = http.get(`${BASE_URL}/api/time-lock/${credentialId}`, params);
    check(credRes, {
      'credential get: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    credentialVerificationDuration.add(credRes.timings.duration);
    errorRate.add(credRes.status >= 500);
  });
}

function enrollment() {
  group('Enrollment', () => {
    const userId = randomItem(testData.userIds);
    const courseId = randomItem(testData.courseIds);

    const payload = JSON.stringify({
      userId,
      courseId,
      timestamp: new Date().toISOString(),
      source: 'load-test',
    });

    const enrollRes = http.post(`${BASE_URL}/api/events/course-enrollment`, payload, {
      ...params,
      headers: { ...params.headers },
    });

    check(enrollRes, {
      'enrollment: status 2xx or 4xx': (r) => r.status >= 200 && r.status < 500,
    });
    enrollmentDuration.add(enrollRes.timings.duration);
    errorRate.add(enrollRes.status >= 500);
  });
}

// ---------------------------------------------------------------------------
// Default function — weighted scenario distribution
// ---------------------------------------------------------------------------

export default function () {
  const roll = Math.random() * 100;

  if (roll < 80) {
    courseBrowsing();
  } else if (roll < 95) {
    credentialVerification();
  } else {
    enrollment();
  }

  // Small pause between iterations
  sleep(Math.random() * 1 + 0.5);
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

export function setup() {
  // Verify target is reachable
  const res = http.get(`${BASE_URL}/api/health`, { timeout: '5s' });
  if (res.status !== 200) {
    console.warn(`WARNING: Target ${BASE_URL} health check returned ${res.status}`);
  }
  return { startTime: new Date().toISOString() };
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: '  ', enableColors: true }),
    'tests/load/results/smoke-results.json': JSON.stringify(data, null, 2),
  };
}

// Simple text summary fallback
function textSummary(data, opts) {
  const metrics = data.metrics || {};
  const lines = ['\n=== Smoke Test Results ==='];

  if (metrics.http_req_duration) {
    const values = metrics.http_req_duration.values;
    lines.push(`  HTTP Request Duration:`);
    lines.push(`    avg: ${values.avg?.toFixed(1)}ms`);
    lines.push(`    p(50): ${values['p(50)']?.toFixed(1)}ms`);
    lines.push(`    p(95): ${values['p(95)']?.toFixed(1)}ms`);
    lines.push(`    p(99): ${values['p(99)']?.toFixed(1)}ms`);
  }

  if (metrics.http_req_failed) {
    lines.push(`  Error Rate: ${(metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  }

  if (metrics.http_reqs) {
    lines.push(`  Total Requests: ${metrics.http_reqs.values.count}`);
    lines.push(`  Throughput: ${metrics.http_reqs.values.rate?.toFixed(1)} req/s`);
  }

  lines.push('========================\n');
  return lines.join('\n');
}
