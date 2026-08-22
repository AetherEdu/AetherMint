const request = require('supertest');
const app = require('../src/index');

describe('API Versioning', () => {

  // ─── Version Header Tests ─────────────────────────────────────────────────

  describe('X-API-Version Header', () => {
    test('versioned routes return X-API-Version header with correct version', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('v1');
    });

    test('non-versioned routes return X-API-Version header with current version', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['x-api-version']).toBe('v1');
    });
  });

  // ─── Deprecation Header Tests ─────────────────────────────────────────────-

  describe('Deprecation Headers', () => {
    test('non-versioned routes include Deprecation header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['deprecation']).toBeDefined();
      expect(response.headers['deprecation']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('non-versioned routes include Sunset header', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['sunset']).toBeDefined();
      expect(response.headers['sunset']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('non-versioned routes include Link header pointing to versioned path', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.headers['link']).toBeDefined();
      expect(response.headers['link']).toContain('/api/v1/');
      expect(response.headers['link']).toContain('rel="deprecation"');
    });

    test('versioned routes do NOT include deprecation headers', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.headers['deprecation']).toBeUndefined();
      expect(response.headers['sunset']).toBeUndefined();
    });
  });

  // ─── Version Info Endpoint Tests ───────────────────────────────────────────

  describe('Version Info Endpoint', () => {
    test('GET /api/version returns current version info', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.currentVersion).toBe('v1');
      expect(response.body.data.supportedVersions).toContain('v1');
    });

    test('version endpoint includes sunset and deprecation dates', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body.data.deprecationDate).toBeDefined();
      expect(response.body.data.sunsetDate).toBeDefined();
      expect(response.body.data.compatibilityPeriod).toBeDefined();
      expect(response.body.data.migrationGuide).toBe('/api/docs');
    });
  });

  // ─── Versioned Route Access Tests ──────────────────────────────────────────

  describe('Versioned Route Access', () => {
    test('GET /api/v1/health returns healthy status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    test('non-versioned /api/health still works (backward compat)', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    test('versioned routes return same data as non-versioned routes', async () => {
      const versioned = await request(app).get('/api/v1/health').expect(200);
      const legacy = await request(app).get('/api/health').expect(200);

      expect(versioned.body.status).toBe(legacy.body.status);
      expect(versioned.body.timestamp).toBeDefined();
      expect(legacy.body.timestamp).toBeDefined();
    });
  });

  // ─── Backward Compatibility Tests ─────────────────────────────────────────

  describe('Backward Compatibility', () => {
    test('GET / returns root info without any version header', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.message).toBeDefined();
      expect(response.body.version).toBeDefined();
    });
  });
});
