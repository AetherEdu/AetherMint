export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  joinDate: string;
  totalCoursesCompleted: number;
  currentStreak: number;
  studyHours: number;
  level: number;
  experience: number;
  privacy: 'public' | 'private' | 'friends-only';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedDate?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  requirement: string;
  category: string;
  /** Points awarded when the achievement is unlocked. */
  points?: number;
  progress?: number;
  maxProgress?: number;
}

export interface Credential {
  id: string;
  title: string;
  issuer: string;
  issueDate: string;
  expiryDate?: string;
  credentialId: string;
  type: 'certificate' | 'badge' | 'degree' | 'license';
  verificationStatus: 'verified' | 'pending' | 'rejected' | 'expired';
  verificationUrl?: string;
  documentUrl?: string;
  skills: string[];
}

export interface ProfileStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalCertificates: number;
  verifiedCredentials: number;
  pendingCredentials: number;
  totalAchievements: number;
  rareAchievements: number;
  studyStreak: number;
  totalStudyHours: number;
  averageCompletionTime: number;
  rank: number;
  percentile: number;
}

export interface ProfileSettings {
  emailNotifications: boolean;
  weeklyDigest: boolean;
  achievementAlerts: boolean;
  darkMode: boolean;
  language: string;
  privacy: 'public' | 'private' | 'friends-only';
  twoFactorEnabled: boolean;
  newsletter: boolean;
  profileVisibility: {
    showAchievements: boolean;
    showCourses: boolean;
    showStats: boolean;
    showCredentials: boolean;
  };
}

export interface ProfileFormData {
  name: string;
  email: string;
  bio?: string;
  location?: string;
  website?: string;
  privacy: 'public' | 'private' | 'friends-only';
}

export interface ProfileUpdateResponse {
  success: boolean;
  message: string;
  profile?: UserProfile;
}

export interface CredentialVerificationRequest {
  credentialId: string;
  documentUrl?: string;
  additionalInfo?: string;
}

export interface AchievementProgress {
  achievementId: string;
  currentProgress: number;
  maxProgress: number;
  isCompleted: boolean;
  completedAt?: string;
}
