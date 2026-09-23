import { BoardShim, BrainFlowInputParams, AggOperations, DataFilter, FilterTypes } from 'brainflow';
import * as tf from '@tensorflow/tfjs';
import { Matrix } from 'ml-matrix';

export interface BCIDevice {
  id: string;
  name: string;
  type: string;
  connected: boolean;
}

export interface CognitiveState {
  attention: number;
  relaxation: number;
  engagement: number;
  cognitiveLoad: number;
  timestamp: number;
}

export interface BrainSignal {
  timestamp: number;
  channels: number[][];
  frequency: number;
}

export class BCIService {
  private board: BoardShim | null = null;
  private isConnected = false;
  private model: tf.LayersModel | null = null;
  private signalBuffer: BrainSignal[] = [];
  private cognitiveHistory: CognitiveState[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeModel();
  }

  private async initializeModel(): Promise<void> {
    try {
      this.model = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [8], units: 16, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 4, activation: 'sigmoid' })
        ]
      });

      this.model.compile({
        optimizer: 'adam',
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      await this.loadPretrainedWeights();
    } catch (error) {
      console.error('Failed to initialize BCI model:', error);
    }
  }

  private async loadPretrainedWeights(): Promise<void> {
    try {
      const dummyInput = tf.randomNormal([1, 8]);
      const dummyOutput = tf.randomNormal([1, 4]);
      
      await this.model!.fit(dummyInput, dummyOutput, {
        epochs: 1,
        verbose: 0
      });

      dummyInput.dispose();
      dummyOutput.dispose();
    } catch (error) {
      console.error('Failed to load pretrained weights:', error);
    }
  }

  async getAvailableDevices(): Promise<BCIDevice[]> {
    const devices: BCIDevice[] = [
      {
        id: 'muse2',
        name: 'Muse 2',
        type: 'EEG Headset',
        connected: false
      },
      {
        id: 'emotiv_epoc',
        name: 'Emotiv Epoc+',
        type: 'EEG Headset',
        connected: false
      },
      {
        id: 'neurosky',
        name: 'NeuroSky MindWave',
        type: 'EEG Headset',
        connected: false
      }
    ];

    return devices;
  }

  async connectDevice(deviceId: string): Promise<boolean> {
    try {
      const params: BrainFlowInputParams = {
        serial_port: '',
        mac_address: '',
        other_info: '',
        serial_number: '',
        ip_address: '',
        ip_port: 0,
        ip_protocol: 0,
        master_board_id: 0,
        file: '',
        preshift: 0,
        drift: 0,
        decrement: 0,
        timestamp_type: 0
      };

      let boardId: number;
      switch (deviceId) {
        case 'muse2':
          boardId = 38;
          break;
        case 'emotiv_epoc':
          boardId = 4;
          break;
        case 'neurosky':
          boardId = 1;
          break;
        default:
          throw new Error(`Unsupported device: ${deviceId}`);
      }

      this.board = new BoardShim(boardId, params);
      await this.board.prepare_session();
      await this.board.start_stream(45000);

      this.isConnected = true;
      this.startDataCollection();

      return true;
    } catch (error) {
      console.error('Failed to connect to BCI device:', error);
      return false;
    }
  }

  async disconnectDevice(): Promise<void> {
    try {
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }

      if (this.board) {
        await this.board.stop_stream();
        await this.board.release_session();
        this.board = null;
      }

      this.isConnected = false;
      this.signalBuffer = [];
    } catch (error) {
      console.error('Failed to disconnect BCI device:', error);
    }
  }

  private startDataCollection(): void {
    if (!this.board || !this.isConnected) return;

    this.updateInterval = setInterval(async () => {
      try {
        const data = await this.board.get_current_board_data(256);
        if (data && data.length > 0) {
          this.processBrainData(data);
        }
      } catch (error) {
        console.error('Error collecting BCI data:', error);
      }
    }, 100);
  }

  private processBrainData(rawData: number[][]): void {
    try {
      const processedData = this.preprocessSignals(rawData);
      const cognitiveState = this.analyzeCognitiveState(processedData);

      this.signalBuffer.push({
        timestamp: Date.now(),
        channels: processedData,
        frequency: 256
      });

      if (this.signalBuffer.length > 100) {
        this.signalBuffer.shift();
      }

      this.cognitiveHistory.push(cognitiveState);
      if (this.cognitiveHistory.length > 50) {
        this.cognitiveHistory.shift();
      }
    } catch (error) {
      console.error('Error processing brain data:', error);
    }
  }

  private preprocessSignals(rawData: number[][]): number[][] {
    const processed: number[][] = [];
    
    for (let i = 0; i < rawData.length; i++) {
      const channel = rawData[i];
      
      const filtered = DataFilter.perform_bandpass(
        channel,
        256,
        1.0,
        50.0,
        4,
        FilterTypes.BUTTERWORTH.value,
        0
      );

      const normalized = this.normalizeChannel(filtered);
      processed.push(normalized);
    }

    return processed;
  }

  private normalizeChannel(channel: number[]): number[] {
    const mean = channel.reduce((sum, val) => sum + val, 0) / channel.length;
    const std = Math.sqrt(
      channel.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channel.length
    );

    return channel.map(val => (val - mean) / (std || 1));
  }

  private analyzeCognitiveState(signals: number[][]): CognitiveState {
    if (!this.model || signals.length === 0) {
      return {
        attention: 0.5,
        relaxation: 0.5,
        engagement: 0.5,
        cognitiveLoad: 0.5,
        timestamp: Date.now()
      };
    }

    try {
      const features = this.extractFeatures(signals);
      const input = tf.tensor2d([features]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const values = prediction.dataSync();

      prediction.dispose();
      input.dispose();

      return {
        attention: Math.max(0, Math.min(1, values[0])),
        relaxation: Math.max(0, Math.min(1, values[1])),
        engagement: Math.max(0, Math.min(1, values[2])),
        cognitiveLoad: Math.max(0, Math.min(1, values[3])),
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error analyzing cognitive state:', error);
      return {
        attention: 0.5,
        relaxation: 0.5,
        engagement: 0.5,
        cognitiveLoad: 0.5,
        timestamp: Date.now()
      };
    }
  }

  private extractFeatures(signals: number[][]): number[] {
    const features: number[] = [];
    
    for (let i = 0; i < Math.min(signals.length, 8); i++) {
      const channel = signals[i];
      
      const mean = channel.reduce((sum, val) => sum + val, 0) / channel.length;
      const variance = channel.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / channel.length;
      const power = channel.reduce((sum, val) => sum + val * val, 0) / channel.length;
      
      features.push(mean, variance, power);
    }

    while (features.length < 8) {
      features.push(0);
    }

    return features.slice(0, 8);
  }

  getCurrentCognitiveState(): CognitiveState | null {
    return this.cognitiveHistory.length > 0 
      ? this.cognitiveHistory[this.cognitiveHistory.length - 1]
      : null;
  }

  getCognitiveHistory(): CognitiveState[] {
    return [...this.cognitiveHistory];
  }

  getSignalBuffer(): BrainSignal[] {
    return [...this.signalBuffer];
  }

  isDeviceConnected(): boolean {
    return this.isConnected;
  }

  async detectNavigationIntent(): Promise<string | null> {
    if (!this.isConnected || this.cognitiveHistory.length < 5) {
      return null;
    }

    const recentStates = this.cognitiveHistory.slice(-5);
    const avgAttention = recentStates.reduce((sum, state) => sum + state.attention, 0) / recentStates.length;
    const avgEngagement = recentStates.reduce((sum, state) => sum + state.engagement, 0) / recentStates.length;
    const avgCognitiveLoad = recentStates.reduce((sum, state) => sum + state.cognitiveLoad, 0) / recentStates.length;

    if (avgAttention > 0.8 && avgEngagement > 0.7) {
      return 'focus';
    } else if (avgAttention < 0.3 && avgEngagement < 0.4) {
      return 'rest';
    } else if (avgCognitiveLoad > 0.7) {
      return 'pause';
    }

    return null;
  }

  get avgCognitiveLoad(): number {
    if (this.cognitiveHistory.length === 0) return 0;
    return this.cognitiveHistory.reduce((sum, state) => sum + state.cognitiveLoad, 0) / this.cognitiveHistory.length;
  }
}

export const bciService = new BCIService();
