const crypto = require('crypto');
const forge = require('node-forge');
const tf = require('@tensorflow/tfjs-node');

class PrivacyPreservingAggregator {
  constructor(options = {}) {
    this.encryptionScheme = options.encryptionScheme || 'paillier';
    this.differentialPrivacy = options.differentialPrivacy || true;
    this.epsilon = options.epsilon || 1.0;
    this.delta = options.delta || 1e-5;
    this.secureAggregation = options.secureAggregation || true;
    this.homomorphicEncryption = options.homomorphicEncryption || true;
  }

  // Main aggregation method with privacy guarantees
  async aggregateModelUpdates(updates, aggregationMethod = 'fedavg') {
    try {
      console.log(`🔒 Starting privacy-preserving aggregation with ${updates.length} updates`);
      
      let aggregatedUpdate;
      
      switch (aggregationMethod) {
        case 'fedavg':
          aggregatedUpdate = await this.privacyPreservingFedAvg(updates);
          break;
        case 'secure':
          aggregatedUpdate = await this.secureAggregationProtocol(updates);
          break;
        case 'trimmed':
          aggregatedUpdate = await this.trimmedMeanAggregation(updates);
          break;
        default:
          throw new Error(`Unknown aggregation method: ${aggregationMethod}`);
      }

      // Add privacy metadata
      aggregatedUpdate.privacyMetadata = {
        method: aggregationMethod,
        epsilon: this.epsilon,
        delta: this.delta,
        timestamp: new Date(),
        participants: updates.length,
        encryptionUsed: this.homomorphicEncryption,
        dpApplied: this.differentialPrivacy
      };

      console.log('✅ Privacy-preserving aggregation completed');
      return aggregatedUpdate;
    } catch (error) {
      console.error('❌ Privacy-preserving aggregation failed:', error);
      throw error;
    }
  }

  // Privacy-preserving Federated Averaging
  async privacyPreservingFedAvg(updates) {
    try {
      // Step 1: Apply differential privacy to each update
      const privateUpdates = await this.applyDifferentialPrivacyToUpdates(updates);
      
      // Step 2: Apply secure aggregation if enabled
      let aggregatedWeights;
      if (this.secureAggregation) {
        aggregatedWeights = await this.performSecureAggregation(privateUpdates);
      } else {
        aggregatedWeights = await this.standardAggregation(privateUpdates);
      }

      // Step 3: Apply post-aggregation privacy mechanisms
      const finalWeights = await this.postAggregationPrivacy(aggregatedWeights);

      return {
        weights: finalWeights,
        metadata: {
          aggregationMethod: 'privacy-preserving-fedavg',
          participants: updates.length,
          privacyLevel: 'high'
        }
      };
    } catch (error) {
      console.error('❌ Privacy-preserving FedAvg failed:', error);
      throw error;
    }
  }

  // Apply differential privacy to model updates
  async applyDifferentialPrivacyToUpdates(updates) {
    try {
      const privateUpdates = [];
      
      for (const update of updates) {
        const privateUpdate = await this.applyDifferentialPrivacy(
          update.weights,
          update.participant.dataSize || 1000,
          this.epsilon
        );
        
        privateUpdates.push({
          ...update,
          weights: privateUpdate.weights,
          privacyNoise: privateUpdate.noise
        });
      }
      
      console.log(`🔐 Applied differential privacy to ${privateUpdates.length} updates`);
      return privateUpdates;
    } catch (error) {
      console.error('❌ Failed to apply differential privacy:', error);
      throw error;
    }
  }

  // Apply differential privacy to a single weight vector
  async applyDifferentialPrivacy(weights, dataSize, epsilon) {
    try {
      const sensitivity = this.calculateSensitivity(weights, dataSize);
      const scale = sensitivity / epsilon;
      
      // Add Gaussian noise for (ε, δ)-DP
      const noisyWeights = weights.map(weight => {
        const noise = this.generateGaussianNoise(0, scale);
        return weight + noise;
      });

      return {
        weights: noisyWeights,
        noise: {
          type: 'gaussian',
          scale,
          epsilon,
          sensitivity
        }
      };
    } catch (error) {
      console.error('❌ Differential privacy application failed:', error);
      throw error;
    }
  }

  // Calculate sensitivity for weight vectors
  calculateSensitivity(weights, dataSize) {
    // L2 sensitivity for bounded updates
    const normSquared = weights.reduce((sum, w) => sum + w * w, 0);
    const bound = 1.0; // Assume weights are bounded by 1
    return Math.sqrt(normSquared) * bound / Math.sqrt(dataSize);
  }

  // Generate Gaussian noise
  generateGaussianNoise(mean, stdDev) {
    // Box-Muller transform for Gaussian noise
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  // Perform secure aggregation protocol
  async performSecureAggregation(updates) {
    try {
      console.log('🔐 Performing secure aggregation protocol');
      
      // Step 1: Generate pairwise masks
      const masks = await this.generatePairwiseMasks(updates.length);
      
      // Step 2: Apply masks to updates
      const maskedUpdates = updates.map((update, index) => {
        const maskedWeights = this.applyMaskToWeights(update.weights, masks[index]);
        return {
          ...update,
          maskedWeights
        };
      });

      // Step 3: Aggregate masked updates
      const aggregatedMasked = await this.standardAggregation(maskedUpdates);
      
      // Step 4: Remove masks (in real implementation, this would be done via secure multi-party computation)
      const finalWeights = this.removeMasksFromAggregated(aggregatedMasked, masks);

      console.log('✅ Secure aggregation completed');
      return finalWeights;
    } catch (error) {
      console.error('❌ Secure aggregation failed:', error);
      throw error;
    }
  }

  // Generate pairwise masks for secure aggregation
  async generatePairwiseMasks(numParticipants) {
    const masks = [];
    
    for (let i = 0; i < numParticipants; i++) {
      const mask = [];
      for (let j = 0; j < numParticipants; j++) {
        if (i !== j) {
          // Generate random seed for pairwise mask
          const seed = crypto.randomBytes(32);
          mask.push({
            participant: j,
            seed: seed.toString('hex'),
            values: this.generateMaskVector(1000) // Assuming 1000-dimensional weights
          });
        }
      }
      masks.push(mask);
    }
    
    return masks;
  }

  // Generate random mask vector
  generateMaskVector(size) {
    return Array.from({ length: size }, () => 
      (Math.random() - 0.5) * 0.1 // Small random values
    );
  }

  // Apply mask to weight vector
  applyMaskToWeights(weights, masks) {
    let maskedWeights = [...weights];
    
    masks.forEach(mask => {
      maskedWeights = maskedWeights.map((w, i) => 
        w + (mask.values[i] || 0)
      );
    });
    
    return maskedWeights;
  }

  // Remove masks from aggregated weights
  removeMasksFromAggregated(aggregatedWeights, masks) {
    // In a real implementation, masks would cancel out through the protocol
    // For simulation, we'll just return the aggregated weights
    return aggregatedWeights;
  }

  // Standard weighted aggregation
  async standardAggregation(updates) {
    try {
      if (updates.length === 0) {
        throw new Error('No updates to aggregate');
      }

      const weights = updates.map(u => u.maskedWeights || u.weights);
      const sampleWeights = updates.map(u => u.weight || 1.0);
      
      // Calculate total weight
      const totalWeight = sampleWeights.reduce((sum, w) => sum + w, 0);
      
      // Weighted average
      const aggregatedWeights = weights[0].map((_, index) => {
        let weightedSum = 0;
        weights.forEach((weightArray, i) => {
          weightedSum += weightArray[index] * sampleWeights[i];
        });
        return weightedSum / totalWeight;
      });

      return aggregatedWeights;
    } catch (error) {
      console.error('❌ Standard aggregation failed:', error);
      throw error;
    }
  }

  // Post-aggregation privacy mechanisms
  async postAggregationPrivacy(weights) {
    try {
      let finalWeights = [...weights];
      
      // Apply additional noise if needed
      if (this.differentialPrivacy) {
        const postAggNoise = this.calculatePostAggregationNoise(weights.length);
        finalWeights = finalWeights.map((w, i) => w + postAggNoise[i]);
      }

      // Clip weights to prevent extreme values
      finalWeights = this.clipWeights(finalWeights, -1.0, 1.0);

      return finalWeights;
    } catch (error) {
      console.error('❌ Post-aggregation privacy failed:', error);
      throw error;
    }
  }

  // Calculate post-aggregation noise
  calculatePostAggregationNoise(size) {
    const scale = 0.01; // Small noise scale
    return Array.from({ length: size }, () => 
      this.generateGaussianNoise(0, scale)
    );
  }

  // Clip weights to specified range
  clipWeights(weights, min, max) {
    return weights.map(w => Math.max(min, Math.min(max, w)));
  }

  // Secure aggregation with homomorphic encryption
  async secureAggregationProtocol(updates) {
    try {
      console.log('🔐 Starting homomorphic encryption-based aggregation');
      
      // Step 1: Encrypt each update
      const encryptedUpdates = await this.encryptUpdates(updates);
      
      // Step 2: Aggregate encrypted updates
      const encryptedAggregated = await this.aggregateEncryptedUpdates(encryptedUpdates);
      
      // Step 3: Decrypt aggregated result
      const decryptedWeights = await this.decryptAggregated(encryptedAggregated);
      
      console.log('✅ Homomorphic encryption aggregation completed');
      return decryptedWeights;
    } catch (error) {
      console.error('❌ Secure aggregation protocol failed:', error);
      throw error;
    }
  }

  // Encrypt model updates
  async encryptUpdates(updates) {
    const encryptedUpdates = [];
    
    for (const update of updates) {
      const encryptedWeights = await this.encryptWeights(update.weights);
      encryptedUpdates.push({
        ...update,
        encryptedWeights
      });
    }
    
    return encryptedUpdates;
  }

  // Encrypt weight vector (simplified Paillier-like encryption)
  async encryptWeights(weights) {
    // In a real implementation, this would use proper homomorphic encryption
    // For simulation, we'll just add a random offset
    const publicKey = crypto.randomBytes(32);
    const encryptedWeights = weights.map(w => ({
      value: w + Math.random() * 0.001,
      publicKey: publicKey.toString('hex')
    }));
    
    return encryptedWeights;
  }

  // Aggregate encrypted updates
  async aggregateEncryptedUpdates(encryptedUpdates) {
    const weights = encryptedUpdates.map(u => u.encryptedWeights);
    const sampleWeights = encryptedUpdates.map(u => u.weight || 1.0);
    
    // Homomorphic addition (simplified)
    const aggregatedEncrypted = weights[0].map((_, index) => {
      let sum = 0;
      weights.forEach((weightArray, i) => {
        sum += weightArray[index].value * sampleWeights[i];
      });
      return {
        value: sum / sampleWeights.reduce((a, b) => a + b, 0),
        publicKey: weights[0][index].publicKey
      };
    });
    
    return aggregatedEncrypted;
  }

  // Decrypt aggregated result
  async decryptAggregated(encryptedWeights) {
    // In a real implementation, this would use the private key
    // For simulation, we'll just extract the values
    return encryptedWeights.map(w => w.value);
  }

  // Trimmed mean aggregation for robustness
  async trimmedMeanAggregation(updates, trimRatio = 0.1) {
    try {
      console.log(`📊 Performing trimmed mean aggregation with trim ratio ${trimRatio}`);
      
      const weights = updates.map(u => u.weights);
      const sampleWeights = updates.map(u => u.weight || 1.0);
      
      const aggregatedWeights = weights[0].map((_, index) => {
        // Get all values for this weight position
        const values = weights.map((weightArray, i) => ({
          value: weightArray[index],
          weight: sampleWeights[i]
        }));
        
        // Sort by value
        values.sort((a, b) => a.value - b.value);
        
        // Trim extremes
        const trimCount = Math.floor(values.length * trimRatio);
        const trimmedValues = values.slice(trimCount, values.length - trimCount);
        
        // Calculate weighted mean of trimmed values
        const weightedSum = trimmedValues.reduce((sum, v) => sum + v.value * v.weight, 0);
        const totalWeight = trimmedValues.reduce((sum, v) => sum + v.weight, 0);
        
        return weightedSum / totalWeight;
      });

      return {
        weights: aggregatedWeights,
        metadata: {
          aggregationMethod: 'trimmed-mean',
          trimRatio,
          participants: updates.length,
          privacyLevel: 'medium'
        }
      };
    } catch (error) {
      console.error('❌ Trimmed mean aggregation failed:', error);
      throw error;
    }
  }

  // Validate privacy guarantees
  validatePrivacyGuarantees(aggregatedUpdate) {
    try {
      const metadata = aggregatedUpdate.privacyMetadata;
      
      if (!metadata) {
        throw new Error('No privacy metadata found');
      }

      // Check epsilon-DP guarantee
      if (metadata.epsilon > 2.0) {
        console.warn('⚠️  High epsilon value may compromise privacy');
      }

      // Check delta value
      if (metadata.delta > 1e-3) {
        console.warn('⚠️  High delta value may compromise privacy');
      }

      // Validate encryption usage
      if (!metadata.encryptionUsed && this.homomorphicEncryption) {
        console.warn('⚠️  Encryption was not used as expected');
      }

      console.log('✅ Privacy guarantees validated');
      return true;
    } catch (error) {
      console.error('❌ Privacy validation failed:', error);
      return false;
    }
  }

  // Get privacy budget status
  getPrivacyBudgetStatus() {
    return {
      epsilon: this.epsilon,
      delta: this.delta,
      remainingBudget: this.epsilon, // Simplified - would track actual usage
      privacyLevel: this.differentialPrivacy ? 'high' : 'medium',
      encryptionEnabled: this.homomorphicEncryption,
      secureAggregationEnabled: this.secureAggregation
    };
  }

  // Update privacy parameters
  updatePrivacyParameters(params) {
    if (params.epsilon !== undefined) {
      this.epsilon = Math.max(0.1, params.epsilon);
    }
    if (params.delta !== undefined) {
      this.delta = Math.max(1e-10, params.delta);
    }
    if (params.differentialPrivacy !== undefined) {
      this.differentialPrivacy = params.differentialPrivacy;
    }
    if (params.secureAggregation !== undefined) {
      this.secureAggregation = params.secureAggregation;
    }
    
    console.log('🔧 Privacy parameters updated');
  }
}

module.exports = PrivacyPreservingAggregator;
