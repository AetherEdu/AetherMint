import { TimeLockedCredential, ITimeLockedCredential } from '../models/TimeLockedCredential';
import { auditService } from './auditService';
import { AuditAction } from '../models/AuditLog';
import { v4 as uuidv4 } from 'uuid';
import { Redis } from 'ioredis';
import logger from '../utils/logger';

interface IssueCredentialParams {
  issuer: string;
  recipient: string;
  credentialHash: string;
  metadata: string;
  releaseTime: Date;
}

interface CreateScheduleParams {
  creator: string;
  credentialIds: string[];
  releaseTimes: Date[];
}

interface AuditContext {
  actor?: string;
  ipAddress?: string;
}

export class TimeLockCredentialService {
  private redis: Redis | null = null;

  constructor() {
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');
    
    try {
      this.redis = new Redis({
        host: redisHost,
        port: redisPort,
        password: process.env.REDIS_PASSWORD || undefined,
      });
    } catch (error) {
      logger.warn('Redis not available, caching disabled');
    }
  }

  /**
   * Issue a new time-locked credential
   */
  async issueCredential(params: IssueCredentialParams, auditContext?: AuditContext): Promise<ITimeLockedCredential> {
    const { issuer, recipient, credentialHash, metadata, releaseTime } = params;

    // Validate release time is in the future
    if (releaseTime <= new Date()) {
      throw new Error('Release time must be in the future');
    }

    const credentialId = uuidv4();

    const credential = new TimeLockedCredential({
      credentialId,
      issuer,
      recipient,
      credentialHash,
      metadata,
      releaseTime,
    });

    await (credential as any).addAuditEntry('ISSUE', issuer, 'Credential issued with time lock');

    // Cache the credential
    await this.cacheCredential(credential);

    // Schedule notification job
    await this.scheduleReleaseNotification(credential);

    if (auditContext) {
      await auditService.create(
        auditContext.actor || issuer,
        AuditAction.CREDENTIAL_ISSUE,
        'credential',
        {
          resourceId: credentialId,
          details: { operation: 'issue', issuer, recipient },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return credential;
  }

  /**
   * Release a single credential
   */
  async releaseCredential(credentialId: string, caller: string, auditContext?: AuditContext): Promise<ITimeLockedCredential> {
    const credential = await TimeLockedCredential.findOne({ credentialId });

    if (!credential) {
      throw new Error('Credential not found');
    }

    if (credential.isReleased) {
      throw new Error('Credential already released');
    }

    if (credential.isRevoked) {
      throw new Error('Credential has been revoked');
    }

    if (credential.releaseTime > new Date()) {
      throw new Error('Time lock not yet expired');
    }

    if (credential.issuer !== caller && credential.recipient !== caller) {
      throw new Error('Unauthorized caller');
    }

    credential.isReleased = true;
    await (credential as any).addAuditEntry('RELEASE', caller, 'Credential released');

    // Update cache
    await this.cacheCredential(credential);

    // Emit event via Redis pub/sub
    await this.emitReleaseEvent(credential);

    if (auditContext) {
      await auditService.create(
        auditContext.actor || caller,
        AuditAction.CREDENTIAL_RELEASE,
        'credential',
        {
          resourceId: credentialId,
          details: { operation: 'release', caller },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return credential;
  }

  /**
   * Batch release multiple credentials (gas optimized)
   */
  async batchReleaseCredentials(credentialIds: string[], caller: string, auditContext?: AuditContext): Promise<any[]> {
    const results = await (TimeLockedCredential as any).batchRelease(credentialIds, caller);

    // Cache updated credentials
    for (const result of results) {
      if (result.success) {
        const credential = await TimeLockedCredential.findOne({ credentialId: result.credentialId });
        if (credential) {
          await this.cacheCredential(credential);
        }
      }
    }

    if (auditContext) {
      const successCount = results.filter((r: any) => r.success).length;
      await auditService.create(
        auditContext.actor || caller,
        AuditAction.CREDENTIAL_RELEASE,
        'credential',
        {
          details: { operation: 'batch_release', total: results.length, success: successCount },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return results;
  }

  /**
   * Emergency revoke a credential (within 5 minutes)
   */
  async emergencyRevoke(
    credentialId: string,
    admin: string,
    reason: string,
    auditContext?: AuditContext
  ): Promise<ITimeLockedCredential> {
    const credential = await TimeLockedCredential.findOne({ credentialId });

    if (!credential) {
      throw new Error('Credential not found');
    }

    if (credential.isRevoked) {
      throw new Error('Credential already revoked');
    }

    // Verify admin privileges (implement your admin check logic here)
    const isAdmin = await this.verifyAdminPrivileges(admin);
    if (!isAdmin) {
      throw new Error('Not authorized');
    }

    credential.isRevoked = true;
    credential.emergencyOverrideBy = admin;
    credential.revokeReason = reason;
    await (credential as any).addAuditEntry('EMERGENCY_REVOKE', admin, `Emergency revoke: ${reason}`);

    // Update cache
    await this.cacheCredential(credential);

    // Emit emergency event
    await this.emitEmergencyRevokeEvent(credential, admin, reason);

    await auditService.create(
      auditContext?.actor || admin,
      AuditAction.CREDENTIAL_REVOKE,
      'credential',
      {
        resourceId: credentialId,
        details: { operation: 'emergency_revoke', admin, reason },
        ipAddress: auditContext?.ipAddress,
      }
    );

    return credential;
  }

  /**
   * Create a release schedule for multiple credentials
   */
  async createReleaseSchedule(params: CreateScheduleParams, auditContext?: AuditContext): Promise<string> {
    const { creator, credentialIds, releaseTimes } = params;

    if (credentialIds.length !== releaseTimes.length) {
      throw new Error('Credential and release time counts must match');
    }

    const scheduleId = uuidv4();

    // Update all credentials with schedule ID
    for (let i = 0; i < credentialIds.length; i++) {
      const credential = await TimeLockedCredential.findOne({ 
        credentialId: credentialIds[i] 
      });

      if (!credential) {
        throw new Error(`Credential ${credentialIds[i]} not found`);
      }

      if (credential.issuer !== creator) {
        throw new Error(`Not authorized to modify credential ${credentialIds[i]}`);
      }

      credential.scheduleId = scheduleId;
      await credential.save();
    }

    // Cache schedule metadata
    if (this.redis) {
      await this.redis.setex(
        `schedule:${scheduleId}`,
        86400 * 30, // 30 days
        JSON.stringify({
          credentialIds,
          releaseTimes: releaseTimes.map(t => t.getTime()),
          creator,
          createdAt: Date.now(),
        })
      );
    }

    if (auditContext) {
      await auditService.create(
        auditContext.actor || creator,
        AuditAction.CREDENTIAL_ISSUE,
        'credential_schedule',
        {
          resourceId: scheduleId,
          details: { operation: 'create_schedule', count: credentialIds.length },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return scheduleId;
  }

  /**
   * Get upcoming releases for notification system
   */
  async getUpcomingReleases(recipient: string, timeWindowMs: number = 86400000, auditContext?: AuditContext): Promise<ITimeLockedCredential[]> {
    // Check cache first
    const cacheKey = `upcoming:${recipient}:${timeWindowMs}`;
    
    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const upcoming = await (TimeLockedCredential as any).findUpcomingReleases(recipient, timeWindowMs);

    // Cache for 5 minutes
    if (this.redis) {
      await this.redis.setex(cacheKey, 300, JSON.stringify(upcoming));
    }

    if (auditContext) {
      await auditService.create(
        auditContext.actor || recipient,
        AuditAction.CREDENTIAL_ACCESS,
        'credential',
        {
          details: { operation: 'get_upcoming_releases', count: upcoming.length },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return upcoming;
  }

  /**
   * Get credentials by recipient
   */
  async getCredentialsByRecipient(recipient: string, auditContext?: AuditContext): Promise<ITimeLockedCredential[]> {
    const credentials = await TimeLockedCredential.find({ recipient }).sort({ createdAt: -1 });
    
    if (auditContext) {
      await auditService.create(
        auditContext.actor || recipient,
        AuditAction.CREDENTIAL_ACCESS,
        'credential',
        {
          details: { operation: 'get_by_recipient', count: credentials.length },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return credentials;
  }

  /**
   * Get credentials by issuer
   */
  async getCredentialsByIssuer(issuer: string, auditContext?: AuditContext): Promise<ITimeLockedCredential[]> {
    const credentials = await TimeLockedCredential.find({ issuer }).sort({ createdAt: -1 });
    
    if (auditContext) {
      await auditService.create(
        auditContext.actor || issuer,
        AuditAction.CREDENTIAL_ACCESS,
        'credential',
        {
          details: { operation: 'get_by_issuer', count: credentials.length },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return credentials;
  }

  /**
   * Get audit trail for a credential
   */
  async getAuditTrail(credentialId: string, auditContext?: AuditContext): Promise<any> {
    const credential = await TimeLockedCredential.findOne({ credentialId });
    if (!credential) {
      throw new Error('Credential not found');
    }

    if (auditContext) {
      await auditService.create(
        auditContext.actor || 'anonymous',
        AuditAction.CREDENTIAL_ACCESS,
        'credential_audit',
        {
          resourceId: credentialId,
          details: { operation: 'get_audit_trail' },
          ipAddress: auditContext.ipAddress,
        }
      );
    }

    return {
      credentialId,
      auditTrail: credential.auditTrail,
      totalEntries: credential.auditTrail.length,
    };
  }

  /**
   * Helper: Cache credential data
   */
  private async cacheCredential(credential: ITimeLockedCredential): Promise<void> {
    if (!this.redis) return;

    const cacheKey = `credential:${credential.credentialId}`;
    await this.redis.setex(cacheKey, 86400, JSON.stringify(credential));
  }

  /**
   * Helper: Schedule release notification
   */
  private async scheduleReleaseNotification(credential: ITimeLockedCredential): Promise<void> {
    // Implement notification scheduling using node-cron or similar
    // This would integrate with your existing notification system
    logger.info('Scheduled notification for credential', {
      credentialId: credential.credentialId,
      releaseTime: credential.releaseTime,
    });
  }

  /**
   * Helper: Emit release event
   */
  private async emitReleaseEvent(credential: ITimeLockedCredential): Promise<void> {
    if (!this.redis) return;

    await this.redis.publish(
      'credential:released',
      JSON.stringify({
        credentialId: credential.credentialId,
        recipient: credential.recipient,
        issuer: credential.issuer,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Helper: Emit emergency revoke event
   */
  private async emitEmergencyRevokeEvent(
    credential: ITimeLockedCredential,
    admin: string,
    reason: string
  ): Promise<void> {
    if (!this.redis) return;

    await this.redis.publish(
      'credential:emergency_revoked',
      JSON.stringify({
        credentialId: credential.credentialId,
        admin,
        reason,
        timestamp: new Date().toISOString(),
      })
    );
  }

  /**
   * Helper: Verify admin privileges
   */
  private async verifyAdminPrivileges(admin: string): Promise<boolean> {
    // Implement your admin verification logic here
    // This could check against a database, role system, etc.
    const emergencyAdmin = process.env.EMERGENCY_ADMIN_ADDRESS;
    return admin === emergencyAdmin;
  }
}

export const timeLockCredentialService = new TimeLockCredentialService();
