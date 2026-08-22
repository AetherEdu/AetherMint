/**
 * Smart Wallet Controller
 * Handles API requests for smart contract wallet operations
 */

import { Request, Response, NextFunction } from 'express';
import { AccountAbstractionService } from '../services/smartWallet/AccountAbstractionService';
import { SocialRecoveryService } from '../services/smartWallet/SocialRecoveryService';
import { MultiSigService } from '../services/smartWallet/MultiSigService';
import { SessionKeyService } from '../services/smartWallet/SessionKeyService';
import { CredentialAutomationService } from '../services/smartWallet/CredentialAutomationService';
import { WalletActivityMonitor } from '../services/smartWallet/WalletActivityMonitor';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';

// Initialize services
const accountAbstractionService = new AccountAbstractionService({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  bundlerUrl:
    process.env.BUNDLER_URL || 'https://bundler.biconomy.io/api/v2/11155111',
  entryPointAddress:
    process.env.ENTRY_POINT_ADDRESS ||
    '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
  walletFactoryAddress: process.env.WALLET_FACTORY_ADDRESS || '',
  paymasterAddress: process.env.PAYMASTER_ADDRESS || ''
});

const socialRecoveryService = new SocialRecoveryService({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  recoveryModuleAddress: process.env.RECOVERY_MODULE_ADDRESS || ''
});

const multiSigService = new MultiSigService({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  multiSigModuleAddress: process.env.MULTISIG_MODULE_ADDRESS || ''
});

const sessionKeyService = new SessionKeyService({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  sessionKeyModuleAddress: process.env.SESSION_KEY_MODULE_ADDRESS || ''
});

const credentialAutomationService = new CredentialAutomationService({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  credentialRegistryAddress: process.env.CREDENTIAL_REGISTRY_ADDRESS || '',
  renewalConfig: {
    enabled: process.env.AUTO_RENEWAL_ENABLED === 'true',
    checkInterval: parseInt(process.env.RENEWAL_CHECK_INTERVAL || '300000'),
    warningThreshold: parseInt(process.env.RENEWAL_WARNING_THRESHOLD || '86400'),
    batchSize: parseInt(process.env.RENEWAL_BATCH_SIZE || '50')
  }
});

const walletActivityMonitor = new WalletActivityMonitor({
  rpcUrl: process.env.ETH_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
  checkInterval: parseInt(process.env.ACTIVITY_CHECK_INTERVAL || '60000')
});

if (process.env.AUTO_RENEWAL_ENABLED === 'true') {
  credentialAutomationService.startMonitoring();
}

export const createSmartWallet = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ownerAddress, guardians, threshold } = req.body;

    const socialRecoveryConfig =
      guardians && threshold
        ? {
            guardians: guardians.map((g: any) => ({
              address: g.address,
              name: g.name,
              addedAt: new Date()
            })),
            threshold
          }
        : undefined;

    const result = await accountAbstractionService.createSmartWallet(
      ownerAddress,
      socialRecoveryConfig
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Smart wallet created successfully'
    });
  } catch (error) {
    logger.error('Create smart wallet error:', error);
    next(error);
  }
};

export const executeTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, to, value, data, signature } = req.body;

    const userOpHash = await accountAbstractionService.executeTransaction(
      walletAddress,
      to,
      BigInt(value),
      data,
      signature
    );

    res.json({
      success: true,
      data: { userOpHash },
      message: 'Transaction submitted successfully'
    });
  } catch (error) {
    logger.error('Execute transaction error:', error);
    next(error);
  }
};

export const executeBatchTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, transactions, signature } = req.body;

    const txs = transactions.map((tx: any) => ({
      to: tx.to,
      value: BigInt(tx.value),
      data: tx.data
    }));

    const userOpHash = await accountAbstractionService.executeBatchTransactions(
      walletAddress,
      txs,
      signature
    );

    res.json({
      success: true,
      data: { userOpHash },
      message: `Batch of ${transactions.length} transactions submitted successfully`
    });
  } catch (error) {
    logger.error('Execute batch transactions error:', error);
    next(error);
  }
};

export const setupSocialRecovery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, guardians, threshold } = req.body;

    const callData = await socialRecoveryService.setupSocialRecovery(
      walletAddress,
      guardians.map((g: any) => ({
        address: g.address,
        name: g.name,
        addedAt: new Date()
      })),
      threshold
    );

    res.json({
      success: true,
      data: { callData },
      message: 'Social recovery setup prepared'
    });
  } catch (error) {
    logger.error('Setup social recovery error:', error);
    next(error);
  }
};

export const initiateRecovery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, newOwner, guardianAddress, guardianSignature } = req.body;

    const result = await socialRecoveryService.initiateRecovery(
      walletAddress,
      newOwner,
      guardianAddress,
      guardianSignature
    );

    res.json({
      success: true,
      data: result,
      message: 'Recovery initiated successfully'
    });
  } catch (error) {
    logger.error('Initiate recovery error:', error);
    next(error);
  }
};

export const supportRecovery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recoveryId, guardianAddress, guardianSignature } = req.body;

    const callData = await socialRecoveryService.supportRecovery(
      recoveryId,
      guardianAddress,
      guardianSignature
    );

    res.json({
      success: true,
      data: { callData },
      message: 'Recovery support added'
    });
  } catch (error) {
    logger.error('Support recovery error:', error);
    next(error);
  }
};

export const getRecoveryRequest = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { recoveryId } = req.params;

    const recoveryRequest = await socialRecoveryService.getRecoveryRequest(
      recoveryId
    );

    if (!recoveryRequest) throw new NotFoundError('Recovery request not found');

    res.json({ success: true, data: recoveryRequest });
  } catch (error) {
    logger.error('Get recovery request error:', error);
    next(error);
  }
};

export const setupMultiSig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, signers, threshold } = req.body;

    const callData = await multiSigService.setupMultiSig(
      walletAddress,
      signers,
      threshold
    );

    res.json({
      success: true,
      data: { callData },
      message: 'Multi-sig setup prepared'
    });
  } catch (error) {
    logger.error('Setup multi-sig error:', error);
    next(error);
  }
};

export const proposeTransaction = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, to, value, data, proposer } = req.body;

    const result = await multiSigService.proposeTransaction(
      walletAddress,
      to,
      BigInt(value),
      data,
      proposer
    );

    res.json({
      success: true,
      data: result,
      message: 'Transaction proposed successfully'
    });
  } catch (error) {
    logger.error('Propose transaction error:', error);
    next(error);
  }
};

export const getPendingTransactions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress } = req.params;

    const transactions = await multiSigService.getPendingTransactions(
      walletAddress
    );

    res.json({ success: true, data: transactions });
  } catch (error) {
    logger.error('Get pending transactions error:', error);
    next(error);
  }
};

export const createSessionKey = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, permissions, validUntil } = req.body;

    const result = await sessionKeyService.createSessionKey(
      walletAddress,
      {
        allowedContracts: permissions.allowedContracts || [],
        allowedMethods: permissions.allowedMethods || [],
        spendingLimit: BigInt(permissions.spendingLimit || 0)
      },
      new Date(validUntil)
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'Session key created successfully'
    });
  } catch (error) {
    logger.error('Create session key error:', error);
    next(error);
  }
};

export const getActiveSessionKeys = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress } = req.params;

    const sessionKeys = await sessionKeyService.getActiveSessionKeys(walletAddress);

    res.json({ success: true, data: sessionKeys });
  } catch (error) {
    logger.error('Get active session keys error:', error);
    next(error);
  }
};

export const getWalletActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const { limit } = req.query;

    const activity = await walletActivityMonitor.getRecentActivity(
      walletAddress,
      limit ? parseInt(limit as string) : 100
    );

    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error('Get wallet activity error:', error);
    next(error);
  }
};

export const getActivityAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress } = req.params;
    const { acknowledged } = req.query;

    const alerts = walletActivityMonitor.getAlerts(
      walletAddress,
      acknowledged !== undefined ? acknowledged === 'true' : undefined
    );

    res.json({ success: true, data: alerts });
  } catch (error) {
    logger.error('Get activity alerts error:', error);
    next(error);
  }
};

export const getCredentialRenewalStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await credentialAutomationService.getRenewalStats();

    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Get credential renewal stats error:', error);
    next(error);
  }
};

export const enableAutoRenewal = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { credentialId, renewalThreshold } = req.body;

    const callData = await credentialAutomationService.enableAutoRenewal(
      credentialId,
      renewalThreshold
    );

    res.json({
      success: true,
      data: { callData },
      message: 'Auto-renewal enabled'
    });
  } catch (error) {
    logger.error('Enable auto-renewal error:', error);
    next(error);
  }
};
