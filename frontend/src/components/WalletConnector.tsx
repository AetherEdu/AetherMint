'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { WalletsKit, MAINNET, TESTNET } from '@creit.tech/stellar-wallets-kit';
import { WalletInfo } from '@/types/enrollment';
import { stellarService, isValidStellarAddress, formatStellarBalance } from '@/lib/stellar';
import { Wallet, AlertCircle, CheckCircle, Copy, ExternalLink } from 'lucide-react';

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
      setError(error.message || 'Failed to connect wallet');
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
      setError(error.message || 'Failed to disconnect wallet');
    }
  };

  const copyAddress = async () => {
    if (connectedWallet?.publicKey) {
      try {
        await navigator.clipboard.writeText(connectedWallet.publicKey);
        // You could add a toast notification here
      } catch (error) {
        console.error('Failed to copy address:', error);
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
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-gray-900">Wallet Connected</span>
          </div>
          <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
            {network}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Wallet Type</label>
            <p className="text-sm font-medium text-gray-900 capitalize">
              {connectedWallet.walletType}
            </p>
          </div>

          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wider">Balance</label>
            <div className="flex items-center justify-between">
              <p className="text-lg font-semibold text-gray-900">
                {formatStellarBalance(balance)}
              </p>
              <button
                onClick={refreshBalance}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Address</label>
              <button
                onClick={() => setShowAddress(!showAddress)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showAddress ? 'Hide' : 'Show'}
              </button>
            </div>
            {showAddress && (
              <div className="flex items-center space-x-2">
                <p className="text-xs font-mono bg-gray-100 p-2 rounded flex-1 break-all">
                  {connectedWallet.publicKey}
                </p>
                <button
                  onClick={copyAddress}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={viewOnStellarExplorer}
                  className="p-1 text-gray-500 hover:text-gray-700"
                  title="View on Stellar Explorer"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        <button
          onClick={disconnectWallet}
          className="mt-4 w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
        >
          Disconnect Wallet
        </button>

        {error && (
          <div className="mt-3 flex items-center space-x-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs">{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="text-center">
        <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Wallet</h3>
        <p className="text-sm text-gray-600 mb-6">
          Connect your Stellar wallet to enroll in courses and make payments
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
            <span>Network: {network}</span>
            <span>•</span>
            <span>Supported: XBull, Albedo, Freighter</span>
          </div>

          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>

          {network === 'testnet' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Testnet Mode:</strong> New accounts will be automatically funded with test XLM.
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletConnector;
