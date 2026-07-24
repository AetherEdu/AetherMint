import { useEffect, useRef } from 'react';

interface FocusTrapOptions {
  onEscape?: () => void;
  initialFocusSelector?: string;
  lockScroll?: boolean;
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
  const { initialFocusSelector, onEscape, lockScroll = true } = options;

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusableElements = () =>
      Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true'
      );

    const focusElement = (element: HTMLElement) => {
      element.focus({ preventScroll: true });
    };

    const focusFallback = () => {
      if (!container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      focusElement(container);
    };

    const initialElement = initialFocusSelector
      ? container.querySelector<HTMLElement>(initialFocusSelector)
      : null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        e.preventDefault();
        focusFallback();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (!container.contains(document.activeElement)) {
          e.preventDefault();
          focusElement(lastElement);
          return;
        }

        if (document.activeElement === firstElement) {
          e.preventDefault();
          focusElement(lastElement);
        }
      } else {
        if (!container.contains(document.activeElement)) {
          e.preventDefault();
          focusElement(firstElement);
          return;
        }

        if (document.activeElement === lastElement) {
          e.preventDefault();
          focusElement(firstElement);
        }
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!container.contains(event.target as Node)) {
        const focusableElements = getFocusableElements();
        if (focusableElements.length > 0) {
          focusElement(focusableElements[0]);
        } else {
          focusFallback();
        }
      }
    };

    const previousOverflow = document.body.style.overflow;
    if (lockScroll) {
      document.body.style.overflow = 'hidden';
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    const focusableElements = getFocusableElements();
    const target = initialElement || focusableElements[0] || container;
    if (target) {
      focusElement(target as HTMLElement);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
      if (lockScroll) {
        document.body.style.overflow = previousOverflow;
      }
      previouslyFocused?.focus();
    };
  }, [initialFocusSelector, isActive, onEscape, lockScroll]);

  return containerRef;
};
