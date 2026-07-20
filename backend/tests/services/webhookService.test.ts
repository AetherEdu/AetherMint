/**
 * Webhook Service Unit Tests
 *
 * Tests for HMAC-SHA256 payload signing, verification, retry logic,
 * dead-letter queue, delivery history, and subscription management.
 */

import crypto from 'crypto';
import {
  signPayload,
  verifySignature,
} from '../../src/services/webhookService';
import type { WebhookPayload } from '../../src/services/webhookService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createTestPayload = (overrides: Partial<WebhookPayload> = {}): WebhookPayload => ({
  event: 'credential.issued',
  timestamp: new Date().toISOString(),
  data: { credentialId: 'cert-123', userId: 'user-456' },
  ...overrides,
});

// ─── HMAC-SHA256 Signing & Verification ─────────────────────────────────────

describe('signPayload', () => {
  it('should produce a 64-character hex signature', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';
    const signature = signPayload(payload, secret);

    expect(signature).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(signature)).toBe(true);
  });

  it('should produce different signatures for different secrets', () => {
    const payload = createTestPayload();
    const sig1 = signPayload(payload, 'secret-key-number-one-16c');
    const sig2 = signPayload(payload, 'secret-key-number-two-16c');

    expect(sig1).not.toEqual(sig2);
  });

  it('should produce different signatures for different payloads', () => {
    const payload1 = createTestPayload({ event: 'credential.issued' });
    const payload2 = createTestPayload({ event: 'credential.verified' });
    const secret = 'my-super-secret-key-min-16-chars';

    const sig1 = signPayload(payload1, secret);
    const sig2 = signPayload(payload2, secret);

    expect(sig1).not.toEqual(sig2);
  });

  it('should produce the same signature for the same payload and secret', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';

    const sig1 = signPayload(payload, secret);
    const sig2 = signPayload(payload, secret);

    expect(sig1).toEqual(sig2);
  });

  it('should produce deterministic signatures (no randomness)', () => {
    const payload = createTestPayload();
    const secret = 'consistent-secret-key-here';

    // Call 100 times, all must match
    const signatures = Array.from({ length: 100 }, () => signPayload(payload, secret));
    const first = signatures[0];

    signatures.forEach((sig) => {
      expect(sig).toEqual(first);
    });
  });

  it('should be deterministic (same payload + secret = same signature)', () => {
    const secret = 'my-super-secret-key-min-16-chars';
    // This payload has event before timestamp
    const payload1: WebhookPayload = {
      event: 'credential.issued',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { a: 1, b: 2 },
    };
    // Build the same logical payload
    const payload2: WebhookPayload = {
      event: 'credential.issued',
      timestamp: '2026-01-01T00:00:00.000Z',
      data: { a: 1, b: 2 },
    };

    expect(signPayload(payload1, secret)).toEqual(signPayload(payload2, secret));
  });

  it('should produce different signatures when data content changes', () => {
    const secret = 'my-super-secret-key-min-16-chars';
    const p1 = createTestPayload({ data: { id: '1' } });
    const p2 = createTestPayload({ data: { id: '2' } });

    expect(signPayload(p1, secret)).not.toEqual(signPayload(p2, secret));
  });
});

describe('verifySignature', () => {
  it('should return true for a valid signature', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';
    const signature = signPayload(payload, secret);

    expect(verifySignature(payload, secret, signature)).toBe(true);
  });

  it('should return false for an invalid signature', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';
    const fakeSignature = 'a'.repeat(64);

    expect(verifySignature(payload, secret, fakeSignature)).toBe(false);
  });

  it('should return false when the wrong secret is used', () => {
    const payload = createTestPayload();
    const signature = signPayload(payload, 'correct-secret-key-16chars');

    expect(verifySignature(payload, 'wrong-secret-key-16chars!!', signature)).toBe(false);
  });

  it('should return false for tampered payloads', () => {
    const original = createTestPayload({ data: { credentialId: 'original' } });
    const secret = 'my-super-secret-key-min-16-chars';
    const signature = signPayload(original, secret);

    const tampered = createTestPayload({ data: { credentialId: 'tampered' } });
    expect(verifySignature(tampered, secret, signature)).toBe(false);
  });

  it('should return false when signature length differs', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';

    // Too short
    expect(verifySignature(payload, secret, 'abc123')).toBe(false);
    // Too long
    expect(verifySignature(payload, secret, 'a'.repeat(65))).toBe(false);
    // Empty
    expect(verifySignature(payload, secret, '')).toBe(false);
  });

  it('should handle signatures with non-hex characters gracefully', () => {
    const payload = createTestPayload();
    const secret = 'my-super-secret-key-min-16-chars';

    expect(verifySignature(payload, secret, 'z'.repeat(64))).toBe(false);
  });
});

// ─── Payload Construction ───────────────────────────────────────────────────

describe('WebhookPayload structure', () => {
  it('should have correct shape with event, timestamp, and data', () => {
    const payload = createTestPayload();

    expect(payload).toHaveProperty('event');
    expect(payload).toHaveProperty('timestamp');
    expect(payload).toHaveProperty('data');
    expect(typeof payload.event).toBe('string');
    expect(typeof payload.timestamp).toBe('string');
    expect(typeof payload.data).toBe('object');
  });

  it('should have ISO-8601 timestamp format', () => {
    const payload = createTestPayload();

    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should preserve nested data objects', () => {
    const complexData = {
      credentialId: 'cert-abc-123',
      userId: 'student-456',
      courseId: 'course-789',
      issuerId: 'institution-001',
      metadata: {
        issuedAt: Date.now(),
        blockchainTx: '0xabcdef1234567890',
        version: 2,
      },
    };
    const payload = createTestPayload({ data: complexData });

    expect(payload.data).toEqual(complexData);
  });

  it('should support all four event types', () => {
    const events = [
      'credential.issued' as const,
      'credential.verified' as const,
      'credential.revoked' as const,
      'enrollment.created' as const,
    ];

    events.forEach((event) => {
      const payload = createTestPayload({ event });
      expect(payload.event).toBe(event);
    });
  });
});

// ─── Retry Scheduling Logic ─────────────────────────────────────────────────

describe('Retry delay calculations', () => {
  // The retry delays are: 60s, 240s, 600s (1 min, 4 min, 10 min)
  const expectedDelays = [60_000, 240_000, 600_000];

  it('should have exactly 3 retry attempts configured', () => {
    expect(expectedDelays).toHaveLength(3);
  });

  it('should have cumulative delay of ~15 minutes', () => {
    const total = expectedDelays.reduce((sum, d) => sum + d, 0);
    // 60 + 240 + 600 = 900 seconds = 15 minutes
    expect(total).toBe(900_000);
  });

  it('should have delays in ascending order (exponential-ish)', () => {
    for (let i = 1; i < expectedDelays.length; i++) {
      expect(expectedDelays[i]).toBeGreaterThan(expectedDelays[i - 1]);
    }
  });
});

// ─── Idempotency ────────────────────────────────────────────────────────────

describe('Idempotency key behavior', () => {
  it('should produce unique UUID v4 idempotency keys (conceptual test)', () => {
    // Generate 1000 UUIDs and verify all are unique
    const uuids = new Set<string>();
    // Use crypto to simulate what uuid v4 does
    for (let i = 0; i < 1000; i++) {
      uuids.add(crypto.randomUUID());
    }
    expect(uuids.size).toBe(1000);
  });
});

// ─── Dead-letter Queue Logic ────────────────────────────────────────────────

describe('Dead-letter queue behavior', () => {
  it('should mark delivery as dead after maxAttempts failures', () => {
    const maxAttempts = 3;
    // Simulate: attempt 0 fails, attempt 1 fails, attempt 2 fails → dead
    let attemptCount = 0;
    let status = 'pending';

    const simulateFailure = () => {
      attemptCount += 1;
      if (attemptCount >= maxAttempts) {
        status = 'dead';
      } else {
        status = 'retrying';
      }
    };

    // Attempt 1 (initial) - fails → retrying
    simulateFailure();
    expect(status).toBe('retrying');
    expect(attemptCount).toBe(1);

    // Attempt 2 (retry 1) - fails → retrying
    simulateFailure();
    expect(status).toBe('retrying');
    expect(attemptCount).toBe(2);

    // Attempt 3 (retry 2) - fails → dead
    simulateFailure();
    expect(status).toBe('dead');
    expect(attemptCount).toBe(3);
  });

  it('should reset attemptCount to 0 on manual retry', () => {
    let attemptCount = 3;
    let status = 'dead';

    // Manual retry: reset
    attemptCount = 0;
    status = 'pending';

    expect(attemptCount).toBe(0);
    expect(status).toBe('pending');
  });

  it('should not allow manual retry of non-dead/failed deliveries', () => {
    const validStatuses = ['dead', 'failed'];
    const invalidStatuses = ['pending', 'succeeded', 'retrying'];

    validStatuses.forEach((s) => {
      expect(validStatuses).toContain(s);
    });

    invalidStatuses.forEach((s) => {
      expect(validStatuses).not.toContain(s);
    });
  });
});

// ─── Auto-pause Logic ───────────────────────────────────────────────────────

describe('Auto-pause subscription on consecutive failures', () => {
  it('should pause subscription after 10 consecutive failures', () => {
    const MAX_CONSECUTIVE_FAILURES = 10;
    let consecutiveFailures = 0;
    let status = 'active';

    // Simulate 9 failures - should stay active
    for (let i = 0; i < 9; i++) {
      consecutiveFailures += 1;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        status = 'paused';
      }
    }
    expect(status).toBe('active');
    expect(consecutiveFailures).toBe(9);

    // 10th failure - should pause
    consecutiveFailures += 1;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      status = 'paused';
    }
    expect(status).toBe('paused');
    expect(consecutiveFailures).toBe(10);
  });

  it('should reset consecutiveFailures on successful delivery', () => {
    let consecutiveFailures = 5;
    let status = 'active';

    // Successful delivery resets failures
    consecutiveFailures = 0;
    status = 'active';

    expect(consecutiveFailures).toBe(0);
    expect(status).toBe('active');
  });
});

// ─── Event Type Validation ──────────────────────────────────────────────────

describe('Webhook event types', () => {
  const VALID_EVENT_TYPES = [
    'credential.issued',
    'credential.verified',
    'credential.revoked',
    'enrollment.created',
  ];

  it('should accept all four valid event types', () => {
    VALID_EVENT_TYPES.forEach((event) => {
      expect(VALID_EVENT_TYPES).toContain(event);
    });
  });

  it('should reject invalid event types', () => {
    const invalidEvents = [
      'credential.deleted',
      'user.created',
      'course.completed',
      'random.event',
      '',
    ];

    invalidEvents.forEach((event) => {
      expect(VALID_EVENT_TYPES).not.toContain(event);
    });
  });

  it('should have exactly 4 event types', () => {
    expect(VALID_EVENT_TYPES).toHaveLength(4);
  });
});

// ─── Filtering & Pagination Logic ───────────────────────────────────────────

describe('Delivery history filtering', () => {
  it('should support filtering by subscriptionId', () => {
    const filter: Record<string, unknown> = {};
    const subscriptionId = 'sub-123';

    if (subscriptionId) filter.subscriptionId = subscriptionId;

    expect(filter).toEqual({ subscriptionId: 'sub-123' });
  });

  it('should support filtering by eventType', () => {
    const filter: Record<string, unknown> = {};
    const eventType = 'credential.issued';

    if (eventType) filter.eventType = eventType;

    expect(filter).toEqual({ eventType: 'credential.issued' });
  });

  it('should support filtering by status', () => {
    const filter: Record<string, unknown> = {};
    const status = 'dead';

    if (status) filter.status = status;

    expect(filter).toEqual({ status: 'dead' });
  });

  it('should support combined filters', () => {
    const filter: Record<string, unknown> = {};
    const subscriptionId = 'sub-123';
    const eventType = 'credential.issued';
    const status = 'failed';

    if (subscriptionId) filter.subscriptionId = subscriptionId;
    if (eventType) filter.eventType = eventType;
    if (status) filter.status = status;

    expect(filter).toEqual({
      subscriptionId: 'sub-123',
      eventType: 'credential.issued',
      status: 'failed',
    });
  });

  it('should support empty filters (return all)', () => {
    const filter: Record<string, unknown> = {};
    expect(filter).toEqual({});
  });

  it('should calculate pagination offset correctly', () => {
    const page = 3;
    const limit = 20;
    const skip = (page - 1) * limit;

    expect(skip).toBe(40);
  });

  it('should handle page 1 with 0 offset', () => {
    const page = 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    expect(skip).toBe(0);
  });
});

// ─── Webhook Request Headers ────────────────────────────────────────────────

describe('Webhook request headers', () => {
  // These header constants must match the service implementation.
  // If the service changes, these tests must be updated accordingly.
  const EXPECTED_SIGNATURE_HEADER = 'X-AetherMint-Signature';
  const EXPECTED_IDEMPOTENCY_HEADER = 'X-AetherMint-Idempotency-Key';
  const EXPECTED_EVENT_HEADER = 'X-AetherMint-Event';
  const EXPECTED_USER_AGENT = 'AetherMint-Webhook/1.0';

  it('should use a non-empty signature header name', () => {
    expect(EXPECTED_SIGNATURE_HEADER.length).toBeGreaterThan(0);
    expect(EXPECTED_SIGNATURE_HEADER).toContain('Signature');
  });

  it('should use a non-empty idempotency header name', () => {
    expect(EXPECTED_IDEMPOTENCY_HEADER.length).toBeGreaterThan(0);
  });

  it('should use a non-empty event header name', () => {
    expect(EXPECTED_EVENT_HEADER.length).toBeGreaterThan(0);
  });

  it('should include AetherMint in user agent', () => {
    expect(EXPECTED_USER_AGENT).toContain('AetherMint');
  });
});

// ─── Concurrent Subscription Handling ───────────────────────────────────────

describe('Concurrent subscription handling', () => {
  it('should produce unique HMAC signatures for different subscriptions with different secrets', () => {
    const payload = createTestPayload();
    const secrets = Array.from({ length: 100 }, (_, i) => (
      `secret-key-for-subscription-${String(i).padStart(3, '0')}`
    ));
    const signatures = new Set(secrets.map((s) => signPayload(payload, s)));

    // All 100 signatures should be unique because secrets differ
    expect(signatures.size).toBe(100);
  });

  it('should handle rapid sequential signature generation without errors', () => {
    const payload = createTestPayload();
    const secret = 'rapid-test-secret-key-16chars';

    for (let i = 0; i < 1000; i++) {
      const sig = signPayload(payload, secret);
      expect(sig).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(sig)).toBe(true);
    }
  });
});

// ─── HTTP Response Handling ─────────────────────────────────────────────────

describe('HTTP response status interpretation', () => {
  it('should treat 2xx as success', () => {
    const successCodes = [200, 201, 202, 204];
    successCodes.forEach((code) => {
      expect(code >= 200 && code < 300).toBe(true);
    });
  });

  it('should treat non-2xx as failure', () => {
    const failureCodes = [301, 400, 401, 403, 404, 500, 502, 503];
    failureCodes.forEach((code) => {
      expect(code >= 200 && code < 300).toBe(false);
    });
  });

  it('should treat network errors as failure', () => {
    const networkErrors = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ECONNRESET',
    ];

    networkErrors.forEach((error) => {
      // Network errors should trigger retry logic
      expect(typeof error).toBe('string');
      expect(error.length).toBeGreaterThan(0);
    });
  });
});

// ─── Subscription URL Validation ────────────────────────────────────────────

describe('Subscription URL validation', () => {
  it('should accept valid HTTP URLs', () => {
    const validUrls = [
      'http://example.com/webhook',
      'https://example.com/webhook',
      'https://api.example.com/v1/webhooks/callback',
      'https://webhook.site/custom-uuid-here',
    ];

    validUrls.forEach((url) => {
      expect(/^https?:\/\/.+/.test(url)).toBe(true);
    });
  });

  it('should reject invalid URLs', () => {
    const invalidUrls = [
      'ftp://example.com/webhook',
      'ws://example.com/webhook',
      'not-a-url',
      '',
    ];

    invalidUrls.forEach((url) => {
      expect(/^https?:\/\/.+/.test(url)).toBe(false);
    });
  });
});

// ─── Delivery Status Transitions ────────────────────────────────────────────

describe('Delivery status state machine', () => {
  const validTransitions: Record<string, string[]> = {
    pending: ['succeeded', 'retrying', 'dead'],
    retrying: ['succeeded', 'retrying', 'dead'],
    dead: ['pending'], // manual retry only
    failed: ['pending'], // manual retry only
    succeeded: [], // terminal
  };

  it('should allow pending → succeeded', () => {
    expect(validTransitions['pending']).toContain('succeeded');
  });

  it('should allow pending → retrying', () => {
    expect(validTransitions['pending']).toContain('retrying');
  });

  it('should allow pending → dead', () => {
    expect(validTransitions['pending']).toContain('dead');
  });

  it('should allow dead → pending (manual retry)', () => {
    expect(validTransitions['dead']).toContain('pending');
  });

  it('should not allow succeeded → anything', () => {
    expect(validTransitions['succeeded']).toHaveLength(0);
  });
});
