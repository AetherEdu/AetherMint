'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  /**
   * Accessible label describing what content is loading
   */
  'aria-label'?: string;
}

interface TextSkeletonProps extends SkeletonProps {
  variant: 'text';
  lines?: number;
  lastLineWidth?: string;
}

interface ImageSkeletonProps extends SkeletonProps {
  variant: 'image';
  aspectRatio?: string;
}

interface CardSkeletonProps extends SkeletonProps {
  variant: 'card';
  imageAspectRatio?: string;
  lines?: number;
  hasFooter?: boolean;
}

interface ListItemSkeletonProps extends SkeletonProps {
  variant: 'list-item';
  lines?: number;
  hasAvatar?: boolean;
}

type SkeletonVariantProps =
  | TextSkeletonProps
  | ImageSkeletonProps
  | CardSkeletonProps
  | ListItemSkeletonProps;

type SkeletonComponentProps = SkeletonVariantProps & {
  'aria-label'?: string;
};

function SkeletonBase({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-gray-200 dark:bg-gray-700',
        className
      )}
      style={style}
      aria-hidden="true"
    />
  );
}

function TextLines({ lines = 3, lastLineWidth = '60%' }: { lines?: number; lastLineWidth?: string }) {
  return (
    <div className="space-y-2.5" aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBase
          key={i}
          className="h-3.5 w-full"
          style={i === lines - 1 ? { width: lastLineWidth } : undefined}
        />
      ))}
    </div>
  );
}

/**
 * Skeleton component for loading states with multiple variants.
 *
 * @example
 * <Skeleton variant="text" lines={3} />
 * <Skeleton variant="image" aspectRatio="16/9" />
 * <Skeleton variant="card" lines={4} />
 * <Skeleton variant="list-item" hasAvatar />
 */
export default function Skeleton(props: SkeletonComponentProps) {
  const { variant, 'aria-label': ariaLabel, ...rest } = props;
  const baseLabel = ariaLabel || `Loading ${variant} content...`;

  switch (variant) {
    case 'text': {
      const { lines = 3, lastLineWidth = '60%' } = rest as TextSkeletonProps;
      return (
        <div role="status" aria-label={baseLabel} className="w-full">
          <TextLines lines={lines} lastLineWidth={lastLineWidth} />
          <span className="sr-only">{baseLabel}</span>
        </div>
      );
    }

    case 'image': {
      const { aspectRatio = '16/9' } = rest as ImageSkeletonProps;
      return (
        <div role="status" aria-label={baseLabel} className="w-full">
          <SkeletonBase
            className="h-0 w-full rounded-lg"
            style={{ paddingBottom: `calc(100% / (${aspectRatio}))` }}
          />
          <span className="sr-only">{baseLabel}</span>
        </div>
      );
    }

    case 'card': {
      const {
        imageAspectRatio = '16/9',
        lines = 3,
        hasFooter = false,
      } = rest as CardSkeletonProps;
      return (
        <div
          role="status"
          aria-label={baseLabel}
          className="w-full rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <SkeletonBase
            className="h-0 w-full rounded-lg"
            style={{ paddingBottom: `calc(100% / (${imageAspectRatio}))` }}
          />
          <div className="mt-4 space-y-3">
            <SkeletonBase className="h-4 w-3/4" />
            <TextLines lines={lines} lastLineWidth="40%" />
          </div>
          {hasFooter && (
            <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-700">
              <SkeletonBase className="h-8 w-8 rounded-full" />
              <SkeletonBase className="h-3.5 w-1/4" />
            </div>
          )}
          <span className="sr-only">{baseLabel}</span>
        </div>
      );
    }

    case 'list-item': {
      const { lines = 2, hasAvatar = true } = rest as ListItemSkeletonProps;
      return (
        <div
          role="status"
          aria-label={baseLabel}
          className="flex w-full items-start gap-3 rounded-lg p-3"
        >
          {hasAvatar && (
            <SkeletonBase className="h-10 w-10 shrink-0 rounded-full" />
          )}
          <div className="min-w-0 flex-1">
            <SkeletonBase className="mb-2 h-4 w-1/3" />
            <TextLines lines={lines} lastLineWidth="40%" />
          </div>
          <span className="sr-only">{baseLabel}</span>
        </div>
      );
    }

    default:
      return null;
  }
}

/**
 * Simple inline skeleton block — useful inside existing layouts.
 */
export function SkeletonBlock({ className, 'aria-label': ariaLabel }: SkeletonProps) {
  return (
    <SkeletonBase
      className={className}
      aria-label={ariaLabel}
    />
  );
}
