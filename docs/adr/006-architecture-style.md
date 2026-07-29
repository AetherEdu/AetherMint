# ADR-006: Microservices-Lite Architecture (Monolith with Service Boundaries)

**Status**: Accepted

**Date**: 2024-06

**Deciders**: Core development team

## Context

AetherMint needs to serve a diverse set of features: course management, credential verification, real-time collaboration (WebSocket), AI/ML processing, IPFS content storage, analytics, and Web3 wallet integration.

Two architectural extremes exist:
- **Monolith**: Single deployable with all features in one process
- **Microservices**: Each feature as an independent deployable service

A pure microservice architecture at this stage would introduce operational complexity disproportionate to the team size and current scale. However, a pure monolith would create tight coupling that makes future decomposition difficult.

## Decision

We will use a **microservices-lite** architecture: a monorepo with clear service boundaries enforced by convention (not infrastructure), organized as independently-deployable packages within a pnpm workspace.

| Package | Role | Boundaries |
|---------|------|------------|
| `contracts/` | Soroban smart contracts (Rust) | On-chain logic, isolated from backend |
| `backend/` | Express API server (Node.js/TypeScript) | HTTP API, WebSocket, IPFS proxy, ML coordination |
| `frontend/` | Next.js application (React/TypeScript) | Client UI, client-side ML, Web3 wallet integration |
| `portal/` | Admin/educator portal (Next.js) | Separate admin UI with elevated permissions |

Specifically:
- **pnpm workspaces** (`pnpm-workspace.yaml`) for dependency management across packages
- **Independent Dockerfiles**: Backend and frontend each have their own `Dockerfile` for independent deployment; contracts are built directly via `cargo build` in CI
- **Shared contracts**: Frontend and backend both depend on contract ABIs/types
- **API-first**: Backend exposes REST API consumed by both frontend and portal
- **Event-driven**: WebSocket for real-time features (collaboration, proctoring)
- **Independent build/test per package**: Each package can be built and tested independently

## Alternatives Considered

### Pure monolith (single service)
- **Pros**: Simple deployment, single codebase, easy local development, no network latency between components
- **Cons**: Scaling limitations (cannot scale contracts independently from API), tight coupling, harder to reason about boundaries
- **Why rejected**: The blockchain + backend + frontend separation is natural and enforced by technology differences (Rust vs TypeScript). Forcing these into one deployable would be artificial.

### Pure microservices
- **Pros**: Independent scaling, isolated failure domains, per-service technology choice, team autonomy
- **Cons**: Operational complexity (service discovery, distributed tracing, network unreliability), deployment coordination, data consistency challenges, higher infrastructure cost
- **Why rejected**: Team size and current scale don't justify the operational overhead. Premature decomposition into microservices creates more problems than it solves.

### Backend-for-Frontend (BFF)
- **Pros**: Tailored APIs for each client, optimized data shapes
- **Cons**: Duplicated logic across BFFs, maintenance burden
- **Why rejected**: The current API surface is well-served by a single backend. A BFF pattern can be introduced later if client-specific optimization becomes necessary.

## Consequences

### Positive
- **Clear boundaries**: Contracts/backend/frontend separation is technology-enforced (Rust vs TypeScript), preventing accidental coupling
- **Independent deployment**: Each package can be deployed independently
- **Simplified local development**: `docker-compose up` starts all services; `npm run dev` per package for fast iteration
- **Gradual evolution**: Service boundaries can be refined and split as needed without architectural upheaval

### Negative
- **Cross-cutting concerns**: Authentication, logging, and error handling must be implemented in both backend and frontend
- **API versioning**: Frontend and backend must stay compatible; breaking changes require coordinated updates
- **Testing complexity**: End-to-end tests span multiple services (Playwright for frontend, Jest for backend, cargo test for contracts)
- **Docker build context**: All Dockerfiles share the monorepo root as context, increasing build times

### Neutral
- **Monitoring**: Each package needs independent health checks (`/api/health` for backend, Next.js health for frontend)
- **Logging**: Winston for backend; console-based for frontend; event logging for contracts
- **Secrets**: Environment variables per package; `.env` files for local development

## References

- `pnpm-workspace.yaml` — Workspace configuration
- `docker-compose.yml` — Multi-service orchestration
- `backend/Dockerfile`, `frontend/Dockerfile` — Independent container definitions
