import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EnrollmentForm from '../EnrollmentForm';
import { env } from '@/lib/env';

jest.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS: 'GDUKMG4GD6VQY66JWH2D7SRPE2A4F4FJKM3KODD37MPEXGLB5JDO3M2M',
  },
}));

jest.mock('../WalletConnector', () => {
  return function MockWalletConnector({ onWalletConnect }: any) {
    return (
      <div>
        <button onClick={() => onWalletConnect({ publicKey: 'G' + 'B'.repeat(55), connected: true, walletType: 'xbull' })}>
          Simulate Connect
        </button>
      </div>
    );
  };
});

jest.mock('../PaymentProcessor', () => {
  return function MockPaymentProcessor({ onPaymentSuccess }: any) {
    return (
      <div>
        <button onClick={() => onPaymentSuccess('tx-hash-123')}>
          Simulate Payment
        </button>
      </div>
    );
  };
});

jest.mock('../Skeleton', () => {
  return function MockSkeleton() {
    return <div data-testid="skeleton" />;
  };
});

global.fetch = jest.fn();

const mockCourse = {
  id: 'course-1',
  title: 'Mastering Stellar',
  description: 'Learn Stellar',
  instructor: 'Dr. Smith',
  price: 150,
  currency: 'XLM',
  duration: '8 weeks',
  level: 'intermediate',
  category: 'blockchain',
};

describe('EnrollmentForm', () => {
  const onEnrollmentComplete = jest.fn();
  const onEnrollmentError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows loading skeleton initially', () => {
    render(
      <EnrollmentForm
        course={mockCourse}
        wallet={null}
        onEnrollmentComplete={onEnrollmentComplete}
        onEnrollmentError={onEnrollmentError}
      />
    );
    expect(screen.getByText('Loading enrollment form...')).toBeInTheDocument();
  });

  it('renders personal info step after loading', () => {
    jest.advanceTimersByTime(200);
    render(
      <EnrollmentForm
        course={mockCourse}
        wallet={null}
        onEnrollmentComplete={onEnrollmentComplete}
        onEnrollmentError={onEnrollmentError}
      />
    );
    expect(screen.getByText('Personal Information')).toBeInTheDocument();
  });

  it('shows error when trying to proceed without filling required fields', () => {
    jest.advanceTimersByTime(200);
    render(
      <EnrollmentForm
        course={mockCourse}
        wallet={null}
        onEnrollmentComplete={onEnrollmentComplete}
        onEnrollmentError={onEnrollmentError}
      />
    );
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText('Please complete the current step before proceeding')).toBeInTheDocument();
  });

  it('shows previous button as disabled on first step', () => {
    render(
      <EnrollmentForm
        course={mockCourse}
        wallet={null}
        onEnrollmentComplete={onEnrollmentComplete}
        onEnrollmentError={onEnrollmentError}
      />
    );
    const prevButton = screen.getByLabelText('Go to previous step');
    expect(prevButton).toBeDisabled();
  });

  it('shows transition loading when moving between steps', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <EnrollmentForm
        course={mockCourse}
        wallet={null}
        onEnrollmentComplete={onEnrollmentComplete}
        onEnrollmentError={onEnrollmentError}
      />
    );
    const firstName = screen.getByLabelText('First Name');
    await user.type(firstName, 'John');
    const lastName = screen.getByLabelText('Last Name');
    await user.type(lastName, 'Doe');
    const email = screen.getByLabelText('Email Address');
    await user.type(email, 'john@example.com');
    fireEvent.click(screen.getByText('Next'));
    expect(screen.getByText(/Loading next step/)).toBeInTheDocument();
  });
});