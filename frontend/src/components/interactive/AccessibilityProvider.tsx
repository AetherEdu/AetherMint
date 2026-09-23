import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface AccessibilityFeaturesProps {
  children: React.ReactNode;
  onSettingsChange?: (settings: AccessibilitySettings) => void;
  initialSettings?: Partial<AccessibilitySettings>;
}

export interface AccessibilitySettings {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrast: boolean;
  reducedMotion: boolean;
  screenReaderMode: boolean;
  keyboardNavigation: boolean;
  focusVisible: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  textToSpeech: boolean;
  autoRead: boolean;
  dyslexiaFont: boolean;
  lineSpacing: 'normal' | 'relaxed' | 'loose';
  wordSpacing: 'normal' | 'wide' | 'wider';
  letterSpacing: 'normal' | 'wide' | 'wider';
  pauseAnimations: boolean;
  simplifyInterface: boolean;
  showAltText: boolean;
  extendedTimeout: boolean;
  visualIndicators: boolean;
  audioDescriptions: boolean;
}

const AccessibilityProvider: React.FC<AccessibilityFeaturesProps> = ({
  children,
  onSettingsChange,
  initialSettings = {}
}) => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    fontSize: 'medium',
    highContrast: false,
    reducedMotion: false,
    screenReaderMode: false,
    keyboardNavigation: true,
    focusVisible: true,
    colorBlindMode: 'none',
    textToSpeech: false,
    autoRead: false,
    dyslexiaFont: false,
    lineSpacing: 'normal',
    wordSpacing: 'normal',
    letterSpacing: 'normal',
    pauseAnimations: false,
    simplifyInterface: false,
    showAltText: false,
    extendedTimeout: false,
    visualIndicators: true,
    audioDescriptions: false,
    ...initialSettings
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const modalRef = useFocusTrap(showSettings);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Font size
    root.style.fontSize = {
      'small': '14px',
      'medium': '16px',
      'large': '18px',
      'extra-large': '20px'
    }[settings.fontSize];

    // High contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Reduced motion
    if (settings.reducedMotion) {
      root.style.setProperty('--transition-duration', '0.01ms');
      root.classList.add('reduce-motion');
    } else {
      root.style.removeProperty('--transition-duration');
      root.classList.remove('reduce-motion');
    }

    // Dyslexia font
    if (settings.dyslexiaFont) {
      root.style.fontFamily = 'OpenDyslexic, Arial, sans-serif';
    } else {
      root.style.fontFamily = '';
    }

    // Line spacing
    root.style.lineHeight = {
      'normal': '1.5',
      'relaxed': '1.75',
      'loose': '2'
    }[settings.lineSpacing];

    // Word spacing
    root.style.wordSpacing = {
      'normal': 'normal',
      'wide': '0.1em',
      'wider': '0.2em'
    }[settings.wordSpacing];

    // Letter spacing
    root.style.letterSpacing = {
      'normal': 'normal',
      'wide': '0.05em',
      'wider': '0.1em'
    }[settings.letterSpacing];

    // Color blind mode
    root.classList.remove('colorblind-protanopia', 'colorblind-deuteranopia', 'colorblind-tritanopia');
    if (settings.colorBlindMode !== 'none') {
      root.classList.add(`colorblind-${settings.colorBlindMode}`);
    }

    // Simplified interface
    if (settings.simplifyInterface) {
      root.classList.add('simplified-ui');
    } else {
      root.classList.remove('simplified-ui');
    }

    // Visual indicators
    if (settings.visualIndicators) {
      root.classList.add('visual-indicators');
    } else {
      root.classList.remove('visual-indicators');
    }

    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // Keyboard navigation
  useEffect(() => {
    if (!settings.keyboardNavigation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Tab navigation enhancement
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
      }

      // Escape to close modals/dialogs
      if (e.key === 'Escape') {
        const modals = document.querySelectorAll('[role="dialog"], .modal');
        modals.forEach(modal => {
          if (modal instanceof HTMLElement && modal.style.display !== 'none') {
            modal.style.display = 'none';
          }
        });
      }

      // Alt + A for accessibility panel
      if (e.altKey && e.key === 'a') {
        e.preventDefault();
        setShowSettings(prev => !prev);
      }

      // Alt + R for read aloud
      if (e.altKey && e.key === 'r') {
        e.preventDefault();
        toggleTextToSpeech();
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-navigation');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [settings.keyboardNavigation]);

  // Focus management
  useEffect(() => {
    if (!settings.focusVisible) return;

    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      setFocusedElement(target);
      
      // Announce focus to screen reader
      if (settings.screenReaderMode && target.textContent) {
        announceToScreenReader(`Focused on: ${target.textContent}`);
      }
    };

    const handleBlur = () => {
      setFocusedElement(null);
    };

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, [settings.focusVisible, settings.screenReaderMode]);

  // Text to speech
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window) || !settings.textToSpeech) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    window.speechSynthesis.speak(utterance);
    setIsReading(true);

    utterance.onend = () => {
      setIsReading(false);
    };
  }, [settings.textToSpeech]);

  const toggleTextToSpeech = useCallback(() => {
    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
    } else if (focusedElement?.textContent) {
      speak(focusedElement.textContent);
    }
  }, [isReading, focusedElement, speak]);

  const announceToScreenReader = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  const updateSetting = useCallback(<K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({
      fontSize: 'medium',
      highContrast: false,
      reducedMotion: false,
      screenReaderMode: false,
      keyboardNavigation: true,
      focusVisible: true,
      colorBlindMode: 'none',
      textToSpeech: false,
      autoRead: false,
      dyslexiaFont: false,
      lineSpacing: 'normal',
      wordSpacing: 'normal',
      letterSpacing: 'normal',
      pauseAnimations: false,
      simplifyInterface: false,
      showAltText: false,
      extendedTimeout: false,
      visualIndicators: true,
      audioDescriptions: false,
      ...initialSettings
    });
  }, [initialSettings]);

  return (
    <>
      {/* Accessibility Toolbar */}
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="bg-blue-500 text-white p-3 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
          aria-label="Accessibility settings (Alt+A)"
          title="Accessibility settings (Alt+A)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" 
             role="dialog" 
             aria-modal="true" 
             aria-labelledby="accessibility-settings-title">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" ref={modalRef}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 id="accessibility-settings-title" className="text-2xl font-bold text-gray-800">Accessibility Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="text-gray-500 hover:text-gray-700"
                  aria-label="Close accessibility settings"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Text Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Text Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
                      <select
                        value={settings.fontSize}
                        onChange={(e) => updateSetting('fontSize', e.target.value as any)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                        <option value="extra-large">Extra Large</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Line Spacing</label>
                      <select
                        value={settings.lineSpacing}
                        onChange={(e) => updateSetting('lineSpacing', e.target.value as any)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="normal">Normal</option>
                        <option value="relaxed">Relaxed</option>
                        <option value="loose">Loose</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="dyslexia-font"
                        checked={settings.dyslexiaFont}
                        onChange={(e) => updateSetting('dyslexiaFont', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="dyslexia-font" className="text-sm font-medium text-gray-700">
                        Dyslexia-friendly font
                      </label>
                    </div>
                  </div>
                </div>

                {/* Visual Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Visual Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="high-contrast"
                        checked={settings.highContrast}
                        onChange={(e) => updateSetting('highContrast', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="high-contrast" className="text-sm font-medium text-gray-700">
                        High contrast mode
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Color Blind Mode</label>
                      <select
                        value={settings.colorBlindMode}
                        onChange={(e) => updateSetting('colorBlindMode', e.target.value as any)}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      >
                        <option value="none">None</option>
                        <option value="protanopia">Protanopia (Red-blind)</option>
                        <option value="deuteranopia">Deuteranopia (Green-blind)</option>
                        <option value="tritanopia">Tritanopia (Blue-blind)</option>
                      </select>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="reduced-motion"
                        checked={settings.reducedMotion}
                        onChange={(e) => updateSetting('reducedMotion', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="reduced-motion" className="text-sm font-medium text-gray-700">
                        Reduce motion
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="visual-indicators"
                        checked={settings.visualIndicators}
                        onChange={(e) => updateSetting('visualIndicators', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="visual-indicators" className="text-sm font-medium text-gray-700">
                        Enhanced visual indicators
                      </label>
                    </div>
                  </div>
                </div>

                {/* Interaction Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Interaction Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="keyboard-navigation"
                        checked={settings.keyboardNavigation}
                        onChange={(e) => updateSetting('keyboardNavigation', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="keyboard-navigation" className="text-sm font-medium text-gray-700">
                        Enhanced keyboard navigation
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="focus-visible"
                        checked={settings.focusVisible}
                        onChange={(e) => updateSetting('focusVisible', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="focus-visible" className="text-sm font-medium text-gray-700">
                        Visible focus indicators
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="extended-timeout"
                        checked={settings.extendedTimeout}
                        onChange={(e) => updateSetting('extendedTimeout', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="extended-timeout" className="text-sm font-medium text-gray-700">
                        Extended timeouts
                      </label>
                    </div>
                  </div>
                </div>

                {/* Screen Reader & Audio */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Screen Reader & Audio</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="screen-reader-mode"
                        checked={settings.screenReaderMode}
                        onChange={(e) => updateSetting('screenReaderMode', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="screen-reader-mode" className="text-sm font-medium text-gray-700">
                        Screen reader mode
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="text-to-speech"
                        checked={settings.textToSpeech}
                        onChange={(e) => updateSetting('textToSpeech', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="text-to-speech" className="text-sm font-medium text-gray-700">
                        Text-to-speech
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="auto-read"
                        checked={settings.autoRead}
                        onChange={(e) => updateSetting('autoRead', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="auto-read" className="text-sm font-medium text-gray-700">
                        Auto-read content
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="audio-descriptions"
                        checked={settings.audioDescriptions}
                        onChange={(e) => updateSetting('audioDescriptions', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="audio-descriptions" className="text-sm font-medium text-gray-700">
                        Audio descriptions
                      </label>
                    </div>
                  </div>
                </div>

                {/* Interface Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Interface Settings</h3>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="simplify-interface"
                        checked={settings.simplifyInterface}
                        onChange={(e) => updateSetting('simplifyInterface', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="simplify-interface" className="text-sm font-medium text-gray-700">
                        Simplified interface
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="show-alt-text"
                        checked={settings.showAltText}
                        onChange={(e) => updateSetting('showAltText', e.target.checked)}
                        className="mr-2"
                      />
                      <label htmlFor="show-alt-text" className="text-sm font-medium text-gray-700">
                        Always show alt text
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={resetSettings}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Reset to defaults
                </button>
                <div className="space-x-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    Apply Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reading Indicator */}
      {isReading && (
        <div className="fixed bottom-4 left-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span>Reading aloud...</span>
          <button
            onClick={() => {
              window.speechSynthesis.cancel();
              setIsReading(false);
            }}
            className="ml-2 hover:bg-green-600 rounded p-1"
            aria-label="Stop reading"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Main content with enhanced accessibility */}
      <div
        role="main"
        aria-label="Main content"
        className={`
          ${settings.keyboardNavigation ? 'keyboard-nav-enabled' : ''}
          ${settings.focusVisible ? 'focus-visible-enabled' : ''}
          ${settings.visualIndicators ? 'visual-indicators-enabled' : ''}
        `}
      >
        {children}
      </div>

      {/* Screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {settings.screenReaderMode && (
          <div>
            Accessibility settings are currently active. Press Alt+A to adjust settings.
          </div>
        )}
      </div>
    </>
  );
};

// Hook for using accessibility context
export const useAccessibility = () => {
  // This would typically use React Context, but for simplicity we're returning defaults
  return {
    announce: (message: string) => {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    },
    speak: (text: string) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
      }
    }
  };
};

export default AccessibilityProvider;
