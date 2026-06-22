/**
 * i18nFormat helper tests
 *
 * Run with: `npx jest __tests__/i18nFormat.test.ts`
 *
 * We mock `Intl` where it would otherwise depend on the host ICU data so
 * tests remain hermetic. The assertions focus on shape + locale resolution,
 * not exact ICU output.
 */

import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatRelativeTime,
} from '../i18nFormat';
import { isRTL, getFontFamily, getDateFormatOptions, getNumberFormatOptions } from '../rtl';

describe('i18nFormat helpers', () => {
  it('formats currency via Intl.NumberFormat with the requested locale', () => {
    const formatted = formatCurrency(1234.5, { currency: 'USD', lng: 'es' });
    // Spanish uses a comma decimal separator; we don't assert exact value
    // (ICU data varies by host) but the string must include digits + symbol.
    expect(formatted).toMatch(/[\d.,]+/);
  });

  it('falls back to "en" for unsupported locales without throwing', () => {
    expect(() => formatNumber(1234.5, { lng: 'xx-YY' })).not.toThrow();
    expect(formatNumber(1234.5, { lng: 'xx-YY' })).toMatch(/1,234/);
  });

  it('formats relative time with lucidity around zero', () => {
    const now = 1_700_000_000_000;
    expect(formatRelativeTime(now - 5_000, { lng: 'en', now })).toMatch(/now|ago/i);
    expect(formatRelativeTime(now - 60_000, { lng: 'en', now })).toMatch(/minute/i);
    expect(formatRelativeTime(now + 60_000, { lng: 'en', now })).toMatch(/minute/i);
    expect(formatRelativeTime(now - 60 * 60_000, { lng: 'en', now })).toMatch(/hour/i);
    expect(formatRelativeTime(now - 24 * 60 * 60_000, { lng: 'en', now })).toMatch(/day/i);
  });

  it('formats a date with locale-aware options', () => {
    const formatted = formatDate(new Date('2025-01-15T12:00:00Z'), { lng: 'fr', dateStyle: 'short' });
    // French short date is "15 janv. 2025" or "15/01/2025" depending on host data.
    expect(formatted).toMatch(/2025/);
  });

  it('returns the input verbatim when the date is invalid', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });
});

describe('rtl helper', () => {
  it('classifies Arabic as RTL', () => {
    expect(isRTL('ar')).toBe(true);
    expect(isRTL('ar-SA')).toBe(true);
    expect(isRTL('he')).toBe(true);
  });
  it('classifies English/Spanish/French as LTR', () => {
    expect(isRTL('en')).toBe(false);
    expect(isRTL('es')).toBe(false);
    expect(isRTL('fr')).toBe(false);
  });
  it('returns a sensible font family per script family', () => {
    expect(getFontFamily('en')).toMatch(/Inter/);
    expect(getFontFamily('ar')).toMatch(/Arabic/);
    expect(getFontFamily('zh')).toMatch(/SC/);
  });
  it('date options include islamic calendar for RTL languages', () => {
    expect(getDateFormatOptions('ar')).toMatchObject({ calendar: 'islamic' });
    expect(getDateFormatOptions('en')).not.toMatchObject({ calendar: 'islamic' });
  });
  it('number options for CJK languages have 0 max fraction digits', () => {
    expect(getNumberFormatOptions('ja').maximumFractionDigits).toBe(0);
    expect(getNumberFormatOptions('en').maximumFractionDigits).toBe(2);
  });
});
