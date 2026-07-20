const request = require('supertest');
const app = require('../../src/index');

// Mock security service to prevent external calls
jest.mock('../../src/services/securityService', () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(true),
}));

// Mock rate limiter for auth routes
jest.mock('../../src/middleware/rateLimiter', () => {
  const original = jest.requireActual('../../src/middleware/rateLimiter');
  return {
    ...original,
    authLimiter: (req, res, next) => next(),
    ipfsLimiter: (req, res, next) => next(),
    tieredRateLimiter: (req, res, next) => next(),
    transactionLimiter: (req, res, next) => next(),
  };
});

describe('Auth API Integration Tests', () => {
  let testUser;
  let authToken;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Registration ─────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser_' + Date.now(),
          email: 'test_' + Date.now() + '@example.com',
          password: 'securePassword123',
          role: 'student',
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBeDefined();
      expect(response.body.token).toBeDefined();
    });

    it('should register a user with default student role', async () => {
      const uniqueId = Date.now();
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser_' + uniqueId,
          email: 'new_' + uniqueId + '@example.com',
          password: 'securePassword123',
        });

      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe('student');
    });

    it('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'testuser' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 400 for invalid role', async () => {
      const uniqueId = Date.now();
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'roleuser_' + uniqueId,
          email: 'role_' + uniqueId + '@example.com',
          password: 'securePassword123',
          role: 'superadmin',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Role must be one of');
    });

    it('should return 409 when username already exists', async () => {
      const uniqueId = Date.now();
      const userData = {
        username: 'dupuser_' + uniqueId,
        email: 'dup_' + uniqueId + '@example.com',
        password: 'securePassword123',
      };

      // Register first time
      await request(app).post('/api/auth/register').send(userData);

      // Try to register again with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...userData,
          email: 'different_' + uniqueId + '@example.com',
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({});

      expect(response.status).toBe(400);
    });

    it('should handle server errors gracefully', async () => {
      // Trigger a server error by sending malformed data
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('not-valid-json}{');

      expect(response.status).toBe(400);
    });
  });

  // ─── Login ────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    beforeAll(async () => {
      // Register a test user for login tests
      const uniqueId = Date.now();
      testUser = {
        username: 'loginuser_' + uniqueId,
        email: 'login_' + uniqueId + '@example.com',
        password: 'securePassword123',
      };

      await request(app).post('/api/auth/register').send(testUser);
    });

    it('should login successfully with valid credentials (username)', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe(testUser.username);
      authToken = response.body.token;
    });

    it('should login successfully with email instead of username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('should return 400 when credentials are missing', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'someone' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent_user_xyz',
          password: 'somepassword',
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'wrongPassword',
        });

      expect(response.status).toBe(401);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  // ─── Profile ──────────────────────────────────────────────────────────

  describe('GET /api/auth/profile', () => {
    beforeAll(async () => {
      // Ensure we have an auth token
      if (!authToken) {
        const uniqueId = Date.now();
        testUser = {
          username: 'profileuser_' + uniqueId,
          email: 'profile_' + uniqueId + '@example.com',
          password: 'securePassword123',
        };
        const reg = await request(app).post('/api/auth/register').send(testUser);
        authToken = reg.body.token;
      }
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.username).toBeDefined();
      expect(response.body.user.email).toBeDefined();
    });

    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
    });

    it('should return 403 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token-here');

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/auth/profile', () => {
    beforeAll(async () => {
      if (!authToken) {
        const uniqueId = Date.now();
        testUser = {
          username: 'putprofile_' + uniqueId,
          email: 'putprofile_' + uniqueId + '@example.com',
          password: 'securePassword123',
        };
        const reg = await request(app).post('/api/auth/register').send(testUser);
        authToken = reg.body.token;
      }
    });

    it('should update username successfully', async () => {
      const newUsername = 'updated_' + Date.now();
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ username: newUsername });

      expect(response.status).toBe(200);
      expect(response.body.user.username).toBe(newUsername);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ username: 'newname' });

      expect(response.status).toBe(401);
    });
  });

  // ─── Assign Role (Admin) ──────────────────────────────────────────────

  describe('PUT /api/auth/assign-role/:userId', () => {
    let adminToken;
    let targetUserId;

    beforeAll(async () => {
      const uniqueId = Date.now();
      // Register an admin user
      const adminReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admin_' + uniqueId,
          email: 'admin_' + uniqueId + '@example.com',
          password: 'adminPass123',
          role: 'admin',
        });
      adminToken = adminReg.body.token;

      // Register a target user
      const targetReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'target_' + uniqueId,
          email: 'target_' + uniqueId + '@example.com',
          password: 'targetPass123',
          role: 'student',
        });
      targetUserId = targetReg.body.user.id;
    });

    it('should assign role as admin', async () => {
      const response = await request(app)
        .put(`/api/auth/assign-role/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'educator' });

      expect(response.status).toBe(200);
      expect(response.body.user.newRole).toBe('educator');
      expect(response.body.user.oldRole).toBe('student');
    });

    it('should return 400 for invalid role assignment', async () => {
      const response = await request(app)
        .put(`/api/auth/assign-role/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'invalid_role' });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .put('/api/auth/assign-role/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'student' });

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .put(`/api/auth/assign-role/${targetUserId}`)
        .send({ role: 'student' });

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const normalReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'normal_' + Date.now(),
          email: 'normal_' + Date.now() + '@example.com',
          password: 'normalPass123',
          role: 'student',
        });
      const normalToken = normalReg.body.token;

      const response = await request(app)
        .put(`/api/auth/assign-role/${targetUserId}`)
        .set('Authorization', `Bearer ${normalToken}`)
        .send({ role: 'educator' });

      expect(response.status).toBe(403);
    });
  });

  // ─── List Users (Admin) ───────────────────────────────────────────────

  describe('GET /api/auth/users', () => {
    let adminToken;

    beforeAll(async () => {
      const uniqueId = Date.now();
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'adminlist_' + uniqueId,
          email: 'adminlist_' + uniqueId + '@example.com',
          password: 'adminPass123',
          role: 'admin',
        });
      adminToken = reg.body.token;
    });

    it('should list users with admin credentials', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.users).toBeDefined();
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/auth/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(5);
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/auth/users?role=admin')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      // All returned users should be admins
      response.body.users.forEach((u) => {
        expect(u.role).toBe('admin');
      });
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const uniqueId = Date.now();
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'studentlist_' + uniqueId,
          email: 'studentlist_' + uniqueId + '@example.com',
          password: 'studentPass123',
          role: 'student',
        });
      const studentToken = reg.body.token;

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ─── Delete User (Admin) ──────────────────────────────────────────────

  describe('DELETE /api/auth/users/:userId', () => {
    let adminToken;
    let targetUserId;

    beforeAll(async () => {
      const uniqueId = Date.now();
      // Register admin
      const adminReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admindelete_' + uniqueId,
          email: 'admindelete_' + uniqueId + '@example.com',
          password: 'adminPass123',
          role: 'admin',
        });
      adminToken = adminReg.body.token;

      // Register target to delete
      const targetReg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'todelete_' + uniqueId,
          email: 'todelete_' + uniqueId + '@example.com',
          password: 'deletePass123',
          role: 'student',
        });
      targetUserId = targetReg.body.user.id;
    });

    it('should delete user as admin', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.deletedUser).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await request(app)
        .delete('/api/auth/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${targetUserId}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const uniqueId = Date.now();
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'studentdel_' + uniqueId,
          email: 'studentdel_' + uniqueId + '@example.com',
          password: 'studentPass123',
          role: 'student',
        });
      const studentToken = reg.body.token;

      const response = await request(app)
        .delete(`/api/auth/users/${targetUserId}`)
        .set('Authorization', `Bearer ${studentToken}`);

      expect(response.status).toBe(403);
    });
  });

  // ─── Edge Cases & Security ───────────────────────────────────────────

  describe('Edge Cases and Security', () => {
    it('should protect profile route from unauthenticated access', async () => {
      const response = await request(app).get('/api/auth/profile');
      expect(response.status).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // Create a very short-lived token manually
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { id: 'test', username: 'test', role: 'student', email: 'test@test.com' },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '0s' }
      );

      // Wait a moment for the token to become definitely expired
      await new Promise((r) => setTimeout(r, 100));

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
    });

    it('should handle malformed authorization headers', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'InvalidFormat');

      expect(response.status).toBe(401);
    });

    it('should not expose passwords in user list responses', async () => {
      const uniqueId = Date.now();
      const reg = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'safe_' + uniqueId,
          email: 'safe_' + uniqueId + '@example.com',
          password: 'secretPass123',
          role: 'admin',
        });
      const adminToken = reg.body.token;

      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      response.body.users.forEach((u) => {
        expect(u.password).toBeUndefined();
      });
    });

    it('should handle concurrent login requests', async () => {
      const uniqueId = Date.now();
      const userData = {
        username: 'concurrent_' + uniqueId,
        email: 'concurrent_' + uniqueId + '@example.com',
        password: 'concurrentPass123',
      };

      await request(app).post('/api/auth/register').send(userData);

      const responses = await Promise.all([
        request(app).post('/api/auth/login').send({ username: userData.username, password: userData.password }),
        request(app).post('/api/auth/login').send({ username: userData.username, password: userData.password }),
        request(app).post('/api/auth/login').send({ username: userData.username, password: userData.password }),
      ]);

      responses.forEach((r) => {
        expect(r.status).toBe(200);
        expect(r.body.token).toBeDefined();
      });
    });

    it('should handle extremely long inputs', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'a'.repeat(1000),
          email: 'long_' + Date.now() + '@example.com',
          password: 'secure123',
        });

      // Should not crash - either accept or reject gracefully
      expect([201, 400]).toContain(response.status);
    });
  });
});
