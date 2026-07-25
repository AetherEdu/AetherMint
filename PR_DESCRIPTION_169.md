## Description

This PR implements a Prometheus metrics endpoint (`GET /api/metrics`) for backend observability, as described in #169.

Previously, the backend logged via Winston but lacked a metrics export for monitoring systems like Prometheus/Grafana. This change adds comprehensive application instrumentation using `prom-client`, exposing all metrics in standard Prometheus text format.

### Metrics Implemented

| Category | Metric | Type | Labels |
|---|---|---|---|
| **HTTP** | `aethermint_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` |
| **HTTP** | `aethermint_http_requests_total` | Counter | `method`, `route`, `status_code` |
| **WebSocket** | `aethermint_websocket_connections_active` | Gauge | — |
| **Redis** | `aethermint_redis_operations_total` | Counter | `operation` (cache_set/get/delete), `status` (hit/miss/error) |
| **Database** | `aethermint_database_query_duration_seconds` | Histogram | `operation`, `collection` |
| **Business** | `aethermint_credential_issuance_total` | Counter | `type` |
| **Business** | `aethermint_enrollment_total` | Counter | — |
| **Business** | `aethermint_course_completion_total` | Counter | — |
| **System** | `aethermint_*` (defaults) | Various | Node.js event loop, memory, GC, CPU, open handles |

All default Prometheus metrics (event loop lag, heap memory, GC pauses, etc.) are also collected automatically.

### Security

The `/api/metrics` endpoint is protected by an `X-Internal-Key` header when the `INTERNAL_METRICS_KEY` environment variable is set. In development (no key configured), the endpoint is openly accessible for convenience. An invalid or missing key returns HTTP 401.

### Files Changed

| File | Change |
|---|---|
| `backend/package.json` | Added `prom-client: ^15.1.3` |
| `backend/src/middleware/metrics.ts` | **New** — Prometheus registry, all metric definitions, Express middleware for HTTP metrics |
| `backend/src/routes/metrics.ts` | **New** — `GET /api/metrics` route with internal auth protection |
| `backend/src/index.ts` | Integrated `metricsMiddleware` into the middleware stack; mounted `/api/metrics` route; WebSocket connection gauge updated every 15s with cleanup on graceful shutdown |
| `backend/src/utils/redis.ts` | Instrumented `cachePermissions`, `getCachedPermissions`, `clearCachedPermissions` with Redis hit/miss/error counters |
| `backend/src/services/eventLoggerService.ts` | Instrumented `logCredentialIssuance`, `logCourseCompletion`, `logCourseEnrollment` with business counters |

Fixes #169

## Architecture Decision Records

- [x] This change does not require a new ADR (no architectural decision made)

## Type of Change

- [x] New feature (non-breaking change which adds functionality)

## How to Test

### 1. Install dependencies

```bash
cd backend && npm install
```

### 2. Start the backend

```bash
npm run dev
# or: npx ts-node src/index.ts
```

### 3. Curl the metrics endpoint

#### Development (no key required):

```bash
curl http://localhost:3001/api/metrics
```

#### With internal auth key:

```bash
# Set the key
export INTERNAL_METRICS_KEY="my-secret-key"

# Access with the key
curl -H "X-Internal-Key: my-secret-key" http://localhost:3001/api/metrics

# Should return 401 without the key
curl http://localhost:3001/api/metrics
```

### 4. Verify output

The response should:
- Return HTTP 200 with `Content-Type: text/plain` (Prometheus text format)
- Include lines like:
  ```
  # HELP aethermint_http_request_duration_seconds Duration of HTTP requests in seconds
  # TYPE aethermint_http_request_duration_seconds histogram
  aethermint_http_request_duration_seconds_count{...}
  
  # HELP aethermint_websocket_connections_active Number of active WebSocket connections
  # TYPE aethermint_websocket_connections_active gauge
  aethermint_websocket_connections_active 0
  ```
- Show `method`, `route`, and `status_code` labels on HTTP metrics
- Include default Node.js metrics (heap, event loop, GC)

### 5. Grafana integration

Point any Prometheus instance to `http://<backend-host>:3001/api/metrics` with the appropriate `X-Internal-Key` header configured as a scrape header in `prometheus.yml`.

## Checklist

- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] TypeScript typecheck passes (`npx tsc --noEmit`)
- [x] HTTP metrics include `method`, `route`, and `status_code` labels
- [x] Endpoint is protected (internal-only key auth when `INTERNAL_METRICS_KEY` is set)
- [x] No impact on request latency (metrics collection is async and uses fast counters)
- [x] Dashboard-able via Grafana (standard Prometheus text format)
