# Architecture Documentation

> AetherMint — Decentralized Education Platform on Stellar/Soroban

This directory contains visual architecture diagrams (C4 model) and comprehensive system documentation for AetherMint. It serves as the onboarding reference for new contributors and the primary reference for architectural decision-making.

---

## Documents

| Document | Description |
|----------|-------------|
| [C4 Level 1: System Context](./c4-level1-system-context.md) | AetherMint in its environment — users and external systems |
| [C4 Level 2: Container Diagram](./c4-level2-container.md) | All deployable containers: frontend, backend, contracts, DB, IPFS |
| [C4 Level 3: Component Diagrams](./c4-level3-components.md) | Internal components of major services (backend, contracts, frontend, ML) |
| [Data Flow Diagrams](./data-flow-diagrams.md) | End-to-end flows for key operations (credential issuance, enrollment, auth, collaboration, federated learning, verification) |
| [Decision Log](./decision-log.md) | Summary and cross-reference of all architectural decisions |

---

## Quick Reference: Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Blockchain** | Stellar + Soroban SDK 26.1.0 | Smart contracts in Rust/WASM |
| **Backend** | Node.js 18, Express.js, TypeScript | REST API + WebSocket (Socket.IO) |
| **Frontend** | Next.js 14, TypeScript, TailwindCSS | App Router, PWA, 10+ languages |
| **Admin Portal** | Next.js, TypeScript | Tenant/user management |
| **Primary DB** | PostgreSQL + Prisma ORM | Users, courses, enrollments, payments |
| **Cache / Queue** | Redis (ioredis) | Sessions, rate limiting, pub/sub |
| **Content Storage** | IPFS | Course materials, credential metadata |
| **ML / AI** | Python (ML modules), JavaScript | Federated learning, recommendations |
| **Quantum** | Python (quantum modules) | Quantum-resistant crypto, QML |
| **Monorepo** | pnpm workspaces | Independent Dockerfiles per package |

---

## Architecture Summary

AetherMint is a **microservices-lite monorepo** (see [ADR-006](../adr/006-architecture-style.md)). The system is split into four independently deployable packages:

```
aethermint/
├── contracts/        ← Soroban smart contracts (Rust)
├── backend/          ← Express REST API + WebSocket (Node.js/TypeScript)
│   ├── microservices/ ← Emerging microservices (api-gateway, auth, analytics, courses)
│   └── portal/       ← Admin/educator Next.js app
├── frontend/         ← Student-facing Next.js app
└── docs/
    ├── adr/          ← Architecture Decision Records
    └── architecture/ ← This directory
```

Key architectural properties:
- **On-chain**: credentials, course metadata, user profiles, governance, marketplace — all anchored to Stellar
- **Off-chain**: course content, media, metadata blobs — stored on IPFS with CIDs referenced on-chain
- **Relational**: user accounts, enrollments, payments, audit logs — PostgreSQL via Prisma
- **Real-time**: collaboration, notifications, proctoring — WebSocket via Socket.IO + Redis pub/sub
- **Privacy-preserving**: AI/ML recommendations via federated learning with differential privacy

---

## Related Documentation

- [`docs/adr/`](../adr/README.md) — Architecture Decision Records (ADR-001 through ADR-007)
- [`backend/docs/`](../../backend/docs/) — Service-specific documentation (federated learning API, CDN, quantum communication, smart wallet)
- [`backend/README.md`](../../backend/README.md) — Backend setup and API overview
- [`frontend/README.md`](../../frontend/README.md) — Frontend setup and feature overview
- [`contracts/DNA_STORAGE_README.md`](../../contracts/DNA_STORAGE_README.md) — DNA storage contract documentation
- [`IPFS_INTEGRATION_README.md`](../../IPFS_INTEGRATION_README.md) — IPFS integration guide

---

## Viewing the Diagrams

All diagrams in this directory use **ASCII art** and **Markdown tables** for maximum portability — they render correctly in any Markdown viewer, GitHub, VS Code, or terminal.

For richer interactive diagrams, the ASCII art in each file can be converted to:
- [Mermaid.js](https://mermaid.js.org/) — paste the structure into a Mermaid diagram
- [Structurizr](https://structurizr.com/) — for formal C4 tooling
- [draw.io](https://draw.io/) — for visual editing

---

*Last updated: 2026-07. Maintained by the AetherMint core team.*
