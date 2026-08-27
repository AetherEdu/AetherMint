/**
 * Translation Model
 *
 * Persistence model and shared types for the course-content localization
 * pipeline (issue #418). A `Translation` holds the translated value of a set
 * of content fields for a single entity (lesson, quiz, transcript, ...) in a
 * single locale, and tracks the source revision it was produced from so the
 * publishing flow can reject stale translations.
 */

import mongoose, { Document, Schema, Model } from "mongoose";

/** Default locale — the source of truth every other locale falls back to. */
export const DEFAULT_LOCALE = "en";

/** Locales the platform currently accepts for course-content translation. */
export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "zh",
  "ja",
  "ar",
  "hi",
  "sw",
] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

/** Lifecycle states a translation moves through in the workflow. */
export enum TranslationStatus {
  /** Translation has been requested but work has not started. */
  DRAFT = "draft",
  /** A translator is actively working on the translation. */
  IN_PROGRESS = "in_progress",
  /** The translation is awaiting reviewer approval. */
  IN_REVIEW = "in_review",
  /** The translation is published and served to learners. */
  PUBLISHED = "published",
  /** The source content changed after this translation was published. */
  OUTDATED = "outdated",
}

/** Kinds of content that can be localized. */
export enum TranslationEntityType {
  LESSON = "lesson",
  QUIZ = "quiz",
  ASSIGNMENT = "assignment",
  RESOURCE = "resource",
  VIDEO = "video",
  DOCUMENT = "document",
  TRANSCRIPT = "transcript",
}

/** Fields on a translation that represent workflow/version metadata. */
export interface TranslationFieldValues {
  [field: string]: string;
}

export interface ITranslation extends Document {
  _id: string;
  /** Type of the localized entity (lesson, quiz, transcript, ...). */
  entityType: TranslationEntityType;
  /** Stable identifier of the localized entity. */
  entityId: string;
  /** Locale this translation targets. */
  locale: Locale;
  /**
   * Revision of the *source* content this translation was produced from.
   * Compared against the latest source revision to detect stale translations.
   */
  sourceRevision: number;
  /** Translated fields keyed by field name (e.g. title, body, transcript). */
  fields: TranslationFieldValues;
  status: TranslationStatus;
  /** User id assigned to translate this content. */
  assigneeId?: string;
  /** User id of the reviewer that approved (or rejected) the translation. */
  reviewerId?: string;
  /** User id that created the translation request. */
  createdBy?: string;
  /** Source revision the translation was published against. */
  publishedRevision?: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TranslationSchema: Schema = new Schema(
  {
    entityType: {
      type: String,
      enum: Object.values(TranslationEntityType),
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    locale: {
      type: String,
      enum: SUPPORTED_LOCALES,
      required: true,
      index: true,
    },
    sourceRevision: {
      type: Number,
      required: true,
      default: 1,
    },
    fields: {
      type: Schema.Types.Mixed,
      required: true,
      default: {},
    },
    status: {
      type: String,
      enum: Object.values(TranslationStatus),
      default: TranslationStatus.DRAFT,
      index: true,
    },
    assigneeId: {
      type: String,
      index: true,
    },
    reviewerId: {
      type: String,
    },
    createdBy: {
      type: String,
    },
    publishedRevision: {
      type: Number,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// A single translation may exist per (entityType, entityId, locale).
TranslationSchema.index({ entityType: 1, entityId: 1, locale: 1 }, { unique: true });
TranslationSchema.index({ entityType: 1, entityId: 1, status: 1 });
TranslationSchema.index({ status: 1, updatedAt: -1 });

export const Translation: Model<ITranslation> = mongoose.model<ITranslation>(
  "Translation",
  TranslationSchema,
);

/** Helper to determine whether a locale is the default (source) locale. */
export function isDefaultLocale(locale: string): boolean {
  return locale === DEFAULT_LOCALE;
}

/** Helper to determine whether a locale is in the supported set. */
export function isSupportedLocale(locale: string): locale is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}
