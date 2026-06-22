/**
 * i18n bootstrap for the AetherMint frontend.
 *
 * Detection order (first hit wins):
 *   1. querystring  — `?lang=es` for explicit deep-links
 *   2. localStorage  — user's previously saved preference (key: `i18nextLng`)
 *   3. cookie       — SSR-friendly persisted preference
 *   4. navigator    — browser's `navigator.language` (Accept-Language)
 *   5. htmlTag      — `<html lang="…">` attribute
 *
 * Missing-key behavior:
 *   - development → warn in console, render the fallback string (no key in UI)
 *   - production  → silent fallback to English, render the fallback string
 *
 * The `header` detector lives behind `i18next-http-middleware` and is only
 * used on the server-side (next-i18next). At runtime in the browser we read
 * `navigator.language` and the `Accept-Language` header is consumed on the
 * initial server render.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isRTL, getFontFamily } from './rtl';

export const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'de',
  'zh',
  'ja',
  'ko',
  'ar',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = 'en';

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  if (!value) return false;
  // Strip region tag (e.g., "es-MX" → "es") before testing.
  const lang = value.toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang);
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale {
  if (!value) return DEFAULT_LOCALE;
  const lang = value.toLowerCase().split('-')[0];
  return (SUPPORTED_LOCALES as readonly string[]).includes(lang)
    ? (lang as SupportedLocale)
    : DEFAULT_LOCALE;
}

const isDevelopment = process.env.NODE_ENV === 'development';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES as unknown as string[],
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    cleanCode: true,

    debug: isDevelopment,

    interpolation: {
      escapeValue: false,
      format: (value, format, lng) => {
        if (format === 'uppercase') return String(value).toUpperCase();
        if (format === 'lowercase') return String(value).toLowerCase();
        if (format === 'currency') {
          return new Intl.NumberFormat(lng, {
            style: 'currency',
            currency: 'USD',
          }).format(Number(value));
        }
        if (format === 'date') {
          return new Intl.DateTimeFormat(lng).format(new Date(value));
        }
        if (format === 'datetime') {
          return new Intl.DateTimeFormat(lng, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(value));
        }
        if (format === 'relativetime') {
          const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' });
          const diff = Date.now() - new Date(value).getTime();
          const days = Math.floor(diff / (1000 * 60 * 60 * 24));
          return rtf.format(-days, 'day');
        }
        return value;
      },
    },

    detection: {
      // Order matters: querystring overrides everything so `?lang=es` always wins.
      order: ['querystring', 'localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      lookupQuerystring: 'lang',
      lookupLocalStorage: 'i18nextLng',
      lookupCookie: 'i18nextLng',
      cookieMinutes: 60 * 24 * 365, // 1 year
      // Empty domain -> cookie scoped to the current host only, which
      // works on `localhost`, IPs, and embedded contexts (vs. setting
      // `window.location.hostname`, which fails for hosts without dots).
      cookieDomain: '',
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    ns: ['common', 'navigation', 'courses', 'profile', 'admin', 'errors', 'validation'],
    defaultNS: 'common',

    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'em', 'span'],
    },

    pluralSeparator: '_',
    contextSeparator: '_',

    returnEmptyString: false,
    returnNull: false,
    returnObjects: false,

    saveMissing: isDevelopment,
    saveMissingTo: 'current',

    /**
     * Surfaces missing keys while keeping the UI friendly:
     *  - dev  → warn in console (no leaked key into UI; renderer falls back).
     *  - prod → silent fallback to English.
     *
     * The actual fallback resolution is handled by i18next via `fallbackLng`.
     */
    missingKeyHandler: isDevelopment
      ? (_lng, _ns, key) => {
          // eslint-disable-next-line no-console
          console.warn(`[i18n] Missing translation key: ${key}`);
        }
      : undefined,

    preload: [...SUPPORTED_LOCALES],
    simplifyPluralSuffix: true,
  });

// -----------------------------------------------------------------------------
// Document-level side effects on language change
// -----------------------------------------------------------------------------

function applyDocumentSideEffects(lng: string) {
  if (typeof document === 'undefined') return;

  const normalized = normalizeLocale(lng);

  document.documentElement.lang = normalized;
  document.documentElement.dir = isRTL(normalized) ? 'rtl' : 'ltr';
  document.body.classList.toggle('rtl', isRTL(normalized));
  document.body.classList.toggle('ltr', !isRTL(normalized));
  document.body.style.fontFamily = getFontFamily(normalized);
}

// Run once on init (handles the case where the user lands with `?lang=es`).
applyDocumentSideEffects(i18n.language || DEFAULT_LOCALE);

i18n.on('languageChanged', (lng) => {
  applyDocumentSideEffects(lng);
});

export default i18n;
