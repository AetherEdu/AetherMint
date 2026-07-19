# C4 Level 2: Container Diagram

> AetherMint — Internal Containers

## Overview

The Container diagram zooms into AetherMint and shows all the independently deployable/runnable units (containers), their technology, and how they communicate.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      AetherMint System                                      │
│                                                                                             │
│   ┌────────────────────┐         ┌────────────────────┐                                    │
│   │                    │         │                    │                                    │
│   │  Student / User    │         │  Educator /        │                                    │
│   │  Browser           │         │  Admin Browser     │                                    │
│   └─────────┬──────────┘         └─────────┬──────────┘                                    │
│             │ HTTPS/WSS                    │ HTTPS                                         │
│             │                             │                                               │
│    ┌────────▼────────────────────────────▼────────────────────────────────┐              │
│    │                         FRONTEND LAYER                               │              │
│    │                                                                       │              │
│    │  ┌───────────────────────────────┐  ┌──────────────────────────────┐ │              │
│    │  │   frontend/                   │  │   backend/portal/            │ │              │
│    │  │   (Next.js 14, TypeScript,    │  │   (Next.js, TypeScript,      │ │              │
│    │  │    TailwindCSS, React)        │  │    TailwindCSS)              │ │              │
│    │  │                               │  │                              │ │              │
│    │  │  • App Router pages           │  │  • Admin dashboard           │ │              │
│    │  │  • Wallet connector           │  │  • User management           │ │              │
│    │  │  • Course browser             │  │  • Tenant management         │ │              │
│    │  │  • Collaboration UI           │  │  • Analytics overview        │ │              │
│    │  │  • Credential viewer          │  │  • System monitoring         │ │              │
│    │  │  • IPFS content uploader      │  │                              │ │              │
│    │  │  • PWA / offline support      │  │  Port: 3001                  │ │              │
│    │  │  • i18n (10+ languages)       │  └──────────────────────────────┘ │              │
│    │  │                               │                                   │              │
│    │  │  Port: 3000                   │                                   │              │
│    │  └───────────────────────────────┘                                   │              │
│    └───────────────────────────────────────┬───────────────────────────────┘              │
│                                            │ REST (HTTPS) / WebSocket                    │
│                                            │                                             │
│    ┌───────────────────────────────────────▼───────────────────────────────┐              │
│    │                         BACKEND LAYER                                 │              │
│    │                                                                       │              │
│    │  ┌────────────────────────────────────────────────────────────────┐  │              │
│    │  │               backend/  (Express.js, Node.js, TypeScript)      │  │              │
│    │  │                                                                 │  │              │
│    │  │  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐ │  │              │
│    │  │  │  REST API Layer │  │  WebSocket Layer │  │  Worker Layer │ │  │              │
│    │  │  │  (Express)      │  │  (Socket.IO)     │  │               │ │  │              │
│    │  │  │  Port: 5000     │  │  Real-time       │  │  Transaction  │ │  │              │
│    │  │  │                 │  │  collaboration,  │  │  processor,   │ │  │              │
│    │  │  │  /api/auth      │  │  notifications,  │  │  queue mgr    │ │  │              │
│    │  │  │  /api/courses   │  │  proctoring      │  │               │ │  │              │
│    │  │  │  /api/creds     │  └──────────────────┘  └───────────────┘ │  │              │
│    │  │  │  /api/ipfs      │                                           │  │              │
│    │  │  │  /api/quantum   │  ┌──────────────────────────────────────┐ │  │              │
│    │  │  │  /api/analytics │  │  Service Layer                       │ │  │              │
│    │  │  │  /api/federated │  │                                      │ │  │              │
│    │  │  │  /api/holograph │  │  • stellarService (Horizon SDK)      │ │  │              │
│    │  │  │  ... (40+ routes│  │  • ipfsService                       │ │  │              │
│    │  │  └─────────────────┘  │  • federatedLearningCoordinator      │ │  │              │
│    │  │                       │  • quantumResistantCrypto            │ │  │              │
│    │  │                       │  • holographicStorage                │ │  │              │
│    │  │                       │  • analyticsService                  │ │  │              │
│    │  │                       │  • enrollmentService                 │ │  │              │
│    │  │                       │  • paymentService                    │ │  │              │
│    │  │                       └──────────────────────────────────────┘ │  │              │
│    │  └────────────────────────────────────────────────────────────────┘  │              │
│    │                                                                       │              │
│    │  ┌──────────────────────────────────────────────────────────────┐    │              │
│    │  │                 MICROSERVICES (future/emerging)               │    │              │
│    │  │                                                               │    │              │
│    │  │  ┌──────────────┐ ┌───────────────┐ ┌────────────────────┐  │    │              │
│    │  │  │ api-gateway  │ │ auth-service  │ │  analytics-service │  │    │              │
│    │  │  │ (Node.js)    │ │ (Node.js/JWT) │ │  (Node.js)         │  │    │              │
│    │  │  └──────────────┘ └───────────────┘ └────────────────────┘  │    │              │
│    │  │                                                               │    │              │
│    │  │  ┌──────────────────────┐                                    │    │              │
│    │  │  │  courses-service     │                                    │    │              │
│    │  │  │  (Node.js)           │                                    │    │              │
│    │  │  └──────────────────────┘                                    │    │              │
│    │  └──────────────────────────────────────────────────────────────┘    │              │
│    └───────────┬──────────────────────┬────────────────────────────────────┘              │
│                │                      │                                                   │
│      ┌─────────▼────────┐   ┌─────────▼────────┐                                         │
│      │  DATA LAYER      │   │  BLOCKCHAIN       │                                         │
│      │                  │   │  LAYER            │                                         │
│      │  ┌────────────┐  │   │                   │                                         │
│      │  │ PostgreSQL │  │   │  ┌─────────────┐  │                                         │
│      │  │ (primary)  │  │   │  │ contracts/  │  │                                         │
│      │  │            │  │   │  │ (Rust,      │  │                                         │
│      │  │ Users,     │  │   │  │ Soroban SDK │  │                                         │
│      │  │ Courses,   │  │   │  │ 26.1.0)     │  │                                         │
│      │  │ Enrollments│  │   │  │             │  │                                         │
│      │  │ Payments,  │  │   │  │ 15+ Soroban │  │                                         │
│      │  │ Audits     │  │   │  │ contracts   │  │                                         │
│      │  └────────────┘  │   │  └─────────────┘  │                                         │
│      │                  │   │                   │                                         │
│      │  ┌────────────┐  │   └──────────┬────────┘                                         │
│      │  │   Redis    │  │              │ Horizon                                          │
│      │  │ (caching,  │  │              │ REST API                                         │
│      │  │  sessions, │  │              │                                                  │
│      │  │  queues)   │  │              ▼                                                  │
│      │  └────────────┘  │   ┌──────────────────┐                                          │
│      └──────────────────┘   │  Stellar Network  │                                          │
│                             │  (Testnet / Main) │                                          │
│                             └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
                 │                                         │
                 │ IPFS HTTP API              External CDN │
                 ▼                                         ▼
       ┌──────────────────┐                   ┌──────────────────┐
       │  IPFS Network    │                   │  CDN / Object    │
       │  (kubo / Web3    │                   │  Storage         │
       │   Storage)       │                   │  (static assets) │
       └──────────────────┘                   └──────────────────┘
```

## Container Inventory

### Frontend Containers

| Container | Technology | Port | Responsibility |
|-----------|-----------|------|----------------|
| `frontend/` | Next.js 14, TypeScript, TailwindCSS | 3000 | Student-facing web app: course browsing, enrollment, credential viewer, wallet connection, real-time collaboration |
| `backend/portal/` | Next.js, TypeScript | 3001 | Admin/educator portal: tenant management, user admin, org analytics, system monitoring |

### Backend Containers

| Container | Technology | Port | Responsibility |
|-----------|-----------|------|----------------|
| `backend/` (main API) | Node.js 18, Express, TypeScript | 5000 | REST API (40+ route modules), WebSocket (Socket.IO), service orchestration, middleware stack |
| `backend/microservices/api-gateway` | Node.js | — | Request routing, load balancing (emerging) |
| `backend/microservices/auth-service` | Node.js, JWT | — | Dedicated authentication microservice (emerging) |
| `backend/microservices/analytics-service` | Node.js | — | Analytics aggregation microservice (emerging) |
| `backend/microservices/courses-service` | Node.js | — | Course management microservice (emerging) |

### Data Containers

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| PostgreSQL | PostgreSQL 15+ | Primary relational store: users, courses, enrollments, payments, audit logs |
| Redis | Redis 7+ | Caching layer, session store, pub/sub, job queues (`ioredis`) |

### Blockchain Container

| Container | Technology | Responsibility |
|-----------|-----------|----------------|
| `contracts/` | Rust, Soroban SDK 26.1.0 | On-chain logic: credentials, courses, profiles, marketplace, governance, VRF, proctoring, DNA storage, analytics |

### External Services

| Service | Protocol | Notes |
|---------|---------|-------|
| Stellar Network (Horizon) | REST / SSE | Smart contract execution, XLM payments, credential anchoring |
| IPFS Network | HTTP API | Content-addressed storage for course media and credential metadata |
| CDN / Object Storage | HTTPS | Static asset delivery; CloudFront or equivalent |

## Communication Patterns

```
Frontend  ──REST/HTTPS──►  Backend API  ──Horizon SDK──►  Stellar Network
Frontend  ──WebSocket──►   Backend WS   ──IPFS HTTP──►    IPFS Network
Portal    ──REST/HTTPS──►  Backend API  ──Prisma ORM──►   PostgreSQL
Backend   ──ioredis──────► Redis
Backend   ──Stellar SDK──► contracts/ (deployed WASM on Stellar)
contracts/──Horizon API──► Stellar Network
```

---

*See [C4 Level 3](./c4-level3-components.md) for component-level breakdowns.*
