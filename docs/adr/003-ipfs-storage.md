# ADR-003: IPFS for Decentralized Content Storage

**Status**: Accepted

**Date**: 2024-08

**Deciders**: Core development team

## Context

AetherMint stores educational content (course materials, videos, documents, certificates) that must be:
- **Tamper-proof**: Content integrity must be verifiable independently of any central server
- **Censorship-resistant**: Content should not be removable by any single party
- **Verifiable**: Content hashes on-chain must resolve to the correct off-chain data
- **Cost-effective**: Storing large files (videos, PDFs) directly on-chain is prohibitively expensive

Centralized storage (AWS S3, CloudFront) would create a single point of failure and trust. The credential verification model requires that the content a credential references can be independently verified by any third party without trusting AetherMint's servers.

## Decision

We will use **IPFS** (InterPlanetary File System) as the primary content-addressable storage layer, integrated via the **`ipfs-http-client`** (v60) JavaScript library.

Specifically:
- **Content addressing**: All content is identified by its CID (Content Identifier), which is a cryptographic hash of the content
- **On-chain references**: Smart contracts store only the IPFS CID (`ipfs_hash` field), not the content itself
- **Pinning**: Critical content (course materials, issued certificates) is pinned to ensure availability
- **Gateway fallback**: Multiple IPFS gateways configured for content retrieval redundancy
- **Upload pipeline**: Backend `/api/content/upload` endpoint handles file upload, IPFS storage, and CID return

## Alternatives Considered

### Centralized Cloud Storage (S3 + CDN)
- **Pros**: Simple, fast, reliable, well-understood
- **Cons**: Single point of trust and failure; content can be removed or modified server-side; verification requires trusting the server operator
- **Why rejected**: Contradicts the core value proposition of decentralized, trustless credential verification. A verifier should not need to trust AetherMint's servers to verify a credential.

### Arweave
- **Pros**: Permanent storage, single payment for perpetual hosting
- **Cons**: Higher cost per byte, slower retrieval, smaller ecosystem, content cannot be removed even if legally required
- **Why rejected**: The permanence model creates legal compliance risks (right to be forgotten). IPFS with pinning provides sufficient durability without the permanence obligation.

### Filecoin
- **Pros**: Economic incentives for storage providers, verifiable storage proofs
- **Cons**: Complex retrieval market, variable pricing, slower content availability during market fluctuations
- **Why rejected**: Adds complexity without proportional benefit. IPFS with self-pinning provides sufficient guarantees for educational content.

### On-chain storage (Soroban persistent storage)
- **Pros**: Maximum integrity, no external dependency
- **Cons**: Extremely expensive for large files (~$0.50/KB for persistent storage), not practical for videos or PDFs
- **Why rejected**: Economic non-viability for educational content. On-chain storage is reserved for credential metadata only.

## Consequences

### Positive
- **Content integrity**: CIDs provide cryptographic proof that content has not been tampered with
- **Decentralized verification**: Any third party can retrieve and verify content using only the CID, without trusting AetherMint
- **Deduplication**: Content-addressable storage naturally deduplicates identical files
- **Offline capability**: IPFS content can be cached locally for offline access

### Negative
- **Availability dependency**: Content availability depends on pinning services. If a CID is not pinned, it may become unavailable.
- **Latency**: IPFS retrieval can be slower than CDN-backed cloud storage, especially for first-time access to unpinned content
- **Gateway reliability**: Public IPFS gateways may rate-limit or go offline; private gateway adds infrastructure cost
- **Large file handling**: Very large files (1GB+ videos) require chunking and may have poor IPFS performance

### Neutral
- **Backend API**: Content upload/download flows through the backend as an IPFS proxy
- **Pinning strategy**: Critical content must be actively pinned; non-critical content may rely on the IPFS network
- **Monitoring**: IPFS node health and pin status need monitoring

## References

- [IPFS Documentation](https://docs.ipfs.tech/)
- `frontend/src/lib/ipfs.ts` — IPFS client utilities (frontend and backend share IPFS logic)
- `backend/package.json` — `ipfs-http-client` v60 dependency
- `contracts/src/credentials.rs` — On-chain `ipfs_hash` field storage
