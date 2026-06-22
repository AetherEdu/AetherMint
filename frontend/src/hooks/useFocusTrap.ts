import { useEffect, useRef } from 'react';

interface FocusTrapOptions {
  onEscape?: () => void;
  initialFocusSelector?: string;
}

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'details summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export const useFocusTrap = (isActive: boolean, options: FocusTrapOptions = {}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { initialFocusSelector, onEscape } = options;

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector);

    if (focusableElements.length === 0) {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    const firstElement = focusableElements[0] || container;
    const lastElement = focusableElements[focusableElements.length - 1] || container;
    const initialElement = initialFocusSelector
      ? container.querySelector<HTMLElement>(initialFocusSelector)
      : null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    (initialElement || firstElement)?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [initialFocusSelector, isActive, onEscape]);

  return containerRef;
};
