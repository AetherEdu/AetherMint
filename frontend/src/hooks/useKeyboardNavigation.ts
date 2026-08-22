import { useEffect } from 'react';

type KeyHandler = (e: KeyboardEvent) => void;

interface KeyboardNavOptions {
  onEnter?: KeyHandler;
  onEscape?: KeyHandler;
  onArrowUp?: KeyHandler;
  onArrowDown?: KeyHandler;
  onArrowLeft?: KeyHandler;
  onArrowRight?: KeyHandler;
  onSpace?: KeyHandler;
  preventDefaultKeys?: string[];
  allowInInputs?: boolean;
}

export const useKeyboardNavigation = (options: KeyboardNavOptions, isActive: boolean = true) => {
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isTypingField && !options.allowInInputs) {
        return;
      }

      if (options.preventDefaultKeys?.includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'Enter':
          options.onEnter?.(e);
          break;
        case 'Escape':
          options.onEscape?.(e);
          break;
        case 'ArrowUp':
          options.onArrowUp?.(e);
          break;
        case 'ArrowDown':
          options.onArrowDown?.(e);
          break;
        case 'ArrowLeft':
          options.onArrowLeft?.(e);
          break;
        case 'ArrowRight':
          options.onArrowRight?.(e);
          break;
        case ' ':
        case 'Spacebar':
        case 'Space':
          options.onSpace?.(e);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [options, isActive]);
};
