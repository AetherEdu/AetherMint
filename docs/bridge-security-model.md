# Bridge Security Model

This document describes how the AetherMint cross-chain bridge is secured against
stalled and malicious relayers. It is split across two layers that share a
single source of truth:

- **On-chain** — the Soroban bridge module in `contracts/src/bridge/` enforces
  staking, liveness, attestation finalization, and slashing in a trustless,
  deterministic way.
- **Off-chain** — `backend/src/services/bridgeMonitor.ts` (and the
  `bridgeMonitorJob.ts` worker) observe relayers and attestations, raise
  alerts, and drive dispute/finalization sweeps.

## Design principles

The bridge uses an **optimistic, stake-backed** security model:

1. Relayering is permissioned by **economic stake**, not reputation.
2. Attestations are **optimistic** — they are trusted only after a dispute
   window passes without a valid challenge.
3. Fraud is punished by **slashing** the relayer's stake, aligning incentives.

## Economic incentives and stake

A relayer must deposit at least `MIN_STAKE` (currently `1000` units of the
bridge's base asset) to register. The stake serves two purposes:

- **Skin in the game** — a relayer that attests to an invalid message loses its
  entire stake (it is slashed to `0`), making fraud economically irrational as
  long as the stake exceeds the value of any single fraudulent attestation.
- **Slashable collateral** — the stake is the pool from which penalties are
  drawn on a successful fraud proof.

| Parameter | Value | Purpose |
| --------- | ----- | ------- |
| `MIN_STAKE` | `1000` | Minimum deposit to become a relayer |
| `LIVENESS_WINDOW_SECONDS` | `86400` (24 h) | Max time without a heartbeat before a relayer is considered down |
| `DISPUTE_WINDOW_SECONDS` | `604800` (7 days) | How long an attestation stays challengeable before it finalizes |

## Relayer liveness monitoring

Every relayer must call `heartbeat()` within `LIVENESS_WINDOW_SECONDS`.
A relayer that stops heartbeating:

- is reported as **not live** by `is_relayer_live()` on-chain, which rejects
  further attestations from that relayer;
- is flagged **stalled** by the off-chain monitor (`checkLiveness()`), which
  emits a `relayer_stalled` alert for operators.

The `bridgeMonitorJob` worker runs this sweep on a configurable interval
(`BRIDGE_MONITOR_INTERVAL_MS`, default 60s).

## Attestation lifecycle and dispute window

A relayer submits an optimistic attestation for an off-chain message via
`submit_attestation()`. The attestation moves through three states:

```
Pending ──(dispute window passes, no challenge)──▶ Finalized
   │
   └──(valid fraud proof within window)──▶ Challenged (relayer slashed)
```

- While `Pending`, the attestation is **not yet trusted**.
- After `DISPUTE_WINDOW_SECONDS`, `finalize_attestation()` (or the off-chain
  `finalizePastDisputeWindow()` sweep) marks it `Finalized`.
- A `Challenged` attestation can never be finalized.

## Fraud-proof submission path

Anyone — not just bridge participants — can submit a fraud proof against a
pending attestation within the dispute window:

1. `submit_fraud_proof(challenger, attestation_id, evidence)` is called with
   evidence of an invalid attestation (e.g. a mismatched `state_root`).
2. The attestation is marked `Challenged`.
3. The submitting relayer is **slashed**: its `stake` is set to `0` and its
   status becomes `Slashed`, permanently barring it from submitting further
   attestations.

This permissionless challenge path is what makes the optimistic model safe:
rational observers are incentivized to police the bridge because they know a
bad attestation can always be challenged before it finalizes.

## Slashing and freezing

Two enforcement mechanisms exist:

- **Slashing** — automatic, triggered by a successful fraud proof. The relayer
  loses its entire stake and can no longer attest.
- **Freezing** — a manual circuit breaker. The bridge admin can call
  `freeze_relayer()` to halt a relayer and `unfreeze_relayer()` to restore it.
  This is used for off-chain incidents (key compromise, maintenance) where
  slashing is not yet warranted.

## Division of responsibility

| Concern | On-chain (`contracts/src/bridge/`) | Off-chain (`bridgeMonitor`) |
| ------- | ----------------------------------- | --------------------------- |
| Registration & stake | `register_relayer` enforces `MIN_STAKE` | mirrors registration state |
| Liveness | `is_relayer_live` rejects stale relayers | `checkLiveness` raises alerts |
| Attestation | `submit_attestation`, `finalize_attestation` | `recordAttestation`, `finalizePastDisputeWindow` |
| Fraud proof | `submit_fraud_proof` slashes | `submitFraudProof` + `fraud_proof` alert |
| Freeze | `freeze_relayer` / `unfreeze_relayer` | observes/admin UI |

## Contract API

The module is surfaced through `AetherMintContract`:

- `initialize_bridge(admin)`
- `register_relayer(relayer, stake)`
- `heartbeat(relayer)`
- `submit_attestation(relayer, message_id, source_chain, destination_chain, state_root) -> u64`
- `submit_fraud_proof(challenger, attestation_id, evidence) -> bool`
- `finalize_attestation(attestation_id)`
- `freeze_relayer(admin, relayer)` / `unfreeze_relayer(admin, relayer)`
- `get_relayer(relayer)`, `get_attestation(id)`, `is_relayer_frozen(relayer)`, `is_relayer_live(relayer)`

## Operational endpoints

The off-chain monitor is exposed under `/api/bridge-monitor`:

- `GET /relayers`, `POST /relayers`, `POST /relayers/:address/heartbeat`
- `GET /attestations`, `POST /attestations`
- `POST /attestations/:id/fraud-proof`
- `POST /sweep` — triggers a liveness + finalization sweep
- `GET /alerts`, `POST /alerts/:id/acknowledge`
- `GET /stats`
