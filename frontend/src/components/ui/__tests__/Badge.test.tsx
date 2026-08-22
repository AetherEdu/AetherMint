import React from 'react';
import { render, screen } from '@testing-library/react';
import { Badge } from '../badge';

describe('Badge', () => {
  it('renders children', () => {
    render(<Badge>Badge text</Badge>);
    expect(screen.getByText('Badge text')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('renders with default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('renders with outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('forwards className', () => {
    render(<Badge className="my-badge">Styled</Badge>);
    expect(screen.getByText('Styled')).toHaveClass('my-badge');
  });
});