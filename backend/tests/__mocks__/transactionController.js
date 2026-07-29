module.exports = {
  listTransactions: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getTransaction: jest.fn((req, res) => res.status(200).json({ success: true, data: req.params })),
  verifyTransaction: jest.fn((req, res) => res.status(200).json({ success: true })),
  getUserTransactions: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getTransactionStats: jest.fn((req, res) => res.status(200).json({ success: true, data: {} }))
};