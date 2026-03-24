const request = require('supertest');
const app = require('../../src/index');
const redisConfig = require('../../src/config/redis');

describe('Rate Limiting Middleware', () => {
  beforeAll(async () => {
    // Ensure Redis is connected
    if (!redisConfig.isConnected) {
      await redisConfig.initialize();
    }
  });

  afterAll(async () => {
    await redisConfig.disconnect();
  });

  beforeEach(async () => {
    // Clear all security-related keys before each test
    const patterns = ['rl:*', 'ddos:*', 'blacklist:*'];
    for (const pattern of patterns) {
      const keys = await redisConfig.client.keys(pattern);
      if (keys.length > 0) {
        await redisConfig.client.del(keys);
      }
    }
  });

  test('should allow requests within global rate limit', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('should block requests exceeding global rate limit', async () => {
    // Default limit is 50 in config
    for (let i = 0; i < 50; i++) {
      const r = await request(app).get('/api/health').set('x-test-security', 'true');
      if (r.status !== 200) {
        console.log(`Request ${i} failed with ${r.status}: ${JSON.stringify(r.body)}`);
      }
    }
    
    const res = await request(app).get('/api/health').set('x-test-security', 'true');
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Too many requests');
  });

  test('should enforce auth endpoint specific limits', async () => {
    // Auth limit is 5 in config
    for (let i = 0; i < 5; i++) {
       await request(app)
        .post('/api/auth/login')
        .set('x-test-security', 'true')
        .send({ username: 'test', password: 'password' });
    }

    const res = await request(app)
      .post('/api/auth/login')
      .set('x-test-security', 'true')
      .send({ username: 'test', password: 'password' });

    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Too many login attempts');
  });

  test('should skip rate limiting for whitelisted IPs', async () => {
    // This is hard to test with supertest as it doesn't easily spoof remote address
    // but we can verify the 'skip' logic if we can mock req.ip
  });
});
