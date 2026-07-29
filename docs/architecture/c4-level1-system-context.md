# C4 Level 1: System Context Diagram

> AetherMint — Decentralized Education Platform on Stellar/Soroban

## Overview

The System Context diagram shows AetherMint as a single system and maps all the people and external systems that interact with it.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL ACTORS                                    │
│                                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│   │   Student   │    │  Educator   │    │ Institution │    │   Auditor   │   │
│   │             │    │             │    │   Admin     │    │  / Verifier │   │
│   │ Enrolls in  │    │ Creates &   │    │ Manages     │    │ Verifies    │   │
│   │ courses,    │    │ publishes   │    │ platform,   │    │ credentials │   │
│   │ earns creds │    │ courses     │    │ users, org  │    │ on-chain    │   │
│   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘   │
└──────────┼─────────────────┼─────────────────┼─────────────────┼─────────────┘
           │                 │                 │                 │
           │  HTTPS / WSS    │  HTTPS / WSS    │  HTTPS          │  HTTPS
           │                 │                 │                 │
           ▼                 ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                                                                 │
│                          ╔═══════════════════╗                                  │
│                          ║   AetherMint      ║                                  │
│                          ║                   ║                                  │
│                          ║  Decentralized    ║                                  │
│                          ║  learning and     ║                                  │
│                          ║  credential       ║                                  │
│                          ║  verification     ║                                  │
│                          ║  platform powered ║                                  │
│                          ║  by Stellar       ║                                  │
│                          ║  blockchain       ║                                  │
│                          ╚═══════════════════╝                                  │
│                                    │                                            │
└────────────────────────────────────┼────────────────────────────────────────────┘
                                     │
        ┌──────────────┬─────────────┼─────────────┬──────────────┐
        │              │             │             │              │
        ▼              ▼             ▼             ▼              ▼
┌──────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   Stellar    │ │  IPFS    │ │  Email / │ │  OAuth   │ │   CDN /      │
│   Network   │ │  Network │ │  Notify  │ │ Provider │ │   Storage    │
│             │ │          │ │  Service │ │          │ │   Layer      │
│ Soroban     │ │ Pinning  │ │ (SMTP /  │ │ (Google, │ │ (CloudFront, │
│ smart       │ │ services │ │ SendGrid)│ │ GitHub)  │ │  S3, etc.)   │
│ contracts,  │ │ for      │ │          │ │          │ │              │
│ XLM         │ │ content  │ │          │ │          │ │              │
│ payments    │ │ storage  │ │          │ │          │ │              │
└──────────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

## Actors

| Actor | Description | Interaction |
|-------|-------------|-------------|
| **Student** | Learner who takes courses, earns credentials, and manages their on-chain learning profile | Web UI (Next.js frontend), wallet connection (Freighter/Albedo), REST API |
| **Educator** | Course creator who publishes educational content, issues credentials, and monitors learner progress | Web UI, Admin portal |
| **Institution Admin** | Manages platform tenants, users, access control and organisation-level analytics | Admin portal (`backend/portal/`) |
| **Auditor / Verifier** | External party that verifies credential authenticity on the blockchain | Public credential verification endpoint, Stellar blockchain explorer |

## External Systems

| System | Purpose | Protocol |
|--------|---------|----------|
| **Stellar Network** | Layer-1 blockchain; executes Soroban smart contracts, settles XLM payments, anchors credentials on-chain | Horizon REST API, Stellar SDK |
| **IPFS Network** | Decentralised content-addressable storage for course materials, credential metadata, and media assets | IPFS HTTP API (`backend/src/config/ipfs.js`) |
| **Email / Notification Service** | Transactional email delivery (course enrolments, credential issuance, alerts) | SMTP / SendGrid API |
| **OAuth Providers** | Third-party identity providers for social login | OAuth 2.0 / OIDC |
| **CDN / Object Storage** | High-speed delivery of static assets and large media files | HTTPS, S3-compatible API |

## Key Responsibilities of AetherMint

1. **Course Management** — create, publish, and enrol learners in blockchain-anchored courses
2. **Credential Issuance** — issue tamper-proof certificates and NFT badges via Soroban contracts
3. **Identity & Access** — JWT authentication, RBAC, multi-tenancy, quantum-resistant key management
4. **Analytics** — learner progress tracking, instructor analytics, federated learning pipeline
5. **Real-Time Collaboration** — WebSocket-powered live classrooms, whiteboards, and chat
6. **Payments** — XLM-based payment processing via Stellar SDK

---

*See [C4 Level 2](./c4-level2-container.md) for a breakdown of AetherMint's internal containers.*
