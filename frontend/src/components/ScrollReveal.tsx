'use client';

/**
 * ScrollReveal
 * ─────────────────────────────────────────────────────────────────────────────
 * A drop-in wrapper component that animates its children into view when they
 * enter the viewport, using IntersectionObserver + framer-motion.
 *
 * Supported `direction` values control the initial translate offset:
 *   up    — slides up from below   (default)
 *   down  — slides down from above
 *   left  — slides in from the right
 *   right — slides in from the left
 *   none  — fade-only (no translate)
 *
 * `delay` adds a staggered wait before the animation starts.
 * `duration` overrides the transition length.
 *
 * When `prefers-reduced-motion: reduce` is active, the component renders its
 * children immediately with no animation at all.
 *
 * Example:
 *   <ScrollReveal direction="up" delay={0.1}>
 *     <CourseCard ... />
 *   </ScrollReveal>
 */

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/useScrollReveal';

type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none';

interface ScrollRevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  delay?: number;
  duration?: number;
  threshold?: number;
  className?: string;
}

const INITIAL_OFFSET = 24; // px

const directionOffsets: Record<RevealDirection, { x: number; y: number }> = {
  up:    { x: 0,              y: INITIAL_OFFSET  },
  down:  { x: 0,              y: -INITIAL_OFFSET },
  left:  { x: INITIAL_OFFSET, y: 0               },
  right: { x: -INITIAL_OFFSET, y: 0              },
  none:  { x: 0,              y: 0               },
};

export function ScrollReveal({
  children,
  direction = 'up',
  delay = 0,
  duration = 0.45,
  threshold = 0.15,
  className,
}: ScrollRevealProps) {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>({ threshold });
  const { x, y } = directionOffsets[direction];

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial={{ opacity: 0, x, y }}
      animate={isVisible ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, x, y }}
      transition={{
        duration,
        delay,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
