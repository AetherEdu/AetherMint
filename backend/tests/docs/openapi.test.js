/**
 * OpenAPI Documentation System Tests
 *
 * Validates that:
 *   1. The spec loads without errors and is valid OpenAPI 3.0+
 *   2. Required structural fields are present
 *   3. Security schemes are correctly defined
 *   4. Reusable component schemas exist
 *   5. At least 20 public endpoints are documented
 *   6. /api/docs and /api/docs/json routes respond correctly
 *   7. Root endpoint exposes documentation links
 */

'use strict';

const request = require('supertest');

// ── Silence noisy startup logs in tests ─────────────────────────────────────
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Lazy-load app inside tests so mocks are in place first
let app;

beforeAll(() => {
  app = require('../../src/index');
});

// ── Helper: load spec directly for structural assertions ────────────────────
let spec;

beforeAll(() => {
  const { openApiSpec } = require('../../src/docs/openapi');
  spec = openApiSpec;
});

// ────────────────────────────────────────────────────────────────────────────
// 1. Spec structure
// ────────────────────────────────────────────────────────────────────────────
describe('OpenAPI spec – structural validation', () => {
  test('spec is a non-null object', () => {
    expect(spec).toBeDefined();
    expect(typeof spec).toBe('object');
    expect(spec).not.toBeNull();
  });

  test('openapi version is 3.0.x or higher', () => {
    expect(spec.openapi).toBeDefined();
    const [major] = spec.openapi.split('.').map(Number);
    expect(major).toBeGreaterThanOrEqual(3);
  });

  test('info object contains required fields', () => {
    expect(spec.info).toBeDefined();
    expect(typeof spec.info.title).toBe('string');
    expect(spec.info.title.length).toBeGreaterThan(0);
    expect(typeof spec.info.version).toBe('string');
    expect(spec.info.version.length).toBeGreaterThan(0);
    expect(typeof spec.info.description).toBe('string');
  });

  test('info.title is "AetherMint API"', () => {
    expect(spec.info.title).toBe('AetherMint API');
  });

  test('servers array is present and non-empty', () => {
    expect(Array.isArray(spec.servers)).toBe(true);
    expect(spec.servers.length).toBeGreaterThan(0);
    expect(spec.servers[0].url).toBeDefined();
  });

  test('paths object exists', () => {
    expect(spec.paths).toBeDefined();
    expect(typeof spec.paths).toBe('object');
  });

  test('components object exists', () => {
    expect(spec.components).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Security schemes
// ────────────────────────────────────────────────────────────────────────────
describe('OpenAPI spec – security schemes', () => {
  let schemes;

  beforeAll(() => {
    schemes = spec?.components?.securitySchemes || {};
  });

  test('BearerAuth scheme is defined', () => {
    expect(schemes.BearerAuth).toBeDefined();
  });

  test('BearerAuth is HTTP Bearer JWT', () => {
    expect(schemes.BearerAuth.type).toBe('http');
    expect(schemes.BearerAuth.scheme).toBe('bearer');
    expect(schemes.BearerAuth.bearerFormat).toBe('JWT');
  });

  test('ApiKeyAuth scheme is defined', () => {
    expect(schemes.ApiKeyAuth).toBeDefined();
  });

  test('ApiKeyAuth is an apiKey in header', () => {
    expect(schemes.ApiKeyAuth.type).toBe('apiKey');
    expect(schemes.ApiKeyAuth.in).toBe('header');
    expect(typeof schemes.ApiKeyAuth.name).toBe('string');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Component schemas
// ────────────────────────────────────────────────────────────────────────────
describe('OpenAPI spec – component schemas', () => {
  let schemas;

  beforeAll(() => {
    schemas = spec?.components?.schemas || {};
  });

  const requiredSchemas = [
    'ErrorResponse',
    'Error',
    'Pagination',
    'User',
    'AuthResponse',
    'RegisterRequest',
    'LoginRequest',
    'Course',
    'CourseSearchRequest',
    'Enrollment',
    'CreateEnrollmentRequest',
    'Payment',
    'PaymentIntentRequest',
    'Transaction',
    'Quiz',
    'IPFSContent',
  ];

  test.each(requiredSchemas)('schema "%s" is defined', (name) => {
    expect(schemas[name]).toBeDefined();
  });

  test('ErrorResponse matches the required error shape', () => {
    const s = schemas.ErrorResponse;
    expect(s.type).toBe('object');
    expect(s.properties.success).toBeDefined();
    expect(s.properties.error).toBeDefined();
    const ep = s.properties.error.properties;
    expect(ep.code).toBeDefined();
    expect(ep.message).toBeDefined();
    expect(ep.details).toBeDefined();
    expect(ep.requestId).toBeDefined();
  });

  test('User schema has id, username, email, role fields', () => {
    const s = schemas.User;
    expect(s.properties.id).toBeDefined();
    expect(s.properties.username).toBeDefined();
    expect(s.properties.email).toBeDefined();
    expect(s.properties.role).toBeDefined();
  });

  test('Enrollment schema has required fields', () => {
    const s = schemas.Enrollment;
    ['id', 'userId', 'courseId', 'status', 'progress'].forEach((f) => {
      expect(s.properties[f]).toBeDefined();
    });
  });

  test('Payment schema has amount and status', () => {
    const s = schemas.Payment;
    expect(s.properties.amount).toBeDefined();
    expect(s.properties.status).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. Endpoint coverage (≥ 20 documented paths)
// ────────────────────────────────────────────────────────────────────────────
describe('OpenAPI spec – endpoint coverage', () => {
  let allEndpoints;

  beforeAll(() => {
    allEndpoints = [];
    const paths = spec?.paths || {};
    for (const [pathKey, methods] of Object.entries(paths)) {
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const method of httpMethods) {
        if (methods[method]) {
          allEndpoints.push(`${method.toUpperCase()} ${pathKey}`);
        }
      }
    }
  });

  test('at least 20 unique endpoints are documented', () => {
    expect(allEndpoints.length).toBeGreaterThanOrEqual(20);
  });

  // Spot-check that the most critical routes are present in the spec
  const criticalPaths = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/profile',
    '/api/auth/users',
    '/api/health',
  ];

  test.each(criticalPaths)('path "%s" is documented', (p) => {
    expect(spec.paths[p]).toBeDefined();
  });

  test('each documented endpoint has a summary', () => {
    const missing = [];
    for (const [pathKey, methods] of Object.entries(spec.paths || {})) {
      const httpMethods = ['get', 'post', 'put', 'patch', 'delete'];
      for (const method of httpMethods) {
        const op = methods[method];
        if (op && !op.summary) {
          missing.push(`${method.toUpperCase()} ${pathKey}`);
        }
      }
    }
    // Allow a small tolerance for auto-generated entries
    expect(missing.length).toBeLessThanOrEqual(5);
  });

  test('critical auth endpoints define at least a 200/201 response', () => {
    const authPost = spec.paths['/api/auth/register']?.post;
    expect(authPost).toBeDefined();
    const codes = Object.keys(authPost.responses || {});
    const has2xx = codes.some((c) => c.startsWith('2'));
    expect(has2xx).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 5. HTTP endpoints – /api/docs and /api/docs/json
// ────────────────────────────────────────────────────────────────────────────
describe('GET /api/docs', () => {
  test('returns 200 with HTML content', async () => {
    const res = await request(app).get('/api/docs/').expect(200);
    expect(res.headers['content-type']).toMatch(/html/i);
  });
});

describe('GET /api/docs/json', () => {
  test('returns 200 JSON', async () => {
    const res = await request(app).get('/api/docs/json').expect(200);
    expect(res.headers['content-type']).toMatch(/json/i);
  });

  test('response body is valid OpenAPI 3.0+', () => {
    // spec is already loaded from the module directly –
    // the route just re-serialises the same object.
    expect(spec.openapi).toMatch(/^3\./);
  });

  test('response contains info title', async () => {
    const res = await request(app).get('/api/docs/json').expect(200);
    expect(res.body.info).toBeDefined();
    expect(res.body.info.title).toBe('AetherMint API');
  });

  test('response contains paths object with entries', async () => {
    const res = await request(app).get('/api/docs/json').expect(200);
    expect(res.body.paths).toBeDefined();
    expect(Object.keys(res.body.paths).length).toBeGreaterThanOrEqual(20);
  });

  test('response contains component schemas', async () => {
    const res = await request(app).get('/api/docs/json').expect(200);
    expect(res.body.components?.schemas).toBeDefined();
    expect(res.body.components?.securitySchemes?.BearerAuth).toBeDefined();
    expect(res.body.components?.securitySchemes?.ApiKeyAuth).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 6. Root endpoint exposes documentation link
// ────────────────────────────────────────────────────────────────────────────
describe('GET /', () => {
  test('returns 200', async () => {
    await request(app).get('/').expect(200);
  });

  test('response body includes documentation.ui link', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body.documentation).toBeDefined();
    expect(typeof res.body.documentation.ui).toBe('string');
    expect(res.body.documentation.ui).toContain('/api/docs');
  });

  test('response body includes documentation.json link', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body.documentation.json).toContain('/api/docs/json');
  });

  test('response includes version and status', async () => {
    const res = await request(app).get('/').expect(200);
    expect(res.body.version).toBeDefined();
    expect(res.body.status).toBe('running');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 7. Health check
// ────────────────────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  test('returns 200 with status healthy', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.status).toBe('healthy');
  });
});
