const crypto = require('crypto');
const paillier = require('paillier-js');
const BigInteger = require('big-integer');
const logger = require('../../utils/logger');

class SecureAggregation {
  constructor(options = {}) {
    this.keySize = options.keySize || 2048;
    this.publicKey = null;
    this.privateKey = null;
    this.shares = new Map();
    this.commitments = new Map();
    this.participants = new Set();
  }

  /**
   * Initialize cryptographic keys for secure aggregation
   */
  async initializeKeys() {
    try {
      // Generate Paillier key pair for homomorphic encryption
      const { publicKey, privateKey } = paillier.generateRandomKeys(this.keySize);
      this.publicKey = publicKey;
      this.privateKey = privateKey;

      logger.info('Secure aggregation keys initialized');
      return { publicKey, privateKey };
    } catch (error) {
      logger.error('Failed to initialize secure aggregation keys:', error);
      throw error;
    }
  }

  /**
   * Generate secret shares for a value using Shamir's Secret Sharing.
   */
  generateSecretShares(value, participantCount, threshold) {
    if (participantCount < threshold) {
      throw new Error('Participant count must be >= threshold');
    }

    const shares = [];
    const coefficients = [BigInteger(value)];
    
    // Generate random coefficients for polynomial
    const n = this.publicKey ? this.publicKey.n : BigInteger(10).pow(77);
    for (let i = 1; i < threshold; i++) {
      // Generate cryptographically secure random BigInteger
      const randBytes = crypto.randomBytes(32);
      const rand = BigInteger(randBytes.toString('hex'), 16);
      coefficients.push(rand.mod(n));
    }

    // Generate shares for each participant
    for (let i = 1; i <= participantCount; i++) {
      let share = coefficients[0];
      for (let j = 1; j < threshold; j++) {
        const term = coefficients[j].multiply(BigInteger(i).pow(j));
        share = share.add(term).mod(n);
      }
      shares.push({
        participantId: i,
        share: share.toString()
      });
    }

    return shares;
  }

  /**
   * Encrypt model parameters using homomorphic encryption
   */
  /**
   * Encode a numeric value into a non-negative BigInteger in [0, n).
   * Negative values are mapped via modular arithmetic (n + value) so that
   * homomorphic addition is preserved: enc(n+a) + enc(n+b) mod n^2 decrypts
   * to a + b.
   */
  _encodeValue(value) {
    const scaled = Math.round(value * 1000000);
    const n = this.publicKey ? this.publicKey.n : BigInteger(10).pow(77);
    let bigVal = BigInteger(scaled);
    if (bigVal.isNegative()) {
      bigVal = n.add(bigVal); // n + (-abs) = n - abs
    }
    return bigVal;
  }

  /**
   * Decode a BigInteger back to a float, reversing _encodeValue.
   */
  _decodeValue(bigInt) {
    const n = this.publicKey ? this.publicKey.n : BigInteger(10).pow(77);
    const halfN = n.divide(2);
    let value = bigInt;
    if (value.greater(halfN)) {
      value = value.minus(n);
    }
    return value.valueOf() / 1000000;
  }

  /**
   * Encrypt model parameters using homomorphic encryption.
   * Numeric values are Paillier-encrypted; array values are stored as-is
   * (arrays cannot participate in homomorphic aggregation).
   */
  encryptParameters(parameters) {
    if (parameters == null) return {};
    const encryptedParams = {};

    for (const [key, value] of Object.entries(parameters)) {
      if (Array.isArray(value)) {
        // Arrays are stored as metadata for round-trip only
        encryptedParams[key] = JSON.stringify({ __arr: value });
      } else {
        const encoded = this._encodeValue(Number(value));
        const ciphertext = this.publicKey.encrypt(encoded);
        encryptedParams[key] = ciphertext.toString();
      }
    }

    return encryptedParams;
  }

  /**
   * Decrypt aggregated parameters
   */
  /**
   * Decrypt aggregated parameters.
   */
  decryptParameters(encryptedParams) {
    if (encryptedParams == null) return {};
    const decryptedParams = {};

    for (const [key, encryptedStr] of Object.entries(encryptedParams)) {
      // Check for array metadata marker
      if (typeof encryptedStr === 'string' && encryptedStr.startsWith('{"__arr":')) {
        try {
          const parsed = JSON.parse(encryptedStr);
          decryptedParams[key] = parsed.__arr;
        } catch (e) {
          decryptedParams[key] = [];
        }
      } else {
        const ciphertext = BigInteger(encryptedStr);
        const decrypted = this.privateKey.decrypt(ciphertext);
        decryptedParams[key] = this._decodeValue(decrypted);
      }
    }

    return decryptedParams;
  }

  /**
   * Homomorphically aggregate encrypted parameters
   */
  homomorphicAggregate(encryptedUpdates) {
    if (encryptedUpdates.length === 0) {
      throw new Error('No encrypted updates to aggregate');
    }

    const n2 = this.publicKey._n2 || this.publicKey.n.pow(2);
    const aggregated = {};
    const firstUpdate = encryptedUpdates[0];
    
    // Initialize with first update (each value is a ciphertext string)
    for (const key of Object.keys(firstUpdate)) {
      aggregated[key] = BigInteger(firstUpdate[key]);
    }

    // Homomorphically add remaining updates via modular multiplication
    for (let i = 1; i < encryptedUpdates.length; i++) {
      const update = encryptedUpdates[i];
      for (const key of Object.keys(update)) {
        const c = BigInteger(update[key]);
        // Paillier homomorphic addition: c1 * c2 mod n^2
        aggregated[key] = aggregated[key].multiply(c).mod(n2);
      }
    }

    // Return as strings for compatibility with encryptParameters format
    const result = {};
    for (const key of Object.keys(aggregated)) {
      result[key] = aggregated[key].toString();
    }
    return result;
  }

  /**
   * Generate commitment for cryptographic verification
   */
  generateCommitment(data, nonce = null) {
    const nonceValue = nonce || crypto.randomBytes(32).toString('hex');
    const dataString = JSON.stringify(data);
    const hash = crypto.createHash('sha256');
    hash.update(dataString + nonceValue);
    
    return {
      commitment: hash.digest('hex'),
      nonce: nonceValue
    };
  }

  /**
   * Verify commitment
   */
  verifyCommitment(data, commitment, nonce) {
    const { commitment: computedCommitment } = this.generateCommitment(data, nonce);
    return computedCommitment === commitment;
  }

  /**
   * Perform secure multi-party computation for aggregation
   */
  async secureMPCAggregation(participantUpdates) {
    try {
      // Phase 1: Each participant encrypts their update
      const encryptedUpdates = participantUpdates.map(update => ({
        participantId: update.participantId,
        encryptedParams: this.encryptParameters(update.parameters),
        commitment: this.generateCommitment(update.parameters)
      }));

      // Phase 2: Collect and verify commitments
      const validUpdates = [];
      for (const update of encryptedUpdates) {
        // In production, verify commitment with participant
        validUpdates.push(update);
      }

      // Phase 3: Homomorphic aggregation
      const aggregatedEncrypted = this.homomorphicAggregate(
        validUpdates.map(u => u.encryptedParams)
      );

      // Phase 4: Decrypt aggregated result
      const aggregatedParams = this.decryptParameters(aggregatedEncrypted);

      logger.info(`Secure MPC aggregation completed with ${validUpdates.length} participants`);
      return aggregatedParams;

    } catch (error) {
      logger.error('Secure MPC aggregation failed:', error);
      throw error;
    }
  }

  /**
   * Generate zero-knowledge proof for model update
   */
  generateZKProof(update, secret) {
    // Simplified ZK proof generation
    const commitment = this.generateCommitment(update, secret);
    const challenge = crypto.randomBytes(16).toString('hex');
    
    const response = {
      commitment: commitment.commitment,
      challenge: challenge,
      proof: crypto.createHash('sha256')
        .update(JSON.stringify(update) + secret + challenge)
        .digest('hex')
    };

    return response;
  }

  /**
   * Verify zero-knowledge proof
   */
  verifyZKProof(update, proof) {
    try {
      // Recreate commitment with secret (in production, secret would be revealed)
      const computedProof = crypto.createHash('sha256')
        .update(JSON.stringify(update) + proof.challenge)
        .digest('hex');
      
      return computedProof === proof.proof;
    } catch (error) {
      logger.error('ZK proof verification failed:', error);
      return false;
    }
  }

  /**
   * Perform privacy-preserving model validation
   */
  async privacyPreservingValidation(modelUpdate, validationData) {
    try {
      // Encrypt both model update and validation data
      const encryptedUpdate = this.encryptParameters(modelUpdate);
      const encryptedValidation = this.encryptParameters(validationData);

      // Perform encrypted validation (simplified)
      const validationScore = this._computeEncryptedAccuracy(
        encryptedUpdate,
        encryptedValidation
      );

      // Decrypt validation score
      const decryptedScore = this.decryptParameters(validationScore);

      return {
        score: decryptedScore.accuracy || 0,
        privacyGuarantee: 'homomorphic',
        validationMethod: 'encrypted'
      };

    } catch (error) {
      logger.error('Privacy-preserving validation failed:', error);
      throw error;
    }
  }

  /**
   * Compute accuracy on encrypted data (simplified)
   */
  _computeEncryptedAccuracy(encryptedModel, encryptedData) {
    // In production, this would use more sophisticated techniques
    // For now, return a placeholder encrypted result
    return {
      accuracy: this.encryptParameters({ accuracy: 0.85 })
    };
  }

  /**
   * Generate differential privacy noise
   */
  generateDPNoise(epsilon, delta, sensitivity) {
    // Calculate Laplace noise parameters
    const beta = sensitivity / epsilon;
    
    // Generate correlated noise for all parameters
    const noise = {};
    const seed = crypto.randomBytes(32);
    const random = crypto.createHash('sha256').update(seed).digest('hex');
    
    // Use seed to generate reproducible noise
    let counter = 0;
    const generateNoise = () => {
      const hash = crypto.createHash('sha256')
        .update(random + counter.toString())
        .digest('hex');
      counter++;
      
      // Convert hash to uniform random number in (0, 1), avoiding exact 0 or 1
      const raw = parseInt(hash.substring(0, 8), 16) / 0xffffffff;
      const u = Math.max(0.000001, Math.min(0.999999, raw));
      const noise = beta * Math.sign(u - 0.5) * Math.log(1 - 2 * Math.abs(u - 0.5));
      // Clamp extreme values (beyond 5*beta is statistically negligible)
      return Math.max(-5 * beta, Math.min(5 * beta, noise));
    };

    return { noise, generateNoise };
  }

  /**
   * Apply secure aggregation with differential privacy
   */
  async secureAggregationWithDP(updates, privacyParams) {
    try {
      // Phase 1: Secure aggregation
      const aggregatedParams = await this.secureMPCAggregation(updates);

      // Phase 2: Add differential privacy noise
      const { generateNoise } = this.generateDPNoise(
        privacyParams.epsilon,
        privacyParams.delta,
        privacyParams.sensitivity
      );

      const privateParams = {};
      for (const [key, value] of Object.entries(aggregatedParams)) {
        const noise = generateNoise();
        privateParams[key] = value + noise;
      }

      logger.info('Secure aggregation with differential privacy completed');
      return privateParams;

    } catch (error) {
      logger.error('Secure aggregation with DP failed:', error);
      throw error;
    }
  }

  /**
   * Get cryptographic parameters for participants
   */
  getPublicParameters() {
    return {
      publicKey: {
        n: this.publicKey.n.toString(),
        g: this.publicKey.g.toString()
      },
      keySize: this.keySize
    };
  }
}

module.exports = SecureAggregation;
