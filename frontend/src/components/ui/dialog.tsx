import * as React from 'react';

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  children?: React.ReactNode;
}

export const Dialog = ({ open, onOpenChange, children }: DialogProps) => {
  React.useEffect(() => {
    if (open === undefined) return;
    // intentional no-op stub
  }, [open, onOpenChange]);
  return <div role="dialog" data-open={open} data-stub="dialog">{children}</div>;
};

export const DialogContent = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={className}>{children}</div>
);

export const DialogHeader = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={className}>{children}</div>
);

export const DialogTitle = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <h2 className={className}>{children}</h2>
);

export const DialogTrigger = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const DialogClose = ({ children }: { children: React.ReactNode }) => <>{children}</>;
