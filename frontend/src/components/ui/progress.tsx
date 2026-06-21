import * as React from 'react';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(function Progress(
  { className, value = 0, max = 100, ...props },
  ref,
) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemax={max}
      data-value={pct}
      className={className}
      {...props}
    />
  );
});
