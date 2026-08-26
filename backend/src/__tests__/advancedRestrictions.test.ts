import { Request, Response, NextFunction } from 'express';
import { advancedRestrictions } from '../middleware/security';
import { ForbiddenError } from '../utils/errors';

jest.mock('../services/securityService', () => ({
  __esModule: true,
  default: {
    checkGeoRestriction: jest.fn(),
    checkTimeRestriction: jest.fn(),
  },
}));

import securityService from '../services/securityService';

const mockedSecurityService = securityService as jest.Mocked<typeof securityService>;

describe('advancedRestrictions middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    req = {
      ip: '203.0.113.1',
      path: '/api/courses',
      headers: {},
    };
    res = {};
    next = jest.fn();
    mockedSecurityService.checkGeoRestriction.mockResolvedValue(false);
    mockedSecurityService.checkTimeRestriction.mockResolvedValue(false);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('skips enforcement in test env without x-test-security header', async () => {
    await advancedRestrictions(req as Request, res as Response, next);

    expect(mockedSecurityService.checkGeoRestriction).not.toHaveBeenCalled();
    expect(mockedSecurityService.checkTimeRestriction).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('blocks geo-restricted requests when x-test-security is set', async () => {
    req.headers = { 'x-test-security': 'true' };
    mockedSecurityService.checkGeoRestriction.mockResolvedValue(true);

    await advancedRestrictions(req as Request, res as Response, next);

    expect(mockedSecurityService.checkGeoRestriction).toHaveBeenCalledWith(
      req.ip,
      req,
    );
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next as jest.Mock).mock.calls[0][0].message).toContain('location');
  });

  it('blocks time-restricted requests when x-test-security is set', async () => {
    req.headers = { 'x-test-security': 'true' };
    mockedSecurityService.checkTimeRestriction.mockResolvedValue(true);

    await advancedRestrictions(req as Request, res as Response, next);

    expect(mockedSecurityService.checkTimeRestriction).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
    expect((next as jest.Mock).mock.calls[0][0].message).toContain('maintenance');
  });

  it('allows requests when geo and time checks pass', async () => {
    req.headers = { 'x-test-security': 'true' };

    await advancedRestrictions(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('bypasses /api/health even when restrictions would apply', async () => {
    req.path = '/api/health';
    req.headers = { 'x-test-security': 'true' };
    mockedSecurityService.checkGeoRestriction.mockResolvedValue(true);
    mockedSecurityService.checkTimeRestriction.mockResolvedValue(true);

    await advancedRestrictions(req as Request, res as Response, next);

    expect(mockedSecurityService.checkGeoRestriction).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('bypasses / even when restrictions would apply', async () => {
    req.path = '/';
    req.headers = { 'x-test-security': 'true' };

    await advancedRestrictions(req as Request, res as Response, next);

    expect(mockedSecurityService.checkGeoRestriction).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('fails open when the security service throws', async () => {
    req.headers = { 'x-test-security': 'true' };
    mockedSecurityService.checkGeoRestriction.mockRejectedValue(new Error('redis down'));

    await advancedRestrictions(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
