import * as React from 'react';

export interface CalendarProps {
  mode?: 'single' | 'range' | 'multiple';
  selected?: Date | Date[] | { from: Date; to?: Date } | null;
  onSelect?: (date: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  initialFocus?: boolean;
  className?: string;
}

/**
 * Stub of `react-day-picker` Calendar for build-time type-checking.
 * The real component is referenced via `react-day-picker`, but for
 * type resolution we provide a permissive placeholder that supports
 * the props the analytics dashboard actually uses at the type level.
 */
export const Calendar = React.forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  { className }: CalendarProps,
  ref,
) {
  return <div ref={ref} data-stub="calendar" className={className} />;
});

export default Calendar;
