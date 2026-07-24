/**
 * Graceful shutdown coordination for the HTTP and WebSocket servers.
 *
 * On `SIGTERM` or `SIGINT` the process must stop accepting new work, let
 * in-flight requests drain, close long-lived connections (WebSocket, Redis,
 * database), and exit with a code that reflects whether the drain finished in
 * time. The coordinator here is deliberately dependency injected: callers pass
 * the ordered cleanup steps plus an {@link GracefulShutdownOptions.onExit} hook,
 * so the same logic can be unit tested without spawning real servers or
 * terminating the test runner.
 */

import type { Server as HttpServer } from 'http';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ServiceUnavailableError } from './errors';

/** Minimal logger surface so tests can inject a spy and production can pass Winston. */
export interface ShutdownLogger {
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
}

/** A single named cleanup action, run during shutdown in registration order. */
export interface ShutdownStep {
  /** Human readable label used in shutdown logs. */
  name: string;
  /** Performs the cleanup. May be async; a rejection is logged, not fatal. */
  run: () => Promise<void> | void;
}

/** Options controlling a single shutdown run. */
export interface GracefulShutdownOptions {
  /** Ordered cleanup steps, e.g. drain HTTP, close sockets, then close Redis. */
  steps: ShutdownStep[];
  /** Hard deadline for the whole sequence. Defaults to {@link DEFAULT_GRACE_MS}. */
  graceMs?: number;
  /** Logger for progress and errors. Defaults to the console. */
  logger?: ShutdownLogger;
  /** Called exactly once with the final exit code. Defaults to `process.exit`. */
  onExit?: (code: number) => void;
  /** Signals to listen on. Defaults to `SIGTERM` and `SIGINT`. */
  signals?: NodeJS.Signals[];
}

/**
 * Default grace period before a stuck shutdown is forced. Overridable with the
 * `GRACEFUL_SHUTDOWN_TIMEOUT_MS` environment variable (issue #170 default: 30s).
 */
export const DEFAULT_GRACE_MS = Number(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS) || 30_000;

let shuttingDown = false;

/** True once a shutdown signal has been received and draining has begun. */
export const isShuttingDown = (): boolean => shuttingDown;

/**
 * Resets the module-level shutdown flag. Intended for tests only, so each case
 * starts from a known state.
 */
export const resetShutdownState = (): void => {
  shuttingDown = false;
};

/**
 * Express middleware that rejects new requests with `503` once shutdown has
 * begun, so load balancers stop routing traffic while in-flight work drains.
 * Paths listed in `exemptPaths` (for example the health probe) are still served
 * so orchestrators can observe the "shutting down" state.
 *
 * Emits RFC 7807 ProblemDetails via the central handler.
 */
export const shutdownGuard = (exemptPaths: string[] = []): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!shuttingDown || exemptPaths.includes(req.path)) {
      next();
      return;
    }
    res.setHeader('Connection', 'close');
    next(new ServiceUnavailableError('Server is shutting down'));
  };
};

/**
 * Stops the HTTP server from accepting new connections and resolves once all
 * in-flight requests have completed. Idle keep-alive sockets are closed eagerly
 * (Node >= 18.2) so the drain does not block on otherwise quiet connections.
 */
export const closeHttpServer = (server: HttpServer): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
    (server as { closeIdleConnections?: () => void }).closeIdleConnections?.();
  });

/**
 * Runs the cleanup steps in order, racing the whole sequence against the grace
 * period. Returns `0` on a clean drain and `1` if the deadline was hit. A second
 * call while a shutdown is already in progress is ignored and returns `-1`.
 *
 * Steps are awaited sequentially; a step that throws is logged and the remaining
 * steps still run, so one stuck dependency cannot strand the others.
 */
export const performShutdown = async (
  signal: string,
  options: GracefulShutdownOptions,
): Promise<number> => {
  const { steps } = options;
  const logger: ShutdownLogger = options.logger ?? console;
  const graceMs = options.graceMs ?? DEFAULT_GRACE_MS;

  if (shuttingDown) {
    logger.warn(`Received ${signal} while already shutting down; ignoring`);
    return -1;
  }
  shuttingDown = true;
  logger.info(`${signal} received, starting graceful shutdown`, { graceMs });

  const drain = (async (): Promise<number> => {
    for (const step of steps) {
      try {
        await step.run();
        logger.info(`Shutdown step complete: ${step.name}`);
      } catch (err) {
        logger.error(`Shutdown step failed: ${step.name}`, err);
      }
    }
    return 0;
  })();

  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<number>((resolve) => {
    timer = setTimeout(() => {
      logger.error(`Graceful shutdown exceeded ${graceMs}ms, forcing exit`);
      resolve(1);
    }, graceMs);
    timer.unref?.();
  });

  const code = await Promise.race([drain, deadline]);
  if (timer) {
    clearTimeout(timer);
  }
  logger.info(`Graceful shutdown finished with exit code ${code}`);
  options.onExit?.(code);
  return code;
};

/**
 * Registers process signal handlers that trigger {@link performShutdown} and
 * then exit with the resulting code. Call this exactly once during startup.
 * Repeated signals are absorbed by {@link performShutdown}'s idempotency guard.
 */
export const registerShutdownHandlers = (options: GracefulShutdownOptions): void => {
  const signals = options.signals ?? (['SIGTERM', 'SIGINT'] as NodeJS.Signals[]);
  const onExit = options.onExit ?? ((code: number): never => process.exit(code));
  for (const signal of signals) {
    process.on(signal, () => {
      void performShutdown(signal, { ...options, onExit });
    });
  }
};
