const StellarSdk = require('@stellar/stellar-sdk');
const logger = require('./logger');

class StellarUtils {
  constructor() {
    this.server = null;
    this.network = process.env.STELLAR_NETWORK || 'testnet';
    this.horizonUrl = this.getHorizonUrl();
    this.fee = process.env.STELLAR_FEE || '100'; // 0.01 XLM in stroops
    this.timeout = process.env.STELLAR_TIMEOUT || 30000; // 30 seconds
    this.maxRetries = process.env.STELLAR_MAX_RETRIES || 3;
    
    this.initializeServer();
  }

  getHorizonUrl() {
    switch (this.network) {
      case 'mainnet':
        return 'https://horizon.stellar.org';
      case 'testnet':
        return 'https://horizon-testnet.stellar.org';
      case 'futurenet':
        return 'https://horizon-futurenet.stellar.org';
      default:
        return 'https://horizon-testnet.stellar.org';
    }
  }

  initializeServer() {
    try {
      this.server = new StellarSdk.Horizon.Server(this.horizonUrl, {
        allowHttp: this.network === 'testnet' || this.network === 'futurenet'
      });
      logger.info(`Stellar server initialized for ${this.network} network`);
    } catch (error) {
      logger.error('Failed to initialize Stellar server:', error);
      throw error;
    }
  }

  /**
   * Create a new Stellar keypair
   */
  createKeypair() {
    try {
      const keypair = StellarSdk.Keypair.random();
      return {
        publicKey: keypair.publicKey(),
        secretKey: keypair.secret(),
        keypair
      };
    } catch (error) {
      logger.error('Error creating keypair:', error);
      throw error;
    }
  }

  /**
   * Validate Stellar address
   */
  validateAddress(address) {
    try {
      StellarSdk.StrKey.decodeEd25519PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate Stellar secret
   */
  validateSecret(secret) {
    try {
      StellarSdk.StrKey.decodeEd25519SecretSeed(secret);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get account information
   */
  async getAccount(accountId) {
    try {
      const account = await this.server.loadAccount(accountId);
      return {
        accountId: account.accountId(),
        sequence: account.sequenceNumber(),
        balances: account.balances(),
        subentryCount: account.subentryCount(),
        lastModifiedLedger: account.lastModifiedLedger(),
        thresholds: account.thresholds(),
        signers: account.signers()
      };
    } catch (error) {
      logger.error(`Error loading account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Check if account exists
   */
  async accountExists(accountId) {
    try {
      await this.server.loadAccount(accountId);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Create and fund a new account
   */
  async createAccount(sourceSecret, newAccountId, startingBalance = '5') {
    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: this.fee,
        networkPassphrase: StellarSdk.Networks[this.network.toUpperCase()]
      })
        .addOperation(StellarSdk.Operation.createAccount({
          destination: newAccountId,
          startingBalance
        }))
        .setTimeout(this.timeout)
        .build();

      transaction.sign(sourceKeypair);

      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations
      };

    } catch (error) {
      logger.error('Error creating account:', error);
      return {
        success: false,
        error: error.message,
        resultCodes: error.response && error.response.data ? error.response.data.resultCodes : null
      };
    }
  }

  /**
   * Send payment
   */
  async sendPayment(sourceSecret, destinationId, amount, asset = null) {
    try {
      const sourceKeypair = StellarSdk.Keypair.fromSecret(sourceSecret);
      const sourceAccount = await this.server.loadAccount(sourceKeypair.publicKey());

      let paymentAsset;
      if (asset && asset.code !== 'XLM') {
        paymentAsset = new StellarSdk.Asset(asset.code, asset.issuer);
      } else {
        paymentAsset = StellarSdk.Asset.native();
      }

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: this.fee,
        networkPassphrase: StellarSdk.Networks[this.network.toUpperCase()]
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: destinationId,
          asset: paymentAsset,
          amount
        }))
        .setTimeout(this.timeout)
        .build();

      transaction.sign(sourceKeypair);

      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations
      };

    } catch (error) {
      logger.error('Error sending payment:', error);
      return {
        success: false,
        error: error.message,
        resultCodes: error.response && error.response.data ? error.response.data.resultCodes : null
      };
    }
  }

  /**
   * Create trustline
   */
  async createTrustline(accountSecret, asset) {
    try {
      const accountKeypair = StellarSdk.Keypair.fromSecret(accountSecret);
      const account = await this.server.loadAccount(accountKeypair.publicKey());

      const trustlineAsset = new StellarSdk.Asset(asset.code, asset.issuer);

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: this.fee,
        networkPassphrase: StellarSdk.Networks[this.network.toUpperCase()]
      })
        .addOperation(StellarSdk.Operation.changeTrust({
          asset: trustlineAsset,
          limit: asset.limit || '9223372036854775807' // Max int64
        }))
        .setTimeout(this.timeout)
        .build();

      transaction.sign(accountKeypair);

      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations
      };

    } catch (error) {
      logger.error('Error creating trustline:', error);
      return {
        success: false,
        error: error.message,
        resultCodes: error.response && error.response.data ? error.response.data.resultCodes : null
      };
    }
  }

  /**
   * Set options on account
   */
  async setAccountOptions(accountSecret, options = {}) {
    try {
      const accountKeypair = StellarSdk.Keypair.fromSecret(accountSecret);
      const account = await this.server.loadAccount(accountKeypair.publicKey());

      const builder = new StellarSdk.TransactionBuilder(account, {
        fee: this.fee,
        networkPassphrase: StellarSdk.Networks[this.network.toUpperCase()]
      });

      if (options.inflationDestination) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          inflationDestination: options.inflationDestination
        }));
      }

      if (options.clearFlags) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          clearFlags: options.clearFlags
        }));
      }

      if (options.setFlags) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          setFlags: options.setFlags
        }));
      }

      if (options.masterWeight !== undefined) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          masterWeight: options.masterWeight
        }));
      }

      if (options.lowThreshold !== undefined) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          lowThreshold: options.lowThreshold
        }));
      }

      if (options.mediumThreshold !== undefined) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          mediumThreshold: options.mediumThreshold
        }));
      }

      if (options.highThreshold !== undefined) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          highThreshold: options.highThreshold
        }));
      }

      if (options.signer) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          signer: options.signer
        }));
      }

      if (options.homeDomain) {
        builder.addOperation(StellarSdk.Operation.setOptions({
          homeDomain: options.homeDomain
        }));
      }

      const transaction = builder.setTimeout(this.timeout).build();
      transaction.sign(accountKeypair);

      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations
      };

    } catch (error) {
      logger.error('Error setting account options:', error);
      return {
        success: false,
        error: error.message,
        resultCodes: error.response && error.response.data ? error.response.data.resultCodes : null
      };
    }
  }

  /**
   * Build transaction from XDR
   */
  buildTransactionFromXDR(xdr, sourceAccountId) {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(xdr, this.horizonUrl);
      return transaction;
    } catch (error) {
      logger.error('Error building transaction from XDR:', error);
      throw error;
    }
  }

  /**
   * Sign transaction
   */
  signTransaction(transactionXdr, secretKey) {
    try {
      const keypair = StellarSdk.Keypair.fromSecret(secretKey);
      const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXdr, this.horizonUrl);
      transaction.sign(keypair);
      return transaction.toXDR();
    } catch (error) {
      logger.error('Error signing transaction:', error);
      throw error;
    }
  }

  /**
   * Submit transaction to network
   */
  async submitTransaction(signedTransactionXdr) {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(signedTransactionXdr, this.horizonUrl);
      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations,
        successful: result.successful,
        processing: result.processing
      };

    } catch (error) {
      logger.error('Error submitting transaction:', error);
      return {
        success: false,
        error: error.message,
        resultCodes: error.response && error.response.data ? error.response.data.resultCodes : null
      };
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionHash) {
    try {
      const transaction = await this.server.transactions().transaction(transactionHash);
      
      return {
        hash: transaction.hash,
        ledger: transaction.ledger,
        createdAt: transaction.created_at,
        successful: transaction.successful,
        sourceAccount: transaction.source_account,
        operations: transaction.operations,
        memo: transaction.memo,
        feeCharged: transaction.fee_charged,
        feeMeta: transaction.fee_meta
      };

    } catch (error) {
      if (error.response && error.response.status === 404) {
        return {
          hash: transactionHash,
          status: 'not_found'
        };
      }
      throw error;
    }
  }

  /**
   * Wait for transaction confirmation
   */
  async waitForTransactionConfirmation(transactionHash, timeoutMs = 60000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const status = await this.getTransactionStatus(transactionHash);
        
        if (status.successful !== undefined) {
          return {
            success: status.successful,
            ledger: status.ledger,
            operations: status.operations
          };
        }

        // Wait 2 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        logger.error(`Error checking transaction ${transactionHash}:`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    throw new Error(`Transaction ${transactionHash} confirmation timeout after ${timeoutMs}ms`);
  }

  /**
   * Get account balances
   */
  async getAccountBalances(accountId) {
    try {
      const account = await this.server.loadAccount(accountId);
      return account.balances().map(balance => ({
        assetType: balance.asset_type,
        assetCode: balance.asset_code,
        assetIssuer: balance.asset_issuer,
        balance: balance.balance,
        limit: balance.limit,
        buyingLiabilities: balance.buying_liabilities,
        sellingLiabilities: balance.selling_liabilities,
        isAuthorized: balance.is_authorized
      }));
    } catch (error) {
      logger.error(`Error getting balances for account ${accountId}:`, error);
      throw error;
    }
  }

  /**
   * Get network fee stats
   */
  async getFeeStats() {
    try {
      const feeStats = await this.server.feeStats();
      return {
        lastLedger: feeStats.last_ledger,
        lastLedgerBaseFee: feeStats.last_ledger_base_fee,
        ledgerCapacityUsage: feeStats.ledger_capacity_usage,
        minAcceptedFee: feeStats.min_accepted_fee,
        modeAcceptedFee: feeStats.mode_accepted_fee,
        p10AcceptedFee: feeStats.p10_accepted_fee,
        p20AcceptedFee: feeStats.p20_accepted_fee,
        p30AcceptedFee: feeStats.p30_accepted_fee,
        p40AcceptedFee: feeStats.p40_accepted_fee,
        p50AcceptedFee: feeStats.p50_accepted_fee,
        p60AcceptedFee: feeStats.p60_accepted_fee,
        p70AcceptedFee: feeStats.p70_accepted_fee,
        p80AcceptedFee: feeStats.p80_accepted_fee,
        p90AcceptedFee: feeStats.p90_accepted_fee,
        p95AcceptedFee: feeStats.p95_accepted_fee,
        p99AcceptedFee: feeStats.p99_accepted_fee
      };
    } catch (error) {
      logger.error('Error getting fee stats:', error);
      throw error;
    }
  }

  /**
   * Estimate smart fee
   */
  async estimateSmartFee(priority = 'medium') {
    try {
      const feeStats = await this.getFeeStats();
      
      switch (priority) {
        case 'low':
          return feeStats.minAcceptedFee || this.fee;
        case 'medium':
          return feeStats.modeAcceptedFee || this.fee;
        case 'high':
          return feeStats.p90AcceptedFee || this.fee;
        default:
          return this.fee;
      }
    } catch (error) {
      logger.error('Error estimating smart fee:', error);
      return this.fee;
    }
  }

  /**
   * Create multi-signature transaction
   */
  async createMultiSigTransaction(sourceAccountId, operations, requiredSignatures = 2) {
    try {
      const sourceAccount = await this.server.loadAccount(sourceAccountId);
      
      const builder = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: this.fee,
        networkPassphrase: StellarSdk.Networks[this.network.toUpperCase()]
      });

      operations.forEach(operation => {
        builder.addOperation(operation);
      });

      const transaction = builder.setTimeout(this.timeout).build();
      return transaction.toXDR();

    } catch (error) {
      logger.error('Error creating multi-sig transaction:', error);
      throw error;
    }
  }

  /**
   * Parse transaction XDR
   */
  parseTransactionXDR(transactionXdr) {
    try {
      const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXdr, this.horizonUrl);
      
      return {
        sourceAccount: transaction.source,
        sequence: transaction.sequence,
        fee: transaction.fee,
        operations: transaction.operations.map(op => ({
          type: op.type,
          source: op.source
        })),
        memo: transaction.memo,
        timeBounds: transaction.timeBounds
      };

    } catch (error) {
      logger.error('Error parsing transaction XDR:', error);
      throw error;
    }
  }
}

// Create singleton instance
const stellarUtils = new StellarUtils();

module.exports = stellarUtils;
