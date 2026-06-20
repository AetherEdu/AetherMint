import { StellarTransactionService, formatStellarBalance, isValidStellarAddress, createEnrollmentMemo, parseEnrollmentMemo } from '@/lib/stellar';

jest.mock('@stellar/stellar-sdk', () => {
  const mockBuild = jest.fn(() => ({
    toXDR: jest.fn(() => 'xdr-encoded-transaction'),
    hash: jest.fn(() => Buffer.from('tx-hash')),
  }));

  const mockTxInstance = () => ({
    hash: jest.fn(() => Buffer.from('tx-hash')),
  });

  const mockTransactionBuilder = jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    addMemo: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: mockBuild,
  }));
  mockTransactionBuilder.fromXDR = jest.fn(() => mockTxInstance());

  const mockTransactionsCall = jest.fn();
  const mockTransactionsOrder = jest.fn(() => ({ call: mockTransactionsCall }));
  const mockTransactionsLimit = jest.fn(() => ({ order: mockTransactionsOrder }));
  const mockForAccount = jest.fn(() => ({ limit: mockTransactionsLimit }));
  const mockTransactionCall = jest.fn();
  const mockTransaction = jest.fn(() => ({ call: mockTransactionCall }));

  const mockServerInstance = {
    loadAccount: jest.fn(),
    fetchBaseFee: jest.fn(),
    submitTransaction: jest.fn(),
    transactions: jest.fn(() => ({
      forAccount: mockForAccount,
      transaction: mockTransaction,
    })),
  };

  return {
    Horizon: {
      Server: jest.fn(() => mockServerInstance),
    },
    TransactionBuilder: mockTransactionBuilder,
    Networks: {
      TESTNET: 'Test SDF Network ; September 2015',
      PUBLIC: 'Public Global Stellar Network ; September 2015',
    },
    Asset: {
      native: jest.fn(() => ({ type: 'native' })),
    },
    Keypair: {
      fromPublicKey: jest.fn((key: string) => {
        if (key.length !== 56 || !key.startsWith('G')) {
          throw new Error('Invalid public key');
        }
        return { publicKey: jest.fn(() => key) };
      }),
    },
    Memo: {
      none: jest.fn(() => ({ type: 'none' })),
    },
    MemoText: jest.fn((text: string) => ({ type: 'text', value: text })),
    Operation: {
      payment: jest.fn((params: any) => ({ type: 'payment', ...params })),
    },
    __esModule: true,
  };
});

describe('formatStellarBalance', () => {
  it('formats balance with 7 decimal places and XLM suffix', () => {
    expect(formatStellarBalance(100)).toBe('100.0000000 XLM');
  });

  it('handles zero balance', () => {
    expect(formatStellarBalance(0)).toBe('0.0000000 XLM');
  });

  it('handles decimal balance', () => {
    expect(formatStellarBalance(1.5)).toBe('1.5000000 XLM');
  });

  it('handles very small balances', () => {
    expect(formatStellarBalance(0.000001)).toBe('0.0000010 XLM');
  });

  it('handles large balances', () => {
    expect(formatStellarBalance(1000000)).toBe('1000000.0000000 XLM');
  });
});

describe('isValidStellarAddress', () => {
  it('validates a correct Stellar public key', () => {
    expect(isValidStellarAddress('G' + 'A'.repeat(55))).toBe(true);
  });

  it('rejects a key that does not start with G', () => {
    expect(isValidStellarAddress('A' + 'A'.repeat(55))).toBe(false);
  });

  it('rejects a short key', () => {
    expect(isValidStellarAddress('GABCD')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidStellarAddress('')).toBe(false);
  });
});

describe('createEnrollmentMemo', () => {
  it('creates memo with ENROLL prefix', () => {
    const memo = createEnrollmentMemo('course-123', 'student456');
    expect(memo).toBe('ENROLL_course-123_student456');
  });

  it('handles course IDs with special characters', () => {
    const memo = createEnrollmentMemo('course_123', 'student-789');
    expect(memo).toBe('ENROLL_course_123_student-789');
  });

  it('handles numeric IDs', () => {
    const memo = createEnrollmentMemo('42', '99');
    expect(memo).toBe('ENROLL_42_99');
  });
});

describe('parseEnrollmentMemo', () => {
  it('parses a valid enrollment memo', () => {
    const result = parseEnrollmentMemo('ENROLL_course-123_student456');
    expect(result).toEqual({
      courseId: 'course-123',
      studentId: 'student456',
    });
  });

  it('returns null for a memo without ENROLL prefix', () => {
    const result = parseEnrollmentMemo('OTHER_course-123_student456');
    expect(result).toBeNull();
  });

  it('returns null for an empty string', () => {
    const result = parseEnrollmentMemo('');
    expect(result).toBeNull();
  });

  it('returns null for a memo with wrong prefix case', () => {
    const result = parseEnrollmentMemo('enroll_course-123_student456');
    expect(result).toBeNull();
  });
});

describe('StellarTransactionService', () => {
  let service: StellarTransactionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StellarTransactionService('testnet');
  });

  describe('constructor', () => {
    it('creates a testnet service by default', () => {
      const s = new StellarTransactionService();
      expect(s).toBeInstanceOf(StellarTransactionService);
    });

    it('creates a mainnet service', () => {
      const s = new StellarTransactionService('mainnet');
      expect(s).toBeInstanceOf(StellarTransactionService);
    });
  });

  describe('getAccountBalance', () => {
    it('returns native balance when account exists', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'native', balance: '500.0000000' },
          { asset_type: 'credit_alphanum4', balance: '100.0000000', asset_code: 'USDC' },
        ],
      });

      const balance = await service.getAccountBalance('G' + 'A'.repeat(55));
      expect(balance).toBe(500);
    });

    it('returns 0 when no native balance found', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockResolvedValue({
        balances: [
          { asset_type: 'credit_alphanum4', balance: '100.0000000', asset_code: 'USDC' },
        ],
      });

      const balance = await service.getAccountBalance('G' + 'A'.repeat(55));
      expect(balance).toBe(0);
    });

    it('throws when account does not exist', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockRejectedValue(new Error('Account not found'));

      await expect(
        service.getAccountBalance('G' + 'A'.repeat(55))
      ).rejects.toThrow('Failed to fetch account balance');
    });
  });

  describe('createPaymentTransaction', () => {
    it('creates and returns a transaction XDR', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockResolvedValue({ id: 'account-id' });
      mockServer.fetchBaseFee.mockResolvedValue(100);

      const xdr = await service.createPaymentTransaction(
        'G' + 'A'.repeat(55),
        'G' + 'B'.repeat(55),
        '150',
        'ENROLL_course-1_student'
      );

      expect(xdr).toBe('xdr-encoded-transaction');
    });

    it('throws on failure', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockRejectedValue(new Error('Network error'));

      await expect(
        service.createPaymentTransaction('G' + 'A'.repeat(55), 'G' + 'B'.repeat(55), '150')
      ).rejects.toThrow('Failed to create payment transaction');
    });
  });

  describe('submitTransaction', () => {
    it('submits and returns a successful receipt', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.submitTransaction.mockResolvedValue({
        hash: 'tx-hash-123',
        successful: true,
        latest_ledger: 12345,
        fee_charged: '100',
        source_account: 'G' + 'A'.repeat(55),
        operations: [
          { type: 'payment', amount: '150', destination: 'G' + 'B'.repeat(55) },
        ],
      });

      const receipt = await service.submitTransaction('signed-xdr');

      expect(receipt.status).toBe('success');
      expect(receipt.transactionHash).toBeDefined();
      expect(receipt.amount).toBe(150);
    });

    it('returns failed status when transaction fails', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.submitTransaction.mockResolvedValue({
        hash: 'tx-hash-123',
        successful: false,
        latest_ledger: 12345,
        source_account: 'G' + 'A'.repeat(55),
        operations: [],
      });

      const receipt = await service.submitTransaction('signed-xdr');

      expect(receipt.status).toBe('failed');
    });

    it('throws with result codes on submission error', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.submitTransaction.mockRejectedValue({
        response: {
          data: {
            extras: {
              result_codes: {
                transaction: 'tx_failed',
                operations: ['op_no_destination'],
              },
            },
          },
        },
      });

      await expect(
        service.submitTransaction('signed-xdr')
      ).rejects.toThrow('Transaction failed: tx_failed');
    });
  });

  describe('fundTestAccount', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('funds a test account via friendbot', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ hash: 'friendbot-tx-hash' }),
      });

      await service.fundTestAccount('G' + 'A'.repeat(55));

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('friendbot.stellar.org')
      );
    });

    it('throws if friendbot returns non-ok response', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      await expect(
        service.fundTestAccount('G' + 'A'.repeat(55))
      ).rejects.toThrow('Failed to fund test account');
    });

    it('throws if fetch itself fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        service.fundTestAccount('G' + 'A'.repeat(55))
      ).rejects.toThrow('Failed to fund test account');
    });
  });

  describe('checkAccountExists', () => {
    it('returns true when account loads', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockResolvedValue({ id: 'exists' });

      const exists = await service.checkAccountExists('G' + 'A'.repeat(55));
      expect(exists).toBe(true);
    });

    it('returns false when account load fails', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockRejectedValue(new Error('not found'));

      const exists = await service.checkAccountExists('G' + 'A'.repeat(55));
      expect(exists).toBe(false);
    });
  });

  describe('estimateTransactionFee', () => {
    it('returns the base fee', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockResolvedValue({ id: 'account-id' });
      mockServer.fetchBaseFee.mockResolvedValue(100);

      const fee = await service.estimateTransactionFee(
        'G' + 'A'.repeat(55),
        'G' + 'B'.repeat(55),
        '150'
      );

      expect(fee).toBe(100);
    });

    it('returns default fee on error', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      mockServer.loadAccount.mockRejectedValue(new Error('Network error'));

      const fee = await service.estimateTransactionFee(
        'G' + 'A'.repeat(55),
        'G' + 'B'.repeat(55),
        '150'
      );

      expect(fee).toBe(100);
    });
  });

  describe('getTransactionHistory', () => {
    it('returns an array of receipts', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      const mockRecords = [
        {
          hash: 'tx-1',
          successful: true,
          created_at: '2024-01-01T00:00:00Z',
          ledger: 1000,
          fee_paid: '100',
          source_account: 'G' + 'A'.repeat(55),
          operations: [
            { type: 'payment', amount: '50', destination: 'G' + 'B'.repeat(55) },
          ],
          memo: 'ENROLL_course-1_student',
        },
      ];

      const transactionsFn = mockServer.transactions;
      const forAccountFn = transactionsFn().forAccount;
      const limitFn = forAccountFn().limit;
      const orderFn = limitFn().order;
      orderFn().call.mockResolvedValue({ records: mockRecords });

      const history = await service.getTransactionHistory('G' + 'A'.repeat(55), 10);

      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('success');
      expect(history[0].transactionHash).toBe('tx-1');
      expect(history[0].amount).toBe(50);
    });

    it('throws on error', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      const transactionsFn = mockServer.transactions;
      const forAccountFn = transactionsFn().forAccount;
      const limitFn = forAccountFn().limit;
      const orderFn = limitFn().order;
      orderFn().call.mockRejectedValue(new Error('Server error'));

      await expect(
        service.getTransactionHistory('G' + 'A'.repeat(55))
      ).rejects.toThrow('Failed to fetch transaction history');
    });
  });

  describe('validateTransaction', () => {
    it('returns receipt for a valid transaction hash', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      const transactionsFn = mockServer.transactions;
      const transactionFn = transactionsFn().transaction;
      transactionFn().call.mockResolvedValue({
        hash: 'tx-hash-456',
        successful: true,
        created_at: '2024-01-01T00:00:00Z',
        ledger: 2000,
        fee_paid: '100',
        source_account: 'G' + 'A'.repeat(55),
        operations: [
          { type: 'payment', amount: '75', destination: 'G' + 'B'.repeat(55) },
        ],
        memo: 'ENROLL_course-2_student2',
      });

      const receipt = await service.validateTransaction('tx-hash-456');

      expect(receipt).not.toBeNull();
      expect(receipt!.status).toBe('success');
      expect(receipt!.transactionHash).toBe('tx-hash-456');
    });

    it('returns null when transaction is not found', async () => {
      const { Horizon } = require('@stellar/stellar-sdk');
      const mockServer = (Horizon.Server as jest.Mock).mock.results[0].value;

      const transactionsFn = mockServer.transactions;
      const transactionFn = transactionsFn().transaction;
      transactionFn().call.mockRejectedValue(new Error('Not found'));

      const receipt = await service.validateTransaction('invalid-hash');
      expect(receipt).toBeNull();
    });
  });
});
