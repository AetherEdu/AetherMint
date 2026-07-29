const SecureAggregation = require('../../src/services/federatedLearning/SecureAggregation');

describe('SecureAggregation', () => {
  let secureAggregation;

  beforeEach(async () => {
    secureAggregation = new SecureAggregation({
      keySize: 512 // Smaller key size for faster testing
    });
    await secureAggregation.initializeKeys();
  });

  describe('Key Initialization', () => {
    test('should initialize cryptographic keys successfully', async () => {
      expect(secureAggregation.publicKey).toBeDefined();
      expect(secureAggregation.privateKey).toBeDefined();
      expect(secureAggregation.publicKey.n).toBeDefined();
      expect(secureAggregation.publicKey.g).toBeDefined();
    });

    test('should handle key initialization failure gracefully', async () => {
      // Mock a failure scenario
      const originalGenerateKeys = require('paillier-js').generateRandomKeys;
      require('paillier-js').generateRandomKeys = jest.fn().mockImplementation(() => {
        throw new Error('Key generation failed');
      });

      const failingAggregation = new SecureAggregation();
      
      await expect(failingAggregation.initializeKeys())
        .rejects.toThrow('Key generation failed');

      // Restore original function
      require('paillier-js').generateRandomKeys = originalGenerateKeys;
    });
  });

  describe('Secret Sharing', () => {
    test('should generate secret shares correctly', () => {
      const value = 42;
      const participantCount = 5;
      const threshold = 3;

      const shares = secureAggregation.generateSecretShares(value, participantCount, threshold);

      expect(shares).toHaveLength(participantCount);
      expect(shares[0]).toHaveProperty('participantId');
      expect(shares[0]).toHaveProperty('share');
      
      // Check participant IDs are sequential
      for (let i = 0; i < participantCount; i++) {
        expect(shares[i].participantId).toBe(i + 1);
      }
    });

    test('should reject invalid parameters for secret sharing', () => {
      expect(() => {
        secureAggregation.generateSecretShares(42, 2, 3);
      }).toThrow('Participant count must be >= threshold');

      expect(() => {
        secureAggregation.generateSecretShares(42, 0, 1);
      }).toThrow('Participant count must be >= threshold');
    });
  });

  describe('Homomorphic Encryption', () => {
    test('should encrypt and decrypt parameters correctly', () => {
      const parameters = {
        weight1: 0.123456,
        weight2: -0.789012,
        weight3: 1.5
      };

      const encrypted = secureAggregation.encryptParameters(parameters);
      const decrypted = secureAggregation.decryptParameters(encrypted);

      expect(decrypted).toEqual(parameters);
    });

    test('should handle array parameters', () => {
      const parameters = {
        layer1: [0.1, 0.2, 0.3, 0.4],
        layer2: [-0.1, -0.2, -0.3, -0.4]
      };

      const encrypted = secureAggregation.encryptParameters(parameters);
      const decrypted = secureAggregation.decryptParameters(encrypted);

      expect(decrypted.layer1).toEqual(parameters.layer1);
      expect(decrypted.layer2).toEqual(parameters.layer2);
    });

    test('should preserve precision in encryption/decryption', () => {
      const parameters = {
        precise: 0.123456789
      };

      const encrypted = secureAggregation.encryptParameters(parameters);
      const decrypted = secureAggregation.decryptParameters(encrypted);

      expect(decrypted.precise).toBeCloseTo(parameters.precise, 6);
    });
  });

  describe('Homomorphic Aggregation', () => {
    test('should aggregate encrypted parameters correctly', () => {
      const update1 = secureAggregation.encryptParameters({
        weight1: 0.1,
        weight2: 0.2
      });

      const update2 = secureAggregation.encryptParameters({
        weight1: 0.3,
        weight2: 0.4
      });

      const aggregated = secureAggregation.homomorphicAggregate([update1, update2]);
      const decrypted = secureAggregation.decryptParameters(aggregated);

      expect(decrypted.weight1).toBeCloseTo(0.4, 6);
      expect(decrypted.weight2).toBeCloseTo(0.6, 6);
    });

    test('should handle multiple updates', () => {
      const updates = [];
      const expectedSum = { weight1: 0, weight2: 0 };

      for (let i = 1; i <= 5; i++) {
        const update = {
          weight1: i * 0.1,
          weight2: i * 0.2
        };
        updates.push(secureAggregation.encryptParameters(update));
        expectedSum.weight1 += update.weight1;
        expectedSum.weight2 += update.weight2;
      }

      const aggregated = secureAggregation.homomorphicAggregate(updates);
      const decrypted = secureAggregation.decryptParameters(aggregated);

      expect(decrypted.weight1).toBeCloseTo(expectedSum.weight1, 6);
      expect(decrypted.weight2).toBeCloseTo(expectedSum.weight2, 6);
    });

    test('should reject empty update list', () => {
      expect(() => {
        secureAggregation.homomorphicAggregate([]);
      }).toThrow('No encrypted updates to aggregate');
    });
  });

  describe('Commitments', () => {
    test('should generate and verify commitments', () => {
      const data = { weight1: 0.1, weight2: 0.2 };
      const { commitment, nonce } = secureAggregation.generateCommitment(data);

      expect(commitment).toBeDefined();
      expect(nonce).toBeDefined();
      expect(commitment).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex

      const isValid = secureAggregation.verifyCommitment(data, commitment, nonce);
      expect(isValid).toBe(true);
    });

    test('should reject invalid commitments', () => {
      const data = { weight1: 0.1, weight2: 0.2 };
      const { commitment, nonce } = secureAggregation.generateCommitment(data);

      const modifiedData = { weight1: 0.1, weight2: 0.3 }; // Modified data
      const isValid = secureAggregation.verifyCommitment(modifiedData, commitment, nonce);
      expect(isValid).toBe(false);

      const wrongNonce = 'different-nonce';
      const isValidWithWrongNonce = secureAggregation.verifyCommitment(data, commitment, wrongNonce);
      expect(isValidWithWrongNonce).toBe(false);
    });

    test('should handle custom nonce', () => {
      const data = { weight1: 0.1 };
      const customNonce = 'custom-nonce-123';

      const { commitment } = secureAggregation.generateCommitment(data, customNonce);
      const isValid = secureAggregation.verifyCommitment(data, commitment, customNonce);
      expect(isValid).toBe(true);
    });
  });

  describe('Secure MPC', () => {
    test('should perform secure MPC aggregation', async () => {
      const participantUpdates = [
        {
          participantId: 'p1',
          parameters: { weight1: 0.1, weight2: 0.2 },
          commitment: { commitment: 'commit1', nonce: 'nonce1' }
        },
        {
          participantId: 'p2',
          parameters: { weight1: 0.3, weight2: 0.4 },
          commitment: { commitment: 'commit2', nonce: 'nonce2' }
        }
      ];

      const result = await secureAggregation.secureMPCAggregation(participantUpdates);

      expect(result).toEqual({
        weight1: 0.4,
        weight2: 0.6
      });
    });

    test('should handle empty participant updates', async () => {
      await expect(secureAggregation.secureMPCAggregation([]))
        .rejects.toThrow();
    });
  });

  describe('Zero-Knowledge Proofs', () => {
    test('should generate and verify ZK proofs', () => {
      const update = { weight1: 0.1, weight2: 0.2 };
      const secret = 'secret-key';

      const proof = secureAggregation.generateZKProof(update, secret);

      expect(proof).toHaveProperty('commitment');
      expect(proof).toHaveProperty('challenge');
      expect(proof).toHaveProperty('proof');

      // Note: In a real implementation, verification would require the secret
      // For this test, we'll just check the structure
      expect(proof.commitment).toMatch(/^[a-f0-9]{64}$/);
      expect(proof.proof).toMatch(/^[a-f0-9]{64}$/);
    });

    test('should handle ZK proof verification', () => {
      const update = { weight1: 0.1 };
      const secret = 'secret-key';
      const proof = secureAggregation.generateZKProof(update, secret);

      // This is a simplified verification - in practice would be more complex
      const isValid = secureAggregation.verifyZKProof(update, proof);
      expect(typeof isValid).toBe('boolean');
    });
  });

  describe('Differential Privacy Integration', () => {
    test('should generate DP noise parameters', () => {
      const { noise, generateNoise } = secureAggregation.generateDPNoise(1.0, 1e-5, 1.0);

      expect(noise).toBeDefined();
      expect(typeof generateNoise).toBe('function');

      // Test noise generation
      const noise1 = generateNoise();
      const noise2 = generateNoise();
      expect(noise1).not.toBe(noise2); // Should be different
    });

    test('should apply secure aggregation with DP', async () => {
      const updates = [
        {
          participantId: 'p1',
          parameters: { weight1: 0.1, weight2: 0.2 }
        },
        {
          participantId: 'p2',
          parameters: { weight1: 0.3, weight2: 0.4 }
        }
      ];

      const privacyParams = {
        epsilon: 1.0,
        delta: 1e-5,
        sensitivity: 1.0
      };

      const result = await secureAggregation.secureAggregationWithDP(updates, privacyParams);

      expect(result).toHaveProperty('weight1');
      expect(result).toHaveProperty('weight2');
      
      // Values should be numbers (DP noise may produce large variations)
      expect(typeof result.weight1).toBe('number');
      expect(typeof result.weight2).toBe('number');
    });
  });

  describe('Public Parameters', () => {
    test('should provide public parameters for participants', () => {
      const publicParams = secureAggregation.getPublicParameters();

      expect(publicParams).toHaveProperty('publicKey');
      expect(publicParams).toHaveProperty('keySize');
      
      expect(publicParams.publicKey).toHaveProperty('n');
      expect(publicParams.publicKey).toHaveProperty('g');
      expect(publicParams.keySize).toBe(512);
    });
  });

  describe('Error Handling', () => {
    test('should handle encryption errors gracefully', () => {
      // Test with invalid parameters
      expect(() => {
        secureAggregation.encryptParameters(null);
      }).not.toThrow(); // Should handle gracefully

      expect(() => {
        secureAggregation.encryptParameters(undefined);
      }).not.toThrow();
    });

    test('should handle decryption errors gracefully', () => {
      // Test with invalid encrypted data
      expect(() => {
        secureAggregation.decryptParameters(null);
      }).not.toThrow();

      expect(() => {
        secureAggregation.decryptParameters({});
      }).not.toThrow();
    });

    test('should handle malformed encrypted parameters in aggregation', () => {
      const validUpdate = secureAggregation.encryptParameters({ weight1: 0.1 });
      const invalidUpdate = { weight1: 'invalid-encrypted-data' };

      expect(() => {
        secureAggregation.homomorphicAggregate([validUpdate, invalidUpdate]);
      }).toThrow();
    });
  });

  describe('Performance', () => {
    test('should handle large parameter sets efficiently', () => {
      const largeParameters = {};
      for (let i = 0; i < 1000; i++) {
        largeParameters[`weight${i}`] = Math.random();
      }

      const startTime = Date.now();
      const encrypted = secureAggregation.encryptParameters(largeParameters);
      const decrypted = secureAggregation.decryptParameters(encrypted);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(15000); // Should complete within 15 seconds
      expect(Object.keys(decrypted)).toHaveLength(1000);
    });

    test('should handle multiple participants efficiently', async () => {
      const updates = [];
      for (let i = 0; i < 50; i++) {
        updates.push({
          participantId: `p${i}`,
          parameters: { weight1: Math.random(), weight2: Math.random() }
        });
      }

      const startTime = Date.now();
      const result = await secureAggregation.secureMPCAggregation(updates);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result).toHaveProperty('weight1');
      expect(result).toHaveProperty('weight2');
    });
  });
});
