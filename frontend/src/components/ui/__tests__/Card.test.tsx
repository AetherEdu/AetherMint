import React from 'react';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardTitle, CardContent } from '../card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders as a div by default', () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild?.nodeName).toBe('DIV');
  });

  it('renders as a custom element when as prop is provided', () => {
    const { container } = render(<Card as="article">Content</Card>);
    expect(container.firstChild?.nodeName).toBe('ARTICLE');
  });

  it('forwards className', () => {
    const { container } = render(<Card className="custom">Content</Card>);
    expect(container.firstChild).toHaveClass('custom');
  });
});

describe('CardHeader', () => {
  it('renders children', () => {
    render(<CardHeader>Header</CardHeader>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('renders as header by default', () => {
    const { container } = render(<CardHeader>Content</CardHeader>);
    expect(container.firstChild?.nodeName).toBe('HEADER');
  });
});

describe('CardTitle', () => {
  it('renders children', () => {
    render(<CardTitle>Title</CardTitle>);
    expect(screen.getByText('Title')).toBeInTheDocument();
  });

  it('renders as h3 by default', () => {
    const { container } = render(<CardTitle>Content</CardTitle>);
    expect(container.firstChild?.nodeName).toBe('H3');
  });
});

describe('CardContent', () => {
  it('renders children', () => {
    render(<CardContent>Content</CardContent>);
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});