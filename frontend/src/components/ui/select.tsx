import * as React from 'react';

interface SelectContextValue {
  value: string;
  setValue: (next: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(component: string): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Select>.`);
  }
  return ctx;
}

export interface SelectProps {
  value: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export const Select = ({ value, defaultValue, onValueChange, children, className }: SelectProps) => {
  const [internal, setInternal] = React.useState<string>(defaultValue ?? value);
  const current = value ?? internal;
  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );
  const ctx = React.useMemo<SelectContextValue>(() => ({ value: current, setValue }), [current, setValue]);
  return <SelectContext.Provider value={ctx}><div className={className}>{children}</div></SelectContext.Provider>;
};

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(function SelectTrigger({ className, children, ...props }, ref) {
  return (
    <button ref={ref} type="button" role="combobox" className={className} {...props}>
      {children}
    </button>
  );
});

export const SelectValue = ({ placeholder }: { placeholder?: string }) => {
  const ctx = useSelectContext('SelectValue');
  return <span data-value={ctx.value}>{ctx.value || placeholder}</span>;
};

export const SelectContent = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div role="listbox" className={className}>{children}</div>
);

export const SelectItem = ({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) => {
  const ctx = useSelectContext('SelectItem');
  const active = ctx.value === value;
  return (
    <div
      role="option"
      aria-selected={active}
      data-value={value}
      className={className}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </div>
  );
};
