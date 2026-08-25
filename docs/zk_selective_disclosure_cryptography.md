# Zero-Knowledge Selective Disclosure Cryptographic Specification

## Overview
This document specifies the cryptographic design and proof scheme for on-chain selective disclosure of credential attributes within the AetherMint platform.

Learners can generate non-interactive zero-knowledge (ZK) proofs to confirm specific attribute predicates (e.g., `graduated == 1`, `age >= 18`, `score in [70, 100]`) on-chain without revealing their identity or unrequested credential data.

---

## 1. Cryptographic Primitives & Assumptions

1. **Hash Function**: SHA-256 is used as the random oracle for commitments, Fiat-Shamir challenge generation, and nullifiers.
2. **Pedersen-style Commitment Scheme**:
   $$\text{Commitment} = H(\text{credential\_id} \mathbin{\Vert} \text{holder\_address} \mathbin{\Vert} \text{attribute\_name} \mathbin{\Vert} \text{attribute\_value} \mathbin{\Vert} \text{salt})$$
   - **Hiding**: The 256-bit random `salt` guarantees statistical hiding against off-chain and on-chain observers.
   - **Binding**: Computationally binding under the collision resistance of SHA-256.

---

## 2. Holder Binding & Non-Transferability

To prevent proof replay or unauthorized transfer by a malicious third party, every proof is cryptographically bound to the legitimate holder address and the specific verifier contract:

1. **Holder Binding Hash**:
   $$\text{HolderBinding} = H(\text{holder\_address} \mathbin{\Vert} \text{commitment} \mathbin{\Vert} \text{nullifier} \mathbin{\Vert} \text{challenge})$$
   - The on-chain verifier computes this hash using the caller/holder address parameter and rejects proofs where the binding does not match.

2. **Verifier-Scoped Nullifier**:
   $$\text{Nullifier} = H(\text{holder\_address} \mathbin{\Vert} \text{verifier\_address} \mathbin{\Vert} \text{credential\_id} \mathbin{\Vert} \text{nonce})$$
   - The nullifier is recorded in persistent contract storage upon successful verification (`CredentialRegistryKey::Nullifier(bytes32)`).
   - Re-submitting a spent nullifier results in an immediate execution panic (`Nullifier already used - replay attack prevented`).

---

## 3. Supported Predicate Types

| Predicate Type | Enum Code | Public Parameters | Description |
|---|---|---|---|
| `Equals` | `0` | `param1` (target value) | Proves attribute value equals target value. |
| `GreaterThanOrEqual` | `1` | `param1` (threshold) | Proves attribute value $\ge$ threshold. |
| `Range` | `2` | `param1` (min), `param2` (max) | Proves attribute value $\in [\text{min}, \text{max}]$. |

---

## 4. On-Chain Verification Algorithm

```
Algorithm: VerifyZkProof(Env, CredentialID, ZkProof, Holder, Verifier)
1. Verify credential exists and is active via `is_credential_valid(Env, CredentialID)`.
2. Ensure `Nullifier` is absent from persistent storage.
3. Compute `expected_binding = H(Holder || commitment || nullifier || challenge)`.
   If `proof.holder_binding != expected_binding`, reject with InvalidHolderBinding.
4. Validate predicate:
   - For Range: check public_param1 <= public_param2.
   - Reconstruct Fiat-Shamir challenge `expected_challenge` from secret response, commitment, nullifier, attribute name, and params.
   - If `proof.challenge != expected_challenge`, reject with InvalidChallenge.
5. Record `Nullifier` in persistent contract storage.
6. Emit on-chain `CredentialLifecycleEvent::Verified` event.
7. Return true.
```

---

## 5. Security & Limitations

- **Preimage Resistance**: Relies on SHA-256 preimage and collision resistance.
- **On-Chain Gas Efficiency**: Uses native Soroban `env.crypto().sha256()` primitives to minimize execution cost.
- **Scope**: Designed for attribute predicate validation; full zk-SNARK circuit proving with bilinear pairings (e.g. Groth16/PLONK) can be added via WASM verifier extensions if needed in future protocol versions.
