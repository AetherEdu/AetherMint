'use client';

import React from 'react';
import type { PresenceStatus } from '@/types/presence';

const STATUS_STYLES: Record<PresenceStatus, { dot: string; label: string }> = {
  available: { dot: 'bg-green-500', label: 'Available' },
  busy: { dot: 'bg-red-500', label: 'Busy' },
  away: { dot: 'bg-amber-500', label: 'Away' },
  invisible: { dot: 'bg-gray-500', label: 'Invisible' },
};

const SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

interface PresenceIndicatorProps {
  status: PresenceStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export function PresenceIndicator({
  status,
  size = 'md',
  showLabel = false,
  className,
}: PresenceIndicatorProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.available;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} title={style.label}>
      <span className={`${SIZES[size]} rounded-full ${style.dot}`} />
      {showLabel && <span className="text-xs text-gray-400">{style.label}</span>}
    </span>
  );
}

export default PresenceIndicator;
