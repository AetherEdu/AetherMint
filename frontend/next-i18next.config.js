/**
 * next-i18next configuration consumed by `appWithTranslation`.
 *
 * The runtime detection that powers `?lang=` querystring, Accept-Language
 * header fallback, and localStorage persistence lives in `src/lib/i18n.ts`.
 * This file is read by next-i18next on the server to seed the initial
 * translations during SSR.
 */

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar'];

module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: SUPPORTED_LOCALES,
    localeDetection: false, // handled by our custom LanguageDetector in lib/i18n.ts
  },

  // Only re-fetch translation files during dev; cache in production.
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  serializeConfig: false,

  // Only the filesystem backend is needed here; the HTTP backend is loaded by
  // the browser bootstrapping in `src/lib/i18n.ts`.
  backend: {
    loadPath: './public/locales/{{lng}}/{{ns}}.json',
  },

  ns: [
    'common',
    'navigation',
    'courses',
    'profile',
    'admin',
    'errors',
    'validation',
    'whiteboard',
  ],
  defaultNS: 'common',

  // We only ship the full translated namespaces for `en` and `es`. Other
  // locales fall back to Spanish (and then English) when a key is missing,
  // which mirrors the runtime fallback configured in src/lib/i18n.ts.
  fallbackLng: {
    default: ['en'],
    ar: ['ar', 'en'],
    zh: ['zh', 'en'],
    ja: ['ja', 'en'],
    ko: ['ko', 'en'],
    es: ['es', 'en'],
    fr: ['fr', 'en'],
    de: ['de', 'en'],
  },

  supportedLngs: SUPPORTED_LOCALES,
  load: 'languageOnly',
  nonExplicitSupportedLngs: true,

  debug: process.env.NODE_ENV === 'development',

  // `saveMissing` is only safe in development; production should never write
  // missing keys back to the disk.
  saveMissing: process.env.NODE_ENV === 'development',

  // In dev we surface missing keys via a console warning. i18next renders the
  // fallback string so end-users never see a raw key.
  missingKeyHandler:
    process.env.NODE_ENV === 'development'
      ? (lng, ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(
            `[i18n] Missing translation — lng: ${lng}, ns: ${ns}, key: ${key}`
          );
        }
      : undefined,

  react: {
    useSuspense: false,
  },

  interpolation: {
    escapeValue: false,
  },

  // TypeScript `strict` and `serverSideTranslations` consumers expect this.
  strictMode: true,
};
