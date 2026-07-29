# Architectural Decision Log

> AetherMint — Summary of Key Architectural Choices

This document aggregates and cross-references all significant architectural decisions made during AetherMint's development. Full decision records live in [`docs/adr/`](../adr/README.md).

---

## Decision Index

| ID | Decision | Status | Date | Impact |
|----|----------|--------|------|--------|
| [ADR-001](#adr-001-stellarsoroban-over-ethereumevm) | Stellar/Soroban over Ethereum/EVM | Accepted | 2024-06 | High |
| [ADR-002](#adr-002-dual-database-strategy) | Dual database (PostgreSQL + MongoDB) | Accepted | 2024-07 | High |
| [ADR-003](#adr-003-ipfs-for-content-storage) | IPFS for decentralized content storage | Accepted | 2024-08 | High |
| [ADR-004](#adr-004-federated-learning) | Federated learning for AI/ML | Accepted | 2024-09 | Medium |
| [ADR-005](#adr-005-quantum-resistant-cryptography) | Quantum-resistant cryptography | Proposed | 2024-10 | Medium |
| [ADR-006](#adr-006-microservices-lite-architecture) | Microservices-lite architecture | Accepted | 2024-06 | High |
| [ADR-007](#adr-007-typescript-gradual-migration) | TypeScript gradual migration | Accepted | 2024-06 | Medium |
| [DEC-008](#dec-008-redis-as-session--cache-layer) | Redis as session/cache layer | Implicit | 2024-06 | Medium |
| [DEC-009](#dec-009-prisma-orm-for-postgresql) | Prisma ORM for PostgreSQL | Implicit | 2024-06 | Medium |
| [DEC-010](#dec-010-soroban-storage-optimisation) | Soroban storage optimisation (bit packing) | Accepted | 2024-11 | Medium |
| [DEC-011](#dec-011-holographic-storage-abstraction) | Holographic storage abstraction layer | Experimental | 2024-12 | Low |
| [DEC-012](#dec-012-pnpm-workspaces-monorepo) | pnpm workspaces monorepo | Accepted | 2024-06 | High |

---

## Decision Details

### ADR-001: Stellar/Soroban over Ethereum/EVM

**Full ADR**: [`docs/adr/001-stellar-soroban-choice.md`](../adr/001-stellar-soroban-choice.md)

**Summary**: AetherMint uses Stellar (Layer-1) with Soroban smart contracts instead of Ethereum.

**Key reasons**:
- Stellar's 5-second finality vs Ethereum's ~12 seconds makes credential issuance significantly faster
- Transaction fees are fractions of a cent vs Ethereum's variable gas (often $5–$50+)
- Soroban contracts are written in Rust (memory-safe, WASM-compiled), aligning with the team's preference for type safety
- Stellar's built-in asset model makes XLM payments for course access simpler than ERC-20

**Trade-offs accepted**:
- Smaller developer ecosystem than Ethereum
- Fewer DeFi integrations available
- Some tooling is less mature (Soroban SDK is newer than Solidity toolchain)

**Affected components**: `contracts/`, `backend/src/services/stellarService.js`, `backend/src/utils/stellarUtils.js`, `frontend/src/lib/stellar.ts`

---

### ADR-002: Dual Database Strategy

**Full ADR**: [`docs/adr/002-dual-database-strategy.md`](../adr/002-dual-database-strategy.md)

**Summary**: Uses PostgreSQL as the primary relational store alongside Redis for caching and sessions. MongoDB was considered but PostgreSQL was selected as the dominant store.

**Current state**:
- **PostgreSQL** (via Prisma ORM): Users, courses, enrollments, payments, audit logs, assignments, quizzes, notifications
- **Redis** (via ioredis): Session cache, rate limiting counters, pub/sub for real-time features, job queues
- MongoDB: Mentioned in the ADR as an alternative; not actively used in the codebase currently

**Key reasons for PostgreSQL**:
- ACID transactions required for payment and enrollment operations
- Strong relational constraints (FK integrity) for credential–user–course relationships
- Prisma ORM provides excellent TypeScript type safety

**Key reasons for Redis**:
- Sub-millisecond cache lookups for hot paths (course listings, user profiles)
- Native pub/sub for WebSocket fan-out (collaboration, notifications)
- Sorted sets for leaderboards and analytics counters

**Affected components**: `backend/src/models/`, `backend/src/utils/redis.ts`, `backend/src/config/redis.ts`, `backend/src/services/redisCluster.js`

---

### ADR-003: IPFS for Content Storage

**Full ADR**: [`docs/adr/003-ipfs-storage.md`](../adr/003-ipfs-storage.md)

**Summary**: Course materials, credential metadata, and media assets are stored on IPFS rather than centralised object storage.

**Key reasons**:
- Content-addressed storage (CID) means content integrity is guaranteed — an IPFS CID is a hash of the content
- Decentralisation aligns with the platform's Web3 philosophy; no single storage provider can censor content
- Cost-efficient at scale: storage costs are distributed across nodes

**Trade-offs accepted**:
- Retrieval latency is higher than CDN-served S3 objects; mitigated by pinning services and in-memory caching
- Not suitable for frequently-mutating data (use PostgreSQL for that)
- Requires pinning strategy to prevent garbage collection of unpinned content

**Affected components**: `backend/src/services/ipfs.js`, `backend/src/config/ipfs.js`, `backend/src/middleware/ipfsAuth.js`, `backend/src/utils/ipfsUtils.js`, `frontend/src/lib/ipfs.ts`

---

### ADR-004: Federated Learning

**Full ADR**: [`docs/adr/004-federated-learning.md`](../adr/004-federated-learning.md)

**Summary**: AI/ML model training uses federated learning — models are trained on-device and only encrypted gradients are shared, not raw user data.

**Key reasons**:
- Privacy-preserving: student learning data never leaves the device
- GDPR/privacy regulation alignment without sacrificing personalisation
- Enables learning path recommendations without centralised user profiling

**Architecture**:
```
Devices ──encrypted gradients──► FL Coordinator ──secure aggregation──► Global Model
                                  (backend/src/services/
                                   federatedLearningCoordinator.js)
```

**Affected components**: `backend/src/services/federatedLearningCoordinator.js`, `backend/src/services/differentialPrivacyService.js`, `backend/src/services/secureMultiPartyComputation.js`, `backend/src/services/privacyPreservingAggregator.js`

---

### ADR-005: Quantum-Resistant Cryptography

**Full ADR**: [`docs/adr/005-quantum-resistant-crypto.md`](../adr/005-quantum-resistant-crypto.md)

**Status**: Proposed (not yet fully deployed)

**Summary**: Integrate post-quantum cryptographic algorithms (CRYSTALS-Kyber, CRYSTALS-Dilithium, SPHINCS+) alongside existing cryptography for future-proofing.

**Key reasons**:
- Cryptographically-relevant quantum computers could break RSA/ECDSA within the lifetime of issued credentials
- Educational credentials may need to remain valid for decades
- Early adoption reduces future migration cost

**Current state**: Service layer exists (`backend/src/services/quantumResistantCrypto.ts`, `backend/src/services/quantumKeyManagement.js`) but is not enforced on all paths. Migration plan defined in `backend/src/services/quantumMigrationService.js`.

---

### ADR-006: Microservices-Lite Architecture

**Full ADR**: [`docs/adr/006-architecture-style.md`](../adr/006-architecture-style.md)

**Summary**: pnpm monorepo with clear package boundaries (`contracts/`, `backend/`, `frontend/`, `backend/portal/`) rather than a full microservices deployment.

**Key reasons**:
- Team size doesn't justify the operational overhead of full microservices
- Technology-enforced boundaries (Rust vs TypeScript) prevent accidental coupling without infrastructure complexity
- Independent Dockerfiles allow each package to be deployed independently when needed

**Decomposition path**: `backend/microservices/` directory contains emerging microservices (api-gateway, auth-service, analytics-service, courses-service) that will be independently deployed as the platform scales.

---

### ADR-007: TypeScript Gradual Migration

**Full ADR**: [`docs/adr/007-typescript-strategy.md`](../adr/007-typescript-strategy.md)

**Summary**: New code is written in TypeScript; existing JavaScript is migrated incrementally. Both `.ts` and `.js` coexist in the backend.

**Strategy**:
- All new controllers, services, models → TypeScript (strict mode)
- Legacy routes and utilities → JavaScript with JSDoc until migrated
- `tsconfig.json` with `allowJs: true` bridges the gap

**Current state**: ~60% of backend files are TypeScript; all new files use TypeScript. Frontend is 100% TypeScript.

---

### DEC-008: Redis as Session / Cache Layer

**Status**: Implicit (no dedicated ADR)

**Summary**: Redis is used for session storage, rate limiting, pub/sub messaging, and job queues.

**Key reasons**:
- Native pub/sub eliminates need for an external message broker for WebSocket fan-out
- Atomic operations (INCR, SETEX) make rate limiting implementation simple and consistent
- Redis Cluster (`backend/src/services/redisCluster.js`) supports horizontal scaling

---

### DEC-009: Prisma ORM for PostgreSQL

**Status**: Implicit (no dedicated ADR)

**Summary**: Prisma is used as the ORM for all PostgreSQL interactions.

**Key reasons**:
- Type-safe query builder eliminates SQL injection risks by construction
- Schema migrations via `prisma migrate` are version-controlled
- Auto-generated TypeScript types from schema keep models and queries in sync

---

### DEC-010: Soroban Storage Optimisation

**Status**: Accepted (documented in README.md)

**Summary**: Smart contracts use bit packing, hash-based storage, and separate storage tiers to reduce on-chain storage costs.

**Results**:
- 30% fewer storage slots across all contracts (~9,000 gas saved per deployment)
- Bit-packed `PackedTimestamps` and `PackedUserFlags` structs in `contracts/src/utils/storage.rs`

---

### DEC-011: Holographic Storage Abstraction

**Status**: Experimental

**Summary**: A software abstraction layer (`backend/src/services/holographicStorage.ts`) simulates 3D spatial data encoding with wavelet-based compression, designed for future physical holographic storage hardware integration.

**Current use**: Not used in production data paths. Available as an optional storage backend for research purposes.

---

### DEC-012: pnpm Workspaces Monorepo

**Status**: Accepted

**Summary**: All packages are managed in a single repository with pnpm workspaces for dependency deduplication and cross-package scripting.

**Key reasons**:
- Single `pnpm install` installs all workspace dependencies
- Shared tooling (ESLint, TypeScript configs) reduces duplication
- Atomic commits spanning contracts + backend + frontend changes are possible

---

## Architectural Principles

These principles guide all decisions in AetherMint:

1. **Decentralisation first** — prefer on-chain or distributed solutions when viable; use centralised components only where necessary (DB, Redis)
2. **Privacy by design** — federated learning, differential privacy, and quantum-resistant crypto are first-class concerns, not afterthoughts
3. **Security layers** — defence in depth: input sanitisation → authentication → RBAC → rate limiting → audit logging
4. **Gradual evolution** — microservices-lite allows incremental decomposition; TypeScript migration is gradual; quantum crypto is opt-in
5. **Storage efficiency** — on-chain storage is expensive; bit packing and hash-based storage reduce costs; IPFS offloads binary data
6. **Observability** — Winston logging, audit trails, Swagger/OpenAPI documentation, health endpoints on all services

---

*For full decision records, see [`docs/adr/`](../adr/README.md).*
