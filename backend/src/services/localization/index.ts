/**
 * Localization service module (issue #418).
 *
 * Re-exports the translation workflow service and its public types so callers
 * can import from `services/localization` rather than reaching into files.
 */

export {
  LocalizationService,
  localizationService,
} from './LocalizationService';
export type {
  TranslationRecord,
  ResolvedTranslation,
  CreateTranslationInput,
  ListTranslationsFilter,
} from './LocalizationService';
