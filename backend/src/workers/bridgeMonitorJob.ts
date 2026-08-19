/**
 * Bridge Monitor Watch Job
 *
 * Periodically drives the off-chain bridge security checks (issue #423):
 * marks stalled relayers and finalizes attestations whose dispute window has
 * closed. Wired into the server lifecycle in `index.ts` alongside the other
 * background workers.
 */

import { bridgeMonitorService } from '../services/bridgeMonitor';
import logger from '../utils/logger';

export class BridgeMonitorJob {
  private isRunning = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private pollIntervalMs: number;

  constructor(pollIntervalMs?: number) {
    this.pollIntervalMs =
      pollIntervalMs ?? parseInt(process.env.BRIDGE_MONITOR_INTERVAL_MS || '60000', 10);
  }

  /** Run a single monitoring sweep. */
  async runOnce(): Promise<{ stalledRelayers: number; finalizedAttestations: number }> {
    const stalledRelayers = bridgeMonitorService.checkLiveness();
    const finalizedAttestations = bridgeMonitorService.finalizePastDisputeWindow();
    return { stalledRelayers, finalizedAttestations };
  }

  /** Start the periodic watch loop. */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge monitor job is already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Starting bridge monitor job (interval ${this.pollIntervalMs}ms)`);

    await this.runOnce();

    this.interval = setInterval(async () => {
      try {
        await this.runOnce();
      } catch (error) {
        logger.error('Bridge monitor sweep failed', error as Error);
      }
    }, this.pollIntervalMs);
  }

  /** Stop the periodic watch loop. */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('Bridge monitor job stopped');
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.pollIntervalMs,
      ...bridgeMonitorService.getStats(),
    };
  }
}

export const bridgeMonitorJob = new BridgeMonitorJob();
export default bridgeMonitorJob;
