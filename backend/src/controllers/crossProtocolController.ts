/**
 * Cross-Protocol Bridge Controller – stub (PR #349 followup)
 *
 * `src/routes/crossProtocolBridge.ts` imports four handler functions from
 * this module, but the full implementation has not yet been built.  Without
 * this stub, requiring `src/index.ts` in tests (including
 * `tests/docs/openapi.test.js`) fails with:
 *
 *   Cannot find module '../controllers/crossProtocolController'
 *   from 'src/routes/crossProtocolBridge.ts'
 *
 * which takes every dependent test down.
 *
 * The stub returns `501 Not Implemented` for every endpoint so the route
 * mounts cleanly and OpenAPI / Swagger introspection can proceed without
 * crashing.  Real implementations for `/api/bridge/send`,
 * `/api/bridge/message/{messageId}`, and `/api/bridge/stats` (declared in
 * `swagger.ts`) are tracked separately.
 */

import { Request, Response } from 'express';

export const bridgeAssets = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Cross-protocol bridge – bridgeAssets not yet implemented',
  });
};

export const getBridgeStatus = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Cross-protocol bridge – getBridgeStatus not yet implemented',
  });
};

export const getSupportedProtocols = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Cross-protocol bridge – getSupportedProtocols not yet implemented',
  });
};

export const validateAddress = (_req: Request, res: Response): void => {
  res.status(501).json({
    success: false,
    message: 'Cross-protocol bridge – validateAddress not yet implemented',
  });
};
