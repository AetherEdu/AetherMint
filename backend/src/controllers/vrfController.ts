/**
 * VRF (Verifiable Random Function) Controller – stub (PR #349 followup)
 *
 * `src/routes/vrf.ts` imports three handler functions from this module,
 * but the full implementation has not yet been built.  Without this stub,
 * requiring `src/index.ts` in tests (including
 * `tests/docs/openapi.test.js`) fails with:
 *
 *   Cannot find module '../controllers/vrfController'
 *   from 'src/routes/vrf.ts'
 *
 * which takes every dependent test down.
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI / Swagger introspection can proceed without
 * crashing.  Real implementations are tracked separately.
 */

import { Request, Response } from 'express';

export const generateRandom = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'VRF – generateRandom not yet implemented',
  });
};

export const verifyProof = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'VRF – verifyProof not yet implemented',
  });
};

export const getVRFOutput = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'VRF – getVRFOutput not yet implemented',
  });
};
