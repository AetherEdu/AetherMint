'use client';

import React from 'react';
import type { PresenceMember } from '@/types/presence';
import { PresenceIndicator } from './PresenceIndicator';

const AVATAR_SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

const RING_SIZES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'ring-1',
  md: 'ring-2',
  lg: 'ring-2',
};

interface PresenceAvatarsProps {
  members: PresenceMember[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
}

export function PresenceAvatars({ members, max = 5, size = 'md' }: PresenceAvatarsProps) {
  const visible = members.slice(0, max);
  const overflow = members.length - visible.length;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((member) => (
        <div
          key={member.userId}
          className="relative"
          title={`${member.displayName} — ${member.status}`}
        >
          <div
            className={`${AVATAR_SIZES[size]} ${RING_SIZES[size]} ring-gray-800 rounded-full bg-purple-500 flex items-center justify-center font-bold uppercase text-white`}
          >
            {member.displayName?.charAt(0) ?? '?'}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5">
            <PresenceIndicator status={member.status} size="sm" />
          </span>
        </div>
      ))}

      {overflow > 0 && (
        <div
          className={`${AVATAR_SIZES[size]} ${RING_SIZES[size]} ring-gray-800 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-300`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

export default PresenceAvatars;
