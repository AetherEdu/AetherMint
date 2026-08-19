'use client';

import React from 'react';
import type { PresenceMember } from '@/types/presence';

interface TypingIndicatorProps {
  users: PresenceMember[];
}

function formatNames(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} is typing`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`;
  return `${names.length} people are typing`;
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const label = formatNames(users.map((user) => user.displayName));

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400" role="status" aria-live="polite">
      <span className="flex gap-1">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default TypingIndicator;
