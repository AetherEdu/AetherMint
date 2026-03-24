'use client';

import React, { useState, useEffect } from 'react';
import { PaymentProcessorProps, PaymentDetails, TransactionReceipt } from '@/types/enrollment';
import { stellarService, createEnrollmentMemo, formatStellarBalance } from '@/lib/stellar';
import { WalletsKit, MAINNET, TESTNET } from '@creit.tech/stellar-wallets-kit';
import { 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ExternalLink,
  RefreshCw,
  Loader2
} from 'lucide-react';

const PaymentProcessor: React.FC<PaymentProcessorProps> = ({
  course,
  wallet,
  onPaymentSuccess,
  onPaymentError,
  onPaymentPending
}) => {
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'failed' | 'pending'>('idle');
  const [transactionReceipt, setTransactionReceipt] = useState<TransactionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletsKit, setWalletsKit] = useState<WalletsKit | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<number>(0);
  const [isCheckingBalance, setIsCheckingBalance] = useState(false);
  const [sufficientBalance, setSufficientBalance] = useState<boolean | null>(null);

  useEffect(() => {
    if (wallet) {
      const kit = new WalletsKit({
        network: wallet.network === 'mainnet' ? MAINNET : TESTNET,
        selectedWalletId: 'xbull',
      });
      setWalletsKit(kit);
      checkBalanceAndEstimateFee();
    }
  }, [wallet, course]);

  const checkBalanceAndEstimateFee = async () => {
    if (!wallet || !course) return;

    setIsCheckingBalance(true);
    try {
      // Check balance
      const balance = await stellarService.getAccountBalance(wallet.publicKey);
      const hasEnoughBalance = balance >= course.price;
      setSufficientBalance(hasEnoughBalance);

      // Estimate transaction fee
      const fee = await stellarService.estimateTransactionFee(
        wallet.publicKey,
        'GDUK...RECIPIENT', // This would be the platform's recipient address
        course.price.toString()
      );
      setEstimatedFee(fee);
    } catch (error) {
      console.error('Error checking balance:', error);
      setError('Failed to check account balance');
    } finally {
      setIsCheckingBalance(false);
    }
  };

  const processPayment = async () => {
    if (!wallet || !walletsKit || !course) {
      setError('Wallet not connected or course information missing');
      return;
    }

    if (!sufficientBalance) {
      setError('Insufficient balance to complete this transaction');
      return;
    }

    setPaymentStatus('processing');
    setError(null);
    onPaymentPending();

    try {
      // Generate unique memo for this enrollment
      const studentId = wallet.publicKey.slice(-8); // Last 8 characters as student ID
      const memo = createEnrollmentMemo(course.id, studentId);
      
      // Platform's recipient address (this should come from environment/config)
      const recipientAddress = process.env.NEXT_PUBLIC_STELLAR_RECEIVER_ADDRESS || 
        'GDUKMG4GD6VQY66JWH2D7SRPE2A4F4FJKM3KODD37MPEXGLB5JDO3M2M';

      // Create transaction
      const transactionXDR = await stellarService.createPaymentTransaction(
        wallet.publicKey,
        recipientAddress,
        course.price.toString(),
        memo
      );

      // Sign and submit transaction through wallet
      const signedTransaction = await walletsKit.signTransaction(transactionXDR, {
        networkPassphrase: wallet.network === 'mainnet' ? 'Public Global Stellar Network ; September 2015' : 'Test SDF Network ; September 2015',
      });

      // Submit transaction
      const receipt = await stellarService.submitTransaction(signedTransaction);
      
      setTransactionReceipt(receipt);
      
      if (receipt.status === 'success') {
        setPaymentStatus('success');
        onPaymentSuccess(receipt.transactionHash);
      } else {
        setPaymentStatus('failed');
        onPaymentError('Transaction failed');
      }

    } catch (error: any) {
      console.error('Payment processing error:', error);
      const errorMessage = error.message || 'Payment processing failed';
      setError(errorMessage);
      setPaymentStatus('failed');
      onPaymentError(errorMessage);
    }
  };

  const retryPayment = () => {
    setPaymentStatus('idle');
    setError(null);
    setTransactionReceipt(null);
  };

  const viewTransaction = () => {
    if (transactionReceipt?.transactionHash) {
      const explorerUrl = wallet?.network === 'testnet'
        ? `https://stellar.expert/explorer/testnet/tx/${transactionReceipt.transactionHash}`
        : `https://stellar.expert/explorer/public/tx/${transactionReceipt.transactionHash}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const getStatusIcon = () => {
    switch (paymentStatus) {
      case 'processing':
      case 'pending':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <CreditCard className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    switch (paymentStatus) {
      case 'processing':
        return 'Processing Payment...';
      case 'pending':
        return 'Payment Pending';
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
      default:
        return 'Ready to Pay';
    }
  };

  if (paymentStatus === 'success' && transactionReceipt) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h3>
          <p className="text-sm text-gray-600 mb-4">
            Your enrollment in {course.title} has been confirmed.
          </p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="text-left space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transaction Hash:</span>
                <span className="font-mono text-xs">{transactionReceipt.transactionHash.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid:</span>
                <span className="font-medium">{formatStellarBalance(transactionReceipt.amount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className="text-green-600 font-medium">Confirmed</span>
              </div>
            </div>
          </div>

          <button
            onClick={viewTransaction}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center justify-center space-x-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>View Transaction</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment Details</h3>
            <p className="text-sm text-gray-600">{getStatusText()}</p>
          </div>
        </div>
        {paymentStatus === 'idle' && (
          <button
            onClick={checkBalanceAndEstimateFee}
            disabled={isCheckingBalance}
            className="p-2 text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingBalance ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="space-y-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Course Information</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Course:</span>
              <span className="font-medium">{course.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Instructor:</span>
              <span className="font-medium">{course.instructor}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Duration:</span>
              <span className="font-medium">{course.duration}</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Payment Breakdown</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Course Price:</span>
              <span className="font-medium">{formatStellarBalance(course.price)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Network Fee:</span>
              <span className="font-medium">{formatStellarBalance(estimatedFee / 10000000)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-medium">
              <span>Total:</span>
              <span>{formatStellarBalance(course.price + (estimatedFee / 10000000))}</span>
            </div>
          </div>
        </div>

        {wallet && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Wallet Information</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Connected Wallet:</span>
                <span className="font-medium">{wallet.walletType}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Network:</span>
                <span className="font-medium capitalize">{wallet.network}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Available Balance:</span>
                <span className={`font-medium ${sufficientBalance === false ? 'text-red-600' : 'text-green-600'}`}>
                  {formatStellarBalance(wallet.balance || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {sufficientBalance === false && (
        <div className="mb-4 flex items-center space-x-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">
            Insufficient balance. Please add at least {formatStellarBalance(course.price - (wallet?.balance || 0))} to your wallet.
          </span>
        </div>
      )}

      <div className="flex space-x-3">
        {paymentStatus === 'failed' && (
          <button
            onClick={retryPayment}
            className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        )}
        
        <button
          onClick={processPayment}
          disabled={
            paymentStatus === 'processing' || 
            paymentStatus === 'pending' ||
            !wallet ||
            sufficientBalance === false ||
            isCheckingBalance
          }
          className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
        >
          {paymentStatus === 'processing' || paymentStatus === 'pending' ? (
            <span className="flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </span>
          ) : (
            `Pay ${formatStellarBalance(course.price)}`
          )}
        </button>
      </div>
    </div>
  );
};

export default PaymentProcessor;
