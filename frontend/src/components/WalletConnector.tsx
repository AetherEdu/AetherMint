'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WalletsKit, MAINNET, TESTNET } from '@creit.tech/stellar-wallets-kit';
import { WalletInfo } from '@/types/enrollment';
import { stellarService, isValidStellarAddress, formatStellarBalance } from '@/lib/stellar';
import { Wallet, AlertCircle, CheckCircle, Copy, ExternalLink, Loader2 } from 'lucide-react';

interface WalletConnectorProps {
  onWalletConnect: (wallet: WalletInfo) => void;
  onWalletDisconnect: () => void;
  network: 'testnet' | 'mainnet';
}

const WalletConnector: React.FC<WalletConnectorProps> = ({
  onWalletConnect,
  onWalletDisconnect,
  network
}) => {
  const [walletsKit, setWalletsKit] = useState<WalletsKit | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<WalletInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [showAddress, setShowAddress] = useState(false);

  useEffect(() => {
    const kit = new WalletsKit({
      network: network === 'mainnet' ? MAINNET : TESTNET,
      selectedWalletId: 'xbull',
    });
    setWalletsKit(kit);

    // Check if wallet is already connected
    checkExistingConnection(kit);
  }, [network]);

  const checkExistingConnection = async (kit: WalletsKit) => {
    try {
      const wallet = await kit.getWallet();
      if (wallet && wallet.publicKey) {
        const walletInfo: WalletInfo = {
          publicKey: wallet.publicKey,
          network,
          connected: true,
          walletType: wallet.type || 'unknown',
        };

        const accountBalance = await stellarService.getAccountBalance(wallet.publicKey);
        walletInfo.balance = accountBalance;

        setConnectedWallet(walletInfo);
        setBalance(accountBalance);
        onWalletConnect(walletInfo);
      }
    } catch (error) {
      console.log('No existing connection found');
    }
  };

  const connectWallet = async () => {
    if (!walletsKit) {
      setError('Wallet kit not initialized');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wallet = await walletsKit.connect();
      
      if (!wallet.publicKey) {
        throw new Error('Failed to get public key from wallet');
      }

      if (!isValidStellarAddress(wallet.publicKey)) {
        throw new Error('Invalid Stellar address');
      }

      const walletInfo: WalletInfo = {
        publicKey: wallet.publicKey,
        network,
        connected: true,
        walletType: wallet.type || 'unknown',
      };

      // Get account balance
      const accountBalance = await stellarService.getAccountBalance(wallet.publicKey);
      walletInfo.balance = accountBalance;

      setConnectedWallet(walletInfo);
      setBalance(accountBalance);
      onWalletConnect(walletInfo);

      // Fund test account if on testnet and balance is 0
      if (network === 'testnet' && accountBalance === 0) {
        try {
          await stellarService.fundTestAccount(wallet.publicKey);
          const updatedBalance = await stellarService.getAccountBalance(wallet.publicKey);
          setBalance(updatedBalance);
          walletInfo.balance = updatedBalance;
          onWalletConnect(walletInfo);
        } catch (fundError) {
          console.warn('Failed to fund test account:', fundError);
        }
      }

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      const errorMessage = error.message || 'Failed to connect wallet';
      setError(errorMessage);

      // Show contextual toast for wallet errors
      if (errorMessage.toLowerCase().includes('network') || 
          errorMessage.toLowerCase().includes('timeout') ||
          errorMessage.toLowerCase().includes('fetch')) {
        toast.error('Network error: Unable to connect to the Stellar network. Please check your connection.', {
          duration: 6000,
        });
      } else if (errorMessage.toLowerCase().includes('rejected') || 
                 errorMessage.toLowerCase().includes('denied')) {
        toast.error('Wallet connection was rejected', { duration: 4000 });
      } else {
        toast.error(`Wallet error: ${errorMessage}`, { duration: 5000 });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    if (!walletsKit) return;

    try {
      await walletsKit.disconnect();
      setConnectedWallet(null);
      setBalance(0);
      setShowAddress(false);
      onWalletDisconnect();
      setError(null);
    } catch (error: any) {
      console.error('Wallet disconnection error:', error);
      const errorMessage = error.message || 'Failed to disconnect wallet';
      setError(errorMessage);
      toast.error(`Disconnection error: ${errorMessage}`, { duration: 4000 });
    }
  };

  const copyAddress = async () => {
    if (connectedWallet?.publicKey) {
      try {
        await navigator.clipboard.writeText(connectedWallet.publicKey);
        toast.success('Address copied to clipboard', { duration: 3000 });
      } catch (error) {
        console.error('Failed to copy address:', error);
        toast.error('Failed to copy address to clipboard', { duration: 3000 });
      }
    }
  };

  const viewOnStellarExplorer = () => {
    if (connectedWallet?.publicKey) {
      const explorerUrl = network === 'testnet' 
        ? `https://stellar.expert/explorer/testnet/account/${connectedWallet.publicKey}`
        : `https://stellar.expert/explorer/public/account/${connectedWallet.publicKey}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const refreshBalance = async () => {
    if (connectedWallet?.publicKey) {
      try {
        const accountBalance = await stellarService.getAccountBalance(connectedWallet.publicKey);
        setBalance(accountBalance);
        const updatedWallet = { ...connectedWallet, balance: accountBalance };
        setConnectedWallet(updatedWallet);
        onWalletConnect(updatedWallet);
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
    }
  };

  if (connectedWallet) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 shadow-sm w-full" role="region" aria-label="Connected wallet information">
        <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm sm:text-base font-medium text-gray-900">Wallet Connected</span>
          </div>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full" aria-label={`Network: ${network}`}>
            {network}
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider" id="wallet-type-label">Wallet Type</label>
            <p className="text-sm sm:text-base font-medium text-gray-900 capitalize" aria-labelledby="wallet-type-label">
              {connectedWallet.walletType}
            </p>
          </div>

          <div>
            <label className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider" id="balance-label">Balance</label>
            <div className="flex items-center justify-between" role="group" aria-labelledby="balance-label">
              <p className="text-lg sm:text-xl font-semibold text-gray-900" aria-live="polite" aria-atomic="true">
                {formatStellarBalance(balance)}
              </p>
              <button
                onClick={refreshBalance}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 px-3 transition-colors"
                aria-label="Refresh balance"
              >
                Refresh
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs sm:text-sm text-gray-500 uppercase tracking-wider" id="address-label">Address</label>
              <button
                onClick={() => setShowAddress(!showAddress)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 px-3 transition-colors"
                aria-expanded={showAddress}
                aria-controls="wallet-address-section"
              >
                {showAddress ? 'Hide' : 'Show'}
              </button>
            </div>
            {showAddress && (
              <div id="wallet-address-section" className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2" role="group" aria-label="Wallet address actions">
                <p className="text-xs sm:text-sm font-mono bg-gray-100 p-2 sm:p-3 rounded-lg flex-1 break-all" aria-label={`Wallet address: ${connectedWallet.publicKey}`}>
                  {connectedWallet.publicKey}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={copyAddress}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Copy wallet address to clipboard"
                  >
                    <Copy className="w-5 h-5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={viewOnStellarExplorer}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="View wallet on Stellar Explorer (opens in new tab)"
                  >
                    <ExternalLink className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={disconnectWallet}
          className="mt-4 w-full min-h-[44px] bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base font-medium active:scale-[0.98]"
          aria-label="Disconnect wallet"
        >
          Disconnect Wallet
        </button>

        {error && (
          <div className="mt-3 flex items-start space-x-2 text-red-600 bg-red-50 p-3 rounded-lg" role="alert" aria-live="assertive">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 sm:p-8 shadow-sm w-full" role="region" aria-label="Wallet connection">
      <div className="text-center">
        <Wallet className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4" aria-hidden="true" />
        <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2" id="connect-wallet-heading">Connect Your Wallet</h3>
        <p className="text-sm sm:text-base text-gray-600 mb-6 px-2" aria-describedby="connect-wallet-heading">
          Connect your Stellar wallet to enroll in courses and make payments
        </p>

        <div className="space-y-4">
          <div className="flex flex-col xs:flex-row items-center justify-center gap-1 xs:gap-3 text-xs sm:text-sm text-gray-500 px-4" aria-label={`Network: ${network}. Supported wallets: XBull, Albedo, Freighter`}>
            <span>Network: {network}</span>
            <span className="hidden xs:inline mx-1" aria-hidden="true">•</span>
            <span>Supported: XBull, Albedo, Freighter</span>
          </div>

          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center space-x-2"
            aria-label={isConnecting ? 'Connecting wallet' : 'Connect wallet'}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Connecting...</span>
              </>
            ) : (
              'Connect Wallet'
            )}
          </button>

          {network === 'testnet' && (
            <div className="mt-4 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg" role="note" aria-label="Testnet mode notice">
              <p className="text-xs sm:text-sm text-yellow-800">
                <strong>Testnet Mode:</strong> New accounts will be automatically funded with test XLM.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-start space-x-2 text-red-600 bg-red-50 p-3 sm:p-4 rounded-lg" role="alert" aria-live="assertive">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletConnector;
