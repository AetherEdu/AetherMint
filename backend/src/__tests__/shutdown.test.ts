import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request, Response } from 'express';
import {
  closeHttpServer,
  isShuttingDown,
  performShutdown,
  registerShutdownHandlers,
  resetShutdownState,
  shutdownGuard,
  type ShutdownLogger,
} from '../utils/shutdown';

const makeLogger = (): jest.Mocked<ShutdownLogger> => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const makeRes = () => {
  const res: Partial<Record<keyof Response, jest.Mock>> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
};

describe('graceful shutdown', () => {
  let logger: jest.Mocked<ShutdownLogger>;

  beforeEach(() => {
    resetShutdownState();
    logger = makeLogger();
  });

  afterEach(() => {
    resetShutdownState();
  });

  it('runs every step in order and exits 0 on a clean drain', async () => {
    const calls: string[] = [];
    const onExit = jest.fn();

    const code = await performShutdown('SIGTERM', {
      steps: [
        { name: 'a', run: () => { calls.push('a'); } },
        { name: 'b', run: async () => { calls.push('b'); } },
        { name: 'c', run: async () => { calls.push('c'); } },
      ],
      logger,
      onExit,
    });

    expect(calls).toEqual(['a', 'b', 'c']);
    expect(code).toBe(0);
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onExit).toHaveBeenCalledWith(0);
  });

  it('logs a failing step but still runs the remaining steps', async () => {
    const calls: string[] = [];

    const code = await performShutdown('SIGINT', {
      steps: [
        { name: 'a', run: () => { calls.push('a'); } },
        { name: 'b', run: async () => { calls.push('b'); throw new Error('boom'); } },
        { name: 'c', run: () => { calls.push('c'); } },
      ],
      logger,
      onExit: jest.fn(),
    });

    expect(calls).toEqual(['a', 'b', 'c']);
    expect(code).toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown step failed: b'),
      expect.any(Error),
    );
  });

  it('exits 1 when the drain exceeds the grace period', async () => {
    const onExit = jest.fn();

    const code = await performShutdown('SIGTERM', {
      // A step that never settles, so only the deadline can resolve the race.
      steps: [{ name: 'hang', run: () => new Promise<void>(() => undefined) }],
      graceMs: 25,
      logger,
      onExit,
    });

    expect(code).toBe(1);
    expect(onExit).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('exceeded 25ms'));
  });

  it('ignores a second signal received while already shutting down', async () => {
    await performShutdown('SIGTERM', { steps: [], logger, onExit: jest.fn() });

    const calls: string[] = [];
    const onExit = jest.fn();
    const code = await performShutdown('SIGINT', {
      steps: [{ name: 'x', run: () => { calls.push('x'); } }],
      logger,
      onExit,
    });

    expect(code).toBe(-1);
    expect(calls).toEqual([]);
    expect(onExit).not.toHaveBeenCalled();
  });

  it('reports the shutting-down state once a shutdown has begun', async () => {
    expect(isShuttingDown()).toBe(false);
    await performShutdown('SIGTERM', { steps: [], logger, onExit: jest.fn() });
    expect(isShuttingDown()).toBe(true);
  });

  describe('registerShutdownHandlers', () => {
    it('runs the shutdown sequence when a registered signal fires', async () => {
      const ran: string[] = [];

      await new Promise<void>((resolve) => {
        registerShutdownHandlers({
          // Use a benign, test-only signal so the real SIGTERM/SIGINT handlers
          // are not clobbered while the suite runs.
          signals: ['SIGUSR2'],
          steps: [{ name: 'step', run: () => { ran.push('step'); } }],
          logger,
          onExit: () => resolve(),
        });
        (process.emit as (event: string) => boolean)('SIGUSR2');
      });

      expect(ran).toEqual(['step']);
      process.removeAllListeners('SIGUSR2');
    });
  });

  describe('shutdownGuard', () => {
    it('passes requests through while the server is healthy', () => {
      const next = jest.fn();
      const res = makeRes();

      shutdownGuard(['/api/health'])({ path: '/api/courses' } as Request, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects new requests with 503 during shutdown but still serves exempt paths', async () => {
      await performShutdown('SIGTERM', { steps: [], logger, onExit: jest.fn() });
      const guard = shutdownGuard(['/api/health']);

      const exemptNext = jest.fn();
      const exemptRes = makeRes();
      guard({ path: '/api/health' } as Request, exemptRes, exemptNext);
      expect(exemptNext).toHaveBeenCalledTimes(1);
      expect(exemptRes.status).not.toHaveBeenCalled();

      const blockedNext = jest.fn();
      const blockedRes = makeRes();
      guard({ path: '/api/courses' } as Request, blockedRes, blockedNext);
      expect(blockedNext).not.toHaveBeenCalled();
      expect(blockedRes.setHeader).toHaveBeenCalledWith('Connection', 'close');
      expect(blockedRes.status).toHaveBeenCalledWith(503);
      expect(blockedRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe('closeHttpServer', () => {
    it('resolves once the server closes and eagerly frees idle sockets', async () => {
      const closeIdleConnections = jest.fn();
      const server = {
        close: (cb: (err?: Error) => void) => cb(),
        closeIdleConnections,
      };

      await expect(closeHttpServer(server as never)).resolves.toBeUndefined();
      expect(closeIdleConnections).toHaveBeenCalledTimes(1);
    });

    it('rejects when the server fails to close', async () => {
      const server = { close: (cb: (err?: Error) => void) => cb(new Error('not running')) };

      await expect(closeHttpServer(server as never)).rejects.toThrow('not running');
    });
  });
});
