const { Server, Networks, TransactionBuilder, Operation, Asset, Memo, MemoText } = require('@stellar/stellar-sdk');
const { Contract } = require('soroban-client');
const axios = require('axios');

class StellarService {
  constructor() {
    this.network = process.env.STELLAR_NETWORK === 'mainnet' 
      ? Networks.PUBLIC 
      : Networks.TESTNET;
    
    this.horizonUrl = process.env.STELLAR_NETWORK === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';
    
    this.server = new Server(this.horizonUrl);
    
    // Gas optimization configuration
    this.gasConfig = {
      baseFee: parseInt(process.env.STELLAR_BASE_FEE) || 100,
      maxFee: parseInt(process.env.STELLAR_MAX_FEE) || 1000,
      congestionThreshold: 0.8, // 80% network utilization
      priorityMultiplier: 1.5,
      batchDiscount: 0.9, // 10% discount for batch operations
    };

    // Network monitoring
    this.networkStats = {
      lastUpdate: null,
      feeStats: null,
      ledgerCount: 0,
      operationCount: 0,
      congestionLevel: 0,
    };

    // Credential expiration monitoring
    this.credentialRegistry = {
      contractId: process.env.CREDENTIAL_REGISTRY_CONTRACT_ID,
      sorobanRpc: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org:443',
    };

    // Expiration monitoring configuration
    this.expirationConfig = {
      checkInterval: parseInt(process.env.CREDENTIAL_EXPIRATION_CHECK_INTERVAL) || 300000, // 5 minutes
      warningThreshold: parseInt(process.env.CREDENTIAL_EXPIRATION_WARNING_THRESHOLD) || 86400, // 24 hours
      batchSize: parseInt(process.env.CREDENTIAL_EXPIRATION_BATCH_SIZE) || 50,
      autoRenewalEnabled: process.env.AUTO_RENEWAL_ENABLED === 'true',
      notificationEnabled: process.env.EXPIRATION_NOTIFICATIONS_ENABLED === 'true',
    };

    // Start expiration monitoring if enabled
    if (process.env.CREDENTIAL_EXPIRATION_MONITORING_ENABLED === 'true') {
      this.startExpirationMonitoring();
    }
  }

  async getNetworkStatus() {
    try {
      const [feeStats, latestLedger] = await Promise.all([
        this.server.feeStats(),
        this.server.ledgers().order('desc').limit(1).call(),
      ]);

      this.networkStats = {
        lastUpdate: new Date(),
        feeStats: {
          min: feeStats.min_accepted_fee,
          max: feeStats.max_accepted_fee,
          mode: feeStats.fee_charged.mode,
          p10: feeStats.fee_charged.p10,
          p20: feeStats.fee_charged.p20,
          p50: feeStats.fee_charged.p50,
          p70: feeStats.fee_charged.p70,
          p80: feeStats.fee_charged.p80,
          p90: feeStats.fee_charged.p90,
          p95: feeStats.fee_charged.p95,
          p99: feeStats.fee_charged.p99,
        },
        ledgerCount: latestLedger.records[0]?.sequence || 0,
        operationCount: latestLedger.records[0]?.operation_count || 0,
        congestionLevel: this.calculateCongestionLevel(feeStats),
      };

      return this.networkStats;

    } catch (error) {
      console.error('Failed to get network status:', error);
      throw new Error('Unable to fetch Stellar network status');
    }
  }

  calculateCongestionLevel(feeStats) {
    // Calculate congestion based on fee distribution
    const { min, max, mode } = feeStats;
    
    if (min === 0 && max === 0) return 0;
    
    const feeRange = max - min;
    const modePosition = (mode - min) / feeRange;
    
    // Higher congestion when mode fee is closer to max fee
    return Math.min(modePosition * 2, 1); // Scale to 0-1 range
  }

  async optimizeGasFees({ type, payload, networkStatus = null }) {
    try {
      // Get current network status if not provided
      const status = networkStatus || await this.getNetworkStatus();
      
      let baseFee = this.gasConfig.baseFee;
      let optimization = {
        strategy: 'standard',
        estimatedFee: baseFee,
        savings: 0,
        confidence: 0.95,
      };

      // Adjust based on network congestion
      if (status.congestionLevel > this.gasConfig.congestionThreshold) {
        baseFee = Math.ceil(status.feeStats.p70 * this.gasConfig.priorityMultiplier);
        optimization.strategy = 'priority';
        optimization.confidence = 0.99;
      } else if (status.congestionLevel < 0.3) {
        baseFee = Math.ceil(status.feeStats.p50 * 0.8);
        optimization.strategy = 'economy';
        optimization.confidence = 0.85;
      }

      // Transaction-specific optimizations
      switch (type) {
        case 'credential_issuance':
          optimization = await this.optimizeCredentialIssuance(baseFee, payload, status);
          break;
        case 'course_payment':
          optimization = await this.optimizeCoursePayment(baseFee, payload, status);
          break;
        case 'smart_contract_interaction':
          optimization = await this.optimizeSmartContractInteraction(baseFee, payload, status);
          break;
        case 'profile_update':
          optimization = await this.optimizeProfileUpdate(baseFee, payload, status);
          break;
        default:
          optimization.estimatedFee = baseFee;
      }

      // Apply batch discount if applicable
      if (payload.batchSize && payload.batchSize > 1) {
        optimization.estimatedFee = Math.ceil(optimization.estimatedFee * this.gasConfig.batchDiscount);
        optimization.savings += Math.ceil(baseFee * (1 - this.gasConfig.batchDiscount));
        optimization.strategy += '_batch';
      }

      // Ensure fee doesn't exceed maximum
      optimization.estimatedFee = Math.min(optimization.estimatedFee, this.gasConfig.maxFee);

      return optimization;

    } catch (error) {
      console.error('Gas optimization failed:', error);
      // Fallback to standard fee
      return {
        strategy: 'fallback',
        estimatedFee: this.gasConfig.baseFee,
        savings: 0,
        confidence: 0.5,
      };
    }
  }

  async optimizeCredentialIssuance(baseFee, payload, networkStatus) {
    // Credential issuance is typically time-sensitive but not urgent
    const optimization = {
      strategy: 'standard',
      estimatedFee: baseFee,
      savings: 0,
      confidence: 0.90,
    };

    // Check if we can use memo to reduce operations
    if (payload.memoText) {
      optimization.estimatedFee = Math.ceil(baseFee * 0.95); // 5% savings with memo
      optimization.savings = Math.ceil(baseFee * 0.05);
      optimization.strategy = 'memo_optimized';
    }

    // Check for batch credential issuance
    if (payload.recipients && payload.recipients.length > 1) {
      const batchFee = baseFee * payload.recipients.length;
      const optimizedBatchFee = Math.ceil(batchFee * 0.85); // 15% batch discount
      optimization.estimatedFee = optimizedBatchFee;
      optimization.savings = batchFee - optimizedBatchFee;
      optimization.strategy = 'batch_issuance';
    }

    return optimization;
  }

  async optimizeCoursePayment(baseFee, payload, networkStatus) {
    // Course payments are time-sensitive
    const optimization = {
      strategy: 'priority',
      estimatedFee: Math.ceil(baseFee * 1.2), // 20% higher for priority
      savings: 0,
      confidence: 0.95,
    };

    // Check if payment can be combined with other operations
    if (payload.combineOperations) {
      optimization.estimatedFee = Math.ceil(baseFee * 1.1); // Only 10% increase
      optimization.savings = Math.ceil(baseFee * 0.1);
      optimization.strategy = 'combined_payment';
    }

    // Check for recurring payment optimization
    if (payload.isRecurring) {
      optimization.estimatedFee = Math.ceil(baseFee * 0.9); // 10% discount
      optimization.savings = Math.ceil(baseFee * 0.1);
      optimization.strategy = 'recurring_payment';
    }

    return optimization;
  }

  async optimizeSmartContractInteraction(baseFee, payload, networkStatus) {
    // Smart contract interactions depend on complexity
    const optimization = {
      strategy: 'standard',
      estimatedFee: baseFee,
      savings: 0,
      confidence: 0.85,
    };

    // Estimate operations based on contract method
    const operationCount = this.estimateContractOperations(payload.method, payload.args);
    optimization.estimatedFee = baseFee * operationCount;

    // Check if we can batch multiple contract calls
    if (payload.batchCalls && payload.batchCalls.length > 1) {
      const totalOps = payload.batchCalls.reduce((sum, call) => 
        sum + this.estimateContractOperations(call.method, call.args), 0);
      
      const batchFee = baseFee * totalOps;
      const optimizedBatchFee = Math.ceil(batchFee * 0.8); // 20% batch discount
      optimization.estimatedFee = optimizedBatchFee;
      optimization.savings = batchFee - optimizedBatchFee;
      optimization.strategy = 'batch_contract_calls';
    }

    return optimization;
  }

  async optimizeProfileUpdate(baseFee, payload, networkStatus) {
    // Profile updates are not time-sensitive
    const optimization = {
      strategy: 'economy',
      estimatedFee: Math.ceil(baseFee * 0.8), // 20% lower fee
      savings: Math.ceil(baseFee * 0.2),
      confidence: 0.85,
    };

    // Check if multiple fields can be updated in one transaction
    if (payload.updatedFields && Object.keys(payload.updatedFields).length > 1) {
      optimization.estimatedFee = Math.ceil(baseFee * 0.7); // 30% discount
      optimization.savings = Math.ceil(baseFee * 0.3);
      optimization.strategy = 'bulk_update';
    }

    return optimization;
  }

  estimateContractOperations(method, args) {
    // Rough estimation of operation count based on common patterns
    const operationMap = {
      'create_account': 2,
      'payment': 1,
      'set_options': 1,
      'manage_data': 1,
      'manage_offer': 2,
      'create_passive_offer': 2,
      'set_trust_line': 1,
      'allow_trust': 1,
      'account_merge': 1,
      'inflation': 1,
      'bump_sequence': 1,
    };

    return operationMap[method] || 1;
  }

  async submitTransaction({ type, payload, userId }) {
    try {
      // Get user's account
      const userAccount = await this.server.loadAccount(payload.sourceAccount);
      
      // Build transaction based on type
      let transaction;
      
      switch (type) {
        case 'credential_issuance':
          transaction = await this.buildCredentialIssuanceTransaction(userAccount, payload);
          break;
        case 'course_payment':
          transaction = await this.buildCoursePaymentTransaction(userAccount, payload);
          break;
        case 'smart_contract_interaction':
          transaction = await this.buildSmartContractTransaction(userAccount, payload);
          break;
        case 'profile_update':
          transaction = await this.buildProfileUpdateTransaction(userAccount, payload);
          break;
        default:
          throw new Error(`Unknown transaction type: ${type}`);
      }

      // Sign transaction
      if (payload.secretKey) {
        transaction.sign(payload.secretKey);
      } else if (payload.signatures) {
        payload.signatures.forEach(sig => transaction.addSignature(sig.publicKey, sig.signature));
      }

      // Submit to network
      const result = await this.server.submitTransaction(transaction);

      return {
        hash: result.hash,
        ledger: result.ledger,
        operations: result.operations?.length || 0,
        gasUsed: this.calculateGasUsed(result),
        fee: transaction.fee,
        successful: result.successful,
      };

    } catch (error) {
      console.error('Transaction submission failed:', error);
      
      // Parse Stellar error
      if (error.response && error.response.data) {
        const stellarError = error.response.data;
        throw new Error(`Stellar transaction failed: ${stellarError.title} - ${stellarError.detail}`);
      }
      
      throw error;
    }
  }

  async buildCredentialIssuanceTransaction(account, payload) {
    const builder = new TransactionBuilder(account, {
      fee: payload.gasOptimization.estimatedFee.toString(),
      networkPassphrase: this.network,
    });

    // Add memo for credential reference
    if (payload.memoText) {
      builder.addMemo(Memo.text(payload.memoText));
    }

    // Create payment operations for credential issuance
    if (payload.recipients) {
      if (Array.isArray(payload.recipients)) {
        // Batch credential issuance
        payload.recipients.forEach(recipient => {
          builder.addOperation(Operation.payment({
            destination: recipient.address,
            asset: Asset.native(),
            amount: recipient.amount || '0', // Credential issuance might be free
          }));
        });
      } else {
        // Single recipient
        builder.addOperation(Operation.payment({
          destination: payload.recipients.address,
          asset: Asset.native(),
          amount: payload.recipients.amount || '0',
        }));
      }
    }

    // Add manage data operation for credential metadata
    if (payload.credentialData) {
      Object.entries(payload.credentialData).forEach(([key, value]) => {
        builder.addOperation(Operation.manageData({
          name: `cred_${key}`,
          value: Buffer.from(JSON.stringify(value)).toString('base64'),
        }));
      });
    }

    return builder.setTimeout(180).build(); // 3 minute timeout
  }

  async buildCoursePaymentTransaction(account, payload) {
    const builder = new TransactionBuilder(account, {
      fee: payload.gasOptimization.estimatedFee.toString(),
      networkPassphrase: this.network,
    });

    // Add memo for payment reference
    if (payload.memoText) {
      builder.addMemo(Memo.text(payload.memoText));
    }

    // Payment operation
    builder.addOperation(Operation.payment({
      destination: payload.merchantAccount,
      asset: payload.asset || Asset.native(),
      amount: payload.amount,
    }));

    // Add course enrollment data
    if (payload.courseData) {
      builder.addOperation(Operation.manageData({
        name: 'course_enrollment',
        value: Buffer.from(JSON.stringify({
          courseId: payload.courseData.courseId,
          userId: payload.courseData.userId,
          timestamp: new Date().toISOString(),
        })).toString('base64'),
      }));
    }

    return builder.setTimeout(120).build(); // 2 minute timeout
  }

  async buildSmartContractTransaction(account, payload) {
    const builder = new TransactionBuilder(account, {
      fee: payload.gasOptimization.estimatedFee.toString(),
      networkPassphrase: this.network,
    });

    // Add memo for contract interaction
    if (payload.memoText) {
      builder.addMemo(Memo.text(payload.memoText));
    }

    // Handle different contract interaction types
    if (payload.contractType === 'soroban') {
      // Soroban smart contract interaction
      builder.addOperation(Operation.invokeContractFunction({
        contract: payload.contractId,
        function: payload.method,
        args: payload.args || [],
      }));
    } else {
      // Traditional Stellar contract (using manage_data for state)
      if (payload.method === 'set_data') {
        builder.addOperation(Operation.manageData({
          name: payload.dataKey,
          value: Buffer.from(JSON.stringify(payload.dataValue)).toString('base64'),
        }));
      } else if (payload.method === 'create_account') {
        builder.addOperation(Operation.createAccount({
          destination: payload.destination,
          startingBalance: payload.startingBalance,
        }));
      }
    }

    return builder.setTimeout(180).build();
  }

  async buildProfileUpdateTransaction(account, payload) {
    const builder = new TransactionBuilder(account, {
      fee: payload.gasOptimization.estimatedFee.toString(),
      networkPassphrase: this.network,
    });

    // Update profile data
    if (payload.updatedFields) {
      Object.entries(payload.updatedFields).forEach(([key, value]) => {
        const dataKey = `profile_${key}`;
        const dataValue = Buffer.from(JSON.stringify({
          value,
          timestamp: new Date().toISOString(),
          userId: payload.userId,
        })).toString('base64');

        builder.addOperation(Operation.manageData({
          name: dataKey,
          value: dataValue,
        }));
      });
    }

    // Update account options if needed
    if (payload.accountOptions) {
      builder.addOperation(Operation.setOptions(payload.accountOptions));
    }

    return builder.setTimeout(300).build(); // 5 minute timeout
  }

  calculateGasUsed(result) {
    // Estimate gas usage based on transaction result
    if (!result.operations) return 0;
    
    // Base gas per operation
    const baseGasPerOp = 1000;
    const additionalGas = result.operations.reduce((total, op) => {
      switch (op.type) {
        case 'payment':
          return total + 500;
        case 'manage_data':
          return total + (op.value ? op.value.length * 10 : 200);
        case 'set_options':
          return total + 300;
        case 'invoke_contract_function':
          return total + 2000; // Contract operations are more expensive
        default:
          return total + 200;
      }
    }, 0);

    return baseGasPerOp * result.operations.length + additionalGas;
  }

  async getGasOptimizationInfo() {
    try {
      const networkStatus = await this.getNetworkStatus();
      
      return {
        currentNetworkStats: networkStatus,
        optimizationStrategies: {
          economy: {
            description: 'Lowest fee, lower priority',
            confidence: 0.85,
            estimatedSavings: '20-30%',
          },
          standard: {
            description: 'Balanced fee and priority',
            confidence: 0.95,
            estimatedSavings: '5-15%',
          },
          priority: {
            description: 'Higher fee, faster processing',
            confidence: 0.99,
            estimatedSavings: '0-5%',
          },
        },
        recommendations: {
          currentCongestion: networkStatus.congestionLevel,
          suggestedStrategy: networkStatus.congestionLevel > 0.8 ? 'priority' : 
                           networkStatus.congestionLevel < 0.3 ? 'economy' : 'standard',
          batchDiscount: '10%',
          memoOptimization: '5%',
        },
      };

    } catch (error) {
      console.error('Failed to get gas optimization info:', error);
      throw error;
    }
  }

  async monitorTransaction(hash) {
    try {
      const transaction = await this.server.transactions()
        .transaction(hash)
        .call();

      return {
        hash: transaction.hash,
        ledger: transaction.ledger,
        createdAt: transaction.created_at,
        successful: transaction.successful,
        feePaid: transaction.fee_charged,
        operationCount: transaction.operation_count,
        memo: transaction.memo,
        signatures: transaction.signatures,
      };

    } catch (error) {
      console.error(`Failed to monitor transaction ${hash}:`, error);
      throw error;
    }
  }

  async getAccountTransactions(accountAddress, limit = 10) {
    try {
      const transactions = await this.server.transactions()
        .forAccount(accountAddress)
        .order('desc')
        .limit(limit)
        .call();

      return transactions.records.map(tx => ({
        hash: tx.hash,
        type: this.getTransactionType(tx),
        amount: this.getTransactionAmount(tx),
        timestamp: tx.created_at,
        successful: tx.successful,
        fee: tx.fee_charged,
        memo: tx.memo,
      }));

    } catch (error) {
      console.error('Failed to get account transactions:', error);
      throw error;
    }
  }

  getTransactionType(transaction) {
    if (!transaction.operations || transaction.operations.length === 0) {
      return 'unknown';
    }

    const firstOp = transaction.operations[0].type;
    
    // Map operation types to user-friendly names
    const typeMap = {
      'payment': 'payment',
      'create_account': 'account_creation',
      'manage_data': 'data_update',
      'set_options': 'options_update',
      'invoke_contract_function': 'contract_call',
    };

    return typeMap[firstOp] || 'other';
  }

  getTransactionAmount(transaction) {
    if (!transaction.operations || transaction.operations.length === 0) {
      return null;
    }

    const paymentOp = transaction.operations.find(op => op.type === 'payment');
    if (paymentOp) {
      return {
        amount: paymentOp.amount,
        asset: paymentOp.asset_code || 'XLM',
        destination: paymentOp.to,
      };
    }

    return null;
  }

  // ===== Credential Expiration Monitoring =====

  /**
   * Start automated credential expiration monitoring
   */
  startExpirationMonitoring() {
    console.log('🔔 Starting credential expiration monitoring...');
    
    setInterval(async () => {
      try {
        await this.checkCredentialExpirations();
      } catch (error) {
        console.error('❌ Error during credential expiration check:', error);
      }
    }, this.expirationConfig.checkInterval);

    // Run initial check
    this.checkCredentialExpirations().catch(console.error);
  }

  /**
   * Check for expiring credentials and handle notifications/renewals
   */
  async checkCredentialExpirations() {
    try {
      console.log('🔍 Checking credential expirations...');
      
      // Get credentials expiring soon
      const expiringSoon = await this.getCredentialsExpiringSoon(this.expirationConfig.warningThreshold);
      
      if (expiringSoon.length > 0) {
        console.log(`⏰ Found ${expiringSoon.length} credentials expiring soon`);
        
        // Process each expiring credential
        for (const credential of expiringSoon) {
          await this.processExpiringCredential(credential);
        }
      }

      // Check for already expired credentials
      const expired = await this.getExpiredCredentials();
      if (expired.length > 0) {
        console.log(`⚠️ Found ${expired.length} expired credentials`);
        
        // Process expired credentials
        for (const credential of expired) {
          await this.processExpiredCredential(credential);
        }
      }

      // Batch update expiration status
      await this.batchUpdateExpirationStatus();

    } catch (error) {
      console.error('Failed to check credential expirations:', error);
      throw error;
    }
  }

  /**
   * Get credentials that will expire within the specified time window
   */
  async getCredentialsExpiringSoon(withinSeconds) {
    try {
      const contract = new Contract(this.credentialRegistry.contractId);
      const rpc = new (require('soroban-client')).Server(this.credentialRegistry.sorobanRpc);
      
      const result = await rpc.simulateTransaction({
        source: process.env.ADMIN_PUBLIC_KEY,
        transaction: new TransactionBuilder(
          await this.server.loadAccount(process.env.ADMIN_PUBLIC_KEY),
          { networkPassphrase: this.network }
        )
          .addOperation(Operation.invokeContractFunction({
            contract: this.credentialRegistry.contractId,
            function: 'get_credentials_expiring_soon',
            args: [withinSeconds.toString()],
          }))
          .setTimeout(30)
          .build(),
      });

      if (result.results && result.results[0]) {
        return this.parseCredentialIds(result.results[0].value);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get credentials expiring soon:', error);
      return [];
    }
  }

  /**
   * Get list of expired credentials
   */
  async getExpiredCredentials() {
    try {
      const contract = new Contract(this.credentialRegistry.contractId);
      const rpc = new (require('soroban-client')).Server(this.credentialRegistry.sorobanRpc);
      
      const result = await rpc.simulateTransaction({
        source: process.env.ADMIN_PUBLIC_KEY,
        transaction: new TransactionBuilder(
          await this.server.loadAccount(process.env.ADMIN_PUBLIC_KEY),
          { networkPassphrase: this.network }
        )
          .addOperation(Operation.invokeContractFunction({
            contract: this.credentialRegistry.contractId,
            function: 'get_expired_credentials',
            args: [],
          }))
          .setTimeout(30)
          .build(),
      });

      if (result.results && result.results[0]) {
        return this.parseCredentialIds(result.results[0].value);
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get expired credentials:', error);
      return [];
    }
  }

  /**
   * Process a credential that is expiring soon
   */
  async processExpiringCredential(credential) {
    try {
      console.log(`⏰ Processing expiring credential ${credential.id}`);
      
      // Send expiration warning notification
      if (this.expirationConfig.notificationEnabled) {
        await this.sendExpirationWarning(credential);
      }

      // Auto-renew if enabled and configured
      if (this.expirationConfig.autoRenewalEnabled && credential.autoRenewal) {
        await this.autoRenewCredential(credential);
      }

      // Log expiration warning event
      await this.logExpirationEvent('warning', credential);

    } catch (error) {
      console.error(`Failed to process expiring credential ${credential.id}:`, error);
    }
  }

  /**
   * Process an expired credential
   */
  async processExpiredCredential(credential) {
    try {
      console.log(`⚠️ Processing expired credential ${credential.id}`);
      
      // Send expiration notification
      if (this.expirationConfig.notificationEnabled) {
        await this.sendExpirationNotification(credential);
      }

      // Log expiration event
      await this.logExpirationEvent('expired', credential);

      // Update credential status in database
      await this.updateCredentialStatus(credential.id, 'expired');

    } catch (error) {
      console.error(`Failed to process expired credential ${credential.id}:`, error);
    }
  }

  /**
   * Send expiration warning notification
   */
  async sendExpirationWarning(credential) {
    try {
      // Implementation would depend on your notification system
      console.log(`📧 Sending expiration warning for credential ${credential.id} to user ${credential.recipient}`);
      
      // Example: Send email, push notification, or in-app notification
      if (process.env.NOTIFICATION_SERVICE_URL) {
        await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/send`, {
          type: 'credential_expiration_warning',
          recipient: credential.recipient,
          data: {
            credentialId: credential.id,
            title: credential.title,
            expiresAt: credential.expiresAt,
            daysUntilExpiry: Math.ceil((credential.expiresAt - Date.now() / 1000) / 86400),
          },
        });
      }
    } catch (error) {
      console.error('Failed to send expiration warning:', error);
    }
  }

  /**
   * Send expiration notification
   */
  async sendExpirationNotification(credential) {
    try {
      console.log(`📧 Sending expiration notification for credential ${credential.id} to user ${credential.recipient}`);
      
      if (process.env.NOTIFICATION_SERVICE_URL) {
        await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/send`, {
          type: 'credential_expired',
          recipient: credential.recipient,
          data: {
            credentialId: credential.id,
            title: credential.title,
            expiredAt: credential.expiresAt,
          },
        });
      }
    } catch (error) {
      console.error('Failed to send expiration notification:', error);
    }
  }

  /**
   * Auto-renew a credential
   */
  async autoRenewCredential(credential) {
    try {
      console.log(`🔄 Auto-renewing credential ${credential.id}`);
      
      const renewalDuration = credential.defaultRenewalDuration || 2592000; // 30 days default
      
      const transaction = await this.buildRenewalTransaction(credential.id, renewalDuration);
      const result = await this.submitTransaction({
        type: 'credential_renewal',
        payload: {
          ...transaction,
          secretKey: process.env.ADMIN_SECRET_KEY,
        },
        userId: credential.recipient,
      });

      console.log(`✅ Credential ${credential.id} renewed successfully:`, result.hash);
      
      // Send renewal confirmation
      if (this.expirationConfig.notificationEnabled) {
        await this.sendRenewalConfirmation(credential, renewalDuration);
      }

    } catch (error) {
      console.error(`Failed to auto-renew credential ${credential.id}:`, error);
    }
  }

  /**
   * Build credential renewal transaction
   */
  async buildRenewalTransaction(credentialId, extensionDuration) {
    const adminAccount = await this.server.loadAccount(process.env.ADMIN_PUBLIC_KEY);
    
    const transaction = new TransactionBuilder(adminAccount, {
      fee: '1000',
      networkPassphrase: this.network,
    })
      .addOperation(Operation.invokeContractFunction({
        contract: this.credentialRegistry.contractId,
        function: 'renew_credential',
        args: [
          credentialId.toString(),
          process.env.ADMIN_PUBLIC_KEY,
          extensionDuration.toString(),
        ],
      }))
      .setTimeout(30)
      .build();

    return { transaction, gasOptimization: { estimatedFee: 1000 } };
  }

  /**
   * Send renewal confirmation notification
   */
  async sendRenewalConfirmation(credential, extensionDuration) {
    try {
      console.log(`📧 Sending renewal confirmation for credential ${credential.id}`);
      
      if (process.env.NOTIFICATION_SERVICE_URL) {
        await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/send`, {
          type: 'credential_renewed',
          recipient: credential.recipient,
          data: {
            credentialId: credential.id,
            title: credential.title,
            extensionDuration,
            newExpiryDate: credential.expiresAt + extensionDuration,
          },
        });
      }
    } catch (error) {
      console.error('Failed to send renewal confirmation:', error);
    }
  }

  /**
   * Log expiration event to analytics
   */
  async logExpirationEvent(eventType, credential) {
    try {
      console.log(`📊 Logging ${eventType} event for credential ${credential.id}`);
      
      if (process.env.ANALYTICS_SERVICE_URL) {
        await axios.post(`${process.env.ANALYTICS_SERVICE_URL}/events`, {
          eventType: `credential_${eventType}`,
          timestamp: new Date().toISOString(),
          data: {
            credentialId: credential.id,
            recipient: credential.recipient,
            title: credential.title,
            expiresAt: credential.expiresAt,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log expiration event:', error);
    }
  }

  /**
   * Update credential status in local database
   */
  async updateCredentialStatus(credentialId, status) {
    try {
      console.log(`🗄️ Updating credential ${credentialId} status to ${status}`);
      
      if (process.env.DATABASE_SERVICE_URL) {
        await axios.patch(`${process.env.DATABASE_SERVICE_URL}/credentials/${credentialId}`, {
          status,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Failed to update credential status:', error);
    }
  }

  /**
   * Batch update expiration status for multiple credentials
   */
  async batchUpdateExpirationStatus() {
    try {
      console.log('🔄 Running batch expiration status update...');
      
      const rpc = new (require('soroban-client')).Server(this.credentialRegistry.sorobanRpc);
      
      // Get all credential IDs (this would need to be implemented based on your storage)
      const credentialIds = await this.getAllCredentialIds();
      
      if (credentialIds.length === 0) return;
      
      // Process in batches
      for (let i = 0; i < credentialIds.length; i += this.expirationConfig.batchSize) {
        const batch = credentialIds.slice(i, i + this.expirationConfig.batchSize);
        
        const result = await rpc.simulateTransaction({
          source: process.env.ADMIN_PUBLIC_KEY,
          transaction: new TransactionBuilder(
            await this.server.loadAccount(process.env.ADMIN_PUBLIC_KEY),
            { networkPassphrase: this.network }
          )
            .addOperation(Operation.invokeContractFunction({
              contract: this.credentialRegistry.contractId,
              function: 'batch_update_expiration_status',
              args: [batch],
            }))
            .setTimeout(30)
            .build(),
        });

        if (result.results && result.results[0]) {
          const expiredInBatch = this.parseCredentialIds(result.results[0].value);
          if (expiredInBatch.length > 0) {
            console.log(`⚠️ Batch update found ${expiredInBatch.length} newly expired credentials`);
          }
        }
      }

    } catch (error) {
      console.error('Failed to batch update expiration status:', error);
    }
  }

  /**
   * Parse credential IDs from contract response
   */
  parseCredentialIds(value) {
    // This would need to be implemented based on the actual response format
    // from the Soroban contract
    try {
      if (Array.isArray(value)) {
        return value.map(id => parseInt(id.toString()));
      }
      return [];
    } catch (error) {
      console.error('Failed to parse credential IDs:', error);
      return [];
    }
  }

  /**
   * Get all credential IDs (implementation depends on your storage)
   */
  async getAllCredentialIds() {
    // This would need to be implemented based on how you track credential IDs
    // For now, return empty array
    return [];
  }

  /**
   * Manually trigger expiration check
   */
  async triggerExpirationCheck() {
    console.log('🔔 Manually triggering credential expiration check...');
    await this.checkCredentialExpirations();
  }

  /**
   * Get credential expiration statistics
   */
  async getExpirationStatistics() {
    try {
      const expiringSoon = await this.getCredentialsExpiringSoon(this.expirationConfig.warningThreshold);
      const expired = await this.getExpiredCredentials();
      
      return {
        expiringSoon: {
          count: expiringSoon.length,
          credentials: expiringSoon,
        },
        expired: {
          count: expired.length,
          credentials: expired,
        },
        lastCheck: new Date().toISOString(),
        nextCheck: new Date(Date.now() + this.expirationConfig.checkInterval).toISOString(),
        config: this.expirationConfig,
      };
    } catch (error) {
      console.error('Failed to get expiration statistics:', error);
      throw error;
    }
  }
}

module.exports = { StellarService };
