import * as React from 'react';

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Tabs>.`);
  }
  return ctx;
}

export interface TabsProps {
  value: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
  children?: React.ReactNode;
  className?: string;
}

export const Tabs = ({ value, defaultValue, onValueChange, children, className }: TabsProps) => {
  const [internal, setInternal] = React.useState<string>(defaultValue ?? value);
  const current = value ?? internal;
  const setValue = React.useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );
  const ctx = React.useMemo<TabsContextValue>(() => ({ value: current, setValue }), [current, setValue]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={className} data-tabs-root>{children}</div>
    </TabsContext.Provider>
  );
};

export const TabsList = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div role="tablist" className={className}>{children}</div>
);

export const TabsTrigger = ({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) => {
  const ctx = useTabsContext('TabsTrigger');
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? 'active' : 'inactive'}
      className={className}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children?: React.ReactNode;
}) => {
  const ctx = useTabsContext('TabsContent');
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" data-state="active" className={className}>
      {children}
    </div>
  );
};
