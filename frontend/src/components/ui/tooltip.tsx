import * as React from 'react';

export interface TooltipProviderProps {
  children?: React.ReactNode;
  delayDuration?: number;
}

export const TooltipProvider = ({ children }: TooltipProviderProps) => <>{children}</>;

export const Tooltip = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

export const TooltipTrigger = ({ children, asChild: _asChild }: { children: React.ReactNode; asChild?: boolean }) => (
  <>{children}</>
);

export const TooltipContent = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div role="tooltip" className={className}>{children}</div>
);
