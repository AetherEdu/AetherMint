/**
 * k6 Full Load Test — 100 concurrent users, 5 minutes
 *
 * Simulates realistic production traffic with weighted scenario distribution:
 *   - Course browsing: 80% (read-heavy)
 *   - Credential verification: 15%
 *   - Enrollment: 5%
 *
 * Runs on merge to main against staging environment.
 *
 * Usage:
 *   k6 run tests/load/k6-full.js
 *   k6 run -e BASE_URL=https://staging.aethermint.io tests/load/k6-full.js
 *
 * Performance budgets:
 *   - p95 latency < 500ms
 *   - error rate < 1%
 *   - throughput > 50 req/s
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
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
const courseBrowsingErrors = new Rate('course_browsing_errors');
const credentialVerificationErrors = new Rate('credential_verification_errors');
const enrollmentErrors = new Rate('enrollment_errors');
const totalRequests = new Counter('total_requests');
const scenarioCounters = {
  courseBrowsing: new Counter('scenario_course_browsing'),
  credentialVerification: new Counter('scenario_credential_verification'),
  enrollment: new Counter('scenario_enrollment'),
};

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

let testData = { courseIds: [], credentialIds: [], userIds: [] };

try {
  const rawData = new SharedArray('testData', function () {
    try {
      const data = JSON.parse(open(TEST_DATA_PATH));
      return [data];
    } catch {
      return [{ courseIds: ['test-course-1'], credentialIds: ['test-cred-1'], userIds: ['test-user-1'] }];
    }
  });
  testData = rawData[0];
} catch {
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
    full_load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        // Warm-up: ramp to 20 users over 1 minute
        { duration: '60s', target: 20 },
        // Ramp-up: increase to 80 users over 2 minutes
        { duration: '120s', target: 80 },
        // Peak: reach 100 users over 1 minute
        { duration: '60s', target: 100 },
        // Sustain: hold 100 users for 30 seconds
        { duration: '30s', target: 100 },
        // Cool-down: ramp down to 0 over 30 seconds
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '15s',
    },
  },

  thresholds: {
    // Global thresholds — performance budgets
    http_req_duration: [
      'p(50)<200',   // Median latency under 200ms
      'p(95)<500',   // 95th percentile under 500ms
      'p(99)<1000',  // 99th percentile under 1s
    ],
    http_req_failed: ['rate<0.01'],  // Error rate under 1%
    http_reqs: ['rate>50'],          // Throughput above 50 req/s

    // Per-scenario thresholds
    course_browsing_duration: ['p(95)<400', 'p(50)<150'],
    credential_verification_duration: ['p(95)<500', 'p(50)<200'],
    enrollment_duration: ['p(95)<600', 'p(50)<250'],

    // Error rates per scenario
    course_browsing_errors: ['rate<0.005'],
    credential_verification_errors: ['rate<0.01'],
    enrollment_errors: ['rate<0.02'],
  },
};

// ---------------------------------------------------------------------------
// HTTP params
// ---------------------------------------------------------------------------

const params = {
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: '15s',
};

// ---------------------------------------------------------------------------
// Scenario: Course Browsing (80%)
// ---------------------------------------------------------------------------

function courseBrowsing() {
  scenarioCounters.courseBrowsing.add(1);

  group('01_Course_Browsing', () => {
    // 1. Health check (lightweight)
    const healthRes = http.get(`${BASE_URL}/api/health`, params);
    check(healthRes, {
      'health: status 200': (r) => r.status === 200,
      'health: latency < 100ms': (r) => r.timings.duration < 100,
    });
    courseBrowsingDuration.add(healthRes.timings.duration);
    courseBrowsingErrors.add(healthRes.status !== 200);
    totalRequests.add(1);

    sleep(Math.random() * 0.3 + 0.1);

    // 2. Analytics overview
    const overviewRes = http.get(`${BASE_URL}/api/analytics/overview`, params);
    check(overviewRes, {
      'overview: status 200': (r) => r.status === 200,
      'overview: has body': (r) => r.body && r.body.length > 0,
      'overview: latency < 400ms': (r) => r.timings.duration < 400,
    });
    courseBrowsingDuration.add(overviewRes.timings.duration);
    courseBrowsingErrors.add(overviewRes.status !== 200);
    totalRequests.add(1);

    sleep(Math.random() * 0.3 + 0.1);

    // 3. Course analytics listing
    const coursesRes = http.get(`${BASE_URL}/api/analytics/courses`, params);
    check(coursesRes, {
      'courses: status 200': (r) => r.status === 200,
      'courses: latency < 400ms': (r) => r.timings.duration < 400,
    });
    courseBrowsingDuration.add(coursesRes.timings.duration);
    courseBrowsingErrors.add(coursesRes.status !== 200);
    totalRequests.add(1);

    sleep(Math.random() * 0.3 + 0.1);

    // 4. User analytics
    const usersRes = http.get(`${BASE_URL}/api/analytics/users`, params);
    check(usersRes, {
      'users: status 200': (r) => r.status === 200,
    });
    courseBrowsingDuration.add(usersRes.timings.duration);
    courseBrowsingErrors.add(usersRes.status !== 200);
    totalRequests.add(1);

    sleep(Math.random() * 0.3 + 0.1);

    // 5. Engagement metrics
    const engagementRes = http.get(`${BASE_URL}/api/analytics/engagement`, params);
    check(engagementRes, {
      'engagement: status 200': (r) => r.status === 200,
    });
    courseBrowsingDuration.add(engagementRes.timings.duration);
    courseBrowsingErrors.add(engagementRes.status !== 200);
    totalRequests.add(1);

    sleep(Math.random() * 0.3 + 0.1);

    // 6. Performance metrics
    const perfRes = http.get(`${BASE_URL}/api/analytics/performance`, params);
    check(perfRes, {
      'performance: status 200': (r) => r.status === 200,
    });
    courseBrowsingDuration.add(perfRes.timings.duration);
    courseBrowsingErrors.add(perfRes.status !== 200);
    totalRequests.add(1);
  });
}

// ---------------------------------------------------------------------------
// Scenario: Credential Verification (15%)
// ---------------------------------------------------------------------------

function credentialVerification() {
  scenarioCounters.credentialVerification.add(1);

  group('02_Credential_Verification', () => {
    const credentialId = randomItem(testData.credentialIds);

    // 1. Get credential by ID
    const credRes = http.get(`${BASE_URL}/api/time-lock/${credentialId}`, params);
    check(credRes, {
      'credential: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      'credential: no 5xx': (r) => r.status < 500,
    });
    credentialVerificationDuration.add(credRes.timings.duration);
    credentialVerificationErrors.add(credRes.status >= 500);
    totalRequests.add(1);

    sleep(Math.random() * 0.5 + 0.2);

    // 2. Get credential status
    const statusRes = http.get(`${BASE_URL}/api/time-lock/${credentialId}/status`, params);
    check(statusRes, {
      'status: status 200 or 404': (r) => r.status === 200 || r.status === 404,
      'status: no 5xx': (r) => r.status < 500,
    });
    credentialVerificationDuration.add(statusRes.timings.duration);
    credentialVerificationErrors.add(statusRes.status >= 500);
    totalRequests.add(1);

    sleep(Math.random() * 0.5 + 0.2);

    // 3. Smart wallet credential stats (related read)
    const walletRes = http.get(`${BASE_URL}/api/smart-wallet/credentials/stats`, params);
    check(walletRes, {
      'wallet stats: status < 500': (r) => r.status < 500,
    });
    credentialVerificationDuration.add(walletRes.timings.duration);
    credentialVerificationErrors.add(walletRes.status >= 500);
    totalRequests.add(1);
  });
}

// ---------------------------------------------------------------------------
// Scenario: Enrollment (5%)
// ---------------------------------------------------------------------------

function enrollment() {
  scenarioCounters.enrollment.add(1);

  group('03_Enrollment', () => {
    const userId = randomItem(testData.userIds);
    const courseId = randomItem(testData.courseIds);

    const payload = JSON.stringify({
      userId,
      courseId,
      timestamp: new Date().toISOString(),
      source: 'load-test-full',
      metadata: {
        browser: 'k6-load-test',
        session: `session-${__VU}-${__ITER}`,
      },
    });

    // 1. Create enrollment event
    const enrollRes = http.post(
      `${BASE_URL}/api/events/course-enrollment`,
      payload,
      {
        ...params,
        headers: {
          ...params.headers,
          'X-Load-Test': 'true',
        },
      }
    );

    check(enrollRes, {
      'enrollment: status < 500': (r) => r.status < 500,
      'enrollment: has response': (r) => r.body !== null,
    });
    enrollmentDuration.add(enrollRes.timings.duration);
    enrollmentErrors.add(enrollRes.status >= 500);
    totalRequests.add(1);

    sleep(Math.random() * 1 + 0.5);

    // 2. Verify enrollment via course enrollments
    const verifyRes = http.get(
      `${BASE_URL}/api/analytics/courses`,
      params
    );
    check(verifyRes, {
      'verify enrollment: status < 500': (r) => r.status < 500,
    });
    enrollmentDuration.add(verifyRes.timings.duration);
    enrollmentErrors.add(verifyRes.status >= 500);
    totalRequests.add(1);
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

  // Think time between iterations (simulates real user behavior)
  sleep(Math.random() * 2 + 1);
}

// ---------------------------------------------------------------------------
// Setup & teardown
// ---------------------------------------------------------------------------

export function setup() {
  console.log(`\n=== Full Load Test Configuration ===`);
  console.log(`Target: ${BASE_URL}`);
  console.log(`Duration: 5 minutes`);
  console.log(`Peak VUs: 100`);
  console.log(`Scenario distribution:`);
  console.log(`  Course browsing: 80%`);
  console.log(`  Credential verification: 15%`);
  console.log(`  Enrollment: 5%`);
  console.log(`====================================\n`);

  // Verify target is reachable
  const res = http.get(`${BASE_URL}/api/health`, { timeout: '10s' });
  if (res.status !== 200) {
    console.warn(`WARNING: Target ${BASE_URL} health check returned ${res.status}`);
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
  };
}

export function handleSummary(data) {
  const now = new Date().toISOString();
  const results = {
    metadata: {
      testType: 'full-load',
      timestamp: now,
      baseUrl: BASE_URL,
      duration: '5m',
      peakVUs: 100,
    },
    metrics: data.metrics,
    thresholds: {},
  };

  // Extract threshold results for easy parsing
  if (data.metrics) {
    for (const [key, metric] of Object.entries(data.metrics)) {
      if (metric.thresholds) {
        results.thresholds[key] = metric.thresholds;
      }
    }
  }

  return {
    stdout: generateTextSummary(data),
    [`tests/load/results/full-load-results-${now.replace(/[:.]/g, '-')}.json`]: JSON.stringify(results, null, 2),
    'tests/load/results/full-load-results-latest.json': JSON.stringify(results, null, 2),
  };
}

function generateTextSummary(data) {
  const metrics = data.metrics || {};
  const lines = [
    '\n╔══════════════════════════════════════════╗',
    '║       Full Load Test Results             ║',
    '╠══════════════════════════════════════════╣',
  ];

  if (metrics.http_req_duration) {
    const v = metrics.http_req_duration.values;
    lines.push('║  HTTP Request Duration:                ║');
    lines.push(`║    avg:  ${(v.avg || 0).toFixed(1).padStart(8)}ms                  ║`);
    lines.push(`║    p(50): ${(v['p(50)'] || 0).toFixed(1).padStart(8)}ms                  ║`);
    lines.push(`║    p(95): ${(v['p(95)'] || 0).toFixed(1).padStart(8)}ms  [budget: <500ms]  ║`);
    lines.push(`║    p(99): ${(v['p(99)'] || 0).toFixed(1).padStart(8)}ms                  ║`);
    lines.push(`║    max:  ${(v.max || 0).toFixed(1).padStart(8)}ms                  ║`);
  }

  if (metrics.http_req_failed) {
    const rate = (metrics.http_req_failed.values.rate * 100).toFixed(2);
    lines.push(`║  Error Rate: ${rate.padStart(6)}%  [budget: <1%]    ║`);
  }

  if (metrics.http_reqs) {
    const rate = (metrics.http_reqs.values.rate || 0).toFixed(1);
    lines.push(`║  Throughput: ${rate.padStart(8)} req/s  [budget: >50]  ║`);
    lines.push(`║  Total Requests: ${metrics.http_reqs.values.count}            ║`);
  }

  lines.push('╚══════════════════════════════════════════╝\n');
  return lines.join('\n');
}
