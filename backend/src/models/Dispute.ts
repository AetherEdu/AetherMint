import mongoose, { Document, Schema } from 'mongoose';

export type DisputeStatus = 'open' | 'under_review' | 'resolved_refund' | 'resolved_release' | 'closed';

export interface DisputeEvidence {
  authorId: string;
  content: string;
  createdAt: Date;
}

export interface IDispute extends Document {
  listingId: string;
  escrowId?: string;
  buyerId: string;
  sellerId?: string;
  reason: string;
  status: DisputeStatus;
  evidence: DisputeEvidence[];
  mediatorId?: string;
  resolution?: 'refund' | 'release';
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EvidenceSchema = new Schema<DisputeEvidence>({
  authorId: { type: String, required: true },
  content: { type: String, required: true, maxlength: 4096 },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const DisputeSchema = new Schema<IDispute>({
  listingId: { type: String, required: true, index: true },
  escrowId: { type: String, index: true },
  buyerId: { type: String, required: true, index: true },
  sellerId: { type: String, index: true },
  reason: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['open', 'under_review', 'resolved_refund', 'resolved_release', 'closed'], default: 'open', index: true },
  evidence: { type: [EvidenceSchema], default: [] },
  mediatorId: { type: String },
  resolution: { type: String, enum: ['refund', 'release'] },
  resolvedAt: { type: Date },
}, { timestamps: true, versionKey: false });

DisputeSchema.index({ listingId: 1, buyerId: 1, status: 1 });

export const Dispute = mongoose.model<IDispute>('Dispute', DisputeSchema);
