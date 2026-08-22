module.exports = {
  create: jest.fn(() => ({
    version: jest.fn().mockResolvedValue({ version: '1.0.0' }),
    add: jest.fn().mockResolvedValue({ cid: { toString: () => 'QmTest123456789' } }),
    cat: jest.fn(),
    pin: {
      add: jest.fn(),
      rm: jest.fn()
    },
    id: jest.fn().mockResolvedValue({ id: 'test-id' }),
    repo: {
      stat: jest.fn().mockResolvedValue({ numObjects: 0, repoSize: 0, storageMax: 0 })
    }
  }))
};