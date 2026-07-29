import React from 'react';
import { useStellarWallet } from '../../context/WalletContext';
import { WalletNetwork } from '@creit.tech/stellar-wallets-kit';
import { Wallet, LogOut, Globe, Shield, RefreshCw } from 'lucide-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export const WalletConnector: React.FC = () => {
  const { 
    address, 
    isConnected, 
    isConnecting, 
    balance, 
    network, 
    connect, 
    disconnect, 
    switchNetwork,
    error 
  } = useStellarWallet();

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <ErrorBoundary variant="wallet" errorTitle="Wallet Error" errorMessage="There was a problem with your wallet connection. Please ensure your wallet is unlocked and try again.">
      <div className="flex flex-col gap-2">
      {error && (
        <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-md border border-red-200 animate-pulse">
          {error}
        </div>
      )}
      
      <div className="flex items-center gap-3">
        {isConnected ? (
          <div className="flex items-center gap-2 bg-white border rounded-full px-4 py-1.5 shadow-sm">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                {network === WalletNetwork.PUBLIC ? 'Mainnet' : 'Testnet'}
              </span>
              <span className="text-xs font-bold text-gray-900">
                {parseFloat(balance).toFixed(2)} XLM
              </span>
            </div>
            <div className="h-8 w-[1px] bg-gray-200 mx-1" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-gray-700">
                {shortenAddress(address!)}
              </span>
              <button 
                onClick={disconnect}
                className="text-[10px] text-red-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <LogOut size={10} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={connect}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-full font-semibold transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Wallet size={18} />
            )}
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        )}      {isConnected && (
        <div className="relative group">
          <button className="p-2 border rounded-full hover:bg-gray-50 transition-colors">
            <Globe size={18} className="text-gray-600" />
          </button>
          <div className="absolute top-full right-0 mt-2 w-48 bg-white border rounded-xl shadow-xl hidden group-hover:block z-50 overflow-hidden">
            <div className="p-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b">
              Select Network
            </div>
            <button
              onClick={() => switchNetwork(WalletNetwork.PUBLIC)}
              className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${
                network === WalletNetwork.PUBLIC ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-700'
              }`}
            >
              Mainnet 
              {network === WalletNetwork.PUBLIC && <Shield size={14} />}
            </button>
            <button
              onClick={() => switchNetwork(WalletNetwork.TESTNET)}
              className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${
                network === WalletNetwork.TESTNET ? 'text-blue-600 font-bold bg-blue-50/50' : 'text-gray-700'
              }`}
            >
              Testnet
              {network === WalletNetwork.TESTNET && <Shield size={14} />}
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
    </ErrorBoundary>
  );
};
