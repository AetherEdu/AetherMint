/**
 * Shared Prometheus registry.
 *
 * All metric modules register against this single registry so that every
 * series is exposed together on `GET /api/metrics`. Extracted from
 * `middleware/metrics.ts` so that metrics modules (e.g. `slo.ts`) can
 * register their collectors without creating an import cycle with the
 * Express middleware.
 */

import client from 'prom-client';

export const register = new client.Registry();
register.setDefaultLabels({
  app: 'aethermint-backend',
});

// Enable default metrics (event loop lag, heap, GC, process CPU, open handles, etc.)
client.collectDefaultMetrics({ register, prefix: 'aethermint_' });

export default register;
