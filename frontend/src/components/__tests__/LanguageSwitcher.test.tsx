/**
 * Smoke tests for LanguageSwitcher rendering and language-change wiring.
 */

import {
  render,
  screen,
  waitFor,
  fireEvent,
} from '@testing-library/react';

// Mock factory isolated per render so we never leak state across tests.
function mockUseTranslation(initialLanguage = 'en') {
  let language = initialLanguage;

  const useTranslationMock = jest.fn(() => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: {
      get language() {
        return language;
      },
      changeLanguage: jest.fn(async (lng: string) => {
        language = lng;
      }),
    },
  }));

  jest.doMock('react-i18next', () => ({
    __esModule: true,
    useTranslation: useTranslationMock,
  }));
  return useTranslationMock;
}

describe('<LanguageSwitcher />', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('next/router', () => ({
      useRouter: () => ({
        pathname: '/',
        asPath: '/',
        query: {},
        push: jest.fn(),
        replace: jest.fn(),
        events: { on: jest.fn(), off: jest.fn() },
      }),
    }));
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  it('renders without crashing in dropdown variant', async () => {
    mockUseTranslation();
    const { LanguageSwitcher } = require('../LanguageSwitcher');
    render(<LanguageSwitcher />);
    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });
  });

  it('renders the grid variant with all languages', async () => {
    mockUseTranslation();
    const { LanguageSwitcher } = require('../LanguageSwitcher');
    render(<LanguageSwitcher variant="grid" />);
    await waitFor(() => {
      expect(
        screen.getByText('Select Your Language')
      ).toBeInTheDocument();
    });
  });

  it('calls i18n.changeLanguage when a language is chosen', async () => {
    const { LanguageSwitcher } = require('../LanguageSwitcher');
    mockUseTranslation();
    render(<LanguageSwitcher variant="dropdown" />);

    // Open the dropdown.
    const trigger = await screen.findByLabelText('Select language');
    fireEvent.click(trigger);

    // Pick Spanish.
    const spanishOption = await screen.findByText(/Español/i);
    fireEvent.click(spanishOption);

    await waitFor(() => {
      expect(
        window.localStorage.getItem('i18nextLng')
      ).toBe('es');
    });
  });
});
