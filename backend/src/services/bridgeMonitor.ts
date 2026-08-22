/**
 * Bridge Monitor Service
 *
 * Off-chain companion to the on-chain bridge security contracts (issue #423).
 * Tracks relayer liveness, attestation lifecycle, and fraud proofs so the
 * platform can alert on stalled relayers and drive dispute/finalization flows.
 *
 * The service keeps its state in memory (a production deployment would persist
 * to Redis/Mongo) and exposes pure, deterministic methods so the worker job
 * and the API routes can share one source of truth.
 */

import logger from '../utils/logger';

export type RelayerStatus = 'active' | 'stalled' | 'frozen' | 'slashed';
export type AttestationStatus = 'pending' | 'challenged' | 'finalized';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface RelayerRecord {
  address: string;
  stake: number;
  status: RelayerStatus;
  registeredAt: number;
  lastSeen: number;
  attestationCount: number;
}

export interface AttestationRecord {
  id: string;
  relayer: string;
  messageId: string;
  sourceChain: number;
  destinationChain: number;
  stateRoot: string;
  status: AttestationStatus;
  submittedAt: number;
  finalizedAt?: number;
  fraudProofCount: number;
}

export interface BridgeAlert {
  id: string;
  type: 'relayer_stalled' | 'fraud_proof' | 'attestation_finalized' | 'relayer_registered';
  severity: AlertSeverity;
  message: string;
  createdAt: number;
  acknowledged: boolean;
}

export interface BridgeMonitorConfig {
  /** Minimum stake required for a relayer to register. */
  minStake: number;
  /** Seconds without a heartbeat before a relayer is considered stalled. */
  livenessWindowSeconds: number;
  /** Seconds an attestation remains challengeable before finalization. */
  disputeWindowSeconds: number;
}

const DEFAULT_CONFIG: BridgeMonitorConfig = {
  minStake: 1000,
  livenessWindowSeconds: 24 * 60 * 60,
  disputeWindowSeconds: 7 * 24 * 60 * 60,
};

export class BridgeMonitorService {
  private config: BridgeMonitorConfig;
  private relayers: Map<string, RelayerRecord> = new Map();
  private attestations: Map<string, AttestationRecord> = new Map();
  private alerts: BridgeAlert[] = [];
  private attestationCounter = 0;
  private alertCounter = 0;

  constructor(config: Partial<BridgeMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Register a staked relayer. */
  registerRelayer(address: string, stake: number): RelayerRecord {
    if (stake < this.config.minStake) {
      throw new Error(`Stake ${stake} is below the minimum of ${this.config.minStake}`);
    }
    if (this.relayers.has(address)) {
      throw new Error(`Relayer ${address} is already registered`);
    }

    const now = Date.now();
    const record: RelayerRecord = {
      address,
      stake,
      status: 'active',
      registeredAt: now,
      lastSeen: now,
      attestationCount: 0,
    };
    this.relayers.set(address, record);
    this.raiseAlert('relayer_registered', 'info', `Relayer ${address} registered with stake ${stake}`);
    return { ...record };
  }

  /** Record a relayer heartbeat. */
  heartbeat(address: string): RelayerRecord {
    const record = this.requireRelayer(address);
    record.lastSeen = Date.now();
    if (record.status === 'stalled') {
      record.status = 'active';
    }
    return { ...record };
  }

  /**
   * Record an optimistic attestation submitted by a live, active relayer.
   * Returns the attestation id.
   */
  recordAttestation(
    relayer: string,
    messageId: string,
    sourceChain: number,
    destinationChain: number,
    stateRoot: string,
  ): string {
    const record = this.requireRelayer(relayer);
    if (record.status !== 'active') {
      throw new Error(`Relayer ${relayer} is not active`);
    }
    if (!this.isLive(record)) {
      throw new Error(`Relayer ${relayer} is not live`);
    }

    this.attestationCounter += 1;
    const id = `att_${Date.now()}_${this.attestationCounter}`;
    const attestation: AttestationRecord = {
      id,
      relayer,
      messageId,
      sourceChain,
      destinationChain,
      stateRoot,
      status: 'pending',
      submittedAt: Date.now(),
      fraudProofCount: 0,
    };
    this.attestations.set(id, attestation);

    record.attestationCount += 1;
    return id;
  }

  /**
   * Submit a fraud proof against a pending attestation within the dispute
   * window. Slashes the submitting relayer. Returns `true` on success.
   */
  submitFraudProof(attestationId: string, evidence: string): boolean {
    const attestation = this.requireAttestation(attestationId);
    if (attestation.status !== 'pending') {
      throw new Error(`Attestation ${attestationId} is not pending`);
    }
    const now = Date.now();
    if (now > attestation.submittedAt + this.config.disputeWindowSeconds * 1000) {
      throw new Error('Dispute window has closed');
    }

    attestation.status = 'challenged';
    attestation.fraudProofCount += 1;

    const relayer = this.relayers.get(attestation.relayer);
    if (relayer) {
      relayer.status = 'slashed';
      relayer.stake = 0;
    }

    this.raiseAlert(
      'fraud_proof',
      'critical',
      `Fraud proof submitted for attestation ${attestationId}: ${evidence}`,
    );
    return true;
  }

  /** Finalize pending attestations whose dispute window has closed. */
  finalizePastDisputeWindow(): number {
    const now = Date.now();
    let finalized = 0;
    for (const attestation of this.attestations.values()) {
      if (
        attestation.status === 'pending' &&
        now > attestation.submittedAt + this.config.disputeWindowSeconds * 1000
      ) {
        attestation.status = 'finalized';
        attestation.finalizedAt = now;
        finalized += 1;
        this.raiseAlert(
          'attestation_finalized',
          'info',
          `Attestation ${attestation.id} finalized`,
        );
      }
    }
    return finalized;
  }

  /** Mark active relayers that have stopped heartbeating as stalled. */
  checkLiveness(): number {
    const now = Date.now();
    let stalled = 0;
    for (const record of this.relayers.values()) {
      if (
        record.status === 'active' &&
        now > record.lastSeen + this.config.livenessWindowSeconds * 1000
      ) {
        record.status = 'stalled';
        stalled += 1;
        this.raiseAlert(
          'relayer_stalled',
          'warning',
          `Relayer ${record.address} has not heartbeated within ${this.config.livenessWindowSeconds}s`,
        );
      }
    }
    if (stalled > 0) {
      logger.warn(`Bridge monitor marked ${stalled} relayer(s) as stalled`);
    }
    return stalled;
  }

  getRelayers(): RelayerRecord[] {
    return Array.from(this.relayers.values()).map((r) => ({ ...r }));
  }

  getRelayer(address: string): RelayerRecord | null {
    const record = this.relayers.get(address);
    return record ? { ...record } : null;
  }

  getAttestations(): AttestationRecord[] {
    return Array.from(this.attestations.values()).map((a) => ({ ...a }));
  }

  getAttestation(id: string): AttestationRecord | null {
    const record = this.attestations.get(id);
    return record ? { ...record } : null;
  }

  getAlerts(): BridgeAlert[] {
    return this.alerts.map((a) => ({ ...a }));
  }

  acknowledgeAlert(id: string): boolean {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  isRelayerLive(address: string): boolean {
    const record = this.relayers.get(address);
    return !!record && this.isLive(record);
  }

  getStats() {
    return {
      relayers: this.relayers.size,
      activeRelayers: this.countRelayersByStatus('active'),
      stalledRelayers: this.countRelayersByStatus('stalled'),
      frozenRelayers: this.countRelayersByStatus('frozen'),
      slashedRelayers: this.countRelayersByStatus('slashed'),
      pendingAttestations: this.countAttestationsByStatus('pending'),
      finalizedAttestations: this.countAttestationsByStatus('finalized'),
      challengedAttestations: this.countAttestationsByStatus('challenged'),
      unacknowledgedAlerts: this.alerts.filter((a) => !a.acknowledged).length,
    };
  }

  reset(): void {
    this.relayers.clear();
    this.attestations.clear();
    this.alerts = [];
    this.attestationCounter = 0;
    this.alertCounter = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────

  private isLive(record: RelayerRecord): boolean {
    return (
      record.status === 'active' &&
      Date.now() <= record.lastSeen + this.config.livenessWindowSeconds * 1000
    );
  }

  private requireRelayer(address: string): RelayerRecord {
    const record = this.relayers.get(address);
    if (!record) {
      throw new Error(`Relayer ${address} is not registered`);
    }
    return record;
  }

  private requireAttestation(id: string): AttestationRecord {
    const record = this.attestations.get(id);
    if (!record) {
      throw new Error(`Attestation ${id} not found`);
    }
    return record;
  }

  private raiseAlert(type: BridgeAlert['type'], severity: AlertSeverity, message: string): void {
    this.alertCounter += 1;
    this.alerts.push({
      id: `alert_${Date.now()}_${this.alertCounter}`,
      type,
      severity,
      message,
      createdAt: Date.now(),
      acknowledged: false,
    });
  }

  private countRelayersByStatus(status: RelayerStatus): number {
    let count = 0;
    for (const r of this.relayers.values()) {
      if (r.status === status) count += 1;
    }
    return count;
  }

  private countAttestationsByStatus(status: AttestationStatus): number {
    let count = 0;
    for (const a of this.attestations.values()) {
      if (a.status === status) count += 1;
    }
    return count;
  }
}

export const bridgeMonitorService = new BridgeMonitorService();
