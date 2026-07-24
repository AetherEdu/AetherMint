/**
 * Time-Lock Credential Controller – stub (PR #349 followup)
 *
 * `src/routes/timeLockCredentials.ts` imports four handler functions from
 * this module, but the full implementation has not yet been built.  Without
 * this stub, requiring `src/index.ts` in tests (including
 * `tests/docs/openapi.test.js`) fails with:
 *
 *   Cannot find module '../controllers/timeLockController'
 *   from 'src/routes/timeLockCredentials.ts'
 *
 * which takes every dependent test down.
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI / Swagger introspection can proceed without
 * crashing.  Real implementations are tracked separately.
 */

import { Request, Response } from 'express';

export const createTimeLockCredential = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Time-lock credentials – createTimeLockCredential not yet implemented',
  });
};

export const releaseCredential = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Time-lock credentials – releaseCredential not yet implemented',
  });
};

export const getCredential = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Time-lock credentials – getCredential not yet implemented',
  });
};

export const getStatus = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Time-lock credentials – getStatus not yet implemented',
  });
};
