/**
 * Course Model
 * Defines the structure and interfaces for course data
 */

import mongoose, { Document, Schema } from 'mongoose';

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  REVIEW = 'review',
}

export interface Instructor {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  rating: number;
}

export interface CourseMetadata {
  level: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in hours
  language: string;
  subtitle: string;
  prerequisiteCourses: string[]; // IDs of prerequisite courses
  maxStudents: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseCategory {
  id: string;
  name: string;
  description: string;
  parentCategory?: string;
}

export interface CourseRating {
  userId: string;
  rating: number; // 1-5
  review?: string;
  createdAt: Date;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  shortDescription: string;
  category: CourseCategory;
  subcategories?: CourseCategory[];
  instructor: Instructor;
  price: number;
  originalPrice?: number;
  discount?: number;
  rating: number; // Average rating
  ratingCount: number;
  reviews: CourseRating[];
  enrollmentCount: number;
  thumbnail: string;
  coverImage: string;
  tags: string[];
  skills: string[];
  objectives: string[];
  curriculum: CurriculumModule[];
  metadata: CourseMetadata;
  searchScore?: number; // Used for relevance scoring
}

export interface CurriculumModule {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  duration: number; // in hours
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  duration: number; // in minutes
  videoUrl?: string;
  resourceUrls?: string[];
  order: number;
}

export interface SearchFilter {
  category?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
  priceRange?: {
    min: number;
    max: number;
  };
  rating?: number; // Minimum rating
  language?: string;
  instructor?: string;
  durationRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
  sortBy?: 'relevance' | 'rating' | 'price-low' | 'price-high' | 'newest' | 'popular';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  courses: Course[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SearchAnalytics {
  id: string;
  query: string;
  filters: SearchFilter;
  resultCount: number;
  timestamp: Date;
  userId?: string;
  sessionId: string;
  resultsClicked?: string[]; // Course IDs that were clicked
}

export interface RecommendationContext {
  userId: string;
  enrolledCourseIds: string[];
  browsedCourseIds: string[];
  preferredCategories: string[];
  preferredLevels: ('beginner' | 'intermediate' | 'advanced')[];
  lastSearchQuery?: string;
  ratings: { courseId: string; rating: number }[];
}

export interface Recommendation {
  courseId: string;
  course: Course;
  score: number;
  reason: string;
}

export interface RecommendationResult {
  recommendations: Recommendation[];
  generatedAt: Date;
}

// ── Mongoose Schema ────────────────────────────────────────────────────────

export interface ICourseDocument extends Document {
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: string;
  instructorId: string;
  price: number;
  rating: number;
  ratingCount: number;
  enrollmentCount: number;
  tags: string[];
  skills: string[];
  status: CourseStatus;
  level: 'beginner' | 'intermediate' | 'advanced';
  language: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourseDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    instructorId: {
      type: String,
      required: true,
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      index: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    enrollmentCount: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    skills: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(CourseStatus),
      default: CourseStatus.DRAFT,
      index: true,
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      index: true,
    },
    language: {
      type: String,
      default: 'en',
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Text index for full-text search on title, description, and tags
CourseSchema.index(
  { title: 'text', description: 'text', tags: 'text' },
  { weights: { title: 10, description: 5, tags: 3 }, name: 'course_text_search' }
);

// Composite: status + createdAt for listing queries
CourseSchema.index({ status: 1, createdAt: -1 });

// Composite: category + status for filtered browsing
CourseSchema.index({ category: 1, status: 1, createdAt: -1 });

// Composite: instructor + status for instructor dashboard
CourseSchema.index({ instructorId: 1, status: 1 });

// Composite: level + rating for recommendations
CourseSchema.index({ level: 1, rating: -1 });

// Composite: price + rating for cost/value sorting
CourseSchema.index({ price: 1, rating: -1 });

export const CourseModel = mongoose.model<ICourseDocument>('Course', CourseSchema);
