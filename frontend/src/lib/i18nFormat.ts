/**
 * Locale-aware format helpers
 *
 * Re-exports of `Intl` formatters that the existing `useTranslation()` flow
 * already picks up via the active language. We centralize these so callers
 * don't have to worry about:
 *  - whether to pass the raw `lng` from i18next vs. the resolved `SupportedLocale`
 *    (i18next sometimes hands back the full BCP-47 tag like "es-MX"),
 *  - how to handle the i18next `format` placeholder syntax for currency, etc.
 *
 * Usage:
 *   import { formatCurrency, formatDate, formatRelativeTime } from '@/lib/i18nFormat';
 *   formatCurrency(99.95, { currency: 'USD', lng: i18n.language });
 */

import { normalizeLocale, type SupportedLocale } from './i18n';
import { getDateFormatOptions, getNumberFormatOptions } from './rtl';

export interface FormatCurrencyOptions {
  /** ISO-4217 currency code, e.g. 'USD', 'EUR'. Defaults to USD. */
  currency?: string;
  /** Locale tag from i18next (e.g. 'es', 'es-MX'). */
  lng?: string;
  /** Override `Intl.NumberFormatOptions`. */
  numberFormatOptions?: Intl.NumberFormatOptions;
}

export function formatCurrency(value: number, options: FormatCurrencyOptions = {}): string {
  const lng = normalizeLocale(options.lng);
  const currency = options.currency ?? 'USD';
  const localeForFormatting = normalizeLocale(options.lng ?? lng);
  const formatter = new Intl.NumberFormat(localeForFormatting, {
    style: 'currency',
    currency,
    ...getNumberFormatOptions(lng),
    ...options.numberFormatOptions,
  });
  // Per ICU, currencies need to be formatted with the locale's number system
  // but represent the requesting currency — so we split the locale parts: use
  // `lng` for digit grouping, but keep the currency code explicit.
  void localeForFormatting;
  return formatter.format(value);
}

export interface FormatDateOptions {
  lng?: string;
  dateStyle?: 'short' | 'medium' | 'long' | 'full';
  timeStyle?: 'short' | 'medium' | 'long' | 'full';
}

const DATE_BASE_OPTIONS = {
  short: { year: 'numeric', month: 'short', day: 'numeric' } as Intl.DateTimeFormatOptions,
  medium: { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions,
  long: { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' } as Intl.DateTimeFormatOptions,
  full: { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' } as Intl.DateTimeFormatOptions,
};

export function formatDate(value: Date | string | number, options: FormatDateOptions = {}): string {
  const lng = normalizeLocale(options.lng);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dateStyle = options.dateStyle ?? 'medium';
  const formatter = new Intl.DateTimeFormat(lng, {
    ...DATE_BASE_OPTIONS[dateStyle],
    ...getDateFormatOptions(lng),
  });
  return formatter.format(date);
}

export function formatNumber(value: number, options: FormatCurrencyOptions & Intl.NumberFormatOptions = {}): string {
  const lng = normalizeLocale(options.lng);
  const { currency: _currency, numberFormatOptions: _numOpt, lng: _lng, ...rest } = options;
  void _currency;
  void _numOpt;
  void _lng;
  return new Intl.NumberFormat(lng, {
    ...getNumberFormatOptions(lng),
    ...rest,
  }).format(value);
}

export interface FormatRelativeTimeOptions {
  lng?: string;
  /**
   * Optional fixed "now" to compare against (useful in tests). Defaults to
   * `Date.now()`.
   */
  now?: number;
}

/**
 * Compact relative time string suitable for "saved 5 minutes ago" copy.
 * Picks the largest whole unit (day / hour / minute / second) so output is
 * always a single number + unit, mirroring common i18n patterns.
 */
export function formatRelativeTime(input: Date | string | number, options: FormatRelativeTimeOptions = {}): string {
  const target = input instanceof Date ? input.getTime() : new Date(input).getTime();
  if (!Number.isFinite(target)) return String(input);
  const now = options.now ?? Date.now();
  const diffMs = now - target;
  const future = diffMs < 0;
  const absolute = Math.abs(diffMs);

  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
    { unit: 'second', ms: 1000 },
    { unit: 'minute', ms: 60 * 1000 },
    { unit: 'hour', ms: 60 * 60 * 1000 },
    { unit: 'day', ms: 24 * 60 * 60 * 1000 },
    { unit: 'month', ms: 30 * 24 * 60 * 60 * 1000 },
    { unit: 'year', ms: 365 * 24 * 60 * 60 * 1000 },
  ];

  let chosen = units[0];
  for (const candidate of units) {
    if (absolute >= candidate.ms) chosen = candidate;
  }

  const value = Math.round(absolute / chosen.ms);
  // For "just now" we deliberately render zero rather than the locale's
  // "in 0 seconds" rendering.
  if (value === 0) {
    return Intl.RelativeTimeFormat(norm(options.lng), { numeric: 'auto' }).format(0, 'second');
  }
  const rtf = new Intl.RelativeTimeFormat(norm(options.lng), { numeric: 'auto' });
  return rtf.format(future ? value : -value, chosen.unit);
}

function norm(lng: string | undefined): SupportedLocale {
  return normalizeLocale(lng);
}
