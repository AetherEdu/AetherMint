import mongoose, { Document, Schema } from 'mongoose';

export enum UserRole {
  STUDENT = 'student',
  EDUCATOR = 'educator',
  INSTRUCTOR = 'instructor',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending'
}

export interface User {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  profile?: UserProfile;
  address?: string;
}

export enum PrivacyLevel {
  Public = 'Public',
  Private = 'Private',
  FriendsOnly = 'FriendsOnly',
}

export interface UserProfile {
  owner: string;
  username: string;
  email?: string;
  bio?: string;
  avatarUrl?: string;
  createdAt: number;
  updatedAt: number;
  achievements: number[];
  credentials: number[];
  reputation: number;
  privacyLevel: PrivacyLevel;
  role: UserRole;
}

export interface Achievement {
  id: number;
  user: string;
  title: string;
  description: string;
  earnedAt: number;
  badgeUrl?: string;
  verified: boolean;
}

export interface UserStats {
  totalCourses: number;
  totalCredentials: number;
  totalAchievements: number;
  reputation: number;
}

// ── Mongoose Schema ────────────────────────────────────────────────────────

export interface IUserDocument extends Document {
  email: string;
  username: string;
  walletAddress: string;
  role: UserRole;
  status: UserStatus;
  profile: UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    walletAddress: {
      type: String,
      sparse: true,
      index: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.STUDENT,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.PENDING,
      index: true,
    },
    profile: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Composite: wallet address + status for auth lookups
UserSchema.index({ walletAddress: 1, status: 1 });

// Composite: role + status for admin queries
UserSchema.index({ role: 1, status: 1 });

// Composite: role + createdAt for analytics
UserSchema.index({ role: 1, createdAt: -1 });

export const UserModel = mongoose.model<IUserDocument>('User', UserSchema);