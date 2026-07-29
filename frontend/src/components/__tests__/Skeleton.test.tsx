import React from 'react';
import { render, screen } from '@testing-library/react';
import Skeleton, { SkeletonBlock } from '../Skeleton';

describe('Skeleton', () => {
  describe('text variant', () => {
    it('renders with role status and accessible label', () => {
      render(<Skeleton variant="text" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading text content...');
    });

    it('renders default number of lines', () => {
      const { container } = render(<Skeleton variant="text" />);
      const skeletonBases = container.querySelectorAll('.animate-pulse');
      expect(skeletonBases.length).toBeGreaterThanOrEqual(3);
    });

    it('accepts custom line count', () => {
      const { container } = render(<Skeleton variant="text" lines={5} />);
      const skeletonBases = container.querySelectorAll('.animate-pulse');
      expect(skeletonBases.length).toBeGreaterThanOrEqual(5);
    });

    it('accepts custom aria-label', () => {
      render(<Skeleton variant="text" aria-label="Custom label" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Custom label');
    });
  });

  describe('image variant', () => {
    it('renders with role status', () => {
      render(<Skeleton variant="image" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders with default aspect ratio', () => {
      const { container } = render(<Skeleton variant="image" />);
      const skeletonDiv = container.querySelector('.animate-pulse');
      expect(skeletonDiv).toBeInTheDocument();
    });

    it('accepts custom aspect ratio', () => {
      const { container } = render(<Skeleton variant="image" aspectRatio="4/3" />);
      const skeletonDiv = container.querySelector('.animate-pulse');
      expect(skeletonDiv).toBeInTheDocument();
    });
  });

  describe('card variant', () => {
    it('renders with role status', () => {
      render(<Skeleton variant="card" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders footer when hasFooter is true', () => {
      const { container } = render(<Skeleton variant="card" hasFooter />);
      const footerElements = container.querySelectorAll('.border-t');
      expect(footerElements.length).toBeGreaterThan(0);
    });

    it('renders without footer by default', () => {
      const { container } = render(<Skeleton variant="card" />);
      const footerElements = container.querySelectorAll('.border-t');
      expect(footerElements.length).toBe(0);
    });
  });

  describe('list-item variant', () => {
    it('renders with role status', () => {
      render(<Skeleton variant="list-item" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders avatar when hasAvatar is true', () => {
      const { container } = render(<Skeleton variant="list-item" hasAvatar />);
      const avatarSkeleton = container.querySelector('.rounded-full');
      expect(avatarSkeleton).toBeInTheDocument();
    });

    it('hides avatar when hasAvatar is false', () => {
      const { container } = render(<Skeleton variant="list-item" hasAvatar={false} />);
      const avatarSkeleton = container.querySelector('.h-10');
      expect(avatarSkeleton).not.toBeInTheDocument();
    });
  });

  describe('invalid variant', () => {
    it('returns null for unknown variant', () => {
      const { container } = render(<Skeleton variant={'unknown' as any} />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});

describe('SkeletonBlock', () => {
  it('renders a skeleton div', () => {
    const { container } = render(<SkeletonBlock />);
    const el = container.querySelector('.animate-pulse');
    expect(el).toBeInTheDocument();
  });

  it('forwards className', () => {
    const { container } = render(<SkeletonBlock className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});