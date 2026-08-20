'use client';

import React from 'react';
import { Circle, Clock, EyeOff, Minus } from 'lucide-react';
import type { PresenceStatus } from '@/types/presence';

const STATUS_OPTIONS: Array<{
  value: PresenceStatus;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'available', label: 'Available', Icon: Circle },
  { value: 'busy', label: 'Busy', Icon: Minus },
  { value: 'away', label: 'Away', Icon: Clock },
  { value: 'invisible', label: 'Invisible', Icon: EyeOff },
];

interface StatusPickerProps {
  value: PresenceStatus;
  onChange: (status: PresenceStatus) => void;
  disabled?: boolean;
}

export function StatusPicker({ value, onChange, disabled = false }: StatusPickerProps) {
  return (
    <div className="flex flex-col gap-1" role="radiogroup" aria-label="Availability status">
      {STATUS_OPTIONS.map(({ value: optionValue, label, Icon }) => {
        const active = value === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(optionValue)}
            className={`flex items-center gap-2 rounded px-3 py-2 text-sm transition-colors ${
              active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <Icon className={`h-4 w-4 ${active ? 'text-green-400' : ''}`} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default StatusPicker;
