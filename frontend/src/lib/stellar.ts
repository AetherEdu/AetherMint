import { 
  Horizon, 
  TransactionBuilder, 
  Networks, 
  Asset, 
  Keypair,
  Memo,
  MemoText,
  Operation
} from '@stellar/stellar-sdk';
import { PaymentDetails, TransactionReceipt, WalletInfo } from '@/types/enrollment';

const HORIZON_TESTNET_URL = 'https://horizon-testnet.stellar.org';
const HORIZON_MAINNET_URL = 'https://horizon.stellar.org';

export class StellarTransactionService {
  private server: Horizon.Server;
  /**
   * The new @stellar/stellar-sdk no longer exposes a `Networks.Network`
   * union type. The passphrases we use are simple strings.
   */
  private networkPassphrase: string;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.server = new Horizon.Server(
      network === 'testnet' ? HORIZON_TESTNET_URL : HORIZON_MAINNET_URL,
    );
    this.networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;
  }

  async getAccountBalance(publicKey: string): Promise<number> {
    try {
      const account = await this.server.loadAccount(publicKey);
      const nativeBalance = account.balances.find(
        (balance: any) => balance.asset_type === 'native'
      );
      return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    } catch (error) {
      console.error('Error fetching account balance:', error);
      throw new Error('Failed to fetch account balance');
    }
  }

  async createPaymentTransaction(
    fromPublicKey: string,
    toPublicKey: string,
    amount: string,
    memo?: string
  ): Promise<string> {
    try {
      const account = await this.server.loadAccount(fromPublicKey);
      
      const transaction = new TransactionBuilder(account, {
        fee: await this.server.fetchBaseFee(),
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: toPublicKey,
            asset: Asset.native(),
            amount: amount,
          })
        )
        .addMemo(memo ? new MemoText(memo) : Memo.none())
        .setTimeout(30)
        .build();

      return transaction.toXDR();
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create payment transaction');
    }
  }

  async submitTransaction(signedTransactionXDR: string): Promise<TransactionReceipt> {
    try {
      const transaction = TransactionBuilder.fromXDR(signedTransactionXDR, this.networkPassphrase);
      const result = await this.server.submitTransaction(transaction) as unknown as {
        hash: string;
        successful: boolean;
        latest_ledger?: number;
        ledger?: number;
        fee_charged?: string | number;
        source_account?: string;
        operations?: Array<{ type: string; amount?: string; destination?: string }>;
        memo?: string;
      };

      // The Stellar SDK's `SubmitTransactionResponse` shape mutated in
      // v14. Cast to `any` for fields that the new types don't expose
      // directly so the receipt interface stays consumer-friendly.
      const submitResult = result;

      return {
        transactionHash: String(submitResult.hash),
        status: submitResult.successful ? 'success' : 'failed',
        timestamp: new Date().toISOString(),
        blockNumber: submitResult.latest_ledger ?? submitResult.ledger,
        fee: submitResult.fee_charged
          ? parseInt(String(submitResult.fee_charged))
          : undefined,
        amount: this.extractPaymentAmount(submitResult),
        from: this.extractSourceAccount(submitResult),
        to: this.extractDestinationAccount(submitResult),
        memo: this.extractMemo(submitResult),
      };
    } catch (error) {
      const err = error as { response?: { data?: { extras?: { result_codes?: { transaction?: string; operations?: string[] } } } } };
      console.error('Error submitting transaction:', error);
      
      if (err.response?.data?.extras?.result_codes) {
        const resultCodes = err.response.data.extras.result_codes;
        throw new Error(
          `Transaction failed: ${resultCodes.transaction || resultCodes.operations?.[0] || 'Unknown error'}`,
        );
      }

      throw new Error('Failed to submit transaction');
    }
  }

  async validateTransaction(transactionHash: string): Promise<TransactionReceipt | null> {
    try {
      const transaction = await this.server.transactions()
        .transaction(transactionHash)
        .call();

      // `fee_paid` and other SDK-returned numeric fields are declared on different
      // types in v14 of @stellar/stellar-sdk. Cast to a permissive shape so the
      // receipt we hand back to callers still parses cleanly.
      const txRecord = transaction as unknown as {
        hash: string;
        successful: boolean;
        created_at: string;
        ledger: number;
        fee_paid?: string | number;
        operations: Array<{ type: string; amount?: string; destination?: string }>;
        source_account: string;
        memo?: string;
      };
      return {
        transactionHash: txRecord.hash,
        status: txRecord.successful ? 'success' : 'failed',
        timestamp: txRecord.created_at,
        blockNumber: txRecord.ledger,
        fee: txRecord.fee_paid ? parseInt(String(txRecord.fee_paid)) : undefined,
        amount: this.extractPaymentAmountFromOperations(txRecord.operations),
        from: txRecord.source_account,
        to: this.extractDestinationFromOperations(txRecord.operations),
        memo: txRecord.memo ? txRecord.memo : undefined,
      };
    } catch (error) {
      console.error('Error validating transaction:', error);
      return null;
    }
  }

  async getTransactionHistory(publicKey: string, limit: number = 10): Promise<TransactionReceipt[]> {
    try {
      const transactions = await this.server
        .transactions()
        .forAccount(publicKey)
        .limit(limit)
        .order('desc')
        .call();

      return transactions.records.map((transaction: any) => ({
        transactionHash: transaction.hash,
        status: transaction.successful ? 'success' : 'failed',
        timestamp: transaction.created_at,
        blockNumber: transaction.ledger,
        fee: transaction.fee_paid ? parseInt(transaction.fee_paid) : undefined,
        amount: this.extractPaymentAmountFromOperations(transaction.operations),
        from: transaction.source_account,
        to: this.extractDestinationFromOperations(transaction.operations),
        memo: transaction.memo ? transaction.memo : undefined,
      }));
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      throw new Error('Failed to fetch transaction history');
    }
  }

  private get network(): string {
    return this.networkPassphrase === Networks.TESTNET ? 'testnet' : 'mainnet';
  }

  private extractPaymentAmount(result: any): number | undefined {
    if (result.operations && result.operations.length > 0) {
      const paymentOp = result.operations.find((op: any) => op.type === 'payment');
      if (paymentOp && paymentOp.amount) {
        return parseFloat(paymentOp.amount);
      }
    }
    return undefined;
  }

  private extractPaymentAmountFromOperations(operations: Array<{ type: string; amount?: string }>): number | undefined {
    const paymentOp = operations.find((op) => op.type === 'payment');
    if (paymentOp && paymentOp.amount) {
      return parseFloat(paymentOp.amount);
    }
    return undefined;
  }

  private extractSourceAccount(result: any): string {
    return result.source_account || '';
  }

  private extractDestinationAccount(result: any): string {
    if (result.operations && result.operations.length > 0) {
      const paymentOp = result.operations.find((op: any) => op.type === 'payment');
      if (paymentOp && paymentOp.destination) {
        return paymentOp.destination;
      }
    }
    return '';
  }

  private extractDestinationFromOperations(operations: Array<{ type: string; destination?: string }>): string {
    const paymentOp = operations.find((op) => op.type === 'payment');
    if (paymentOp && paymentOp.destination) {
      return paymentOp.destination;
    }
    return '';
  }

  private extractMemo(result: any): string | undefined {
    return result.memo || undefined;
  }

  async estimateTransactionFee(fromPublicKey: string, toPublicKey: string, amount: string): Promise<number> {
    try {
      const account = await this.server.loadAccount(fromPublicKey);
      const baseFee = await this.server.fetchBaseFee();

      // Build (but don't immediately submit) a transaction to validate inputs.
      new TransactionBuilder(account, {
        fee: baseFee,
        networkPassphrase: this.networkPassphrase,
      })
        .addOperation(
          Operation.payment({
            destination: toPublicKey,
            asset: Asset.native(),
            amount: amount,
          })
        )
        .setTimeout(30)
        .build();

      return baseFee;
    } catch (error) {
      console.error('Error estimating transaction fee:', error);
      return 100; // Default fee in stroops
    }
  }

  async checkAccountExists(publicKey: string): Promise<boolean> {
    try {
      await this.server.loadAccount(publicKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  async fundTestAccount(publicKey: string): Promise<void> {
    if (this.networkPassphrase === Networks.TESTNET) {
      try {
        const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
        if (!response.ok) {
          throw new Error('Failed to fund test account');
        }
        const result = await response.json();
        console.log('Test account funded:', result);
      } catch (error) {
        console.error('Error funding test account:', error);
        throw new Error('Failed to fund test account');
      }
    } else {
      throw new Error('Test account funding is only available on testnet');
    }
  }
}

export const stellarService = new StellarTransactionService();

export const formatStellarBalance = (balance: number): string => {
  return balance.toFixed(7) + ' XLM';
};

export const isValidStellarAddress = (address: string): boolean => {
  try {
    Keypair.fromPublicKey(address);
    return true;
  } catch (error) {
    return false;
  }
};

export const createEnrollmentMemo = (courseId: string, studentId: string): string => {
  return `ENROLL_${courseId}_${studentId}`;
};

export const parseEnrollmentMemo = (memo: string): { courseId: string; studentId: string } | null => {
  const match = memo.match(/^ENROLL_(.+)_(.+)$/);
  if (match) {
    return {
      courseId: match[1],
      studentId: match[2]
    };
  }
  return null;
};
