import { sanitizeInput, detectSuspiciousPatterns } from '../middleware/sanitizer';
import { Request, Response, NextFunction } from 'express';

describe('Security Middleware', () => {
  describe('detectSuspiciousPatterns', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;
    let jsonMock: jest.Mock;

    beforeEach(() => {
      jsonMock = jest.fn();
      req = {
        body: {},
        query: {},
        params: {}
      };
      res = {
        status: jest.fn(() => ({ json: jsonMock })),
      };
      next = jest.fn();
    });

    it('should detect XSS attempts with script tags', () => {
      req.body = {
        name: '<script>alert("xss")</script>'
      };

      detectSuspiciousPatterns(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalled();
    });

    it('should detect SQL injection attempts', () => {
      req.body = {
        id: "1' OR '1'='1"
      };

      detectSuspiciousPatterns(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should detect NoSQL injection attempts', () => {
      req.body = {
        $gt: 0
      };

      detectSuspiciousPatterns(req as Request, res as Response, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should let normal requests pass', () => {
      req.body = {
        name: 'John Doe',
        email: 'john@example.com'
      };

      detectSuspiciousPatterns(req as Request, res as Response, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('sanitizeInput', () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
      req = {
        body: {},
        query: {},
        params: {}
      };
      res = {};
      next = jest.fn();
    });

    it('should strip HTML tags', () => {
      req.body = {
        name: '<b>John</b> Doe',
        bio: '<script>malicious</script>Hello'
      };

      sanitizeInput(req as Request, res as Response, next);
      
      expect(req.body.name).not.toContain('<b>');
      expect(req.body.bio).not.toContain('<script>');
      expect(next).toHaveBeenCalled();
    });

    it('should sanitize NoSQL operators in keys', () => {
      req.body = {
        $gt: 5,
        $in: [1, 2, 3]
      };

      sanitizeInput(req as Request, res as Response, next);
      
      expect(req.body).not.toHaveProperty('$gt');
      expect(req.body).toHaveProperty('sanitized_gt');
      expect(next).toHaveBeenCalled();
    });
  });
});
