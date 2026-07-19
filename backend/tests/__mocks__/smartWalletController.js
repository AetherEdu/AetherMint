module.exports = {
  createSmartWallet: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  executeTransaction: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  executeBatchTransactions: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  setupSocialRecovery: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  initiateRecovery: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  supportRecovery: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getRecoveryRequest: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  setupMultiSig: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  proposeTransaction: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getPendingTransactions: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  createSessionKey: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getActiveSessionKeys: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getWalletActivity: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getActivityAlerts: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  getCredentialRenewalStats: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' })),
  enableAutoRenewal: jest.fn(async (req, res) => res.json({ success: true, message: 'mock' }))
};