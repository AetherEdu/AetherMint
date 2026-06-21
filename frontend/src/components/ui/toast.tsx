import * as React from 'react';

export interface ToastProviderProps {
  children?: React.ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => <>{children}</>;

export const Toast = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div role="status" className={className}>{children}</div>
);

export const ToastTitle = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={className}>{children}</div>
);

export const ToastDescription = ({ className, children }: { className?: string; children?: React.ReactNode }) => (
  <div className={className}>{children}</div>
);
