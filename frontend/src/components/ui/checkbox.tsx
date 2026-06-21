import * as React from 'react';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  onCheckedChange?: (next: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, onCheckedChange, checked, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      className={className}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
});
