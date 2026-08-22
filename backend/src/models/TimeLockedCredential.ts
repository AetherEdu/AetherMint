import mongoose, { Document, Schema } from 'mongoose';

export interface ITimeLockedCredential extends Document {
  credentialId: string;
  issuer: string;
  recipient: string;
  credentialHash: string;
  metadata: string;
  releaseTime: Date;
  createdAt: Date;
  isReleased: boolean;
  isRevoked: boolean;
  emergencyOverrideBy?: string;
  revokeReason?: string;
  scheduleId?: string;
  auditTrail: AuditEntry[];
}

interface AuditEntry {
  operation: string;
  actor: string;
  timestamp: Date;
  details: string;
}

const AuditEntrySchema = new Schema({
  operation: { type: String, required: true },
  actor: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  details: { type: String, required: true },
}, { _id: false });

const TimeLockedCredentialSchema = new Schema<ITimeLockedCredential>({
  credentialId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  issuer: { 
    type: String, 
    required: true,
    index: true 
  },
  recipient: { 
    type: String, 
    required: true,
    index: true 
  },
  credentialHash: { 
    type: String, 
    required: true,
    index: true
  },
  metadata: { 
    type: String, 
    required: true 
  },
  releaseTime: { 
    type: Date, 
    required: true,
    index: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  isReleased: { 
    type: Boolean, 
    default: false 
  },
  isRevoked: { 
    type: Boolean, 
    default: false 
  },
  emergencyOverrideBy: { 
    type: String 
  },
  revokeReason: { 
    type: String 
  },
  scheduleId: { 
    type: String,
    index: true 
  },
  auditTrail: {
    type: [AuditEntrySchema],
    default: []
  },
}, {
  timestamps: true,
});

// Index for querying upcoming releases
TimeLockedCredentialSchema.index({ releaseTime: 1, isReleased: 1, isRevoked: 1 });

// Index for batch queries
TimeLockedCredentialSchema.index({ issuer: 1, createdAt: -1 });
TimeLockedCredentialSchema.index({ recipient: 1, createdAt: -1 });

// Composite: credential hash lookups with release status
TimeLockedCredentialSchema.index({ credentialHash: 1, isReleased: 1 });

// Composite: recipient + release status for user-facing queries
TimeLockedCredentialSchema.index({ recipient: 1, isReleased: 1, isRevoked: 1 });

// Text index for metadata search
TimeLockedCredentialSchema.index({ metadata: 'text', revokeReason: 'text' });

// Method to add audit entry
TimeLockedCredentialSchema.methods.addAuditEntry = function(
  operation: string,
  actor: string,
  details: string
) {
  this.auditTrail.push({
    operation,
    actor,
    timestamp: new Date(),
    details,
  });
  return this.save();
};

// Static method to find upcoming releases
TimeLockedCredentialSchema.statics.findUpcomingReleases = function(
  recipient: string,
  timeWindowMs: number
) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + timeWindowMs);
  
  return this.find({
    recipient,
    releaseTime: { $lte: windowEnd, $gt: now },
    isReleased: false,
    isRevoked: false,
  }).sort({ releaseTime: 1 });
};

// Static method for batch release
TimeLockedCredentialSchema.statics.batchRelease = async function(
  credentialIds: string[],
  caller: string
) {
  const results = [];
  const now = new Date();
  
  for (const credentialId of credentialIds) {
    try {
      const credential = await this.findOne({ credentialId });
      
      if (!credential) {
        results.push({ credentialId, success: false, error: 'Not found' });
        continue;
      }
      
      if (credential.isReleased) {
        results.push({ credentialId, success: false, error: 'Already released' });
        continue;
      }
      
      if (credential.isRevoked) {
        results.push({ credentialId, success: false, error: 'Revoked' });
        continue;
      }
      
      if (credential.releaseTime > now) {
        results.push({ credentialId, success: false, error: 'Time lock active' });
        continue;
      }
      
      if (credential.issuer !== caller && credential.recipient !== caller) {
        results.push({ credentialId, success: false, error: 'Unauthorized' });
        continue;
      }
      
      credential.isReleased = true;
      await credential.addAuditEntry('RELEASE', caller, 'Credential released via batch operation');
      
      results.push({ credentialId, success: true });
    } catch (error) {
      results.push({ 
        credentialId, 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
  
  return results;
};

export const TimeLockedCredential = mongoose.model<ITimeLockedCredential>(
  'TimeLockedCredential',
  TimeLockedCredentialSchema
);
