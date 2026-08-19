import mongoose, { Schema, Document } from 'mongoose';

export interface IReply extends Document {
  postId: string;
  authorId: string;
  content: string;
  upvotes: number;
  isAcceptedAnswer: boolean;
  isInstructorAnswer: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReplySchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  authorId: { type: String, required: true },
  content: { type: String, required: true },
  upvotes: { type: Number, default: 0 },
  isAcceptedAnswer: { type: Boolean, default: false },
  isInstructorAnswer: { type: Boolean, default: false },
}, { timestamps: true });

export const Reply = mongoose.models.Reply || mongoose.model<IReply>('Reply', ReplySchema);
