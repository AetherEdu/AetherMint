'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/router';
import { ChevronDown, Globe, Check } from 'lucide-react';
import { isRTL, getFontFamily } from '../lib/rtl';
import { SUPPORTED_LOCALES, normalizeLocale, DEFAULT_LOCALE } from '../lib/i18n';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  rtl?: boolean;
}

const languages: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', rtl: true },
];

type LanguageSwitcherProps = {
  variant?: 'dropdown' | 'grid' | 'compact';
  showFlag?: boolean;
  showNativeName?: boolean;
  className?: string;
};

export function LanguageSwitcher({
  variant = 'dropdown',
  showFlag = true,
  showNativeName = true,
  className = '',
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation(['common', 'navigation']);
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<Language | null>(null);

  useEffect(() => {
    const code = normalizeLocale(i18n.language || DEFAULT_LOCALE);
    const current = languages.find((lang) => lang.code === code) || languages[0];
    setSelectedLanguage(current);
    // Defer render until after first paint to avoid SSR hydration mismatch
    // (server may default to `en` while client picks up localStorage).
  }, [i18n.language]);

  const handleLanguageChange = async (language: Language) => {
    setIsOpen(false);
    setSearchTerm('');

    // 1. Update the i18next instance (triggers languageChanged event -> RTL swap)
    await i18n.changeLanguage(language.code);

    // 2. Persist in localStorage so the next visit picks up the choice.
    try {
      window.localStorage.setItem('i18nextLng', language.code);
    } catch {
      /* localStorage may be unavailable (private mode, SSR-test envs) */
    }

    // 3. Persist in a cookie so SSR has it on the next request.
    const oneYearSeconds = 60 * 60 * 24 * 365;
    document.cookie = `i18nextLng=${language.code};path=/;max-age=${oneYearSeconds};SameSite=Lax`;

    // 4. Reflect the choice in the URL (?lang=es) so shared links preserve it.
    if (router?.push) {
      const nextQuery = { ...router.query, lang: language.code };
      // Replace, don't push, so the back button doesn't fill up with switches.
      router.replace(
        { pathname: router.pathname, query: nextQuery },
        router.asPath,
        { shallow: true, scroll: false }
      );
    }

    // 5. Mirror document attributes immediately for instant visual feedback.
    document.documentElement.lang = language.code;
    document.documentElement.dir = isRTL(language.code) ? 'rtl' : 'ltr';
    document.documentElement.style.fontFamily = getFontFamily(language.code);
    document.body.classList.toggle('rtl', isRTL(language.code));
    document.body.classList.toggle('ltr', !isRTL(language.code));
    document.body.style.fontFamily = getFontFamily(language.code);
  };

  const filteredLanguages = useMemo(
    () =>
      languages.filter((lang) =>
        lang.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [searchTerm]
  );

  // Sanity check: every supported locale must have metadata so the UI
  // can render a label + flag. Run once on mount, not on every render.
  useEffect(() => {
    SUPPORTED_LOCALES.forEach((code) => {
      if (!languages.find((lang) => lang.code === code)) {
        // eslint-disable-next-line no-console
        console.warn(`[LanguageSwitcher] Locale ${code} has no metadata entry.`);
      }
    });
  }, []);

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          aria-label={t('language.switcherAria', 'Select language')}
        >
          <Globe className="h-4 w-4" />
          {selectedLanguage?.code.toUpperCase()}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
            role="menu"
          >
            <div className="max-h-64 overflow-y-auto">
              {filteredLanguages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  role="menuitemradio"
                  aria-checked={selectedLanguage?.code === language.code}
                >
                  {showFlag && <span>{language.flag}</span>}
                  <span className="font-medium">{language.code.toUpperCase()}</span>
                  {selectedLanguage?.code === language.code && (
                    <Check className="h-4 w-4 text-blue-600 dark:text-blue-400 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'grid') {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {t('language.selectTitle', 'Select Your Language')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t(
              'language.selectSubtitle',
              'Choose your preferred language for the best experience'
            )}
          </p>
        </div>

        <div
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3"
          role="radiogroup"
          aria-label={t('language.switcherAria', 'Select language')}
        >
          {filteredLanguages.map((language) => (
            <button
              key={language.code}
              onClick={() => handleLanguageChange(language)}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200 text-center
                ${
                  selectedLanguage?.code === language.code
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }
              `}
              role="radio"
              aria-checked={selectedLanguage?.code === language.code}
            >
              {showFlag && <div className="text-2xl mb-1">{language.flag}</div>}
              <div className="text-sm font-medium text-gray-900 dark:text-white">
                {showNativeName ? language.nativeName : language.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {language.code.toUpperCase()}
              </div>
              {selectedLanguage?.code === language.code && (
                <div className="absolute top-1 right-1">
                  <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('language.switcherAria', 'Select language')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Globe className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        {showFlag && selectedLanguage && (
          <span className="text-lg">{selectedLanguage.flag}</span>
        )}
        <span className="font-medium text-gray-900 dark:text-white">
          {showNativeName && selectedLanguage
            ? selectedLanguage.nativeName
            : selectedLanguage?.name}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50"
          role="menu"
        >
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <input
                type="text"
                placeholder={t(
                  'language.searchPlaceholder',
                  'Search languages...'
                )}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                aria-label={t(
                  'language.searchPlaceholder',
                  'Search languages...'
                )}
              />
              <Globe className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredLanguages.map((language) => (
              <button
                key={language.code}
                onClick={() => handleLanguageChange(language)}
                className={`
                  w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
                  ${
                    selectedLanguage?.code === language.code
                      ? 'bg-blue-50 dark:bg-blue-900/20'
                      : ''
                  }
                `}
                role="menuitemradio"
                aria-checked={selectedLanguage?.code === language.code}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {showFlag && <span className="text-lg">{language.flag}</span>}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {language.name}
                      </div>
                      {showNativeName && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {language.nativeName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {language.code.toUpperCase()}
                    </span>
                    {selectedLanguage?.code === language.code && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
