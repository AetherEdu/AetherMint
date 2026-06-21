import * as React from 'react';

export type SpinnerProps = React.HTMLAttributes<HTMLDivElement> & {
  size?: number;
};

export const Spinner = ({ className, size = 16, ...props }: SpinnerProps) => (
  <div
    role="status"
    aria-label="Loading"
    data-size={size}
    className={className}
    {...props}
  />
);
