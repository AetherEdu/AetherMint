import mongoose, { Schema, Document } from 'mongoose';

export interface IContractEvent extends Document {
  contractId: string;
  topic: string;
  type: string;
  data: any;
  ledgerSequence: number;
  transactionHash: string;
  processedAt: Date;
}

const ContractEventSchema = new Schema({
  contractId: { type: String, required: true, index: true },
  topic: { type: String, required: true, index: true },
  type: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  ledgerSequence: { type: Number, required: true, index: true },
  transactionHash: { type: String, required: true, unique: true },
  processedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Create a compound index for efficient queries by contract, topic, and order
ContractEventSchema.index({ contractId: 1, topic: 1, ledgerSequence: -1 });

export const ContractEvent = mongoose.models.ContractEvent || mongoose.model<IContractEvent>('ContractEvent', ContractEventSchema);
