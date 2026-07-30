import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionDemo } from '../TransactionDemo';

jest.mock('../../../context/WalletContext', () => ({
  useStellarWallet: jest.fn(),
}));

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: {
    Server: jest.fn(() => ({
      loadAccount: jest.fn().mockResolvedValue({}),
    })),
  },
  TransactionBuilder: jest.fn(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(() => ({ toXDR: () => 'dummy-xdr' })),
  })),
  BASE_FEE: '100',
  Operation: {
    setOptions: jest.fn(() => ({})),
  },
  TimeoutInfinite: 0,
}));

jest.mock('../../../lib/stellar/wallets', () => ({
  TESTNET_DETAILS: { horizonUrl: 'https://horizon-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2015' },
  MAINNET_DETAILS: { horizonUrl: 'https://horizon.stellar.org', networkPassphrase: 'Public Global Stellar Network ; September 2015' },
}));

jest.mock('react-hot-toast', () => ({
  loading: jest.fn(),
  success: jest.fn(),
  error: jest.fn(),
}));

import { useStellarWallet } from '../../../context/WalletContext';

describe('TransactionDemo', () => {
  const mockSignTransaction = jest.fn().mockResolvedValue({ result: 'signed-xdr' });

  beforeEach(() => {
    jest.clearAllMocks();
    (useStellarWallet as jest.Mock).mockReturnValue({
      address: 'G' + 'A'.repeat(55),
      isConnected: true,
      network: 'testnet',
      signTransaction: mockSignTransaction,
    });
  });

  it('renders nothing when not connected', () => {
    (useStellarWallet as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
      network: 'testnet',
      signTransaction: mockSignTransaction,
    });
    const { container } = render(<TransactionDemo />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the demo section when connected', () => {
    render(<TransactionDemo />);
    expect(screen.getByText('Transaction Signing Demo')).toBeInTheDocument();
    expect(screen.getByText('Sign Dummy Transaction')).toBeInTheDocument();
  });

  it('renders SecurityWarning component', () => {
    render(<TransactionDemo />);
    expect(screen.getByText('Stay Safe on AetherMint')).toBeInTheDocument();
  });

  it('shows "No transaction signed yet" initially', () => {
    render(<TransactionDemo />);
    expect(screen.getByText('No transaction signed yet')).toBeInTheDocument();
  });

  it('signs transaction when button is clicked', async () => {
    render(<TransactionDemo />);
    fireEvent.click(screen.getByText('Sign Dummy Transaction'));
    await waitFor(() => {
      expect(mockSignTransaction).toHaveBeenCalled();
    });
  });

  it('shows signing state while signing', () => {
    mockSignTransaction.mockImplementation(() => new Promise(() => {}));
    render(<TransactionDemo />);
    fireEvent.click(screen.getByText('Sign Dummy Transaction'));
    expect(screen.getByText('Signing in Wallet...')).toBeInTheDocument();
  });
});