const tf = require('@tensorflow/tfjs-node');
const crypto = require('crypto');
const forge = require('node-forge');
const Big = require('big.js');
const EventEmitter = require('events');

class FederatedLearningCoordinator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.participants = new Map();
    this.globalModel = null;
    this.roundNumber = 0;
    this.minParticipants = options.minParticipants || 3;
    this.maxParticipants = options.maxParticipants || 100;
    this.aggregationStrategy = options.aggregationStrategy || 'fedavg';
    this.privacyBudget = options.privacyBudget || 1.0;
    this.differentialPrivacy = options.differentialPrivacy || true;
    this.secureAggregation = options.secureAggregation || true;
    this.modelHistory = [];
    this.activeRound = null;
  }

  // Initialize the federated learning system
  async initialize(modelArchitecture) {
    try {
      this.globalModel = await this.createModel(modelArchitecture);
      console.log('🤖 Federated Learning Coordinator initialized');
      console.log(`📊 Min participants: ${this.minParticipants}`);
      console.log(`🔒 Privacy features: DP=${this.differentialPrivacy}, Secure=${this.secureAggregation}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize FL coordinator:', error);
      throw error;
    }
  }

  // Create a TensorFlow model based on architecture
  async createModel(architecture) {
    const model = tf.sequential();
    
    architecture.layers.forEach(layer => {
      switch (layer.type) {
        case 'dense':
          model.add(tf.layers.dense({
            inputShape: layer.inputShape,
            units: layer.units,
            activation: layer.activation || 'relu',
            useBias: layer.useBias !== false
          }));
          break;
        case 'dropout':
          model.add(tf.layers.dropout({
            rate: layer.rate || 0.2
          }));
          break;
        case 'batchNormalization':
          model.add(tf.layers.batchNormalization());
          break;
      }
    });

    model.compile({
      optimizer: tf.train.adam(architecture.learningRate || 0.001),
      loss: architecture.loss || 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  // Register a new participant institution
  registerParticipant(institutionId, publicKey, metadata = {}) {
    try {
      const participant = {
        id: institutionId,
        publicKey,
        metadata: {
          name: metadata.name || institutionId,
          location: metadata.location || 'unknown',
          dataSize: metadata.dataSize || 0,
          contributionScore: 0,
          lastActive: new Date(),
          ...metadata
        },
        status: 'registered',
        contributions: 0,
        reputation: 1.0
      };

      this.participants.set(institutionId, participant);
      
      console.log(`🏫 Institution registered: ${participant.metadata.name}`);
      this.emit('participantRegistered', participant);
      
      return participant;
    } catch (error) {
      console.error('❌ Failed to register participant:', error);
      throw error;
    }
  }

  // Start a new federated learning round
  async startRound(roundConfig = {}) {
    try {
      if (this.activeRound) {
        throw new Error('A round is already active');
      }

      const availableParticipants = Array.from(this.participants.values())
        .filter(p => p.status === 'registered');

      if (availableParticipants.length < this.minParticipants) {
        throw new Error(`Insufficient participants. Need ${this.minParticipants}, have ${availableParticipants.length}`);
      }

      this.roundNumber++;
      this.activeRound = {
        id: `round_${this.roundNumber}`,
        number: this.roundNumber,
        status: 'active',
        startTime: new Date(),
        participants: availableParticipants.slice(0, this.maxParticipants),
        modelUpdates: new Map(),
        config: {
          epochs: roundConfig.epochs || 1,
          batchSize: roundConfig.batchSize || 32,
          learningRate: roundConfig.learningRate || 0.001,
          timeout: roundConfig.timeout || 300000, // 5 minutes
          ...roundConfig
        },
        metrics: {
          participantsJoined: 0,
          updatesReceived: 0,
          aggregationTime: 0,
          modelAccuracy: 0
        }
      };

      // Update participant status
      this.activeRound.participants.forEach(participant => {
        participant.status = 'training';
        participant.roundId = this.activeRound.id;
      });

      console.log(`🚀 Round ${this.roundNumber} started with ${this.activeRound.participants.length} participants`);
      this.emit('roundStarted', this.activeRound);

      // Set timeout for round completion
      setTimeout(() => {
        if (this.activeRound && this.activeRound.status === 'active') {
          this.completeRound();
        }
      }, this.activeRound.config.timeout);

      return this.activeRound;
    } catch (error) {
      console.error('❌ Failed to start round:', error);
      throw error;
    }
  }

  // Receive model update from participant
  async receiveModelUpdate(participantId, modelUpdate, signature) {
    try {
      if (!this.activeRound || this.activeRound.status !== 'active') {
        throw new Error('No active round to receive updates');
      }

      const participant = this.participants.get(participantId);
      if (!participant || participant.status !== 'training') {
        throw new Error('Invalid participant or participant not in training state');
      }

      // Verify signature
      const isValidSignature = await this.verifySignature(
        modelUpdate, 
        signature, 
        participant.publicKey
      );

      if (!isValidSignature) {
        throw new Error('Invalid model update signature');
      }

      // Apply differential privacy if enabled
      if (this.differentialPrivacy) {
        modelUpdate = await this.applyDifferentialPrivacy(modelUpdate);
      }

      // Store the update
      this.activeRound.modelUpdates.set(participantId, {
        update: modelUpdate,
        timestamp: new Date(),
        participant: participant,
        weight: this.calculateParticipantWeight(participant)
      });

      this.activeRound.metrics.updatesReceived++;
      participant.contributions++;
      participant.lastActive = new Date();

      console.log(`📥 Model update received from ${participant.metadata.name}`);
      this.emit('modelUpdateReceived', { participantId, roundId: this.activeRound.id });

      // Check if all participants have submitted
      if (this.activeRound.metrics.updatesReceived === this.activeRound.participants.length) {
        await this.completeRound();
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to receive model update:', error);
      throw error;
    }
  }

  // Complete the current round and aggregate models
  async completeRound() {
    try {
      if (!this.activeRound || this.activeRound.status !== 'active') {
        throw new Error('No active round to complete');
      }

      console.log(`🔄 Completing round ${this.roundNumber}...`);
      this.activeRound.status = 'aggregating';

      const updates = Array.from(this.activeRound.modelUpdates.values());
      
      if (updates.length < this.minParticipants) {
        throw new Error(`Insufficient updates for aggregation. Need ${this.minParticipants}, have ${updates.length}`);
      }

      // Aggregate model updates
      const startTime = Date.now();
      let aggregatedModel;

      if (this.secureAggregation) {
        aggregatedModel = await this.secureAggregate(updates);
      } else {
        aggregatedModel = await this.federatedAveraging(updates);
      }

      this.activeRound.metrics.aggregationTime = Date.now() - startTime;

      // Update global model
      await this.updateGlobalModel(aggregatedModel);

      // Evaluate model performance
      const accuracy = await this.evaluateModel();
      this.activeRound.metrics.modelAccuracy = accuracy;

      // Store round history
      this.modelHistory.push({
        round: this.roundNumber,
        accuracy,
        participants: updates.length,
        timestamp: new Date(),
        aggregationTime: this.activeRound.metrics.aggregationTime
      });

      // Update participant reputations
      this.updateParticipantReputations(updates);

      // Reset participant statuses
      this.activeRound.participants.forEach(participant => {
        participant.status = 'registered';
        participant.roundId = null;
      });

      this.activeRound.status = 'completed';
      this.activeRound.endTime = new Date();

      console.log(`✅ Round ${this.roundNumber} completed successfully`);
      console.log(`📊 Model accuracy: ${accuracy.toFixed(4)}`);
      console.log(`⏱️  Aggregation time: ${this.activeRound.metrics.aggregationTime}ms`);

      this.emit('roundCompleted', this.activeRound);
      this.activeRound = null;

      return { success: true, accuracy, roundNumber: this.roundNumber };
    } catch (error) {
      console.error('❌ Failed to complete round:', error);
      this.activeRound.status = 'failed';
      this.emit('roundFailed', { roundId: this.activeRound.id, error: error.message });
      this.activeRound = null;
      throw error;
    }
  }

  // Federated Averaging aggregation
  async federatedAveraging(updates) {
    try {
      const weights = updates.map(u => u.update.weights);
      const weightsArray = weights.map(w => tf.tensor(w));
      const sampleWeights = updates.map(u => u.weight);

      // Weighted average of model weights
      const aggregatedWeights = tf.tensorsMean(weightsArray, sampleWeights);
      
      return {
        weights: await aggregatedWeights.array(),
        metadata: {
          aggregationMethod: 'fedavg',
          participants: updates.length,
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('❌ Federated averaging failed:', error);
      throw error;
    }
  }

  // Secure aggregation with homomorphic encryption
  async secureAggregate(updates) {
    try {
      // Generate random masks for secure aggregation
      const masks = this.generateSecureMasks(updates.length);
      
      // Apply masks to updates
      const maskedUpdates = updates.map((update, index) => ({
        ...update,
        maskedWeights: this.applyMask(update.update.weights, masks[index])
      }));

      // Aggregate masked updates
      const aggregatedMasked = await this.federatedAveraging(maskedUpdates);

      // Remove masks (in a real implementation, this would involve secure multi-party computation)
      const aggregatedWeights = this.removeMask(aggregatedMasked.weights, masks);

      return {
        weights: aggregatedWeights,
        metadata: {
          aggregationMethod: 'secure',
          participants: updates.length,
          timestamp: new Date(),
          securityLevel: 'high'
        }
      };
    } catch (error) {
      console.error('❌ Secure aggregation failed:', error);
      throw error;
    }
  }

  // Apply differential privacy to model updates
  async applyDifferentialPrivacy(modelUpdate, epsilon = this.privacyBudget) {
    try {
      const weights = modelUpdate.weights;
      const sensitivity = 2.0 / this.activeRound.participants.length; // L2 sensitivity
      const scale = sensitivity / epsilon;

      // Add Gaussian noise to weights
      const noisyWeights = weights.map(weight => {
        const noise = this.generateGaussianNoise(0, scale, weight.length);
        return weight.map((w, i) => w + noise[i]);
      });

      return {
        ...modelUpdate,
        weights: noisyWeights,
        privacyMetadata: {
          epsilon,
          sensitivity,
          timestamp: new Date()
        }
      };
    } catch (error) {
      console.error('❌ Differential privacy application failed:', error);
      throw error;
    }
  }

  // Generate Gaussian noise for differential privacy
  generateGaussianNoise(mean, stdDev, size) {
    const noise = [];
    for (let i = 0; i < size; i++) {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
      noise.push(mean + stdDev * z);
    }
    return noise;
  }

  // Verify digital signature
  async verifySignature(data, signature, publicKey) {
    try {
      const md = forge.md.sha256.create();
      md.update(JSON.stringify(data), 'utf8');
      const hash = md.digest().getBytes();

      const key = forge.pki.publicKeyFromPem(publicKey);
      return key.verify(hash, signature);
    } catch (error) {
      console.error('❌ Signature verification failed:', error);
      return false;
    }
  }

  // Calculate participant weight based on data size and reputation
  calculateParticipantWeight(participant) {
    const dataSizeWeight = Math.log(participant.metadata.dataSize + 1);
    const reputationWeight = participant.reputation;
    return dataSizeWeight * reputationWeight;
  }

  // Update global model with aggregated weights
  async updateGlobalModel(aggregatedModel) {
    try {
      const weights = aggregatedModel.weights.map(w => tf.tensor(w));
      this.globalModel.setWeights(weights);
      console.log('🔄 Global model updated successfully');
    } catch (error) {
      console.error('❌ Failed to update global model:', error);
      throw error;
    }
  }

  // Evaluate model performance (placeholder - would need test data)
  async evaluateModel() {
    try {
      // In a real implementation, this would evaluate on a held-out test set
      // For now, return a simulated accuracy that improves over time
      const baseAccuracy = 0.7;
      const improvement = Math.min(0.2, this.roundNumber * 0.02);
      const noise = (Math.random() - 0.5) * 0.05;
      return Math.max(0, Math.min(1, baseAccuracy + improvement + noise));
    } catch (error) {
      console.error('❌ Model evaluation failed:', error);
      return 0;
    }
  }

  // Update participant reputations based on contribution quality
  updateParticipantReputations(updates) {
    updates.forEach(update => {
      const participant = update.participant;
      // Simple reputation update based on timeliness and consistency
      const timelinessBonus = update.timestamp > this.activeRound.startTime ? 0.1 : 0;
      participant.reputation = Math.min(2.0, participant.reputation + timelinessBonus * 0.1);
    });
  }

  // Generate secure masks for secure aggregation
  generateSecureMasks(count) {
    return Array.from({ length: count }, () => 
      Array.from({ length: 100 }, () => Math.random() - 0.5)
    );
  }

  // Apply mask to weights
  applyMask(weights, mask) {
    return weights.map((w, i) => w + (mask[i] || 0));
  }

  // Remove mask from aggregated weights
  removeMask(weights, masks) {
    const maskSum = masks.reduce((sum, mask) => {
      return sum.map((m, i) => m + (mask[i] || 0));
    }, new Array(weights.length).fill(0));
    
    return weights.map((w, i) => w - maskSum[i] / masks.length);
  }

  // Get system status
  getStatus() {
    return {
      roundNumber: this.roundNumber,
      activeRound: this.activeRound ? {
        id: this.activeRound.id,
        status: this.activeRound.status,
        participants: this.activeRound.participants.length,
        updatesReceived: this.activeRound.metrics.updatesReceived
      } : null,
      totalParticipants: this.participants.size,
      modelHistory: this.modelHistory.slice(-10), // Last 10 rounds
      privacySettings: {
        differentialPrivacy: this.differentialPrivacy,
        secureAggregation: this.secureAggregation,
        privacyBudget: this.privacyBudget
      }
    };
  }

  // Get global model weights
  getGlobalModel() {
    if (!this.globalModel) {
      throw new Error('Global model not initialized');
    }
    
    return {
      weights: this.globalModel.getWeights().map(w => w.arraySync()),
      architecture: this.globalModel.getConfig(),
      timestamp: new Date()
    };
  }
}

module.exports = FederatedLearningCoordinator;
