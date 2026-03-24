const crypto = require('crypto');
const EventEmitter = require('events');

class DifferentialPrivacyService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.epsilon = options.epsilon || 1.0;
    this.delta = options.delta || 1e-5;
    this.sensitivity = options.sensitivity || 1.0;
    this.mechanism = options.mechanism || 'gaussian';
    this.privacyBudget = options.privacyBudget || 10.0;
    this.remainingBudget = this.privacyBudget;
    this.queries = new Map();
    this.queryHistory = [];
  }

  // Apply differential privacy to a value
  applyDifferentialPrivacy(value, queryType = 'count', customEpsilon = null) {
    try {
      const epsilon = customEpsilon || this.epsilon;
      
      // Check privacy budget
      if (this.remainingBudget < epsilon) {
        throw new Error('Insufficient privacy budget');
      }

      let noisyValue;
      let noiseAdded;

      switch (this.mechanism) {
        case 'laplace':
          noisyValue = this.applyLaplaceMechanism(value, epsilon);
          noiseAdded = noisyValue - value;
          break;
        case 'gaussian':
          noisyValue = this.applyGaussianMechanism(value, epsilon);
          noiseAdded = noisyValue - value;
          break;
        case 'exponential':
          noisyValue = this.applyExponentialMechanism(value, queryType);
          noiseAdded = null; // Exponential mechanism doesn't add additive noise
          break;
        default:
          throw new Error(`Unknown privacy mechanism: ${this.mechanism}`);
      }

      // Update privacy budget
      this.updatePrivacyBudget(epsilon);

      // Record query
      const queryId = this.recordQuery(queryType, epsilon, value, noisyValue);

      console.log(`🔐 Applied ${this.mechanism} mechanism with ε=${epsilon}`);
      console.log(`📊 Original: ${value}, Noisy: ${noisyValue}, Noise: ${noiseAdded?.toFixed(6) || 'N/A'}`);

      this.emit('privacyApplied', {
        queryId,
        originalValue: value,
        noisyValue,
        epsilon,
        mechanism: this.mechanism
      });

      return {
        value: noisyValue,
        privacyMetadata: {
          epsilon,
          delta: this.delta,
          mechanism: this.mechanism,
          sensitivity: this.sensitivity,
          queryId,
          remainingBudget: this.remainingBudget
        }
      };
    } catch (error) {
      console.error('❌ Failed to apply differential privacy:', error);
      throw error;
    }
  }

  // Apply Laplace mechanism
  applyLaplaceMechanism(value, epsilon) {
    const scale = this.sensitivity / epsilon;
    const noise = this.generateLaplaceNoise(0, scale);
    return value + noise;
  }

  // Apply Gaussian mechanism
  applyGaussianMechanism(value, epsilon) {
    const scale = this.sensitivity * Math.sqrt(2 * Math.log(1.25 / this.delta)) / epsilon;
    const noise = this.generateGaussianNoise(0, scale);
    return value + noise;
  }

  // Apply Exponential mechanism
  applyExponentialMechanism(candidates, queryType) {
    if (!Array.isArray(candidates)) {
      throw new Error('Exponential mechanism requires an array of candidates');
    }

    // Score candidates (simplified - would depend on utility function)
    const scores = candidates.map(candidate => ({
      candidate,
      score: this.scoreCandidate(candidate, queryType)
    }));

    // Apply exponential mechanism
    const maxScore = Math.max(...scores.map(s => s.score));
    const probabilities = scores.map(s => 
      Math.exp((s.score - maxScore) * this.epsilon / this.sensitivity)
    );
    
    const totalProb = probabilities.reduce((sum, p) => sum + p, 0);
    const normalizedProbs = probabilities.map(p => p / totalProb);

    // Sample according to probabilities
    const random = Math.random();
    let cumulativeProb = 0;
    
    for (let i = 0; i < normalizedProbs.length; i++) {
      cumulativeProb += normalizedProbs[i];
      if (random <= cumulativeProb) {
        return scores[i].candidate;
      }
    }

    return scores[scores.length - 1].candidate;
  }

  // Score candidate for exponential mechanism
  scoreCandidate(candidate, queryType) {
    // Simplified scoring - would depend on specific utility function
    switch (queryType) {
      case 'max':
        return candidate;
      case 'min':
        return -candidate;
      case 'mode':
        return 1; // All candidates equally likely for mode
      default:
        return Math.abs(candidate);
    }
  }

  // Generate Laplace noise
  generateLaplaceNoise(mean, scale) {
    const uniform = Math.random() - 0.5;
    return mean - scale * Math.sign(uniform) * Math.log(1 - 2 * Math.abs(uniform));
  }

  // Generate Gaussian noise
  generateGaussianNoise(mean, stdDev) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + stdDev * z0;
  }

  // Apply differential privacy to model weights
  applyDPToModelWeights(weights, epsilon = null) {
    try {
      const epsilonToUse = epsilon || this.epsilon;
      
      if (this.remainingBudget < epsilonToUse) {
        throw new Error('Insufficient privacy budget for model weights');
      }

      const noisyWeights = weights.map(weight => {
        const dpResult = this.applyDifferentialPrivacy(weight, 'weight', epsilonToUse / weights.length);
        return dpResult.value;
      });

      console.log(`🤖 Applied DP to model weights with total ε=${epsilonToUse}`);
      
      return {
        weights: noisyWeights,
        privacyMetadata: {
          epsilon: epsilonToUse,
          mechanism: this.mechanism,
          sensitivity: this.sensitivity,
          remainingBudget: this.remainingBudget
        }
      };
    } catch (error) {
      console.error('❌ Failed to apply DP to model weights:', error);
      throw error;
    }
  }

  // Apply differential privacy to gradients
  applyDPToGradients(gradients, clipNorm = 1.0, epsilon = null) {
    try {
      const epsilonToUse = epsilon || this.epsilon;
      
      if (this.remainingBudget < epsilonToUse) {
        throw new Error('Insufficient privacy budget for gradients');
      }

      // Step 1: Clip gradients to bound sensitivity
      const clippedGradients = this.clipGradients(gradients, clipNorm);
      
      // Step 2: Add noise
      const noisyGradients = clippedGradients.map(gradient => {
        const dpResult = this.applyDifferentialPrivacy(gradient, 'gradient', epsilonToUse / gradients.length);
        return dpResult.value;
      });

      console.log(`📈 Applied DP to gradients with clip norm ${clipNorm}, ε=${epsilonToUse}`);
      
      return {
        gradients: noisyGradients,
        privacyMetadata: {
          epsilon: epsilonToUse,
          clipNorm,
          mechanism: this.mechanism,
          sensitivity: clipNorm,
          remainingBudget: this.remainingBudget
        }
      };
    } catch (error) {
      console.error('❌ Failed to apply DP to gradients:', error);
      throw error;
    }
  }

  // Clip gradients to bound L2 norm
  clipGradients(gradients, clipNorm) {
    const squaredSum = gradients.reduce((sum, g) => sum + g * g, 0);
    const norm = Math.sqrt(squaredSum);
    
    if (norm <= clipNorm) {
      return gradients;
    }
    
    const scale = clipNorm / norm;
    return gradients.map(g => g * scale);
  }

  // Privacy accounting for adaptive queries
  privacyAccounting(epsilon1, epsilon2, delta1, delta2) {
    // Composition theorems for differential privacy
    const totalEpsilon = epsilon1 + epsilon2;
    const totalDelta = delta1 + delta2;
    
    return {
      epsilon: totalEpsilon,
      delta: totalDelta,
      composition: 'basic'
    };
  }

  // Advanced composition theorem
  advancedComposition(epsilon, delta, k) {
    // For k queries with (ε, δ)-DP each
    const totalEpsilon = epsilon * Math.sqrt(2 * k * Math.log(1 / delta)) + k * epsilon * (Math.exp(epsilon) - 1);
    const totalDelta = k * delta + Math.exp(k * epsilon) - 1;
    
    return {
      epsilon: totalEpsilon,
      delta: Math.min(totalDelta, 1),
      composition: 'advanced'
    };
  }

  // Update privacy budget
  updatePrivacyBudget(epsilonUsed) {
    this.remainingBudget -= epsilonUsed;
    
    if (this.remainingBudget < 0) {
      this.remainingBudget = 0;
      console.warn('⚠️  Privacy budget exhausted');
    }
    
    console.log(`💰 Privacy budget: ${this.remainingBudget.toFixed(3)}/${this.privacyBudget}`);
  }

  // Reset privacy budget
  resetPrivacyBudget() {
    this.remainingBudget = this.privacyBudget;
    console.log(`💰 Privacy budget reset to ${this.privacyBudget}`);
  }

  // Record query for tracking
  recordQuery(queryType, epsilon, originalValue, noisyValue) {
    const queryId = crypto.randomBytes(16).toString('hex');
    
    const query = {
      id: queryId,
      type: queryType,
      epsilon,
      timestamp: new Date(),
      originalValue,
      noisyValue,
      mechanism: this.mechanism
    };
    
    this.queries.set(queryId, query);
    this.queryHistory.push(query);
    
    // Keep only last 1000 queries in history
    if (this.queryHistory.length > 1000) {
      this.queryHistory = this.queryHistory.slice(-1000);
    }
    
    return queryId;
  }

  // Get privacy budget status
  getPrivacyBudgetStatus() {
    return {
      totalBudget: this.privacyBudget,
      remainingBudget: this.remainingBudget,
      usedBudget: this.privacyBudget - this.remainingBudget,
      percentageUsed: ((this.privacyBudget - this.remainingBudget) / this.privacyBudget * 100).toFixed(2),
      mechanism: this.mechanism,
      epsilon: this.epsilon,
      delta: this.delta,
      sensitivity: this.sensitivity
    };
  }

  // Get query history
  getQueryHistory(limit = 100) {
    return this.queryHistory.slice(-limit);
  }

  // Analyze privacy loss
  analyzePrivacyLoss() {
    if (this.queryHistory.length === 0) {
      return {
        totalEpsilon: 0,
        totalDelta: 0,
        averageEpsilon: 0,
        queryCount: 0
      };
    }

    const totalEpsilon = this.queryHistory.reduce((sum, query) => sum + query.epsilon, 0);
    const totalDelta = this.queryHistory.reduce((sum, query) => sum + (this.delta || 0), 0);
    const averageEpsilon = totalEpsilon / this.queryHistory.length;

    return {
      totalEpsilon,
      totalDelta,
      averageEpsilon,
      queryCount: this.queryHistory.length,
      mechanismDistribution: this.getMechanismDistribution()
    };
  }

  // Get distribution of mechanisms used
  getMechanismDistribution() {
    const distribution = {};
    
    this.queryHistory.forEach(query => {
      distribution[query.mechanism] = (distribution[query.mechanism] || 0) + 1;
    });
    
    return distribution;
  }

  // Validate privacy parameters
  validatePrivacyParameters() {
    const issues = [];
    
    if (this.epsilon <= 0) {
      issues.push('Epsilon must be positive');
    }
    
    if (this.epsilon > 10) {
      issues.push('Epsilon is very high, privacy guarantees may be weak');
    }
    
    if (this.delta < 0 || this.delta >= 1) {
      issues.push('Delta must be in [0, 1)');
    }
    
    if (this.sensitivity <= 0) {
      issues.push('Sensitivity must be positive');
    }
    
    if (this.privacyBudget <= 0) {
      issues.push('Privacy budget must be positive');
    }
    
    if (issues.length > 0) {
      console.warn('⚠️  Privacy parameter validation issues:', issues);
      return false;
    }
    
    console.log('✅ Privacy parameters are valid');
    return true;
  }

  // Update privacy parameters
  updatePrivacyParameters(params) {
    const oldParams = {
      epsilon: this.epsilon,
      delta: this.delta,
      sensitivity: this.sensitivity,
      mechanism: this.mechanism,
      privacyBudget: this.privacyBudget
    };

    if (params.epsilon !== undefined) {
      this.epsilon = Math.max(0.01, params.epsilon);
    }
    if (params.delta !== undefined) {
      this.delta = Math.max(1e-10, Math.min(0.5, params.delta));
    }
    if (params.sensitivity !== undefined) {
      this.sensitivity = Math.max(0.01, params.sensitivity);
    }
    if (params.mechanism !== undefined) {
      if (['laplace', 'gaussian', 'exponential'].includes(params.mechanism)) {
        this.mechanism = params.mechanism;
      } else {
        throw new Error('Invalid mechanism. Must be laplace, gaussian, or exponential');
      }
    }
    if (params.privacyBudget !== undefined) {
      this.privacyBudget = Math.max(0.1, params.privacyBudget);
      this.remainingBudget = this.privacyBudget;
    }

    console.log('🔧 Privacy parameters updated');
    console.log('Old:', oldParams);
    console.log('New:', {
      epsilon: this.epsilon,
      delta: this.delta,
      sensitivity: this.sensitivity,
      mechanism: this.mechanism,
      privacyBudget: this.privacyBudget
    });

    this.emit('parametersUpdated', { oldParams, newParams: this.getPrivacyBudgetStatus() });
  }

  // Export privacy report
  exportPrivacyReport() {
    const report = {
      timestamp: new Date(),
      configuration: {
        epsilon: this.epsilon,
        delta: this.delta,
        sensitivity: this.sensitivity,
        mechanism: this.mechanism,
        privacyBudget: this.privacyBudget
      },
      budget: this.getPrivacyBudgetStatus(),
      analysis: this.analyzePrivacyLoss(),
      recentQueries: this.getQueryHistory(50),
      validation: this.validatePrivacyParameters()
    };

    return report;
  }

  // Clear query history
  clearQueryHistory() {
    this.queries.clear();
    this.queryHistory = [];
    console.log('🗑️  Query history cleared');
  }
}

module.exports = DifferentialPrivacyService;
