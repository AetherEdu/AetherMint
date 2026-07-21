'use client';

/**
 * useScrollReveal
 * ─────────────────────────────────────────────────────────────────────────────
 * A lightweight IntersectionObserver hook that triggers once when the observed
 * element enters the viewport.  Returns a `[ref, isVisible]` tuple.
 *
 * Options
 *   threshold  — fraction of the element that must be visible (default 0.15)
 *   rootMargin — expand/shrink the detection area (default "0px 0px -40px 0px")
 *   once       — stop observing after first reveal (default true)
 *
 * When `prefers-reduced-motion: reduce` is active the hook immediately
 * returns `isVisible = true` so content is never hidden.
 */

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  /** If true (default) the element is revealed once and never re-hidden */
  once?: boolean;
}

export function useScrollReveal<T extends Element = HTMLDivElement>(
  options: UseScrollRevealOptions = {}
): [React.RefObject<T>, boolean] {
  const { threshold = 0.15, rootMargin = '0px 0px -40px 0px', once = true } = options;
  const reducedMotion = useReducedMotion();
  const ref = useRef<T>(null);
  // If reduced-motion is active, skip the IntersectionObserver entirely and
  // treat every element as already visible.
  const [isVisible, setIsVisible] = useState(reducedMotion);

  useEffect(() => {
    // Keep in sync when the media query changes at runtime
    if (reducedMotion) {
      setIsVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsVisible(false);
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, threshold, rootMargin, once]);

  return [ref, isVisible];
}
