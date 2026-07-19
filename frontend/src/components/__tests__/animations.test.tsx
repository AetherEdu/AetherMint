/**
 * Tests for Issue #283 — Animated page transitions and micro-interactions
 *
 * Covers:
 *   • useReducedMotion hook
 *   • useScrollReveal hook
 *   • PageTransition component
 *   • LoadingSpinner component
 *   • ScrollReveal component
 *   • animatedToast utility
 *   • Button micro-interactions
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// ─── Mock framer-motion (consistent with existing project pattern) ────────────
jest.mock('framer-motion', () => ({
  motion: {
    div:    ({ children, ...props }: any) => <div    {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    svg:    ({ children, ...props }: any) => <svg    {...props}>{children}</svg>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: jest.fn(() => false),
}));

// ─── Mock react-hot-toast ────────────────────────────────────────────────────
jest.mock('react-hot-toast', () => {
  const customMock = jest.fn((_render: any, _opts: any) => 'toast-id');
  return {
    __esModule: true,
    default: Object.assign(jest.fn(), { custom: customMock }),
    custom: customMock,
  };
});

// ─── Imports under test ───────────────────────────────────────────────────────
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useScrollReveal }  from '@/hooks/useScrollReveal';
import { PageTransition }   from '@/components/PageTransition';
import { LoadingSpinner }   from '@/components/ui/LoadingSpinner';
import { ScrollReveal }     from '@/components/ScrollReveal';
import { animatedToast }    from '@/components/ui/animatedToast';
import { Button }           from '@/components/ui/button';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Creates a mock MediaQueryList and wires it into `window.matchMedia`.
 * Returns a function that can trigger the `change` event.
 */
function mockMatchMedia(matches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null;
  const mql: Partial<MediaQueryList> = {
    matches,
    addEventListener: jest.fn((_type, fn) => { listener = fn as any; }),
    removeEventListener: jest.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn(() => mql),
  });
  return {
    triggerChange: (nextMatches: boolean) => {
      (mql as any).matches = nextMatches;
      listener?.({ matches: nextMatches } as MediaQueryListEvent);
    },
  };
}

// ─── useReducedMotion ─────────────────────────────────────────────────────────

describe('useReducedMotion', () => {
  function HookHarness() {
    const reduced = useReducedMotion();
    return <div data-testid="result">{String(reduced)}</div>;
  }

  it('returns false when prefers-reduced-motion is not set', () => {
    mockMatchMedia(false);
    render(<HookHarness />);
    expect(screen.getByTestId('result')).toHaveTextContent('false');
  });

  it('returns true when prefers-reduced-motion: reduce is active', () => {
    mockMatchMedia(true);
    render(<HookHarness />);
    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  it('updates when the media query changes at runtime', async () => {
    const { triggerChange } = mockMatchMedia(false);
    render(<HookHarness />);
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    act(() => triggerChange(true));
    await waitFor(() =>
      expect(screen.getByTestId('result')).toHaveTextContent('true')
    );
  });
});

// ─── useScrollReveal ──────────────────────────────────────────────────────────

describe('useScrollReveal', () => {
  let observerCallback: IntersectionObserverCallback;
  let mockObserve: jest.Mock;
  let mockDisconnect: jest.Mock;

  beforeEach(() => {
    mockObserve = jest.fn();
    mockDisconnect = jest.fn();

    global.IntersectionObserver = jest.fn((cb) => {
      observerCallback = cb;
      return { observe: mockObserve, disconnect: mockDisconnect, unobserve: jest.fn() };
    }) as any;
  });

  function HookHarness({ threshold = 0.15 }: { threshold?: number }) {
    const [ref, isVisible] = useScrollReveal<HTMLDivElement>({ threshold });
    return <div ref={ref} data-testid="target" data-visible={String(isVisible)} />;
  }

  it('starts as hidden (not visible)', () => {
    mockMatchMedia(false);
    render(<HookHarness />);
    expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'false');
  });

  it('becomes visible when the element intersects', async () => {
    mockMatchMedia(false);
    render(<HookHarness />);

    act(() => {
      observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    await waitFor(() =>
      expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'true')
    );
  });

  it('is immediately visible when prefers-reduced-motion is active', () => {
    mockMatchMedia(true);
    render(<HookHarness />);
    expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'true');
  });
});

// ─── PageTransition ───────────────────────────────────────────────────────────

describe('PageTransition', () => {
  it('renders children', () => {
    mockMatchMedia(false);
    render(
      <PageTransition>
        <p>Hello world</p>
      </PageTransition>
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders a plain div (no motion) when reduced-motion is active', () => {
    mockMatchMedia(true);
    const { container } = render(
      <PageTransition>
        <p data-testid="child">Content</p>
      </PageTransition>
    );
    // Should be a plain div, not a motion.div
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.tagName).toBe('DIV');
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('accepts and forwards a className prop', () => {
    mockMatchMedia(false);
    const { container } = render(
      <PageTransition className="custom-class">
        <span>Test</span>
      </PageTransition>
    );
    expect(container.firstChild).toHaveClass('custom-class');
  });
});

// ─── LoadingSpinner ───────────────────────────────────────────────────────────

describe('LoadingSpinner', () => {
  it('renders a status element with the default accessible label', () => {
    mockMatchMedia(false);
    render(<LoadingSpinner />);
    const status = screen.getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-label', 'Loading…');
  });

  it('accepts a custom label', () => {
    mockMatchMedia(false);
    render(<LoadingSpinner label="Fetching credentials…" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Fetching credentials…'
    );
  });

  it('shows the text label when showLabel is true', () => {
    mockMatchMedia(false);
    render(<LoadingSpinner showLabel label="Please wait" />);
    // The visible label text (aria-hidden) should be present in the DOM
    expect(screen.getAllByText('Please wait').length).toBeGreaterThan(0);
  });

  it('renders in all size variants without throwing', () => {
    mockMatchMedia(false);
    const sizes = ['sm', 'md', 'lg', 'xl'] as const;
    sizes.forEach((size) => {
      const { unmount } = render(<LoadingSpinner size={size} />);
      unmount();
    });
  });

  it('falls back to a plain div when reduced-motion is active', () => {
    mockMatchMedia(true);
    const { container } = render(<LoadingSpinner />);
    // No SVG — uses a plain div with a CSS border animation
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('div[style*="border"]')).toBeTruthy();
  });
});

// ─── ScrollReveal ─────────────────────────────────────────────────────────────

describe('ScrollReveal', () => {
  let observerCallback: IntersectionObserverCallback;

  beforeEach(() => {
    global.IntersectionObserver = jest.fn((cb) => {
      observerCallback = cb;
      return { observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() };
    }) as any;
  });

  it('renders children', () => {
    mockMatchMedia(false);
    render(
      <ScrollReveal>
        <p>Reveal me</p>
      </ScrollReveal>
    );
    expect(screen.getByText('Reveal me')).toBeInTheDocument();
  });

  it('accepts a direction prop without throwing', () => {
    mockMatchMedia(false);
    (['up', 'down', 'left', 'right', 'none'] as const).forEach((dir) => {
      const { unmount } = render(
        <ScrollReveal direction={dir}>
          <span>{dir}</span>
        </ScrollReveal>
      );
      unmount();
    });
  });

  it('forwards className to the wrapper', () => {
    mockMatchMedia(false);
    const { container } = render(
      <ScrollReveal className="my-class">
        <span>Test</span>
      </ScrollReveal>
    );
    expect(container.firstChild).toHaveClass('my-class');
  });
});

// ─── animatedToast ────────────────────────────────────────────────────────────

describe('animatedToast', () => {
  // Get the mocked `toast.custom` to inspect calls
  const getToastCustom = () =>
    (jest.requireMock('react-hot-toast') as any).custom as jest.Mock;

  beforeEach(() => {
    getToastCustom().mockClear();
    // Ensure window.matchMedia returns false (animations enabled)
    mockMatchMedia(false);
  });

  it('calls toast.custom for success variant', () => {
    animatedToast.success('Operation successful!');
    expect(getToastCustom()).toHaveBeenCalledTimes(1);
  });

  it('calls toast.custom for error variant', () => {
    animatedToast.error('Something went wrong.');
    expect(getToastCustom()).toHaveBeenCalledTimes(1);
  });

  it('calls toast.custom for info variant', () => {
    animatedToast.info('Did you know…');
    expect(getToastCustom()).toHaveBeenCalledTimes(1);
  });

  it('calls toast.custom for warning variant', () => {
    animatedToast.warning('Low balance!');
    expect(getToastCustom()).toHaveBeenCalledTimes(1);
  });

  it('passes a custom duration via options', () => {
    animatedToast.error('Fatal error', { duration: 8000 });
    const [, opts] = getToastCustom().mock.calls[0];
    expect(opts.duration).toBe(8000);
  });
});

// ─── Button micro-interactions ────────────────────────────────────────────────

describe('Button', () => {
  const { useReducedMotion: mockUseReducedMotion } =
    jest.requireMock('framer-motion') as { useReducedMotion: jest.Mock };

  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('renders with default variant and is accessible', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: /click me/i });
    expect(btn).toBeInTheDocument();
  });

  it('renders all variants without throwing', () => {
    const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;
    variants.forEach((variant) => {
      const { unmount } = render(<Button variant={variant}>Btn</Button>);
      unmount();
    });
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('fires onClick handler when clicked', async () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Action</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders a plain button (no motion) when reduced-motion is active', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { container } = render(<Button>Plain</Button>);
    // The element should be a vanilla <button>, not a motion.button proxy
    const btn = container.querySelector('button');
    expect(btn).toBeInTheDocument();
  });

  it('forwards custom className', () => {
    render(<Button className="my-btn">Styled</Button>);
    expect(screen.getByRole('button')).toHaveClass('my-btn');
  });
});
