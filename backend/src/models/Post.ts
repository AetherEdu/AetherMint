import mongoose, { Schema, Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  authorId: string;
  courseId?: string;
  tags: string[];
  upvotes: number;
  isResolved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PostSchema = new Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: String, required: true, index: true },
  courseId: { type: String, index: true },
  tags: [{ type: String }],
  upvotes: { type: Number, default: 0 },
  isResolved: { type: Boolean, default: false },
}, { timestamps: true });

export const Post = mongoose.models.Post || mongoose.model<IPost>('Post', PostSchema);
