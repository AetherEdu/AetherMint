# IPFS Integration Guide

AetherMint stores educational content (course materials, media, documents,
certificates) on [IPFS](https://docs.ipfs.tech/), a content-addressable storage
network. Only the resulting **CID** is anchored on-chain, keeping credential
verification trustless while large files stay off-chain.

For the rationale behind this decision, see
[ADR-003: IPFS for Decentralized Content Storage](docs/adr/003-ipfs-storage.md).

## How it fits together

```
Client ──upload──▶ Backend /api/content/upload ──▶ IPFS node ──▶ CID
                                     │
                                     └──▶ CID stored in Soroban contract / DB
```

- **Content addressing** — every file is identified by the CID, a cryptographic
  hash of its bytes. A CID either resolves to the exact content or it does not.
- **On-chain references** — Soroban contracts store only the `ipfs_hash` (CID)
  field, never the content itself (see `contracts/src/credentials.rs`).
- **Pinning** — curated content is pinned so it stays retrievable.
- **Gateway fallback** — retrieval goes through a configurable gateway
  (`IPFS_GATEWAY_URL`), so a public gateway, a private gateway, or a local node
  can all be used.

## Configuration

IPFS settings are validated at startup in
[`backend/src/config/ipfs.js`](backend/src/config/ipfs.js). Copy
[`backend/.env.example`](backend/.env.example) to `backend/.env` and set the
values relevant to your node.

| Variable | Default | Purpose |
|----------|---------|---------|
| `IPFS_HOST` | `localhost` | IPFS API host |
| `IPFS_PORT` | `5001` | IPFS API port |
| `IPFS_PROTOCOL` | `http` | API protocol (`http` / `https`) |
| `IPFS_API_PATH` | `/api/v0` | IPFS API path |
| `IPFS_GATEWAY_URL` | `https://ipfs.io/ipfs/` | Gateway used to read content |
| `IPFS_MAX_FILE_SIZE` | `104857600` | Max upload size in bytes (100 MB) |
| `IPFS_CHUNK_SIZE` | `1048576` | Chunk size in bytes (1 MB) |
| `IPFS_AUTO_PIN` | `true` | Pin uploads automatically |
| `IPFS_PIN_TIMEOUT` | `30000` | Pin/API timeout in ms |
| `IPFS_ENABLE_CACHE` | `true` | Enable the in-memory content cache |
| `IPFS_CACHE_TIMEOUT` | `3600000` | Cache TTL in ms |
| `IPFS_MAX_RETRIES` | `3` | Upload retry attempts |
| `IPFS_RETRY_DELAY` | `1000` | Delay between retries in ms |
| `IPFS_AUTH_ENABLED` | `false` | Enable auth against a private/cluster gateway |
| `IPFS_AUTH_USERNAME` / `IPFS_AUTH_PASSWORD` | — | Basic auth credentials |
| `IPFS_AUTH_TOKEN` | — | Bearer token (alternative to basic auth) |
| `IPFS_INCLUDE_TIMESTAMP` | `true` | Include upload timestamp in metadata |
| `IPFS_INCLUDE_UPLOADER` | `true` | Include uploader identity in metadata |
| `IPFS_INCLUDE_CONTENT_TYPE` | `true` | Include content type in metadata |
| `IPFS_INCLUDE_FILE_SIZE` | `true` | Include file size in metadata |

If `IPFS_AUTH_ENABLED=true` but no credentials are supplied, startup validation
fails fast with a descriptive error.

## Running a local IPFS node

The easiest way to develop against a real node:

```bash
# Install the IPFS CLI (https://docs.ipfs.tech/install/)
ipfs init
ipfs daemon
```

The default API endpoint is `http://localhost:5001` and the default gateway is
`http://localhost:8080/ipfs/`. Point `IPFS_GATEWAY_URL` at the gateway you want
to use for reads.

## API endpoints

See the backend route definitions in
[`backend/src/routes/`](backend/src/routes/) and the interactive reference at
`http://localhost:3001/api/docs`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/content/upload` | Upload a file to IPFS with metadata |
| `POST` | `/api/content/upload/batch` | Upload multiple files |
| `GET` | `/api/content/:cid` | Retrieve content (buffer, base64, or stream) |
| `GET` | `/api/content/:cid/metadata` | Fetch content metadata |
| `POST` | `/api/content/:cid/pin` | Pin content |
| `DELETE` | `/api/content/:cid/pin` | Unpin content |
| `GET` | `/api/content/health` | Check IPFS service health |

## Client usage

The canonical client implementation lives in
[`frontend/src/lib/ipfs.ts`](frontend/src/lib/ipfs.ts) and is shared by the
frontend upload/retrieval components.

```typescript
import ipfsClient from './lib/ipfs';

// Upload a file
const result = await ipfsClient.uploadFile(file, {
  metadata: { course: 'math101' },
  onProgress: (progress) => console.log(`${progress.progress}%`),
});

// Retrieve content
const content = await ipfsClient.getContent(result.cid, 'base64');
```

For authenticated gateways, call `ipfsClient.setAuthToken(token)` before making
requests.

## Testing

The IPFS helpers are covered by unit tests, with the `ipfs-http-client` module
mocked so tests do not require a running daemon:

```bash
cd backend
npm test -- tests/ipfs-test.js
```

The mock lives at `backend/tests/__mocks__/ipfs-http-client.js`.

## Security notes

- Uploads are size- and content-type-restricted (see `allowedContentTypes` in
  `backend/src/config/ipfs.js`).
- Only the CID is stored on-chain. Never place secrets or private keys in
  content that will be published to IPFS — pinned content is public.
- IPFS is **not** an access-control layer. Sensitive material must be encrypted
  before upload; the CID proves integrity, not confidentiality.
