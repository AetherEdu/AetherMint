const express = require('express');
const { cspMiddleware, securityHeadersMiddleware } = require('../../src/middleware/security');

describe('CSP Middleware', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(cspMiddleware);
    app.use(securityHeadersMiddleware);
    app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  });

  test('sets Content-Security-Policy-Report-Only by default', async () => {
    const res = await require('supertest')(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy-report-only']).toBeDefined();
    expect(res.headers['content-security-policy-report-only']).toContain("default-src 'self'");
    expect(res.headers['content-security-policy-report-only']).toContain("frame-ancestors 'none'");
    expect(res.headers['content-security-policy-report-only']).toContain('report-uri /api/csp-violation');
  });

  test('includes nonce in script-src directive', async () => {
    const res = await require('supertest')(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy-report-only']).toContain("script-src 'self' 'nonce-");
  });

  test('does not use unsafe-inline or unsafe-eval for scripts', async () => {
    const res = await require('supertest')(app).get('/api/health');
    expect(res.status).toBe(200);
    const csp = res.headers['content-security-policy-report-only'];
    expect(csp).not.toContain("'unsafe-inline'");
    expect(csp).not.toContain("'unsafe-eval'");
  });

  test('sets additional security headers', async () => {
    const res = await require('supertest')(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});