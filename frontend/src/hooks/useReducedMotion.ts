'use client';

import { useEffect, useState } from 'react';

/**
 * useReducedMotion
 *
 * Returns `true` when the user has opted into reduced motion via the
 * `prefers-reduced-motion: reduce` media query (OS-level accessibility setting).
 *
 * All animation components in AetherMint check this hook and either skip
 * their transitions entirely or fall back to instant / opacity-only changes,
 * in line with WCAG 2.1 Success Criterion 2.3.3.
 *
 * SSR-safe: defaults to `false` on the server so hydration never mismatches
 * the client's first-paint. The value is updated synchronously on mount.
 */
export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReduced(event.matches);
    };

    // `addEventListener` is preferred over the deprecated `addListener`
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return prefersReduced;
}
