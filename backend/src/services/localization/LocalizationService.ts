/**
 * Localization Service
 *
 * Core workflow for the course-content localization pipeline (issue #418).
 *
 * Responsibilities:
 *  - Track a multi-locale registry with a single default (source) locale.
 *  - Drive the translation workflow: draft → in_progress → in_review → published.
 *  - Resolve content per locale with automatic fallback to the default locale.
 *  - Version content so every translation records the source revision it
 *    tracks, and reject publishing when a translation has gone stale.
 */

import {
  DEFAULT_LOCALE,
  Locale,
  SUPPORTED_LOCALES,
  TranslationEntityType,
  TranslationStatus,
  isSupportedLocale,
} from '../../models/Translation';
import logger from '../../utils/logger';

/** A translation record as managed by the workflow service. */
export interface TranslationRecord {
  id: string;
  entityType: TranslationEntityType;
  entityId: string;
  locale: Locale;
  sourceRevision: number;
  fields: Record<string, string>;
  status: TranslationStatus;
  assigneeId?: string;
  reviewerId?: string;
  createdBy?: string;
  publishedRevision?: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** A resolved value, including whether it fell back to the default locale. */
export interface ResolvedTranslation {
  locale: Locale;
  value: string | Record<string, string>;
  isFallback: boolean;
  status: TranslationStatus;
  sourceRevision: number;
}

export interface CreateTranslationInput {
  entityType: TranslationEntityType;
  entityId: string;
  locale: string;
  fields: Record<string, string>;
  createdBy?: string;
}

export interface ListTranslationsFilter {
  entityType?: TranslationEntityType;
  entityId?: string;
  locale?: string;
  status?: TranslationStatus;
}

interface SourceRevisionState {
  revision: number;
  /** Canonical default-locale content (the source of truth). */
  fields: Record<string, string>;
}

export class LocalizationService {
  private translations: Map<string, TranslationRecord> = new Map();
  private sourceRevisions: Map<string, SourceRevisionState> = new Map();
  private idCounter = 0;

  /** Locales supported by the pipeline. */
  getSupportedLocales(): Locale[] {
    return [...SUPPORTED_LOCALES];
  }

  /** The default (source-of-truth) locale. */
  getDefaultLocale(): Locale {
    return DEFAULT_LOCALE;
  }

  /** Whether `locale` is the default locale. */
  isDefaultLocale(locale: string): boolean {
    return locale === DEFAULT_LOCALE;
  }

  /**
   * Record (or update) the canonical default-locale content for an entity.
   *
   * Bumping the source content advances the entity's revision and marks every
   * published translation that tracks an older revision as `outdated`, which
   * the publishing flow then refuses to serve.
   */
  upsertSourceContent(
    entityType: TranslationEntityType,
    entityId: string,
    fields: Record<string, string>,
    updatedBy?: string,
  ): number {
    const key = this.sourceKey(entityType, entityId);
    const existing = this.sourceRevisions.get(key);
    const revision = (existing?.revision ?? 0) + 1;

    this.sourceRevisions.set(key, { revision, fields: { ...fields } });

    // Mark dependent published translations as outdated.
    for (const [id, record] of this.translations) {
      if (
        record.entityType === entityType &&
        record.entityId === entityId &&
        record.status === TranslationStatus.PUBLISHED &&
        record.sourceRevision < revision
      ) {
        record.status = TranslationStatus.OUTDATED;
        record.updatedAt = new Date();
        this.translations.set(id, record);
      }
    }

    logger.info(
      `Localization source content updated for ${entityType}:${entityId} at revision ${revision}${
        updatedBy ? ` by ${updatedBy}` : ''
      }`,
    );
    return revision;
  }

  /** The latest source revision for an entity (defaults to 1 when unknown). */
  getSourceRevision(entityType: TranslationEntityType, entityId: string): number {
    return this.sourceRevisions.get(this.sourceKey(entityType, entityId))?.revision ?? 1;
  }

  /**
   * Create a translation request for an entity in a target locale.
   *
   * Rejects translating into the default locale (it is the source of truth)
   * and rejects duplicate (entity, locale) pairs.
   */
  createTranslation(input: CreateTranslationInput): TranslationRecord {
    const locale = this.requireSupportedLocale(input.locale);

    if (locale === DEFAULT_LOCALE) {
      throw new Error(`Cannot translate into the default locale "${DEFAULT_LOCALE}"`);
    }

    const key = this.translationKey(input.entityType, input.entityId, locale);
    if (this.translations.has(key)) {
      throw new Error(
        `A translation already exists for ${input.entityType}:${input.entityId} in ${locale}`,
      );
    }

    const now = new Date();
    const record: TranslationRecord = {
      id: this.nextId(),
      entityType: input.entityType,
      entityId: input.entityId,
      locale,
      sourceRevision: this.getSourceRevision(input.entityType, input.entityId),
      fields: { ...input.fields },
      status: TranslationStatus.DRAFT,
      createdBy: input.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    this.translations.set(key, record);
    return { ...record };
  }

  /** Assign a translation to a translator and move it into progress. */
  assignTranslation(id: string, assigneeId: string): TranslationRecord {
    const record = this.findRecordOrThrow(id);

    if (
      record.status !== TranslationStatus.DRAFT &&
      record.status !== TranslationStatus.IN_PROGRESS
    ) {
      throw new Error(`Translation ${id} cannot be assigned from status "${record.status}"`);
    }

    record.assigneeId = assigneeId;
    record.status = TranslationStatus.IN_PROGRESS;
    record.updatedAt = new Date();
    return { ...record };
  }

  /** Submit a completed translation for review. */
  submitTranslation(id: string, submittedBy: string): TranslationRecord {
    const record = this.findRecordOrThrow(id);

    if (record.status === TranslationStatus.DRAFT && !record.assigneeId) {
      throw new Error(`Translation ${id} must be assigned before submission`);
    }
    if (
      record.status !== TranslationStatus.DRAFT &&
      record.status !== TranslationStatus.IN_PROGRESS
    ) {
      throw new Error(`Translation ${id} cannot be submitted from status "${record.status}"`);
    }

    record.status = TranslationStatus.IN_REVIEW;
    record.updatedAt = new Date();
    logger.info(`Translation ${id} submitted for review by ${submittedBy}`);
    return { ...record };
  }

  /**
   * Approve and publish a translation.
   *
   * Publishing is refused when the translation tracks a source revision older
   * than the current one — stale translations must be re-translated first.
   */
  approveTranslation(id: string, reviewerId: string): TranslationRecord {
    const record = this.findRecordOrThrow(id);

    if (record.status !== TranslationStatus.IN_REVIEW) {
      throw new Error(`Translation ${id} cannot be approved from status "${record.status}"`);
    }

    const currentRevision = this.getSourceRevision(record.entityType, record.entityId);
    if (record.sourceRevision < currentRevision) {
      record.status = TranslationStatus.OUTDATED;
      record.updatedAt = new Date();
      throw new Error(
        `Cannot publish stale translation ${id}: source is at revision ${currentRevision} ` +
          `but the translation tracks revision ${record.sourceRevision}`,
      );
    }

    record.status = TranslationStatus.PUBLISHED;
    record.reviewerId = reviewerId;
    record.publishedRevision = currentRevision;
    record.publishedAt = new Date();
    record.updatedAt = new Date();
    logger.info(`Translation ${id} published by ${reviewerId}`);
    return { ...record };
  }

  /** Reject a translation under review, returning it to draft for rework. */
  rejectTranslation(id: string, reviewerId: string): TranslationRecord {
    const record = this.findRecordOrThrow(id);

    if (record.status !== TranslationStatus.IN_REVIEW) {
      throw new Error(`Translation ${id} cannot be rejected from status "${record.status}"`);
    }

    record.status = TranslationStatus.DRAFT;
    record.reviewerId = reviewerId;
    record.updatedAt = new Date();
    return { ...record };
  }

  /** Update the translated field values of a draft/in-progress translation. */
  updateTranslationFields(id: string, fields: Record<string, string>): TranslationRecord {
    const record = this.findRecordOrThrow(id);

    if (record.status === TranslationStatus.PUBLISHED) {
      throw new Error(`Published translation ${id} cannot be modified directly`);
    }

    record.fields = { ...record.fields, ...fields };
    record.updatedAt = new Date();
    return { ...record };
  }

  getTranslation(id: string): TranslationRecord | null {
    const record = this.findById(id);
    return record ? { ...record } : null;
  }

  listTranslations(filter: ListTranslationsFilter = {}): TranslationRecord[] {
    const records: TranslationRecord[] = [];
    for (const record of this.translations.values()) {
      if (filter.entityType && record.entityType !== filter.entityType) continue;
      if (filter.entityId && record.entityId !== filter.entityId) continue;
      if (filter.locale && record.locale !== filter.locale) continue;
      if (filter.status && record.status !== filter.status) continue;
      records.push({ ...record });
    }
    return records.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  }

  /**
   * Resolve content for a locale, falling back to the default (source) locale
   * when no published translation exists for the requested locale.
   */
  resolveTranslation(
    entityType: TranslationEntityType,
    entityId: string,
    locale: string,
    field?: string,
  ): ResolvedTranslation | null {
    const resolvedLocale = this.requireSupportedLocale(locale);

    if (resolvedLocale !== DEFAULT_LOCALE) {
      const key = this.translationKey(entityType, entityId, resolvedLocale);
      const record = this.translations.get(key);
      if (record && record.status === TranslationStatus.PUBLISHED) {
        return this.toResolved(record, field);
      }
    }

    // Fallback to the default (source) locale.
    const source = this.sourceRevisions.get(this.sourceKey(entityType, entityId));
    if (!source) {
      return null;
    }
    return {
      locale: DEFAULT_LOCALE,
      value: this.pickField(source.fields, field),
      isFallback: true,
      status: TranslationStatus.PUBLISHED,
      sourceRevision: source.revision,
    };
  }

  /**
   * Translations that can no longer be served because their source has moved
   * on. This covers translations already marked `outdated` by a source update
   * as well as any `published` translation that is defensively behind the
   * current source revision.
   */
  getStaleTranslations(): TranslationRecord[] {
    const stale: TranslationRecord[] = [];
    for (const record of this.translations.values()) {
      const current = this.getSourceRevision(record.entityType, record.entityId);
      const behind = record.sourceRevision < current;
      if (
        record.status === TranslationStatus.OUTDATED ||
        (record.status === TranslationStatus.PUBLISHED && behind)
      ) {
        stale.push({ ...record });
      }
    }
    return stale;
  }

  /** Clear all in-memory state (primarily for tests). */
  reset(): void {
    this.translations.clear();
    this.sourceRevisions.clear();
    this.idCounter = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  private requireSupportedLocale(locale: string): Locale {
    if (!isSupportedLocale(locale)) {
      throw new Error(`Unsupported locale "${locale}"`);
    }
    return locale;
  }

  private translationKey(entityType: TranslationEntityType, entityId: string, locale: Locale): string {
    return `${entityType}:${entityId}:${locale}`;
  }

  private sourceKey(entityType: TranslationEntityType, entityId: string): string {
    return `${entityType}:${entityId}`;
  }

  private nextId(): string {
    this.idCounter += 1;
    return `tr_${Date.now()}_${this.idCounter}`;
  }

  private findById(id: string): TranslationRecord | undefined {
    for (const record of this.translations.values()) {
      if (record.id === id) return record;
    }
    return undefined;
  }

  private findRecordOrThrow(id: string): TranslationRecord {
    const record = this.findById(id);
    if (!record) {
      throw new Error(`Translation ${id} not found`);
    }
    return record;
  }

  private pickField(fields: Record<string, string>, field?: string): string | Record<string, string> {
    if (field) return fields[field] ?? '';
    return { ...fields };
  }

  private toResolved(record: TranslationRecord, field?: string): ResolvedTranslation {
    return {
      locale: record.locale,
      value: this.pickField(record.fields, field),
      isFallback: false,
      status: record.status,
      sourceRevision: record.sourceRevision,
    };
  }
}

export const localizationService = new LocalizationService();
