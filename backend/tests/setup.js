const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Set test environment variables immediately
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STELLAR_NETWORK = 'testnet';

console.log('Testing in environment:', process.env.NODE_ENV);

const request = require('supertest');

// Mock IPFS service globally
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

const app = require('../src/index');

jest.setTimeout(60000);

// Mock external dependencies
jest.mock('@stellar/stellar-sdk');
jest.mock('ipfs-http-client', () => ({
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
}), { virtual: true });
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
    expire: jest.fn(function() {
      return this;
    }),
    lPush: jest.fn(function(key, val) {
      this._key = key;
      this._val = val;
      return this;
    }),
    zAdd: jest.fn(function() {
      return this;
    }),
    zRem: jest.fn(function() {
      return this;
    }),
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
        // Correctly handle negative indices if needed, but simple slice for now
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

  return {
    createClient: jest.fn(() => mockClient)
  };
}, { virtual: true });

let mongoServer;

// Global test setup
beforeAll(async () => {
  // Start in-memory MongoDB for testing
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
});

// Global test teardown
afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Database cleanup between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});

// Global test utilities
global.testUtils = {
  // Create authenticated request
  authenticatedRequest: (token) => {
    return request(app)
      .set('Authorization', `Bearer ${token}`);
  },
  
  // Generate test JWT token
  generateTestToken: (payload = {}) => {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { 
        userId: 'test-user-id', 
        address: 'GD5DJ3B7MHLRWGS7QKXYYEJZRGFQMVJ7T7S6DLPNHP5TGB7FZ7NBHJVP',
        ...payload 
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  },
  
  // Generate test Stellar address
  generateStellarAddress: () => {
    return 'GD' + Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15).toUpperCase();
  },
  
  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock IPFS response
  mockIPFSResponse: (data) => ({
    cid: 'QmTest123456789',
    size: JSON.stringify(data).length,
    data: Buffer.from(JSON.stringify(data))
  }),
  
  // Mock Stellar transaction
  mockStellarTransaction: () => ({
    toXDR: () => 'mock-transaction-xdr',
    hash: () => 'mock-transaction-hash',
    sign: jest.fn(),
    submit: jest.fn().mockResolvedValue({ successful: true })
  })
};

// Mock console methods to reduce test noise
/*
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};
*/

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
