process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STELLAR_NETWORK = 'testnet';

console.log('Testing in environment:', process.env.NODE_ENV);

const request = require('supertest');

// Mock broken/missing modules before requiring app
jest.mock('../src/services/ipfs', () => ({
  uploadFile: jest.fn(),
  uploadMultipleFiles: jest.fn(),
  getContent: jest.fn(),
  getMetadata: jest.fn(),
  pinContent: jest.fn(),
  unpinContent: jest.fn(),
  getNodeInfo: jest.fn(),
  getFileMetadata: jest.fn(),
  pinFile: jest.fn(),
  unpinFile: jest.fn(),
  updateFileMetadata: jest.fn()
}));

jest.mock('../src/routes/smartWallet', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});

jest.mock('../src/routes/agiTutorRoutes', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});

jest.mock('../src/routes/autonomousAgents', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});

jest.mock('../src/routes/gamification', () => {
  const express = require('express');
  const router = express.Router();
  return router;
});

jest.mock('../src/controllers/smartWalletController', () => ({
  createSmartWallet: jest.fn(async (req, res) => res.json({ success: true })),
  executeTransaction: jest.fn(async (req, res) => res.json({ success: true })),
  executeBatchTransactions: jest.fn(async (req, res) => res.json({ success: true })),
  setupSocialRecovery: jest.fn(async (req, res) => res.json({ success: true })),
  initiateRecovery: jest.fn(async (req, res) => res.json({ success: true })),
  supportRecovery: jest.fn(async (req, res) => res.json({ success: true })),
  getRecoveryRequest: jest.fn(async (req, res) => res.json({ success: true })),
  setupMultiSig: jest.fn(async (req, res) => res.json({ success: true })),
  proposeTransaction: jest.fn(async (req, res) => res.json({ success: true })),
  getPendingTransactions: jest.fn(async (req, res) => res.json({ success: true })),
  createSessionKey: jest.fn(async (req, res) => res.json({ success: true })),
  getActiveSessionKeys: jest.fn(async (req, res) => res.json({ success: true })),
  getWalletActivity: jest.fn(async (req, res) => res.json({ success: true })),
  getActivityAlerts: jest.fn(async (req, res) => res.json({ success: true })),
  getCredentialRenewalStats: jest.fn(async (req, res) => res.json({ success: true })),
  enableAutoRenewal: jest.fn(async (req, res) => res.json({ success: true }))
}));

jest.setTimeout(60000);

// Lazily load the full app only when needed
let app;
function getApp() {
  if (!app) {
    app = require('../src/index');
  }
  return app;
}

jest.mock('../src/services/transactionService', () => ({
  getAllTransactions: jest.fn(async () => []),
  getTransactionById: jest.fn(async (id) => ({ id })),
  verifyTransaction: jest.fn(async (id) => ({ verified: true, transactionId: id })),
  getTransactionsByUser: jest.fn(async () => []),
  getTransactionStatistics: jest.fn(async () => ({ total: 0, volume: 0 }))
}));

jest.mock('@stellar/stellar-sdk', () => ({
  Horizon: { Server: class Server {} },
  TransactionBuilder: class TransactionBuilder {},
  Network: { testnet: {}, standalone: {} },
  Asset: class Asset {},
  BASE_FEE: 100,
  Keypair: class Keypair {
    static fromSecret(secret) { return this.fromPublicKey('GTest'); }
    static fromPublicKey(publicKey) { return new Keypair(); }
    publicKey() { return 'GTest'; }
    secretKey() { return 'SSecret'; }
    sign(data) { return Buffer.from('signed'); }
    verify(data, signature) { return true; }
  },
  Operation: {},
  Memo: {},
}));

jest.mock('ipfs-http-client', () => ({
  create: jest.fn(() => ({
    version: jest.fn().mockResolvedValue({ version: '1.0.0' }),
    add: jest.fn().mockResolvedValue({ cid: { toString: () => 'QmTest123456789' } }),
    cat: jest.fn(),
    pin: { add: jest.fn(), rm: jest.fn() },
    id: jest.fn().mockResolvedValue({ id: 'test-id' }),
    repo: { stat: jest.fn().mockResolvedValue({ numObjects: 0, repoSize: 0, storageMax: 0 }) }
  }))
}));

jest.mock('redis', () => {
  const store = new Map();
  const lists = new Map();
  const hashes = new Map();

  const mockMulti = (client) => ({
    incr: jest.fn(function(key) {
      this._key = key;
      return this;
    }),
    incrBy: jest.fn(function(key, val) {
      this._key = key;
      this._val = val;
      return this;
    }),
    expire: jest.fn(function() { return this; }),
    lPush: jest.fn(function(key, val) {
      this._key = key;
      this._val = val;
      return this;
    }),
    zAdd: jest.fn(function() { return this; }),
    zRem: jest.fn(function() { return this; }),
    exec: jest.fn(async function() {
      const key = this._key;
      if (key) {
        const increment = this._val !== undefined ? this._val : 1;
        const current = parseInt(store.get(key) || '0') + increment;
        store.set(key, current.toString());
        return [current, 1];
      }
      return [1, 1];
    })
  });

  const mockClient = {
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn(async (key) => store.get(key) || null),
    set: jest.fn(async (key, val) => { store.set(key, val); return 'OK'; }),
    setEx: jest.fn(async (key, ttl, val) => { store.set(key, val); return 'OK'; }),
    del: jest.fn(async (keys) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      keysArray.forEach(k => {
        store.delete(k);
        lists.delete(k);
        hashes.delete(k);
      });
      return keysArray.length;
    }),
    incrBy: jest.fn(async (key, val) => {
      const current = parseInt(store.get(key) || '0');
      const newVal = current + val;
      store.set(key, newVal.toString());
      return newVal;
    }),
    incr: jest.fn(async (key) => {
      const current = parseInt(store.get(key) || '0') + 1;
      store.set(key, current.toString());
      return current;
    }),
    expire: jest.fn().mockResolvedValue(1),
    lPush: jest.fn(async (key, val) => {
      if (!lists.has(key)) lists.set(key, []);
      lists.get(key).unshift(val);
      return lists.get(key).length;
    }),
    lTrim: jest.fn(async (key, start, stop) => {
      if (lists.has(key)) {
        const list = lists.get(key);
        lists.set(key, list.slice(start, stop === -1 ? undefined : stop + 1));
      }
      return 'OK';
    }),
    lRange: jest.fn(async (key, start, stop) => {
      if (!lists.has(key)) return [];
      const list = lists.get(key);
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }),
    hSet: jest.fn(async (key, field, val) => {
      if (!hashes.has(key)) hashes.set(key, new Map());
      hashes.get(key).set(field, val);
      return 1;
    }),
    hGet: jest.fn(async (key, field) => {
      if (!hashes.has(key)) return null;
      return hashes.get(key).get(field) || null;
    }),
    hGetAll: jest.fn(async (key) => {
      if (!hashes.has(key)) return {};
      return Object.fromEntries(hashes.get(key));
    }),
    lLen: jest.fn(async (key) => (lists.get(key) || []).length),
    zCard: jest.fn(async (key) => 0),
    zAdd: jest.fn().mockResolvedValue(1),
    zRem: jest.fn().mockResolvedValue(1),
    zRangeByScore: jest.fn().mockResolvedValue([]),
    brPop: jest.fn().mockResolvedValue(null),
    quit: jest.fn().mockResolvedValue(true),
    subscribe: jest.fn().mockResolvedValue(),
    unsubscribe: jest.fn().mockResolvedValue(),
    publish: jest.fn().mockResolvedValue(1),
    keys: jest.fn(async (pattern) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return Array.from(store.keys()).filter(k => regex.test(k));
    }),
    multi: jest.fn(function() { return mockMulti(this); }),
    v4: {
      get: jest.fn(async (key) => store.get(key) || null),
      set: jest.fn(async (key, val) => { store.set(key, val); return 'OK'; }),
      del: jest.fn(async (key) => { store.delete(key); return 1; })
    }
  };

  return { createClient: jest.fn(() => mockClient) };
});

global.testUtils = {
  authenticatedRequest: (token) => request(getApp()).set('Authorization', `Bearer ${token}`),
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId: 'test-user-id', address: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP', ...payload },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  generateStellarAddress: () => {
    return 'GD' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15).toUpperCase();
  },
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  mockIPFSResponse: (data) => ({
    cid: 'QmTest123456789',
    size: JSON.stringify(data).length,
    data: Buffer.from(JSON.stringify(data))
  }),
  mockStellarTransaction: () => ({
    toXDR: () => 'mock-transaction-xdr',
    hash: () => 'mock-transaction-hash',
    sign: jest.fn(),
    submit: jest.fn().mockResolvedValue({ successful: true })
  })
};

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});