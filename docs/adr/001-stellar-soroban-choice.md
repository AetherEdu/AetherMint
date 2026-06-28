# ADR-001: Choice of Stellar/Soroban over Ethereum/EVM

**Status**: Accepted

**Date**: 2024-06

**Deciders**: Core development team

## Context

AetherMint needs a blockchain platform for decentralized credential verification. The primary requirements are: tamper-proof credential storage, low transaction costs for frequent issuance/verification operations, smart contract programmability for credential logic, and a developer-friendly ecosystem.

Two dominant smart-contract platforms exist: **Ethereum/EVM-compatible chains** and **Stellar with Soroban**. Each represents a fundamentally different approach to blockchain architecture.

The education credential use case involves high-frequency, low-value transactions (issuing certificates, verifying credentials) where gas costs on Ethereum mainnet would be prohibitive. Ethereum L2s address this but introduce additional complexity and fragmentation.

## Decision

We will build on **Stellar**, using **Soroban** (Stellar's smart contract platform) for on-chain credential logic.

Specifically:
- Smart contracts written in **Rust** targeting `wasm32v1-none`
- **Soroban SDK v26.1.0** with exact version pinning (`=26.1.0`) for deterministic builds
- **Stellar SDK** for JavaScript/TypeScript client integration (`@stellar/stellar-sdk`)
- Stellar's native multi-signature and account model for issuer/recipient authorization

## Alternatives Considered

### Ethereum/EVM (Solidity)
- **Pros**: Largest ecosystem, extensive tooling (Hardhat, Foundry), massive developer community, established NFT standards (ERC-721)
- **Cons**: High gas costs on L1 (~$5-50 per credential issuance), variable transaction fees, 12-second block times slower than Stellar's 5-second ledger close
- **Why rejected**: Gas costs make frequent credential operations economically non-viable. L2 solutions (Arbitrum, Optimism) would add bridging complexity and still cost more than Stellar.

### Solana
- **Pros**: High throughput, low fees, Rust-based contracts
- **Cons**: Network reliability concerns, smaller ecosystem for credential/NFT standards, different account model requiring runtime rent
- **Why rejected**: Network stability concerns are incompatible with the reliability requirements of educational credentials. Stellar's deterministic fee model is better suited.

### Hyperledger Fabric (Permissioned)
- **Pros**: Enterprise-grade, private channels
- **Cons**: Permissioned nature contradicts the open verification goal; requires consortium governance
- **Why rejected**: AetherMint's vision is open, permissionless credential verification. A permissioned blockchain would undermine this.

## Consequences

### Positive
- **Near-zero transaction costs**: Stellar's base fee of 100 stroops (~0.00001 XLM) enables free-to-use credential verification
- **Fast finality**: 5-second ledger close times enable near-instant credential issuance and verification
- **Rust safety**: Memory safety guarantees for smart contract logic that handles sensitive credential data
- **Native multi-sig**: Stellar's built-in multi-signature support simplifies multi-party credential issuance (institution + instructor)
- **Soroban storage model**: Instance/persistent/temporary storage tiers provide gas-efficient state management

### Negative
- **Smaller ecosystem**: Fewer libraries, tools, and community resources compared to Ethereum. Soroban-specific knowledge required.
- **Evolving platform**: Soroban is relatively new; APIs may change between major versions.
- **Talent pool**: Fewer developers with Stellar/Soroban experience compared to Solidity/EVM.
- **WASM target complexity**: `wasm32v1-none` target requirement with Rust 1.84+ adds build configuration complexity.

### Neutral
- **CI/CD pipeline**: Need to install Rust toolchain with `wasm32v1-none` target and `stellar-cli` in CI environments
- **Testing**: Soroban's test framework (`Env::default()`, `mock_all_auths()`) requires learning specific patterns
- **Documentation**: Generated via `cargo doc --no-deps` and published to GitHub Pages

## References

- [Stellar Consensus Protocol](https://stellar.org/developers/learn)
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Rust targeting wasm32v1-none](https://soroban.stellar.org/docs/reference/sdks/rust)
- `contracts/Cargo.toml` — exact dependency versions
