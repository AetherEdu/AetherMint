'use client';

/**
 * PageTransition
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps page content with a smooth fade + upward-slide entrance animation
 * powered by framer-motion.
 *
 * Usage
 * ─────
 * App Router  — render inside a layout or directly in a page:
 *   <PageTransition>{children}</PageTransition>
 *
 * Pages Router — wrap <Component> in _app.tsx with a key so that
 *   AnimatePresence detects route changes:
 *   <PageTransition routeKey={router.pathname}>…</PageTransition>
 *
 * Accessibility
 * ─────────────
 * When `prefers-reduced-motion: reduce` is active the component renders its
 * children with no animation whatsoever (no fade, no translate).
 */

import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PageTransitionProps {
  children: ReactNode;
  /**
   * Provide this when using the Pages Router so AnimatePresence can detect
   * when the page actually changes. Typically `router.pathname` or
   * `router.asPath`.
   */
  routeKey?: string;
  className?: string;
}

/** Animation variants shared across both router modes */
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number], // Material Design easing
};

export function PageTransition({ children, routeKey, className }: PageTransitionProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    // Skip all motion — render children as-is.
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={routeKey}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
