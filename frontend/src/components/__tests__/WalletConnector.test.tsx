import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WalletConnector from '../WalletConnector';
import { WalletsKit } from '@creit.tech/stellar-wallets-kit';
import { stellarService, isValidStellarAddress, formatStellarBalance } from '@/lib/stellar';

jest.mock('@creit.tech/stellar-wallets-kit', () => ({
  WalletsKit: jest.fn(),
  MAINNET: 'public',
  TESTNET: 'testnet',
}));

jest.mock('@/lib/stellar', () => ({
  stellarService: {
    getAccountBalance: jest.fn(),
    fundTestAccount: jest.fn(),
  },
  isValidStellarAddress: jest.fn(),
  formatStellarBalance: jest.fn(),
}));

type MockInstance = {
  connect: jest.Mock;
  disconnect: jest.Mock;
  getWallet: jest.Mock;
  signTransaction: jest.Mock;
  setNetwork: jest.Mock;
};

const createMockInstance = (): MockInstance => ({
  connect: jest.fn().mockResolvedValue({ publicKey: 'G' + 'A'.repeat(55), type: 'xbull' }),
  disconnect: jest.fn().mockResolvedValue(undefined),
  getWallet: jest.fn().mockResolvedValue(null),
  signTransaction: jest.fn().mockResolvedValue('signed-xdr'),
  setNetwork: jest.fn(),
});

let mockInstance: MockInstance;
const defaultInstance = createMockInstance();

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(defaultInstance, createMockInstance());
  mockInstance = defaultInstance;
  (WalletsKit as jest.Mock).mockImplementation(() => defaultInstance);
  (formatStellarBalance as jest.Mock).mockImplementation((b: number) => `${b.toFixed(7)} XLM`);
  (isValidStellarAddress as jest.Mock).mockReturnValue(true);
  (stellarService.getAccountBalance as jest.Mock).mockResolvedValue(100);
  (stellarService.fundTestAccount as jest.Mock).mockResolvedValue(undefined);
});

describe('WalletConnector', () => {
  const mockOnWalletConnect = jest.fn();
  const mockOnWalletDisconnect = jest.fn();

  describe('disconnected state', () => {
    it('renders the connect button when not connected', () => {
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
      expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
      expect(screen.getByText('Network: testnet')).toBeInTheDocument();
    });

    it('shows testnet banner when on testnet', async () => {
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Testnet Mode/)).toBeInTheDocument();
      });
    });

    it('does not show testnet banner when on mainnet', async () => {
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="mainnet"
        />
      );

      await waitFor(() => {
        expect(screen.queryByText(/Testnet Mode/)).not.toBeInTheDocument();
      });
    });

    it('disables connect button and shows connecting text while connecting', async () => {
      defaultInstance.connect.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      const button = screen.getByText('Connect Wallet');
      await user.click(button);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
      expect(screen.getByText('Connecting...')).toBeDisabled();
    });
  });

  describe('connect flow', () => {
    it('handles successful wallet connection', async () => {
      const publicKey = 'G' + 'B'.repeat(55);
      defaultInstance.connect.mockResolvedValue({ publicKey, type: 'xbull' });

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(mockOnWalletConnect).toHaveBeenCalledWith(
          expect.objectContaining({
            publicKey,
            network: 'testnet',
            connected: true,
            walletType: 'xbull',
            balance: 100,
          })
        );
      });

      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    });

    it('funds test account on testnet when balance is zero', async () => {
      defaultInstance.connect.mockResolvedValue({ publicKey: 'G' + 'B'.repeat(55), type: 'xbull' });
      (stellarService.getAccountBalance as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(10000);

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(stellarService.fundTestAccount).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(mockOnWalletConnect).toHaveBeenLastCalledWith(
          expect.objectContaining({ balance: 10000 })
        );
      });
    });

    it('does not fund test account on mainnet', async () => {
      defaultInstance.connect.mockResolvedValue({ publicKey: 'G' + 'B'.repeat(55), type: 'xbull' });
      (stellarService.getAccountBalance as jest.Mock).mockResolvedValue(0);

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="mainnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(stellarService.fundTestAccount).not.toHaveBeenCalled();
      });
    });
  });

  describe('error states', () => {
    it('shows error when connection fails', async () => {
      defaultInstance.connect.mockRejectedValue(new Error('User rejected connection'));

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(screen.getByText('User rejected connection')).toBeInTheDocument();
      });
    });

    it('shows error for invalid Stellar address', async () => {
      defaultInstance.connect.mockResolvedValue({ publicKey: 'invalid-key', type: 'xbull' });
      (isValidStellarAddress as jest.Mock).mockReturnValue(false);

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(screen.getByText('Invalid Stellar address')).toBeInTheDocument();
      });
    });

    it('shows error when publicKey is missing', async () => {
      defaultInstance.connect.mockResolvedValue({ publicKey: '', type: 'xbull' });

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await user.click(screen.getByText('Connect Wallet'));

      await waitFor(() => {
        expect(screen.getByText('Failed to get public key from wallet')).toBeInTheDocument();
      });
    });
  });

  describe('connected state', () => {
    const publicKey = 'G' + 'B'.repeat(55);

    it('shows wallet info when connected', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });

      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      expect(screen.getByText('xbull')).toBeInTheDocument();
      expect(screen.getByText('testnet')).toBeInTheDocument();
    });

    it('shows balance when connected', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });

      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      expect(formatStellarBalance).toHaveBeenCalledWith(100);
    });

    it('toggles address visibility', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      expect(screen.queryByText(publicKey)).not.toBeInTheDocument();

      await user.click(screen.getByText('Show'));
      expect(screen.getByText(publicKey)).toBeInTheDocument();

      await user.click(screen.getByText('Hide'));
      expect(screen.queryByText(publicKey)).not.toBeInTheDocument();
    });

    it('handles disconnect flow', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Disconnect Wallet'));

      expect(defaultInstance.disconnect).toHaveBeenCalled();
      expect(mockOnWalletDisconnect).toHaveBeenCalled();
    });

    it('shows error on disconnect failure', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });
      defaultInstance.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Disconnect Wallet'));

      await waitFor(() => {
        expect(screen.getByText('Disconnect failed')).toBeInTheDocument();
      });
    });

    it('refreshes balance when refresh button is clicked', async () => {
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'xbull' });
      (stellarService.getAccountBalance as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(200);

      const user = userEvent.setup();
      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(stellarService.getAccountBalance).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('reconnection on mount', () => {
    it('detects existing wallet connection on mount', async () => {
      const publicKey = 'G' + 'C'.repeat(55);
      defaultInstance.getWallet.mockResolvedValue({ publicKey, type: 'freighter' });

      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(mockOnWalletConnect).toHaveBeenCalledWith(
          expect.objectContaining({
            publicKey,
            walletType: 'freighter',
            network: 'testnet',
          })
        );
      });

      expect(screen.getByText('Wallet Connected')).toBeInTheDocument();
    });

    it('handles getWallet error gracefully during reconnection', async () => {
      defaultInstance.getWallet.mockRejectedValue(new Error('No wallet found'));

      render(
        <WalletConnector
          onWalletConnect={mockOnWalletConnect}
          onWalletDisconnect={mockOnWalletDisconnect}
          network="testnet"
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument();
      });
    });
  });
});
