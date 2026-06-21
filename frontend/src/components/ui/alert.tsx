import * as React from 'react';

type AlertVariant = 'default' | 'destructive' | 'warning' | 'success';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { className, children, variant = 'default', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role="alert"
      data-variant={variant}
      className={className}
      {...props}
    >
      {children}
    </div>
  );
});

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(function AlertTitle({ className, children, ...props }, ref) {
  return (
    <h5 ref={ref} className={className} {...props}>
      {children}
    </h5>
  );
});

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(function AlertDescription({ className, children, ...props }, ref) {
  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
});

export const AlertDialog = ({ children }: { children: React.ReactNode }) => <>{children}</>;
export const AlertDialogTrigger = ({ children }: { children: React.ReactNode }) => <>{children}</>;
