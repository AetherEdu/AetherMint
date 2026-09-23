# Holographic Storage System

AetherMint includes a **holographic storage abstraction layer** that simulates
3D spatial data storage. It is a software model — not a physical holographic
drive — built to explore and expose a hardware-ready API for future storage
technologies.

Implementation: [`backend/src/services/holographicStorage.ts`](src/services/holographicStorage.ts)
Controller: [`backend/src/controllers/holographicController.ts`](src/controllers/holographicController.ts)
Routes: [`backend/src/routes/holographicRoutes.ts`](src/routes/holographicRoutes.ts)

## What it does

1. **3D spatial encoding** — content is split into 64-byte chunks; each chunk is
   hashed and mapped to a point in 3D space `(x, y, z)` with a `phase` and
   `amplitude`, mimicking an interference pattern.
2. **Holographic compression** — a reversible average/difference (Haar-style
   wavelet) transform reduces payload size before storage.
3. **Parallel access** — multiple hashes are resolved concurrently for
   high-throughput retrieval.
4. **Density optimization & metrics** — reports storage density, simulated access
   speed, and compression ratio.

> **Important:** this is an in-memory simulation. Data is held in a `Map` and is
> lost when the process restarts. It is intended as an interface/abstraction for
> future physical hardware, not as a durable production store. Durable content
> belongs on IPFS (see [`../IPFS_INTEGRATION_README.md`](../IPFS_INTEGRATION_README.md)).

## API endpoints

All routes are mounted at `/api/holographic` and `/api/v1/holographic`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/holographic/encode` | Encode base64 content into holographic format |
| `GET` | `/api/holographic/decode/:hash` | Decode content by its hash |
| `POST` | `/api/holographic/access/parallel` | Retrieve multiple objects concurrently |
| `GET` | `/api/holographic/metrics` | Storage density, access speed, compression ratio |
| `POST` | `/api/holographic/optimize` | Recompute density and return before/after metrics |

Interactive documentation is served by the backend at
`http://localhost:3001/api/docs` (see the **Holographic** tag).

## Usage

### Encode content

```bash
curl -X POST http://localhost:3001/api/holographic/encode \
  -H "Content-Type: application/json" \
  -d '{
    "contentId": "course-101",
    "data": "<base64-encoded-bytes>"
  }'
```

Response:

```json
{
  "success": true,
  "hash": "9f2c...e1",
  "spatialPoints": 32,
  "message": "Content encoded in holographic format"
}
```

The `hash` is the SHA-256 of the original data.

### Decode content

```bash
curl http://localhost:3001/api/holographic/decode/<hash>
```

### Parallel access

```bash
curl -X POST http://localhost:3001/api/holographic/access/parallel \
  -H "Content-Type: application/json" \
  -d '{ "hashes": ["<hash1>", "<hash2>", "<hash3>"] }'
```

### Metrics

```bash
curl http://localhost:3001/api/holographic/metrics
```

## Testing

Unit tests cover encode/decode round-trips, parallel access, metrics, and
missing-content handling:

```bash
cd backend
npm test -- tests/holographicStorage.test.ts
```

## Design notes

- The compression transform is lossless and reversible, so
  `decode(encode(data).hash)` returns the original bytes.
- `decode` returns `null` for an unknown hash; the controller maps this to a
  `404 NotFoundError`.
- Storage is process-local and cleared via `holographicStorage.clear()`, which
  the test suite uses between cases.
