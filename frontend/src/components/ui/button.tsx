/**
 * Button
 * ─────────────────────────────────────────────────────────────────────────────
 * Extends the base shadcn/ui Button with framer-motion micro-interactions:
 *   • Subtle scale-up on hover (1.02×)
 *   • Slight scale-down on press / active (0.97×)
 *   • Focus ring via CSS (existing globals.css handles :focus-visible)
 *
 * The `asChild` pattern (Radix Slot) is preserved.
 *
 * Accessibility / reduced-motion
 *   When `prefers-reduced-motion: reduce` is active the component degrades
 *   gracefully to a plain <button> (no scale transitions), retaining full
 *   keyboard and focus behaviour.
 *
 * Usage is identical to the existing button — no API changes.
 */
'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion as useFramerReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

// ─── Variants (unchanged from the original) ──────────────────────────────────

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:     'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:     'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary:   'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost:       'hover:bg-accent hover:text-accent-foreground',
        link:        'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm:      'h-9 rounded-md px-3',
        lg:      'h-11 rounded-md px-8',
        icon:    'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size:    'default',
    },
  }
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // framer-motion ships its own `useReducedMotion` hook that reads the same
    // media query.  We use it here so the Button stays in sync with the rest
    // of the animation system.
    const prefersReducedMotion = useFramerReducedMotion();

    const combinedClassName = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      // Slot forwarding — cannot be wrapped in motion.button.
      return (
        <Slot
          className={combinedClassName}
          ref={ref}
          {...props}
        />
      );
    }

    if (prefersReducedMotion) {
      // Reduced-motion: plain button, no scale animation.
      return (
        <button
          type="button"
          className={combinedClassName}
          ref={ref}
          {...props}
        />
      );
    }

    // Full animation variant
    return (
      <motion.button
        type="button"
        className={combinedClassName}
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        {...(props as React.ComponentPropsWithoutRef<typeof motion.button>)}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
