import { localizationService } from '../services/localization';
import {
  DEFAULT_LOCALE,
  TranslationEntityType,
  TranslationStatus,
} from '../models/Translation';

const LESSON = TranslationEntityType.LESSON;

const sourceFields = {
  title: 'Introduction to Stellar',
  body: 'Learn the fundamentals of the Stellar network.',
};

describe('LocalizationService', () => {
  beforeEach(() => {
    localizationService.reset();
  });

  describe('locale registry', () => {
    it('exposes a default locale that is part of the supported set', () => {
      const locales = localizationService.getSupportedLocales();
      expect(localizationService.getDefaultLocale()).toBe(DEFAULT_LOCALE);
      expect(locales).toContain(DEFAULT_LOCALE);
      expect(localizationService.isDefaultLocale(DEFAULT_LOCALE)).toBe(true);
      expect(localizationService.isDefaultLocale('fr')).toBe(false);
    });
  });

  describe('translation workflow', () => {
    it('creates a draft translation and walks it through to published', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');

      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'es',
        fields: { title: 'Introducción a Stellar' },
        createdBy: 'author-1',
      });
      expect(created.status).toBe(TranslationStatus.DRAFT);

      const assigned = localizationService.assignTranslation(created.id, 'translator-1');
      expect(assigned.status).toBe(TranslationStatus.IN_PROGRESS);
      expect(assigned.assigneeId).toBe('translator-1');

      const submitted = localizationService.submitTranslation(created.id, 'translator-1');
      expect(submitted.status).toBe(TranslationStatus.IN_REVIEW);

      const published = localizationService.approveTranslation(created.id, 'reviewer-1');
      expect(published.status).toBe(TranslationStatus.PUBLISHED);
      expect(published.publishedRevision).toBe(1);
      expect(published.reviewerId).toBe('reviewer-1');
      expect(published.publishedAt).toBeInstanceOf(Date);
    });

    it('tracks assignment and rejects out-of-order transitions', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'fr',
        fields: {},
        createdBy: 'author-1',
      });

      expect(() => localizationService.approveTranslation(created.id, 'reviewer-1')).toThrow(
        /cannot be approved/,
      );

      localizationService.assignTranslation(created.id, 'translator-1');
      expect(() =>
        localizationService.submitTranslation(created.id, 'translator-1'),
      ).not.toThrow();

      const rejected = localizationService.rejectTranslation(created.id, 'reviewer-1');
      expect(rejected.status).toBe(TranslationStatus.DRAFT);
    });
  });

  describe('multi-locale fallback', () => {
    it('resolves a published translation for the requested locale', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'es',
        fields: { title: 'Introducción a Stellar' },
        createdBy: 'author-1',
      });
      localizationService.assignTranslation(created.id, 'translator-1');
      localizationService.submitTranslation(created.id, 'translator-1');
      localizationService.approveTranslation(created.id, 'reviewer-1');

      const resolved = localizationService.resolveTranslation(LESSON, 'lesson-1', 'es', 'title');
      expect(resolved).not.toBeNull();
      expect(resolved!.locale).toBe('es');
      expect(resolved!.value).toBe('Introducción a Stellar');
      expect(resolved!.isFallback).toBe(false);
    });

    it('falls back to the default locale when a translation is missing', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');

      const resolved = localizationService.resolveTranslation(LESSON, 'lesson-1', 'fr', 'title');
      expect(resolved).not.toBeNull();
      expect(resolved!.locale).toBe(DEFAULT_LOCALE);
      expect(resolved!.value).toBe(sourceFields.title);
      expect(resolved!.isFallback).toBe(true);
    });

    it('does not serve an unpublished translation and falls back instead', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'de',
        fields: { title: 'Einführung in Stellar' },
        createdBy: 'author-1',
      });
      localizationService.assignTranslation(created.id, 'translator-1');

      const resolved = localizationService.resolveTranslation(LESSON, 'lesson-1', 'de', 'title');
      expect(resolved!.isFallback).toBe(true);
      expect(resolved!.locale).toBe(DEFAULT_LOCALE);
    });

    it('returns null when neither a translation nor source content exists', () => {
      const resolved = localizationService.resolveTranslation(LESSON, 'missing', 'fr', 'title');
      expect(resolved).toBeNull();
    });
  });

  describe('content versioning and stale translation prevention', () => {
    it('tracks the source revision each translation was produced from', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'pt',
        fields: { title: 'Introdução ao Stellar' },
        createdBy: 'author-1',
      });
      expect(created.sourceRevision).toBe(1);

      // Advancing the source revision marks published translations outdated.
      localizationService.assignTranslation(created.id, 'translator-1');
      localizationService.submitTranslation(created.id, 'translator-1');
      localizationService.approveTranslation(created.id, 'reviewer-1');

      const newRevision = localizationService.upsertSourceContent(
        LESSON,
        'lesson-1',
        { ...sourceFields, body: 'Revised body' },
        'author-1',
      );
      expect(newRevision).toBe(2);

      const record = localizationService.getTranslation(created.id)!;
      expect(record.status).toBe(TranslationStatus.OUTDATED);
    });

    it('refuses to publish a stale translation', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'zh',
        fields: { title: '恒星入门' },
        createdBy: 'author-1',
      });
      localizationService.assignTranslation(created.id, 'translator-1');
      localizationService.submitTranslation(created.id, 'translator-1');

      // Source content changes while the translation is under review.
      localizationService.upsertSourceContent(
        LESSON,
        'lesson-1',
        { ...sourceFields, body: 'Changed while under review' },
        'author-1',
      );

      expect(() => localizationService.approveTranslation(created.id, 'reviewer-1')).toThrow(
        /stale translation/,
      );
      expect(localizationService.getTranslation(created.id)!.status).toBe(
        TranslationStatus.OUTDATED,
      );
    });

    it('lists stale published translations', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const created = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'sw',
        fields: { title: 'Utangulizi wa Stellar' },
        createdBy: 'author-1',
      });
      localizationService.assignTranslation(created.id, 'translator-1');
      localizationService.submitTranslation(created.id, 'translator-1');
      localizationService.approveTranslation(created.id, 'reviewer-1');

      localizationService.upsertSourceContent(LESSON, 'lesson-1', { ...sourceFields }, 'author-1');

      const stale = localizationService.getStaleTranslations();
      expect(stale).toHaveLength(1);
      expect(stale[0].id).toBe(created.id);
    });
  });

  describe('validation', () => {
    it('rejects translating into the default locale', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      expect(() =>
        localizationService.createTranslation({
          entityType: LESSON,
          entityId: 'lesson-1',
          locale: DEFAULT_LOCALE,
          fields: {},
          createdBy: 'author-1',
        }),
      ).toThrow(/default locale/);
    });

    it('rejects unsupported locales', () => {
      expect(() =>
        localizationService.createTranslation({
          entityType: LESSON,
          entityId: 'lesson-1',
          locale: 'xx',
          fields: {},
          createdBy: 'author-1',
        }),
      ).toThrow(/Unsupported locale/);
    });

    it('rejects duplicate translations for the same entity and locale', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      const input = {
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'es',
        fields: { title: 'Introducción' },
        createdBy: 'author-1',
      };
      localizationService.createTranslation(input);
      expect(() => localizationService.createTranslation(input)).toThrow(/already exists/);
    });
  });

  describe('listing', () => {
    it('filters translations by entity, locale, and status', () => {
      localizationService.upsertSourceContent(LESSON, 'lesson-1', sourceFields, 'author-1');
      localizationService.upsertSourceContent(LESSON, 'lesson-2', sourceFields, 'author-1');

      const a = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-1',
        locale: 'es',
        fields: { title: 'Uno' },
        createdBy: 'author-1',
      });
      const b = localizationService.createTranslation({
        entityType: LESSON,
        entityId: 'lesson-2',
        locale: 'fr',
        fields: { title: 'Deux' },
        createdBy: 'author-1',
      });
      localizationService.assignTranslation(b.id, 'translator-1');

      expect(localizationService.listTranslations({ entityId: 'lesson-1' })).toHaveLength(1);
      expect(localizationService.listTranslations({ locale: 'fr' }).map((t) => t.id)).toEqual([
        b.id,
      ]);
      expect(
        localizationService.listTranslations({ status: TranslationStatus.IN_PROGRESS }).map(
          (t) => t.id,
        ),
      ).toEqual([b.id]);
      expect(localizationService.listTranslations()).toHaveLength(2);

      // Unused to satisfy lint about a unused variable being meaningful.
      expect(a.id).toBeTruthy();
    });
  });
});
