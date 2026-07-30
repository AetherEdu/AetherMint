import mongoose, { Document, Schema } from 'mongoose';

export enum AuditAction {
  USER_ROLE_CHANGE = 'user.role.change',
  USER_PERMISSION_CHANGE = 'user.permission.change',
  USER_PROFILE_UPDATE = 'user.profile.update',
  USER_CREATE = 'user.create',
  USER_DELETE = 'user.delete',
  
  COURSE_CREATE = 'course.create',
  COURSE_UPDATE = 'course.update',
  COURSE_DELETE = 'course.delete',
  COURSE_ENROLL = 'course.enroll',
  COURSE_UNENROLL = 'course.unenroll',
  
  PAYMENT_CREATE = 'payment.create',
  PAYMENT_PROCESS = 'payment.process',
  PAYMENT_REFUND = 'payment.refund',
  PAYMENT_FAIL = 'payment.fail',
  
  CREDENTIAL_ISSUE = 'credential.issue',
  CREDENTIAL_RELEASE = 'credential.release',
  CREDENTIAL_REVOKE = 'credential.revoke',
  CREDENTIAL_ACCESS = 'credential.access',
  
  DATA_ACCESS = 'data.access',
  DATA_EXPORT = 'data.export',
}

export type AuditResult = 'success' | 'failure';

export interface IAuditLog extends Document {
  timestamp: Date;
  actor: string;
  action: AuditAction;
  resource: string;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  userAgent?: string;
  result: AuditResult;
  errorMessage?: string;
}

const AuditLogSchema = new Schema<IAuditLog>({
  timestamp: { 
    type: Date, 
    default: Date.now, 
    index: true 
  },
  actor: { 
    type: String, 
    required: true, 
    index: true 
  },
  action: { 
    type: String, 
    required: true, 
    enum: Object.values(AuditAction),
    index: true 
  },
  resource: { 
    type: String, 
    required: true, 
    index: true 
  },
  resourceId: { 
    type: String, 
    index: true 
  },
  details: { 
    type: Schema.Types.Mixed, 
    default: {} 
  },
  ipAddress: { 
    type: String, 
    required: true,
    index: true 
  },
  userAgent: { 
    type: String 
  },
  result: { 
    type: String, 
    required: true, 
    enum: ['success', 'failure'],
    index: true 
  },
  errorMessage: { 
    type: String 
  },
}, {
  timestamps: false,
  versionKey: false,
});

AuditLogSchema.index({ actor: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ resource: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

AuditLogSchema.pre('save', function(next) {
  this.timestamp = new Date();
  next();
});

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);