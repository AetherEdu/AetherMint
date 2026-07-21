module.exports = {
  Server: jest.fn().mockImplementation(() => ({
    loadAccount: jest.fn(),
    payments: jest.fn().mockReturnThis(),
    submitTransaction: jest.fn(),
    testnet: jest.fn(),
    standalone: jest.fn(),
  })),
  TransactionBuilder: jest.fn().mockImplementation(() => ({
    addOperation: jest.fn().mockReturnThis(),
    setTimeout: jest.fn().mockReturnThis(),
    build: jest.fn(),
  })),
  Network: jest.fn(),
  Asset: jest.fn(),
  BASE_FEE: jest.fn(),
  Keypair: jest.fn().mockImplementation(() => ({
    publicKey: jest.fn(),
    secretKey: jest.fn(),
    sign: jest.fn(),
    verify: jest.fn(),
  })),
  Operation: jest.fn(),
  Memo: jest.fn(),
};