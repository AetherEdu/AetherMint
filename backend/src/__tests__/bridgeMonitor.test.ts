import { BridgeMonitorService } from '../services/bridgeMonitor';

function makeService() {
  return new BridgeMonitorService({
    minStake: 100,
    livenessWindowSeconds: 60,
    disputeWindowSeconds: 120,
  });
}

describe('BridgeMonitorService', () => {
  let service: BridgeMonitorService;

  beforeEach(() => {
    jest.useFakeTimers({ now: Date.UTC(2026, 0, 1) });
    service = makeService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('relayer registration and liveness', () => {
    it('registers a relayer with sufficient stake', () => {
      const relayer = service.registerRelayer('G-RELAYER-1', 200);
      expect(relayer.status).toBe('active');
      expect(relayer.stake).toBe(200);
      expect(service.isRelayerLive('G-RELAYER-1')).toBe(true);
    });

    it('rejects a stake below the minimum', () => {
      expect(() => service.registerRelayer('G-RELAYER-1', 50)).toThrow(/below the minimum/);
    });

    it('rejects duplicate registration', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      expect(() => service.registerRelayer('G-RELAYER-1', 300)).toThrow(/already registered/);
    });

    it('keeps a relayer live via heartbeat', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      jest.advanceTimersByTime(90 * 1000); // beyond liveness window
      expect(service.isRelayerLive('G-RELAYER-1')).toBe(false);

      service.heartbeat('G-RELAYER-1');
      expect(service.isRelayerLive('G-RELAYER-1')).toBe(true);
    });

    it('marks stalled relayers and raises alerts', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      jest.advanceTimersByTime(61 * 1000);

      const stalled = service.checkLiveness();
      expect(stalled).toBe(1);
      expect(service.getRelayer('G-RELAYER-1')!.status).toBe('stalled');

      const alerts = service.getAlerts();
      expect(alerts.some((a) => a.type === 'relayer_stalled')).toBe(true);
    });
  });

  describe('attestation lifecycle and fraud proofs', () => {
    it('records an attestation for a live relayer', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      const id = service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');
      expect(id).toBeTruthy();
      expect(service.getRelayer('G-RELAYER-1')!.attestationCount).toBe(1);
    });

    it('rejects attestations from a non-live relayer', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      jest.advanceTimersByTime(61 * 1000);
      expect(() =>
        service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot'),
      ).toThrow(/not live/);
    });

    it('slashes a relayer on a valid fraud proof', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      const id = service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');

      const slashed = service.submitFraudProof(id, 'invalid state root');
      expect(slashed).toBe(true);

      const attestation = service.getAttestation(id)!;
      expect(attestation.status).toBe('challenged');
      expect(attestation.fraudProofCount).toBe(1);

      const relayer = service.getRelayer('G-RELAYER-1')!;
      expect(relayer.status).toBe('slashed');
      expect(relayer.stake).toBe(0);
      expect(service.getAlerts().some((a) => a.type === 'fraud_proof')).toBe(true);
    });

    it('rejects a fraud proof after the dispute window', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      const id = service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');

      jest.advanceTimersByTime(121 * 1000);
      expect(() => service.submitFraudProof(id, 'too late')).toThrow(/Dispute window has closed/);
    });

    it('finalizes attestations only after the dispute window', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      const id = service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');

      expect(service.finalizePastDisputeWindow()).toBe(0);
      jest.advanceTimersByTime(121 * 1000);
      expect(service.finalizePastDisputeWindow()).toBe(1);
      expect(service.getAttestation(id)!.status).toBe('finalized');
    });

    it('does not finalize a challenged attestation', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      const id = service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');
      service.submitFraudProof(id, 'invalid');

      jest.advanceTimersByTime(121 * 1000);
      service.finalizePastDisputeWindow();
      expect(service.getAttestation(id)!.status).toBe('challenged');
    });
  });

  describe('alerts and stats', () => {
    it('acknowledges alerts', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      jest.advanceTimersByTime(61 * 1000);
      service.checkLiveness();

      const alert = service.getAlerts().find((a) => a.type === 'relayer_stalled')!;
      expect(alert.acknowledged).toBe(false);
      expect(service.acknowledgeAlert(alert.id)).toBe(true);
      expect(service.getAlerts().find((a) => a.id === alert.id)!.acknowledged).toBe(true);
      expect(service.acknowledgeAlert('missing')).toBe(false);
    });

    it('reports aggregate stats', () => {
      service.registerRelayer('G-RELAYER-1', 200);
      service.registerRelayer('G-RELAYER-2', 200);
      service.recordAttestation('G-RELAYER-1', 'msg-1', 1, 2, '0xroot');

      const stats = service.getStats();
      expect(stats.relayers).toBe(2);
      expect(stats.activeRelayers).toBe(2);
      expect(stats.pendingAttestations).toBe(1);
      expect(stats.unacknowledgedAlerts).toBe(2); // two registrations
    });
  });
});
