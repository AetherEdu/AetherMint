import * as React from 'react';

type CardProps = React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
};

export const Card = React.forwardRef<HTMLElement, CardProps>(
  ({ as: Component = 'div', className, children, ...props }, ref) => {
    return (
      <Component ref={ref as any} className={className} {...props}>
        {children}
      </Component>
    );
  }
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLElement, CardProps>(
  ({ as: Component = 'header', className, children, ...props }, ref) => {
    return (
      <Component ref={ref as any} className={className} {...props}>
        {children}
      </Component>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLElement, CardProps>(
  ({ as: Component = 'h3', className, children, ...props }, ref) => {
    return (
      <Component ref={ref as any} className={className} {...props}>
        {children}
      </Component>
    );
  }
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLElement, CardProps>(
  ({ as: Component = 'div', className, children, ...props }, ref) => {
    return (
      <Component ref={ref as any} className={className} {...props}>
        {children}
      </Component>
    );
  }
);
CardContent.displayName = 'CardContent';
