/**
 * Bridge routes – legacy placeholder (PR #349 followup)
 *
 * `src/index.ts` still mounts a router at `/api/bridge/*` via
 * `require('./routes/bridge')`, but the historical `bridge` route module was
 * removed when `crossProtocolBridge` was introduced (the cross-protocol
 * bridge uses a different mount path: `/api/cross-protocol-bridge/*`).
 *
 * Without this stub, `require('../src/index')` in any test loads flutter and
 * throws `Cannot find module './routes/bridge'`, taking every dependent test
 * (including `tests/docs/openapi.test.js`) down with it.
 *
 * This file re-exports the cross-protocol bridge router so the app boots. The
 * full set of `/api/bridge/send`, `/api/bridge/message/{messageId}`, and
 * `/api/bridge/stats` endpoints declared in `swagger.ts` still need to be
 * implemented – tracked separately.
 */

const router = require('./crossProtocolBridge');

// `crossProtocolBridge.ts` uses ES `export default router;` while everything
// else in this folder uses CJS `module.exports`. `resolveRoute` in
// `src/index.ts` handles both shapes; reproduce the same disambiguation here.
module.exports = router.default || router;
