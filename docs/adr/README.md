# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the AetherMint project. ADRs document significant architectural decisions, the context in which they were made, the alternatives considered, and the consequences of each decision.

## What is an ADR?

An Architecture Decision Record is a document that captures an important architectural decision made along with its context and consequences. ADRs follow the [Michael Nygard format](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [001](./001-stellar-soroban-choice.md) | Choice of Stellar/Soroban over Ethereum/EVM | Accepted | 2024-06 |
| [002](./002-dual-database-strategy.md) | Dual database strategy (PostgreSQL + MongoDB) | Accepted | 2024-07 |
| [003](./003-ipfs-storage.md) | IPFS for decentralized content storage | Accepted | 2024-08 |
| [004](./004-federated-learning.md) | Federated learning architecture for AI/ML features | Accepted | 2024-09 |
| [005](./005-quantum-resistant-crypto.md) | Quantum-resistant cryptography integration | Proposed | 2024-10 |
| [006](./006-architecture-style.md) | Microservices-lite architecture (monolith with service boundaries) | Accepted | 2024-06 |
| [007](./007-typescript-strategy.md) | TypeScript adoption strategy (gradual migration from JS) | Accepted | 2024-06 |

## Statuses

- **Proposed**: The decision is under discussion.
- **Accepted**: The decision has been agreed upon and is being implemented.
- **Deprecated**: The decision has been superseded by a newer ADR.
- **Superseded**: A newer ADR has replaced this decision.

## Creating a New ADR

1. Copy `template.md` to a new file with the next ADR number.
2. Fill in the sections: Title, Status, Context, Decision, Alternatives Considered, Consequences.
3. Add the ADR to the index table above.
4. Submit a pull request for review.

See [template.md](./template.md) for the ADR template.
