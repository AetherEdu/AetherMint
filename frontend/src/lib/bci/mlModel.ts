import * as tf from '@tensorflow/tfjs';
import { CognitiveState, BrainSignal } from './bciService';

export interface MLPrediction {
  attention: number;
  relaxation: number;
  engagement: number;
  cognitiveLoad: number;
  confidence: number;
}

export interface TrainingData {
  features: number[][];
  labels: number[][];
}

export class MLModel {
  private model: tf.LayersModel | null = null;
  private isTraining = false;
  private trainingHistory: { loss: number; accuracy: number }[] = [];

  constructor() {
    this.initializeModel();
  }

  private initializeModel(): void {
    this.model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [32],
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 128,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.4 }),
        
        tf.layers.dense({
          units: 64,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        
        tf.layers.dense({
          units: 4,
          activation: 'sigmoid'
        })
      ]
    });

    this.model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse']
    });
  }

  async trainModel(trainingData: TrainingData, epochs: number = 50): Promise<void> {
    if (!this.model || this.isTraining) return;

    this.isTraining = true;

    try {
      const features = tf.tensor2d(trainingData.features);
      const labels = tf.tensor2d(trainingData.labels);

      const validationSplit = 0.2;
      const batchSize = Math.min(32, trainingData.features.length);

      const history = await this.model.fit(features, labels, {
        epochs,
        batchSize,
        validationSplit,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            this.trainingHistory.push({
              loss: logs?.loss || 0,
              accuracy: 1 - (logs?.loss || 0)
            });

            console.log(`Epoch ${epoch + 1}: Loss = ${logs?.loss?.toFixed(4)}`);
          }
        }
      });

      features.dispose();
      labels.dispose();

      console.log('Training completed successfully');
    } catch (error) {
      console.error('Training failed:', error);
    } finally {
      this.isTraining = false;
    }
  }

  async predict(features: number[]): Promise<MLPrediction> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input) as tf.Tensor;
      // `.data()` is typed as a union of typed arrays; a float model always
      // returns Float32Array, so narrow it for the helpers below.
      const values = (await prediction.data()) as Float32Array;

      prediction.dispose();
      input.dispose();

      const [attention, relaxation, engagement, cognitiveLoad] = values;

      const confidence = this.calculateConfidence(values);

      return {
        attention: Math.max(0, Math.min(1, attention)),
        relaxation: Math.max(0, Math.min(1, relaxation)),
        engagement: Math.max(0, Math.min(1, engagement)),
        cognitiveLoad: Math.max(0, Math.min(1, cognitiveLoad)),
        confidence
      };
    } catch (error) {
      console.error('Prediction failed:', error);
      return {
        attention: 0.5,
        relaxation: 0.5,
        engagement: 0.5,
        cognitiveLoad: 0.5,
        confidence: 0
      };
    }
  }

  private calculateConfidence(values: Float32Array): number {
    const variance = this.calculateVariance(values);
    return Math.max(0, 1 - variance);
  }

  private calculateVariance(values: Float32Array): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  extractFeatures(signals: BrainSignal[], cognitiveHistory: CognitiveState[]): number[] {
    const features: number[] = [];

    if (signals.length === 0) {
      return new Array(32).fill(0);
    }

    const recentSignals = signals.slice(-10);
    const recentCognitive = cognitiveHistory.slice(-5);

    for (let i = 0; i < Math.min(recentSignals.length, 5); i++) {
      const signal = recentSignals[i];
      if (signal.channels.length > 0) {
        const channelData = signal.channels[0];
        
        const mean = channelData.reduce((sum, val) => sum + val, 0) / channelData.length;
        const variance = channelData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channelData.length;
        const max = Math.max(...channelData);
        const min = Math.min(...channelData);
        const range = max - min;

        features.push(mean, variance, max, min, range);
      } else {
        features.push(0, 0, 0, 0, 0);
      }
    }

    for (let i = 0; i < Math.min(recentCognitive.length, 7); i++) {
      const state = recentCognitive[i];
      features.push(
        state.attention,
        state.relaxation,
        state.engagement,
        state.cognitiveLoad
      );
    }

    while (features.length < 32) {
      features.push(0);
    }

    return features.slice(0, 32);
  }

  async saveModel(name: string): Promise<void> {
    if (!this.model) return;

    try {
      await this.model.save(`localstorage://${name}`);
      console.log(`Model saved as ${name}`);
    } catch (error) {
      console.error('Failed to save model:', error);
    }
  }

  async loadModel(name: string): Promise<boolean> {
    try {
      this.model = await tf.loadLayersModel(`localstorage://${name}`);
      console.log(`Model loaded: ${name}`);
      return true;
    } catch (error) {
      console.error('Failed to load model:', error);
      return false;
    }
  }

  generateSyntheticTrainingData(samples: number = 1000): TrainingData {
    const features: number[][] = [];
    const labels: number[][] = [];

    for (let i = 0; i < samples; i++) {
      const feature = this.generateRandomFeatures();
      const label = this.generateCorrespondingLabels(feature);

      features.push(feature);
      labels.push(label);
    }

    return { features, labels };
  }

  private generateRandomFeatures(): number[] {
    return Array.from({ length: 32 }, () => Math.random() * 2 - 1);
  }

  private generateCorrespondingLabels(features: number[]): number[] {
    const attention = Math.max(0, Math.min(1, 0.5 + features[0] * 0.3 + Math.random() * 0.2));
    const relaxation = Math.max(0, Math.min(1, 0.5 + features[1] * 0.3 + Math.random() * 0.2));
    const engagement = Math.max(0, Math.min(1, 0.5 + features[2] * 0.3 + Math.random() * 0.2));
    const cognitiveLoad = Math.max(0, Math.min(1, 0.5 + features[3] * 0.3 + Math.random() * 0.2));

    return [attention, relaxation, engagement, cognitiveLoad];
  }

  async evaluateModel(testData: TrainingData): Promise<{ loss: number; accuracy: number }> {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    try {
      const features = tf.tensor2d(testData.features);
      const labels = tf.tensor2d(testData.labels);

      const evaluation = this.model.evaluate(features, labels) as tf.Scalar[];
      const loss = await evaluation[0].data();
      const accuracy = 1 - loss[0];

      features.dispose();
      labels.dispose();
      evaluation.forEach(tensor => tensor.dispose());

      return { loss: loss[0], accuracy };
    } catch (error) {
      console.error('Evaluation failed:', error);
      return { loss: Infinity, accuracy: 0 };
    }
  }

  getTrainingHistory(): { loss: number; accuracy: number }[] {
    return [...this.trainingHistory];
  }

  isModelTraining(): boolean {
    return this.isTraining;
  }

  resetModel(): void {
    this.initializeModel();
    this.trainingHistory = [];
  }

  async fineTuneModel(newData: TrainingData, epochs: number = 10): Promise<void> {
    if (!this.model || this.isTraining) return;

    this.isTraining = true;

    try {
      const features = tf.tensor2d(newData.features);
      const labels = tf.tensor2d(newData.labels);

      await this.model.fit(features, labels, {
        epochs,
        batchSize: 16,
        shuffle: true,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Fine-tuning Epoch ${epoch + 1}: Loss = ${logs?.loss?.toFixed(4)}`);
          }
        }
      });

      features.dispose();
      labels.dispose();

      console.log('Fine-tuning completed successfully');
    } catch (error) {
      console.error('Fine-tuning failed:', error);
    } finally {
      this.isTraining = false;
    }
  }

  exportModel(): string {
    if (!this.model) {
      throw new Error('Model not initialized');
    }

    return JSON.stringify({
      modelConfig: this.model.toJSON(),
      trainingHistory: this.trainingHistory
    });
  }

  async importModel(modelData: string): Promise<boolean> {
    try {
      const data = JSON.parse(modelData);
      
      this.model = await tf.models.modelFromJSON(data.modelConfig);
      this.trainingHistory = data.trainingHistory || [];

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae', 'mse']
      });

      console.log('Model imported successfully');
      return true;
    } catch (error) {
      console.error('Failed to import model:', error);
      return false;
    }
  }
}

export const mlModel = new MLModel();
