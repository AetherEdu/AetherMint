'use client';

/**
 * LoadingSpinner (branded)
 * ─────────────────────────────────────────────────────────────────────────────
 * A framer-motion powered branded spinner that uses the AetherMint primary
 * blue/indigo palette.  Falls back to a plain CSS animation when
 * `prefers-reduced-motion: reduce` is active.
 *
 * Variants
 *   sm  — 20 px — inline / button context
 *   md  — 32 px — card / section context  (default)
 *   lg  — 48 px — full-page loading overlay
 *   xl  — 64 px — splash / route-level loading
 *
 * Accessibility
 *   Renders a <div role="status"> with a visually-hidden <span> so
 *   screen readers announce the loading state.
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const SIZE_MAP = {
  sm: { outer: 20, stroke: 2.5 },
  md: { outer: 32, stroke: 3 },
  lg: { outer: 48, stroke: 4 },
  xl: { outer: 64, stroke: 5 },
} as const;

export type SpinnerSize = keyof typeof SIZE_MAP;

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  className?: string;
  /** Override the accessible label. Defaults to "Loading…" */
  label?: string;
  /** Show a text label below the spinner */
  showLabel?: boolean;
}

export function LoadingSpinner({
  size = 'md',
  className,
  label = 'Loading…',
  showLabel = false,
}: LoadingSpinnerProps) {
  const reducedMotion = useReducedMotion();
  const { outer, stroke } = SIZE_MAP[size];
  const r = (outer - stroke) / 2;
  const cx = outer / 2;
  const circumference = 2 * Math.PI * r;
  // The arc covers ≈ 75% of the circle, leaving a visible gap
  const dashArray = `${circumference * 0.75} ${circumference * 0.25}`;

  return (
    <div
      role="status"
      aria-label={label}
      className={cn('flex flex-col items-center justify-center gap-2', className)}
    >
      {/* Visually hidden text for screen readers */}
      <span className="sr-only">{label}</span>

      {reducedMotion ? (
        // Reduced-motion: use a simple CSS opacity pulse instead of rotation
        <div
          className="rounded-full border-t-transparent"
          style={{
            width: outer,
            height: outer,
            borderWidth: stroke,
            borderStyle: 'solid',
            borderColor: '#3b82f6',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
          }}
          aria-hidden="true"
        />
      ) : (
        <motion.svg
          width={outer}
          height={outer}
          viewBox={`0 0 ${outer} ${outer}`}
          aria-hidden="true"
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: 'linear',
          }}
        >
          {/* Track (background ring) */}
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-blue-100 dark:text-blue-900/40"
            opacity={0.3}
          />
          {/* Branded spinner arc — blue → indigo gradient achieved via stroke */}
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="url(#aethermint-spinner-gradient)"
            strokeWidth={stroke}
            strokeDasharray={dashArray}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient
              id="aethermint-spinner-gradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#3b82f6" />   {/* blue-500  */}
              <stop offset="100%" stopColor="#6366f1" /> {/* indigo-500 */}
            </linearGradient>
          </defs>
        </motion.svg>
      )}

      {showLabel && (
        <span
          className="text-sm text-gray-500 dark:text-gray-400 select-none"
          aria-hidden="true"
        >
          {label}
        </span>
      )}
    </div>
  );
}
