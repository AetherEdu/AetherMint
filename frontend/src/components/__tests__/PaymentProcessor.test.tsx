import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PaymentProcessor from '../PaymentProcessor';
import { WalletsKit } from '@creit.tech/stellar-wallets-kit';
import { stellarService, createEnrollmentMemo, formatStellarBalance } from '@/lib/stellar';
import type { Course, WalletInfo } from '@/types/enrollment';

jest.mock('@creit.tech/stellar-wallets-kit', () => ({
  WalletsKit: jest.fn(),
  MAINNET: 'public',
  TESTNET: 'testnet',
}));

jest.mock('@/lib/stellar', () => ({
  stellarService: {
    getAccountBalance: jest.fn(),
    createPaymentTransaction: jest.fn(),
    submitTransaction: jest.fn(),
    estimateTransactionFee: jest.fn(),
  },
  createEnrollmentMemo: jest.fn(),
  formatStellarBalance: jest.fn(),
}));

type MockInstance = {
  connect: jest.Mock;
  disconnect: jest.Mock;
  getWallet: jest.Mock;
  signTransaction: jest.Mock;
  setNetwork: jest.Mock;
};

const mockCourse: Course = {
  id: 'course-1',
  title: 'Mastering Stellar Development',
  description: 'Learn Stellar blockchain development',
  instructor: 'Dr. Smith',
  price: 150,
  currency: 'XLM',
  duration: '8 weeks',
  level: 'intermediate',
  category: 'blockchain',
};

const mockWallet: WalletInfo = {
  publicKey: 'G' + 'B'.repeat(55),
  network: 'testnet',
  connected: true,
  walletType: 'xbull',
  balance: 500,
};

const mockReceipt = {
  transactionHash: 'abc123def456',
  status: 'success' as const,
  timestamp: new Date().toISOString(),
  from: mockWallet.publicKey,
  to: 'GDUKMG4GD6VQY66JWH2D7SRPE2A4F4FJKM3KODD37MPEXGLB5JDO3M2M',
  amount: 150,
};

const createMockInstance = (): MockInstance => ({
  connect: jest.fn().mockResolvedValue({ publicKey: 'G' + 'A'.repeat(55), type: 'xbull' }),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getWallet: jest.fn().mockResolvedValue(null),
  signTransaction: jest.fn().mockResolvedValue('signed-xdr'),
  setNetwork: jest.fn(),
});

const defaultInstance = createMockInstance();

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(defaultInstance, createMockInstance());
  (WalletsKit as jest.Mock).mockImplementation(() => defaultInstance);
  (formatStellarBalance as jest.Mock).mockImplementation((b: number) => `${b.toFixed(7)} XLM`);
  (createEnrollmentMemo as jest.Mock).mockReturnValue('ENROLL_course-1_AAAAAAAA');
  (stellarService.getAccountBalance as jest.Mock).mockResolvedValue(500);
  (stellarService.estimateTransactionFee as jest.Mock).mockResolvedValue(100);
  (stellarService.createPaymentTransaction as jest.Mock).mockResolvedValue('xdr-encoded-tx');
  (stellarService.submitTransaction as jest.Mock).mockResolvedValue(mockReceipt);
});

describe('PaymentProcessor', () => {
  const mockOnPaymentSuccess = jest.fn();
  const mockOnPaymentError = jest.fn();
  const mockOnPaymentPending = jest.fn();

  describe('idle state', () => {
    it('renders payment details when idle', () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      expect(screen.getByText('Payment Details')).toBeInTheDocument();
      expect(screen.getByText('Ready to Pay')).toBeInTheDocument();
      expect(screen.getByText('Mastering Stellar Development')).toBeInTheDocument();
      expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('8 weeks')).toBeInTheDocument();
    });

    it('shows wallet information when wallet is provided', () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      expect(screen.getByText('xbull')).toBeInTheDocument();
      expect(screen.getByText('testnet')).toBeInTheDocument();
    });

    it('renders pay button with correct amount', () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      expect(screen.getByRole('button', { name: /Pay/ })).toBeInTheDocument();
    });
  });

  describe('balance checking', () => {
    it('checks balance and estimates fee on mount', async () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await waitFor(() => {
        expect(stellarService.getAccountBalance).toHaveBeenCalledWith(mockWallet.publicKey);
        expect(stellarService.estimateTransactionFee).toHaveBeenCalled();
      });
    });

    it('shows insufficient balance warning when balance is too low', async () => {
      (stellarService.getAccountBalance as jest.Mock).mockResolvedValue(50);

      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Insufficient balance/)).toBeInTheDocument();
      });
    });

    it('disables pay button when balance is insufficient', async () => {
      (stellarService.getAccountBalance as jest.Mock).mockResolvedValue(50);

      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Pay/ })).toBeDisabled();
      });
    });
  });

  describe('payment flow', () => {
    it('processes payment successfully', async () => {
      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(mockOnPaymentPending).toHaveBeenCalled();
        expect(stellarService.createPaymentTransaction).toHaveBeenCalled();
        expect(defaultInstance.signTransaction).toHaveBeenCalled();
        expect(stellarService.submitTransaction).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
        expect(mockOnPaymentSuccess).toHaveBeenCalledWith(mockReceipt.transactionHash);
      });
    });

    it('shows processing state while payment is in progress', async () => {
      defaultInstance.signTransaction.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));
      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('creates enrollment memo with correct format', async () => {
      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(createEnrollmentMemo).toHaveBeenCalledWith(
          mockCourse.id,
          expect.any(String)
        );
      });
    });
  });

  describe('success state', () => {
    it('shows transaction receipt on success', async () => {
      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Payment Successful!')).toBeInTheDocument();
        expect(screen.getByText(/Your enrollment in/)).toBeInTheDocument();
        expect(screen.getByText('View Transaction')).toBeInTheDocument();
      });
    });
  });

  describe('failed state', () => {
    it('shows error message when payment fails', async () => {
      defaultInstance.signTransaction.mockRejectedValue(new Error('User rejected signing'));

      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(mockOnPaymentError).toHaveBeenCalledWith('User rejected signing');
      });
    });

    it('handles transaction submission failure', async () => {
      (stellarService.submitTransaction as jest.Mock).mockResolvedValue({
        ...mockReceipt,
        status: 'failed' as const,
      });

      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
        expect(mockOnPaymentError).toHaveBeenCalled();
      });
    });
  });

  describe('retry functionality', () => {
    it('retries payment after failure', async () => {
      defaultInstance.signTransaction
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('signed-xdr');

      const user = userEvent.setup();
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Payment Failed')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText('Payment Details')).toBeInTheDocument();
        expect(screen.getByText('Ready to Pay')).toBeInTheDocument();
      });
    });

    it('shows Try Again button only after failure', async () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      expect(screen.queryByText('Try Again')).not.toBeInTheDocument();

      defaultInstance.signTransaction.mockRejectedValue(new Error('fail'));
      const user = userEvent.setup();
      await user.click(screen.getByRole('button', { name: /Pay/ }));

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });
  });

  describe('error handling', () => {
    it('disables pay button when wallet is null', () => {
      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={null}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      expect(screen.getByRole('button', { name: /Pay/ })).toBeDisabled();
    });

    it('shows error when balance check fails', async () => {
      (stellarService.getAccountBalance as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <PaymentProcessor
          course={mockCourse}
          wallet={mockWallet}
          onPaymentSuccess={mockOnPaymentSuccess}
          onPaymentError={mockOnPaymentError}
          onPaymentPending={mockOnPaymentPending}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Failed to check account balance')).toBeInTheDocument();
      });
    });
  });
});
