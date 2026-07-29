'use client';

/**
 * animatedToast
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin wrapper around `react-hot-toast` that provides:
 *   1. Branded AetherMint success / error / info / warning styles
 *   2. Consistent icon, duration, and framer-motion slide-in animation
 *   3. Automatic `prefers-reduced-motion` compliance (disables custom
 *      animation when the media query is active, falling back to the
 *      instant built-in toast behaviour)
 *
 * Usage
 * ─────
 *   import { animatedToast } from '@/components/ui/animatedToast';
 *
 *   animatedToast.success('Credential issued successfully!');
 *   animatedToast.error('Transaction failed. Please try again.');
 *   animatedToast.info('Syncing with the Stellar network…');
 *   animatedToast.warning('Wallet not connected.');
 *
 * The Toaster component is already mounted in PWAClientShell / _app.tsx;
 * no additional setup is needed.
 */

import toast, { type ToastOptions } from 'react-hot-toast';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import React from 'react';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns true if the user's OS has reduced motion enabled. */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Base style shared across all variants.
 * Uses Tailwind utility classes applied via the className prop on the custom
 * JSX element.
 */
const baseStyle: React.CSSProperties = {
  borderRadius: '10px',
  padding: '12px 16px',
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  fontSize: '14px',
  fontWeight: 500,
  boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
  maxWidth: '380px',
};

// Animation keyframes injected once (only if motion is allowed)
const KEYFRAME_ID = 'aethermint-toast-anim';
function ensureKeyframes() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAME_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAME_ID;
  style.textContent = `
    @keyframes am-toast-in {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes am-toast-out {
      from { opacity: 1; transform: translateY(0)   scale(1);    }
      to   { opacity: 0; transform: translateY(4px) scale(0.96); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Variant definitions ─────────────────────────────────────────────────────

type Variant = 'success' | 'error' | 'info' | 'warning';

const VARIANTS: Record<
  Variant,
  { bg: string; color: string; border: string; Icon: typeof CheckCircle }
> = {
  success: {
    bg: '#f0fdf4',
    color: '#15803d',
    border: '1.5px solid #86efac',
    Icon: CheckCircle,
  },
  error: {
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '1.5px solid #fca5a5',
    Icon: XCircle,
  },
  info: {
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '1.5px solid #93c5fd',
    Icon: Info,
  },
  warning: {
    bg: '#fffbeb',
    color: '#b45309',
    border: '1.5px solid #fcd34d',
    Icon: AlertTriangle,
  },
};

// ─── Core renderer ───────────────────────────────────────────────────────────

function renderToast(variant: Variant, message: string, options?: ToastOptions) {
  const reduced = prefersReducedMotion();
  if (!reduced) ensureKeyframes();

  const { bg, color, border, Icon } = VARIANTS[variant];

  const animationStyle: React.CSSProperties = reduced
    ? {}
    : {
        animation: 'am-toast-in 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      };

  return toast.custom(
    (t) => (
      <div
        style={{
          ...baseStyle,
          background: bg,
          color,
          border,
          ...animationStyle,
          ...(t.visible
            ? {}
            : { animation: reduced ? undefined : 'am-toast-out 0.2s ease forwards' }),
        }}
        role="status"
        aria-live="polite"
      >
        <Icon size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
        <span>{message}</span>
      </div>
    ),
    {
      duration: variant === 'error' ? 5000 : 3500,
      ...options,
    }
  );
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const animatedToast = {
  success: (message: string, options?: ToastOptions) =>
    renderToast('success', message, options),
  error: (message: string, options?: ToastOptions) =>
    renderToast('error', message, options),
  info: (message: string, options?: ToastOptions) =>
    renderToast('info', message, options),
  warning: (message: string, options?: ToastOptions) =>
    renderToast('warning', message, options),
};
