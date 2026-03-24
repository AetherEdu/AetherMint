import mongoose, { Document, Schema, Model } from 'mongoose';

export interface INotification extends Document {
  _id: string;
  userId: string;
  title: string;
  message: string;
  category: 'course' | 'message' | 'system' | 'achievement';
  isRead: boolean;
  isDelivered: boolean;
  priority: 'low' | 'medium' | 'high';
  deliveryMethods: ('email' | 'push' | 'websocket')[];
  scheduledTime?: Date;
  sentTime?: Date;
  actionUrl?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['course', 'message', 'system', 'achievement'],
    required: true,
    index: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  isDelivered: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  deliveryMethods: [{
    type: String,
    enum: ['email', 'push', 'websocket']
  }],
  scheduledTime: {
    type: Date
  },
  sentTime: {
    type: Date
  },
  actionUrl: {
    type: String,
    trim: true
  },
  metadata: {
    type: Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for common queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index(
  { scheduledTime: 1 },
  { partialFilterExpression: { isDelivered: false } }
);

export const Notification: Model<INotification> = mongoose.model<INotification>('Notification', NotificationSchema);
