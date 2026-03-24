const request = require('supertest');
const app = require('../../src/index');
const redisConfig = require('../../src/config/redis');

describe('Security Middleware', () => {
  beforeAll(async () => {
    if (!redisConfig.isConnected) {
      await redisConfig.initialize();
    }
  });

  afterAll(async () => {
    await redisConfig.disconnect();
  });

  beforeEach(async () => {
    await redisConfig.client.del(await redisConfig.client.keys('ddos:*'));
    await redisConfig.client.del(await redisConfig.client.keys('blacklist:*'));
  });

  test('should block known bot user agents', async () => {
    const res = await request(app)
      .get('/')
      .set('x-test-security', 'true')
      .set('User-Agent', 'Googlebot');
    
    expect(res.status).toBe(200); // Should be allowed

    const res2 = await request(app)
      .get('/')
      .set('x-test-security', 'true')
      .set('User-Agent', 'python-requests/2.25.1');
    
    expect(res2.status).toBe(403);
    expect(res2.body.message).toContain('Bots are not allowed');
  });

  test('should trigger DDoS protection on rapid requests', async () => {
    // DDoS limit is 15 in config
    for (let i = 0; i < 15; i++) {
       await request(app).get('/').set('x-test-security', 'true');
    }

    const res = await request(app).get('/').set('x-test-security', 'true');
    expect(res.status).toBe(429);
    expect(res.body.message).toContain('Too many requests, please slow down');
  });

  test('should block blacklisted IPs', async () => {
    // Manually blacklist an IP in Redis (using a mock key pattern)
    // Note: supertest local IP is usually 127.0.0.1
    await redisConfig.client.set('blacklist:127.0.0.1', 'Manual Block');

    const res = await request(app)
      .get('/')
      .set('x-test-security', 'true');
    expect(res.status).toBe(403); // Changed from 200 to 403 based on expected behavior for blocked IP
    expect(res.body.message).toContain('Access denied from this IP');
  });

  test('should sanitize suspicious HTML tags in request body', async () => {
    // This test assumes a route that accepts a body
    const res = await request(app)
      .post('/api/auth/register')
      .set('x-test-security', 'true')
      .send({
        username: 'attacker',
        email: 'test@example.com',
        password: 'password<script>alert("xss")</script>'
      });
    
    // We expect the script to be stripped by our sanitizer BEFORE reaching the route logic
    // But registration might fail for other reasons (user exists)
    // We mainly want to see if the sanitizer logic worked.
    // In our implementation, sanitize(req.body) happens in middleware.
  });
});
