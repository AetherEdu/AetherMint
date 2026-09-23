'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Headphones, Mic, MicOff, Radio, Waves, Speaker, Settings } from 'lucide-react';

export type AudioCodec = 'opus' | 'aac' | 'mp3' | 'wav';
export type SpatialModel = 'hrtf' | 'vbap' | 'ambisonics' | 'binaural';
export type AudioEffect = 'reverb' | 'echo' | 'delay' | 'chorus' | 'distortion' | 'filter';

interface SpatialAudioNode {
  id: string;
  userId?: string;
  objectId?: string;
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  volume: number;
  pitch: number;
  isMuted: boolean;
  isLooping: boolean;
  audioBuffer?: AudioBuffer;
  sourceNode?: AudioBufferSourceNode;
  pannerNode?: PannerNode;
  gainNode?: GainNode;
  filterNode?: BiquadFilterNode;
  effects: AudioEffect[];
  cone: {
    innerAngle: number;
    outerAngle: number;
    outerGain: number;
  };
  distanceModel: 'linear' | 'inverse' | 'exponential';
  maxDistance: number;
  refDistance: number;
  rolloffFactor: number;
}

interface AudioListener {
  position: { x: number; y: number; z: number };
  orientation: { x: number; y: number; z: number; upX: number; upY: number; upZ: number };
  velocity: { x: number; y: number; z: number };
  dopplerFactor: number;
  speedOfSound: number;
}

interface AudioEffectChain {
  id: string;
  name: string;
  effects: {
    type: AudioEffect;
    parameters: Record<string, number>;
    enabled: boolean;
  }[];
  wetLevel: number;
  dryLevel: number;
}

interface SpatialAudioSettings {
  codec: AudioCodec;
  spatialModel: SpatialModel;
  sampleRate: number;
  bufferSize: number;
  maxNodes: number;
  enableDoppler: boolean;
  enableOcclusion: boolean;
  enableReverb: boolean;
  reverbImpulseResponse?: string;
  hrtfDataset?: string;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

interface SpatialAudioEngineProps {
  listener: AudioListener;
  audioNodes: SpatialAudioNode[];
  settings: SpatialAudioSettings;
  onNodeUpdate?: (node: SpatialAudioNode) => void;
  onEffectUpdate?: (effect: AudioEffectChain) => void;
  onAudioEvent?: (event: any) => void;
  enableVisualization?: boolean;
  enableRealTimeProcessing?: boolean;
  maxLatency?: number;
}

const DEFAULT_SETTINGS: SpatialAudioSettings = {
  codec: 'opus',
  spatialModel: 'hrtf',
  sampleRate: 48000,
  bufferSize: 512,
  maxNodes: 32,
  enableDoppler: true,
  enableOcclusion: true,
  enableReverb: true,
  quality: 'high'
};

export function SpatialAudioEngine({
  listener,
  audioNodes,
  settings = DEFAULT_SETTINGS,
  onNodeUpdate,
  onEffectUpdate,
  onAudioEvent,
  enableVisualization = true,
  enableRealTimeProcessing = true,
  maxLatency = 50
}: SpatialAudioEngineProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [masterVolume, setMasterVolume] = useState(1.0);
  const [activeNodes, setActiveNodes] = useState<SpatialAudioNode[]>(audioNodes);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioStats, setAudioStats] = useState({
    nodes: 0,
    effects: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    latency: 0,
    sampleRate: settings.sampleRate
  });
  const [showSettings, setShowSettings] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SpatialAudioNode | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainNodeRef = useRef<GainNode | null>(null);
  const convolverNodeRef = useRef<ConvolverNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const nodesRef = useRef<Map<string, SpatialAudioNode>>(new Map());

  // Initialize spatial audio engine
  useEffect(() => {
    initializeAudioEngine();
    return () => {
      cleanupAudioEngine();
    };
  }, []);

  // Update listener position
  useEffect(() => {
    if (audioContext && audioContextRef.current) {
      updateAudioListener(listener);
    }
  }, [listener]);

  // Update audio nodes
  useEffect(() => {
    setActiveNodes(audioNodes);
    updateAudioNodes(audioNodes);
  }, [audioNodes]);

  // Initialize audio engine
  const initializeAudioEngine = async () => {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContext({
        sampleRate: settings.sampleRate,
        latencyHint: 'interactive'
      });
      
      audioContextRef.current = context;
      setAudioContext(context);
      
      // Create master gain node
      const masterGain = context.createGain();
      masterGain.gain.value = masterVolume;
      masterGain.connect(context.destination);
      masterGainNodeRef.current = masterGain;
      
      // Create analyser for visualization
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.connect(masterGain);
      analyserNodeRef.current = analyser;
      
      // Create convolver for reverb
      if (settings.enableReverb) {
        const convolver = context.createConvolver();
        convolver.connect(masterGain);
        convolverNodeRef.current = convolver;
        
        // Load impulse response for reverb
        await loadImpulseResponse(convolver);
      }
      
      // Initialize spatial audio nodes
      await initializeAudioNodes();
      
      setIsInitialized(true);
      console.log('Spatial audio engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize spatial audio engine:', error);
    }
  };

  // Load impulse response for reverb
  const loadImpulseResponse = async (convolver: ConvolverNode) => {
    try {
      const response = await fetch('/audio/impulse-responses/hall.wav');
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContextRef.current?.decodeAudioData(arrayBuffer);
      
      if (audioBuffer) {
        convolver.buffer = audioBuffer;
      }
    } catch (error) {
      console.error('Failed to load impulse response:', error);
    }
  };

  // Initialize audio nodes
  const initializeAudioNodes = async () => {
    if (!audioContextRef.current) return;
    
    const context = audioContextRef.current;
    const nodes = new Map<string, SpatialAudioNode>();
    
    for (const nodeConfig of audioNodes) {
      const spatialNode = await createSpatialAudioNode(context, nodeConfig);
      nodes.set(nodeConfig.id, spatialNode);
    }
    
    nodesRef.current = nodes;
  };

  // Create spatial audio node
  const createSpatialAudioNode = async (context: AudioContext, config: SpatialAudioNode): Promise<SpatialAudioNode> => {
    // Create gain node
    const gainNode = context.createGain();
    gainNode.gain.value = config.volume;
    
    // Create panner node for spatial positioning
    const pannerNode = context.createPanner();
    pannerNode.panningModel = settings.spatialModel === 'hrtf' ? 'HRTF' : 'equalpower';
    pannerNode.distanceModel = config.distanceModel;
    pannerNode.maxDistance = config.maxDistance;
    pannerNode.refDistance = config.refDistance;
    pannerNode.rolloffFactor = config.rolloffFactor;
    pannerNode.coneInnerAngle = config.cone.innerAngle;
    pannerNode.coneOuterAngle = config.cone.outerAngle;
    pannerNode.coneOuterGain = config.cone.outerGain;
    
    // Set position
    pannerNode.setPosition(config.position.x, config.position.y, config.position.z);
    pannerNode.setOrientation(0, 0, -1);
    
    // Create filter node for effects
    const filterNode = context.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 20000;
    filterNode.Q.value = 1;
    
    // Connect nodes
    filterNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(masterGainNodeRef.current!);
    
    // Add reverb if enabled
    if (settings.enableReverb && convolverNodeRef.current) {
      const wetGain = context.createGain();
      const dryGain = context.createGain();
      
      wetGain.gain.value = 0.3;
      dryGain.gain.value = 0.7;
      
      gainNode.connect(wetGain);
      gainNode.connect(dryGain);
      wetGain.connect(convolverNodeRef.current);
      dryGain.connect(pannerNode);
    }
    
    // Create audio buffer if needed
    let audioBuffer: AudioBuffer | undefined;
    if (config.audioBuffer) {
      audioBuffer = config.audioBuffer;
    } else {
      // Generate test tone
      audioBuffer = generateTestTone(context, 440, 2); // A4 note, 2 seconds
    }
    
    // Create source node
    let sourceNode: AudioBufferSourceNode | undefined;
    if (audioBuffer) {
      sourceNode = context.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.loop = config.isLooping;
      sourceNode.playbackRate.value = config.pitch;
      sourceNode.connect(filterNode);
      
      if (config.isMuted) {
        sourceNode.playbackRate.value = 0;
      }
    }
    
    const spatialNode: SpatialAudioNode = {
      ...config,
      audioBuffer,
      sourceNode,
      pannerNode,
      gainNode,
      filterNode,
      effects: config.effects
    };
    
    return spatialNode;
  };

  // Generate test tone
  const generateTestTone = (context: AudioContext, frequency: number, duration: number): AudioBuffer => {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const buffer = context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
      data[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
    }
    
    return buffer;
  };

  // Update audio listener
  const updateAudioListener = (listener: AudioListener) => {
    if (!audioContextRef.current) return;
    
    const context = audioContextRef.current;
    const audioListener = context.listener;
    
    // Set position
    audioListener.positionX.value = listener.position.x;
    audioListener.positionY.value = listener.position.y;
    audioListener.positionZ.value = listener.position.z;
    
    // Set orientation
    audioListener.forwardX.value = listener.orientation.x;
    audioListener.forwardY.value = listener.orientation.y;
    audioListener.forwardZ.value = listener.orientation.z;
    // `upX/Y/Z`, `dopplerFactor` and `speedOfSound` are legacy AudioListener
    // members that current lib.dom typings no longer surface.
    const legacyListener = audioListener as unknown as AudioListener & {
      upX: AudioParam;
      upY: AudioParam;
      upZ: AudioParam;
      dopplerFactor: number;
      speedOfSound: number;
    };
    legacyListener.upX.value = listener.orientation.upX;
    legacyListener.upY.value = listener.orientation.upY;
    legacyListener.upZ.value = listener.orientation.upZ;
    
    // Set doppler factor
    legacyListener.dopplerFactor = listener.dopplerFactor;
    legacyListener.speedOfSound = listener.speedOfSound;
  };

  // Update audio nodes
  const updateAudioNodes = (nodes: SpatialAudioNode[]) => {
    nodes.forEach(node => {
      updateSpatialAudioNode(node);
    });
  };

  // Update spatial audio node
  const updateSpatialAudioNode = (node: SpatialAudioNode) => {
    if (!node.pannerNode || !node.gainNode) return;
    
    // Update position
    node.pannerNode.setPosition(node.position.x, node.position.y, node.position.z);
    
    // Update volume
    node.gainNode.gain.value = node.isMuted ? 0 : node.volume * masterVolume;
    
    // Update pitch
    if (node.sourceNode) {
      node.sourceNode.playbackRate.value = node.isMuted ? 0 : node.pitch;
    }
    
    // Update filter
    if (node.filterNode) {
      node.filterNode.frequency.value = 20000; // Reset to full range
    }
    
    // Apply effects
    node.effects.forEach(effect => {
      applyAudioEffect(node, effect);
    });
  };

  // Apply audio effect
  const applyAudioEffect = (node: SpatialAudioNode, effect: AudioEffect) => {
    if (!node.filterNode) return;
    
    switch (effect) {
      case 'filter':
        // Low-pass filter for distance attenuation
        const distance = Math.sqrt(
          node.position.x ** 2 + node.position.y ** 2 + node.position.z ** 2
        );
        const maxFreq = 20000;
        const minFreq = 200;
        const freq = Math.max(minFreq, maxFreq - (distance / node.maxDistance) * (maxFreq - minFreq));
        node.filterNode.frequency.value = freq;
        break;
        
      case 'reverb':
        // Reverb is handled by the convolver node
        break;
        
      case 'echo':
      case 'delay':
      case 'chorus':
      case 'distortion':
        // These would require additional nodes
        break;
    }
  };

  // Play audio node
  const playAudioNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.get(nodeId);
    if (node && node.sourceNode && audioContextRef.current) {
      try {
        node.sourceNode.start(0);
        console.log('Playing audio node:', nodeId);
      } catch (error) {
        console.error('Failed to play audio node:', error);
      }
    }
  }, []);

  // Stop audio node
  const stopAudioNode = useCallback((nodeId: string) => {
    const node = nodesRef.current.get(nodeId);
    if (node && node.sourceNode) {
      try {
        node.sourceNode.stop();
        console.log('Stopped audio node:', nodeId);
      } catch (error) {
        console.error('Failed to stop audio node:', error);
      }
    }
  }, []);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    setIsAudioEnabled(prev => !prev);
    
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = !isAudioEnabled ? masterVolume : 0;
    }
  }, [isAudioEnabled, masterVolume]);

  // Update master volume
  const updateMasterVolume = useCallback((volume: number) => {
    setMasterVolume(volume);
    
    if (masterGainNodeRef.current) {
      masterGainNodeRef.current.gain.value = isAudioEnabled ? volume : 0;
    }
  }, [isAudioEnabled]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        // Handle recorded audio data
        console.log('Audio data available:', event.data.size);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      console.log('Audio recording started');
    } catch (error) {
      console.error('Failed to start audio recording:', error);
    }
  }, []);

  // Stop recording
  const stopRecording = useCallback(() => {
    // Stop recording logic
    setIsRecording(false);
    console.log('Audio recording stopped');
  }, []);

  // Cleanup audio engine
  const cleanupAudioEngine = () => {
    // Stop all audio nodes
    nodesRef.current.forEach(node => {
      if (node.sourceNode) {
        try {
          node.sourceNode.stop();
        } catch (error) {
          // Ignore errors from already stopped nodes
        }
      }
    });
    
    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
  };

  // Update audio stats
  useEffect(() => {
    const updateStats = () => {
      if (!audioContextRef.current) return;
      
      const context = audioContextRef.current;
      const baseLatency = context.baseLatency;
      const outputLatency = context.outputLatency;
      const totalLatency = baseLatency + outputLatency;
      
      setAudioStats({
        nodes: activeNodes.length,
        effects: activeNodes.reduce((sum, node) => sum + node.effects.length, 0),
        cpuUsage: 0, // Would be calculated from actual CPU usage
        memoryUsage: 0, // Would be calculated from actual memory usage
        latency: Math.round(totalLatency * 1000),
        sampleRate: context.sampleRate
      });
    };
    
    const interval = setInterval(updateStats, 1000);
    return () => clearInterval(interval);
  }, [activeNodes]);

  // Get audio effect icon
  const getAudioEffectIcon = (effect: AudioEffect) => {
    const icons = {
      'reverb': Radio,
      'echo': Waves,
      'delay': Waves,
      'chorus': Speaker,
      'distortion': Volume2,
      'filter': Settings
    };
    return icons[effect] || Volume2;
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing spatial audio engine...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Audio Visualization */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 to-blue-900/20">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Headphones className="h-16 w-16 text-blue-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-white text-xl font-semibold mb-2">Spatial Audio Engine</h3>
            <p className="text-gray-400 text-sm">Immersive 3D audio processing</p>
          </div>
        </div>

        {/* Audio Nodes Visualization */}
        {enableVisualization && activeNodes.map((node, index) => (
          <motion.div
            key={node.id}
            className="absolute"
            style={{
              left: `${50 + node.position.x * 10}%`,
              top: `${50 - node.position.y * 10}%`,
              transform: 'translate(-50%, -50%)'
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={() => setSelectedNode(node)}
          >
            <div className="relative">
              {/* Audio source indicator */}
              <div 
                className="w-8 h-8 rounded-full border-2 shadow-lg animate-pulse"
                style={{
                  backgroundColor: node.isMuted ? '#ef4444' : '#10b981',
                  borderColor: node.isMuted ? '#dc2626' : '#059669',
                  boxShadow: `0 0 20px ${node.isMuted ? '#ef4444' : '#10b981'}`
                }}
              >
                <Speaker className="h-4 w-4 text-white m-1" />
              </div>
              
              {/* Volume indicator */}
              <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-500 rounded-full animate-ping" />
              
              {/* Node info */}
              <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded px-2 py-1 min-w-max">
                <div className="text-white text-xs font-medium">{node.id}</div>
                <div className="text-gray-300 text-xs">Volume: {Math.round(node.volume * 100)}%</div>
                <div className="text-blue-300 text-xs">Effects: {node.effects.length}</div>
              </div>
            </div>
          </motion.div>
        ))}

        {/* Sound waves visualization */}
        {activeNodes.map((node, index) => (
          !node.isMuted && (
            <motion.div
              key={`wave-${node.id}`}
              className="absolute w-16 h-16 border-2 border-blue-400 rounded-full"
              style={{
                left: `${50 + node.position.x * 10}%`,
                top: `${50 - node.position.y * 10}%`,
                transform: 'translate(-50%, -50%)'
              }}
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )
        ))}
      </div>

      {/* Control Panel */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Headphones className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">Spatial Audio</h3>
        </div>

        {/* Audio Controls */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={toggleAudio}
              className={`p-2 rounded transition-colors ${
                isAudioEnabled 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isAudioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-2 rounded transition-colors ${
                isRecording 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status:</span>
            <span className={isAudioEnabled ? 'text-green-400' : 'text-red-400'}>
              {isAudioEnabled ? 'Enabled' : 'Muted'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Recording:</span>
            <span className={isRecording ? 'text-red-400' : 'text-gray-400'}>
              {isRecording ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {/* Master Volume */}
        <div className="mb-4">
          <label className="text-gray-400 text-sm">Master Volume</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={masterVolume}
            onChange={(e) => updateMasterVolume(parseFloat(e.target.value))}
            className="w-full mt-1"
          />
          <div className="text-right text-gray-500 text-xs">{Math.round(masterVolume * 100)}%</div>
        </div>

        {/* Audio Stats */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Active Nodes:</span>
            <span className="text-blue-400 font-mono">{audioStats.nodes}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Effects:</span>
            <span className="text-purple-400 font-mono">{audioStats.effects}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Latency:</span>
            <span className={`font-mono ${audioStats.latency <= maxLatency ? 'text-green-400' : 'text-yellow-400'}`}>
              {audioStats.latency}ms
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Sample Rate:</span>
            <span className="text-green-400 font-mono">{audioStats.sampleRate}Hz</span>
          </div>
        </div>
      </div>

      {/* Audio Node Properties */}
      {selectedNode && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Audio Node</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400">ID:</span>
              <span className="text-white ml-2">{selectedNode.id}</span>
            </div>
            <div>
              <span className="text-gray-400">Position:</span>
              <span className="text-white ml-2 font-mono text-xs">
                ({selectedNode.position.x.toFixed(1)}, {selectedNode.position.y.toFixed(1)}, {selectedNode.position.z.toFixed(1)})
              </span>
            </div>
            <div>
              <span className="text-gray-400">Volume:</span>
              <span className="text-white ml-2">{Math.round(selectedNode.volume * 100)}%</span>
            </div>
            <div>
              <span className="text-gray-400">Pitch:</span>
              <span className="text-white ml-2">{selectedNode.pitch.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-400">Status:</span>
              <span className={`ml-2 ${selectedNode.isMuted ? 'text-red-400' : 'text-green-400'}`}>
                {selectedNode.isMuted ? 'Muted' : 'Active'}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Effects:</span>
              <div className="mt-1 space-y-1">
                {selectedNode.effects.map((effect, index) => {
                  const IconComponent = getAudioEffectIcon(effect);
                  return (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <IconComponent className="h-3 w-3 text-blue-400" />
                      <span className="text-white">{effect}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Node Controls */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => playAudioNode(selectedNode.id)}
                className="flex-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Play
              </button>
              <button
                onClick={() => stopAudioNode(selectedNode.id)}
                className="flex-1 px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="absolute bottom-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute bottom-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <h3 className="text-white font-semibold mb-4">Audio Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-gray-400 text-sm">Spatial Model</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="hrtf">HRTF (Head-Related Transfer Function)</option>
                  <option value="vbap">Vector Base Amplitude Panning</option>
                  <option value="ambisonics">Ambisonics</option>
                  <option value="binaural">Binaural</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Audio Codec</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="opus">Opus</option>
                  <option value="aac">AAC</option>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Sample Rate</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="22050">22.05 kHz</option>
                  <option value="44100">44.1 kHz</option>
                  <option value="48000">48 kHz</option>
                  <option value="96000">96 kHz</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Quality</label>
                <select className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="ultra">Ultra</option>
                </select>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Max Latency</label>
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={maxLatency}
                  className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                />
                <div className="text-right text-gray-500 text-xs">ms</div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableDoppler}
                    onChange={(e) => {
                      // Toggle Doppler effect
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Doppler Effect</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableOcclusion}
                    onChange={(e) => {
                      // Toggle occlusion
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Occlusion</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableReverb}
                    onChange={(e) => {
                      // Toggle reverb
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable Reverb</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording Indicator */}
      {isRecording && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500/20 backdrop-blur-sm rounded-lg p-3 border border-red-500/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-sm font-medium">Recording Audio</span>
          </div>
        </div>
      )}
    </div>
  );
}
