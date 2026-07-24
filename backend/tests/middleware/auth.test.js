const request = require('supertest');
const jwt = require('jsonwebtoken');
const express = require('express');
const { ipfsAuth, optionalIpfsAuth, verifyToken, hasPermission, checkRateLimit, validateContentAccess, validateFileSize } = require('../../src/middleware/ipfsAuth');
const { createIpfsError } = require('../../src/utils/ipfsUtils');
const { errorHandler } = require('../../src/middleware/errorHandler');
const { AuthError, ForbiddenError, ValidationError, NotFoundError, PayloadTooLargeError, RateLimitError } = require('../../src/utils/errors');

/**
 * Issue #254 (RFC 7807) — the IPFS auth / content / file-size helpers now
 * forward failures to the central ``errorHandler`` so the wire envelope
 * matches ``application/problem+json``.  The mocked ``mockRes`` /
 * ``mockNext`` pattern below mirrors that:  res.status / res.json should
 * never be called for an error code and ``next`` should receive an
 * ``AppError`` instance carrying the catalog row.
 */
describe('Authentication Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      file: null
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
      getHeader: jest.fn().mockReturnValue(undefined),
    };
    mockNext = jest.fn();

    // Reset global rate limit
    global.ipfsRateLimit = {};
  });

  describe('verifyToken', () => {
    it('should verify valid JWT token', () => {
      const payload = { userId: 'test-user', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      const result = verifyToken(token);

      expect(result.userId).toBe(payload.userId);
      expect(result.role).toBe(payload.role);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => verifyToken(invalidToken)).toThrow();
    });

    it('should throw error for expired token', () => {
      const payload = { userId: 'test-user', role: 'student' };
      const expiredToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '-1h' });

      expect(() => verifyToken(expiredToken)).toThrow();
    });
  });

  describe('hasPermission', () => {
    it('should grant admin users all permissions', () => {
      const adminUser = { role: 'admin', id: 'admin-1' };

      expect(hasPermission(adminUser, 'upload')).toBe(true);
      expect(hasPermission(adminUser, 'download')).toBe(true);
      expect(hasPermission(adminUser, 'pin')).toBe(true);
    });

    it('should grant instructors upload, download, and pin permissions', () => {
      const instructorUser = { role: 'instructor', id: 'instructor-1' };

      expect(hasPermission(instructorUser, 'upload')).toBe(true);
      expect(hasPermission(instructorUser, 'download')).toBe(true);
      expect(hasPermission(instructorUser, 'pin')).toBe(true);
    });

    it('should grant students download permissions only', () => {
      const studentUser = { role: 'student', id: 'student-1' };

      expect(hasPermission(studentUser, 'upload')).toBe(false);
      expect(hasPermission(studentUser, 'download')).toBe(true);
      expect(hasPermission(studentUser, 'pin')).toBe(false);
    });

    it('should grant guests download permissions only', () => {
      const guestUser = { role: 'guest', id: 'guest-1' };

      expect(hasPermission(guestUser, 'upload')).toBe(false);
      expect(hasPermission(guestUser, 'download')).toBe(true);
      expect(hasPermission(guestUser, 'pin')).toBe(false);
    });

    it('should deny unknown roles all permissions', () => {
      const unknownUser = { role: 'unknown', id: 'unknown-1' };

      expect(hasPermission(unknownUser, 'upload')).toBe(false);
      expect(hasPermission(unknownUser, 'download')).toBe(false);
      expect(hasPermission(unknownUser, 'pin')).toBe(false);
    });
  });

  describe('checkRateLimit', () => {
    beforeEach(() => {
      global.ipfsRateLimit = {};
    });

    it('should allow operations within rate limits', () => {
      const studentUser = { role: 'student', id: 'student-1' };

      expect(() => checkRateLimit(studentUser, 'download')).not.toThrow();
      expect(global.ipfsRateLimit['student-1:download']).toBe(1);
    });

    it('should throw error when rate limit exceeded', () => {
      const guestUser = { role: 'guest', id: 'guest-1' };

      // Guest users have 5 uploads per hour limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit(guestUser, 'upload');
      }

      expect(() => checkRateLimit(guestUser, 'upload')).toThrow('Rate limit exceeded');
    });

    it('should handle different rate limits for different roles', () => {
      const instructorUser = { role: 'instructor', id: 'instructor-1' };
      const studentUser = { role: 'student', id: 'student-1' };

      // Instructors can upload 50 times per hour
      for (let i = 0; i < 50; i++) {
        checkRateLimit(instructorUser, 'upload');
      }

      expect(() => checkRateLimit(instructorUser, 'upload')).toThrow();

      // Students can only upload 10 times per hour
      for (let i = 0; i < 10; i++) {
        checkRateLimit(studentUser, 'upload');
      }

      expect(() => checkRateLimit(studentUser, 'upload')).toThrow();
    });
  });

  describe('ipfsAuth middleware', () => {
    it('should authenticate valid requests', async () => {
      const payload = { userId: 'test-user', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = ipfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(payload);
      expect(mockReq.ipfsOperation).toBe('download');
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject requests without authorization header via AuthError', async () => {
      const middleware = ipfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const err = mockNext.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid authorization format via AuthError', async () => {
      mockReq.headers.authorization = 'InvalidFormat token';

      const middleware = ipfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const err = mockNext.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });

    it('should reject requests with invalid token via AuthError', async () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      const middleware = ipfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const err = mockNext.mock.calls[0][0];
      expect(err).toBeInstanceOf(AuthError);
      expect(err.statusCode).toBe(401);
    });

    it('should reject requests with insufficient permissions via ForbiddenError', async () => {
      const payload = { userId: 'test-user', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = ipfsAuth('upload'); // Students can't upload
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const err = mockNext.mock.calls[0][0];
      expect(err).toBeInstanceOf(ForbiddenError);
      expect(err.statusCode).toBe(403);
    });

    it('should reject requests when rate limit exceeded via RateLimitError (429)', async () => {
      const payload = { userId: 'test-user', role: 'guest' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      mockReq.headers.authorization = `Bearer ${token}`;

      // Exceed rate limit
      for (let i = 0; i < 5; i++) {
        checkRateLimit(payload, 'upload');
      }

      const middleware = ipfsAuth('upload');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const err = mockNext.mock.calls[0][0];
      // Issue #254 follow-up: rate-limit now produces a 429 RateLimitError
      // (data-driven by `checkRateLimit → createIpfsError(..., 429)`) — not
      // the old AuthError(401) heuristic artifact.
      expect(err).toBeInstanceOf(RateLimitError);
      expect(err.statusCode).toBe(429);
      expect(err.errorCode).toBe('RATE_LIMITED');
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('optionalIpfsAuth middleware', () => {
    it('should pass through requests without authentication', async () => {
      const middleware = optionalIpfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockReq.ipfsOperation).toBe('download');
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should authenticate valid requests when token provided', async () => {
      const payload = { userId: 'test-user', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      mockReq.headers.authorization = `Bearer ${token}`;

      const middleware = optionalIpfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual(payload);
      expect(mockReq.ipfsOperation).toBe('download');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should pass through requests with invalid token silently', async () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      const middleware = optionalIpfsAuth('download');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockReq.ipfsOperation).toBe('download');
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject authenticated requests with insufficient permissions via ForbiddenError', async () => {
      const payload = { userId: 'test-student-no-upload', role: 'student' };
      const token = jwt.sign(payload, process.env.JWT_SECRET);

      const app = express();
      app.use((req, _res, next) => {
        req.headers = { authorization: `Bearer ${token}` };
        next();
      });
      app.get('/', optionalIpfsAuth('upload'), (_req, res) => res.json({ ok: true }));
      app.use(errorHandler);

      const res = await request(app).get('/');
      expect(res.status).toBe(403);
      expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
      expect(res.body).toMatchObject({
        title: 'Forbidden',
        status: 403,
        code: 'FORBIDDEN',
        success: false,
      });
      expect(typeof res.body.requestId).toBe('string');
      expect(res.body.detail).toMatch(/Insufficient permissions/);
    });
  });

  describe('validateContentAccess middleware', () => {
    it('should allow access for admin users', async () => {
      mockReq.user = { role: 'admin', id: 'admin-1' };
      mockReq.params = { cid: 'QmTest123' };

      await validateContentAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access without user (public content)', async () => {
      mockReq.user = undefined;
      mockReq.params = { cid: 'QmTest123' };

      await validateContentAccess(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('validateFileSize middleware', () => {
    it('should allow files within size limit', async () => {
      mockReq.file = { size: 1024 }; // 1KB file

      await validateFileSize(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject files exceeding size limit via PayloadTooLargeError (413)', async () => {
      // Mock ipfsConfig with a tiny limit so we don't depend on env vars
      // or module reset hacks.
      jest.isolateModules(() => {
        jest.doMock('../../src/config/ipfs', () => ({
          ipfsConfig: { maxFileSize: 1, allowedContentTypes: ['*/*'] },
        }));
        const { validateFileSize: isolatedValidateFileSize } = require('../../src/middleware/ipfsAuth');

        const localReq = { file: { size: 1024 } };
        const localRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const localNext = jest.fn();
        return isolatedValidateFileSize(localReq, localRes, localNext).then(() => {
          const err = localNext.mock.calls[0] && localNext.mock.calls[0][0];
          expect(err).toBeInstanceOf(PayloadTooLargeError);
          expect(err.statusCode).toBe(413);
          expect(err.errorCode).toBe('PAYLOAD_TOO_LARGE');
        });
      });
    });

    it('should pass through when no file is provided', async () => {
      mockReq.file = null;

      await validateFileSize(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
