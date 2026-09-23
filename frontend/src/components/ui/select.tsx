'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectContextValue {
  value?: string;
  setValue: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  registerLabel: (value: string, label: string) => void;
  labels: Record<string, string>;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used within <Select>`);
  }
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const Select: React.FC<SelectProps> = ({
  value,
  defaultValue,
  onValueChange,
  children,
  className,
}) => {
  const [internal, setInternal] = React.useState<string | undefined>(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [labels, setLabels] = React.useState<Record<string, string>>({});
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const setValue = React.useCallback(
    (next: string) => {
      if (!isControlled) setInternal(next);
      onValueChange?.(next);
      setOpen(false);
    },
    [isControlled, onValueChange],
  );

  const registerLabel = React.useCallback((val: string, label: string) => {
    setLabels((prev) => (prev[val] === label ? prev : { ...prev, [val]: label }));
  }, []);

  const ctx = React.useMemo(
    () => ({ value: current, setValue, open, setOpen, registerLabel, labels }),
    [current, setValue, open, registerLabel, labels],
  );

  return (
    <SelectContext.Provider value={ctx}>
      <div className={cn('relative', className)}>{children}</div>
    </SelectContext.Provider>
  );
};
Select.displayName = 'Select';

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useSelectContext('SelectTrigger');
  return (
    <button
      ref={ref}
      type="button"
      role="combobox"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
});
SelectTrigger.displayName = 'SelectTrigger';

export interface SelectValueProps {
  placeholder?: string;
  className?: string;
}

const SelectValue: React.FC<SelectValueProps> = ({ placeholder, className }) => {
  const { value, labels } = useSelectContext('SelectValue');
  const label = value ? labels[value] : undefined;
  return (
    <span className={cn('truncate', !label && 'text-muted-foreground', className)}>
      {label ?? placeholder ?? ''}
    </span>
  );
};
SelectValue.displayName = 'SelectValue';

const SelectContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open } = useSelectContext('SelectContent');
    if (!open) return null;
    return (
      <div
        ref={ref}
        role="listbox"
        className={cn(
          'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectContent.displayName = 'SelectContent';

export interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: selected, setValue, registerLabel } = useSelectContext('SelectItem');

    React.useEffect(() => {
      if (typeof children === 'string') {
        registerLabel(value, children);
      }
    }, [children, value, registerLabel]);

    const isSelected = selected === value;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        data-state={isSelected ? 'checked' : 'unchecked'}
        onClick={() => setValue(value)}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);
SelectItem.displayName = 'SelectItem';

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
};
