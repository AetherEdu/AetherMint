# ADR-005: Quantum-Resistant Cryptography Integration

**Status**: Proposed

**Date**: 2024-10

**Deciders**: Core development team

## Context

Educational credentials issued by AetherMint are designed to be lifelong records. A credential issued today may need to be verifiable in 20-30 years. The emergence of cryptographically-relevant quantum computers could break the elliptic curve cryptography (Ed25519) that Stellar and most blockchain platforms rely on.

While large-scale quantum computers capable of breaking Ed25519 are not yet available, the "harvest now, decrypt later" threat model means that encrypted or signed data captured today could be decrypted or forged once quantum computers become available. This is particularly relevant for educational credentials, which have multi-decade validity periods.

Additionally, AetherMint includes BCI (Brain-Computer Interface) features and neural data processing. The sensitive nature of cognitive data warrants forward-looking security measures.

## Decision

We will implement a **layered quantum-resistant security strategy**:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Post-quantum signatures** | `libsodium-wrappers` (NaCl/libsodium) | Cryptographic primitives with quantum-resistant properties |
| **Hybrid encryption** | `node-forge` + `libsodium` | Combine classical and post-quantum encryption for defense-in-depth |
| **Hash-based signatures** | Custom implementation | Stateless hash-based signatures for long-term credential integrity |
| **Quantum key distribution prep** | `QuantumTeleportation` module (`frontend/src/services/quantumTeleportation/`) | Software abstraction ready for future QKD hardware |

Specifically:
- Credential attestations support **BytesN<64> signatures** (double-size to accommodate post-quantum signature schemes)
- The `attestation_protocol` module supports multi-signature verification, enabling hybrid classical+quantum-resistant attestation chains
- The `QuantumTeleportation` service provides a software simulation layer for quantum-safe communication protocols
- All cryptographic operations use constant-time implementations to prevent timing side-channels

## Alternatives Considered

### Wait and see (no action now)
- **Pros**: No engineering effort now, wait for NIST standardization to finalize
- **Cons**: "Harvest now, decrypt later" risk for long-lived credentials; retrofitting cryptography is harder than building it in
- **Why rejected**: The educational credential use case demands forward security. Waiting exposes all issued credentials to future compromise.

### Full NIST PQC migration now
- **Pros**: Maximum quantum resistance with standardized algorithms (CRYSTALS-Kyber, CRYSTALS-Dilithium)
- **Cons**: NIST PQC algorithms are still being finalized; implementations are not yet production-hardened; key/signature sizes are significantly larger (2-10x)
- **Why rejected**: Premature adoption of non-finalized standards creates compatibility risk. The hybrid approach provides quantum resistance without betting on a specific NIST candidate.

### Blockchain migration to post-quantum L1
- **Pros**: Protocol-level quantum resistance
- **Cons**: No production post-quantum L1 exists; would require abandoning Stellar/Soroban
- **Why rejected**: Not a practical option. Layered security at the application level is more achievable.

## Consequences

### Positive
- **Forward security**: Credentials issued today resist future quantum attacks
- **Defense-in-depth**: Hybrid classical+post-quantum approach provides security even if one layer is broken
- **Hardware-ready**: QuantumTeleportation service is designed for future QKD hardware integration
- **NIST-aligned**: Architecture accommodates NIST PQC standards as they are finalized

### Negative
- **Larger signatures**: Post-quantum signatures (BytesN<64>) increase on-chain storage costs
- **Performance overhead**: Constant-time implementations are slower than optimized variable-time alternatives
- **Speculative investment**: Quantum computers capable of breaking Ed25519 may be 10-20 years away
- **Complexity**: Hybrid cryptographic schemes are harder to implement, test, and audit correctly

### Neutral
- **NIST timeline**: Architecture designed to swap in NIST PQC algorithms when standards are finalized
- **Migration path**: Existing Ed25519 credentials remain verifiable; new credentials optionally use post-quantum attestations
- **Education**: Team needs training in post-quantum cryptography concepts

## References

- [NIST Post-Quantum Cryptography Standardization](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [libsodium documentation](https://doc.libsodium.org/)
- `contracts/src/attestation_protocol.rs` — Multi-signature attestation with BytesN<64>
- `frontend/src/services/quantumTeleportation/` — Quantum-safe communication service layer
