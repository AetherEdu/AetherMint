import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { ErrorFallback } from '../ErrorFallback';

// Silence console.error for expected error boundary tests
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

const ThrowError: React.FC = () => {
  throw new Error('Test error message');
};

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Safe Content</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });

  it('catches errors and shows fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Fallback</div>}>
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Fallback')).toBeInTheDocument();
  });

  it('resets error state on retry', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );
    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('resets error state when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="initial">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Try Again')).toBeInTheDocument();
    rerender(
      <ErrorBoundary resetKey="updated">
        <div>Recovered</div>
      </ErrorBoundary>
    );
    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });

  it('uses custom variant', () => {
    render(
      <ErrorBoundary variant="network">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });

  it('uses custom title and message', () => {
    render(
      <ErrorBoundary errorTitle="Custom Title" errorMessage="Custom message">
        <ThrowError />
      </ErrorBoundary>
    );
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });
});

describe('ErrorFallback', () => {
  it('renders with default variant', () => {
    render(<ErrorFallback />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('renders with network variant', () => {
    render(<ErrorFallback variant="network" />);
    expect(screen.getByText('Network Error')).toBeInTheDocument();
  });

  it('renders with wallet variant', () => {
    render(<ErrorFallback variant="wallet" />);
    expect(screen.getByText('Wallet Error')).toBeInTheDocument();
  });

  it('renders with payment variant', () => {
    render(<ErrorFallback variant="payment" />);
    expect(screen.getByText('Payment Error')).toBeInTheDocument();
  });

  it('renders with custom title and message', () => {
    render(<ErrorFallback title="Custom" message="Custom message" />);
    expect(screen.getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<ErrorFallback onRetry={undefined} />);
    expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
  });

  it('calls onRetry when button is clicked', () => {
    const onRetry = jest.fn();
    render(<ErrorFallback onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Try Again'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders with role alert', () => {
    render(<ErrorFallback />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});