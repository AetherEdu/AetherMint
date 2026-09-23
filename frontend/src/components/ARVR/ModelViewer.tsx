'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Play, Pause, RotateCw, ZoomIn, ZoomOut, Move3d, Eye, Settings, Download, Info, Layers } from 'lucide-react';

export type ModelFormat = 'gltf' | 'glb' | 'obj' | 'fbx' | 'dae' | 'ply' | 'stl';
export type RenderMode = 'solid' | 'wireframe' | 'points' | 'normals' | 'uv';
export type InteractionMode = 'orbit' | 'pan' | 'zoom' | 'select' | 'measure';
export type LoadingState = 'idle' | 'loading' | 'loaded' | 'error';

export interface ModelInfo {
  id: string;
  name: string;
  format: ModelFormat;
  url: string;
  size: number;
  vertices: number;
  faces: number;
  materials: number;
  textures: string[];
  boundingBox: {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  };
  animations: string[];
  metadata: Record<string, any>;
}

export interface ModelViewerSettings {
  autoRotate: boolean;
  autoRotateSpeed: number;
  environmentIntensity: number;
  exposure: number;
  shadowIntensity: number;
  showGrid: boolean;
  showAxes: boolean;
  showStats: boolean;
  enableLOD: boolean;
  lodLevels: number;
  maxDistance: number;
  quality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface PerformanceStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  textureMemory: number;
  geometryMemory: number;
  renderTime: number;
}

export interface ModelViewerProps {
  modelUrl?: string;
  models?: ModelInfo[];
  onModelLoad?: (model: ModelInfo) => void;
  onModelSelect?: (model: ModelInfo) => void;
  onInteraction?: (type: string, data: any) => void;
  enableControls?: boolean;
  enableStats?: boolean;
  settings?: ModelViewerSettings;
  showUI?: boolean;
  width?: number;
  height?: number;
}

const DEFAULT_SETTINGS: ModelViewerSettings = {
  autoRotate: false,
  autoRotateSpeed: 1.0,
  environmentIntensity: 0.5,
  exposure: 1.0,
  shadowIntensity: 0.5,
  showGrid: true,
  showAxes: true,
  showStats: false,
  enableLOD: true,
  lodLevels: 3,
  maxDistance: 100,
  quality: 'high'
};

export function ModelViewer({
  modelUrl,
  models = [],
  onModelLoad,
  onModelSelect,
  onInteraction,
  enableControls = true,
  enableStats = false,
  settings = DEFAULT_SETTINGS,
  showUI = true,
  width = 800,
  height = 600
}: ModelViewerProps) {
  const [isLoading, setIsLoading] = useState<LoadingState>('idle');
  const [currentModel, setCurrentModel] = useState<ModelInfo | null>(null);
  const [renderMode, setRenderMode] = useState<RenderMode>('solid');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('orbit');
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats>({
    fps: 60,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    textureMemory: 0,
    geometryMemory: 0,
    renderTime: 0
  });
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0, z: 5 });
  const [cameraRotation, setCameraRotation] = useState({ x: 0, y: 0, z: 0 });
  const [modelRotation, setModelRotation] = useState({ x: 0, y: 0, z: 0 });
  const [modelScale, setModelScale] = useState(1.0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeSceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const animationFrameRef = useRef<number | null>(null);
  const modelRef = useRef<any>(null);
  const clockRef = useRef<any>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    initializeThreeJS();
    return () => {
      cleanupThreeJS();
    };
  }, []);

  // Load model when URL changes
  useEffect(() => {
    if (modelUrl) {
      loadModel(modelUrl);
    }
  }, [modelUrl]);

  // Initialize Three.js
  const initializeThreeJS = () => {
    // This would initialize Three.js in production
    // For now, we'll simulate the setup
    console.log('Initializing Three.js scene...');
    
    // Create scene
    const scene = {
      scene: {},
      camera: {},
      renderer: {},
      controls: {},
      lights: []
    };
    
    threeSceneRef.current = scene;
    
    // Start render loop
    startRenderLoop();
    
    console.log('Three.js initialized successfully');
  };

  // Load model
  const loadModel = async (url: string) => {
    setIsLoading('loading');
    
    try {
      // Simulate model loading
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Create mock model info
      const modelInfo: ModelInfo = {
        id: 'model-1',
        name: 'Sample Model',
        format: 'gltf',
        url,
        size: 1024 * 1024, // 1MB
        vertices: 10000,
        faces: 5000,
        materials: 5,
        textures: ['texture1.jpg', 'texture2.jpg'],
        boundingBox: {
          min: { x: -1, y: -1, z: -1 },
          max: { x: 1, y: 1, z: 1 }
        },
        animations: ['idle', 'walk', 'run'],
        metadata: { author: 'Unknown', version: '1.0' }
      };
      
      setCurrentModel(modelInfo);
      setIsLoading('loaded');
      onModelLoad?.(modelInfo);
      
      console.log('Model loaded successfully:', modelInfo);
    } catch (error) {
      console.error('Failed to load model:', error);
      setIsLoading('error');
    }
  };

  // Start render loop
  const startRenderLoop = () => {
    const animate = () => {
      // Update performance stats
      updatePerformanceStats();
      
      // Auto rotate model
      if (settings.autoRotate && currentModel) {
        setModelRotation(prev => ({
          x: prev.x,
          y: prev.y + settings.autoRotateSpeed * 0.01,
          z: prev.z
        }));
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
  };

  // Update performance stats
  const updatePerformanceStats = () => {
    const stats = {
      fps: 60, // Would be calculated from actual frame timing
      drawCalls: 100, // Would be calculated from WebGL stats
      triangles: currentModel?.vertices || 0,
      memoryUsage: 50, // Would be calculated from actual memory usage
      textureMemory: 20, // Would be calculated from texture memory
      geometryMemory: 30, // Would be calculated from geometry memory
      renderTime: 16 // Would be calculated from render timing
    };
    
    setPerformanceStats(stats);
  };

  // Cleanup Three.js
  const cleanupThreeJS = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Dispose Three.js resources
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    
    if (threeSceneRef.current) {
      // Dispose scene resources
    }
  };

  // Handle camera controls
  const handleCameraControl = useCallback((axis: 'x' | 'y' | 'z', delta: number) => {
    setCameraPosition(prev => ({
      ...prev,
      [axis]: prev[axis] + delta
    }));
  }, []);

  const handleCameraRotate = useCallback((axis: 'x' | 'y' | 'z', delta: number) => {
    setCameraRotation(prev => ({
      ...prev,
      [axis]: prev[axis] + delta
    }));
  }, []);

  // Handle model controls
  const handleModelRotate = useCallback((axis: 'x' | 'y' | 'z', delta: number) => {
    setModelRotation(prev => ({
      ...prev,
      [axis]: prev[axis] + delta
    }));
  }, []);

  const handleModelScale = useCallback((delta: number) => {
    setModelScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setCameraPosition({ x: 0, y: 0, z: 5 });
    setCameraRotation({ x: 0, y: 0, z: 0 });
    setModelRotation({ x: 0, y: 0, z: 0 });
    setModelScale(1.0);
  }, []);

  // Toggle auto-rotation
  const toggleAutoRotate = useCallback(() => {
    // This would update the settings
    console.log('Toggle auto-rotate');
  }, []);

  // Get render mode icon
  const getRenderModeIcon = (mode: RenderMode) => {
    const icons = {
      'solid': Box,
      'wireframe': Layers,
      'points': Eye,
      'normals': Eye,
      'uv': Eye
    };
    return icons[mode] || Box;
  };

  // Get render mode color
  const getRenderModeColor = (mode: RenderMode) => {
    const colors = {
      'solid': 'text-blue-400',
      'wireframe': 'text-green-400',
      'points': 'text-purple-400',
      'normals': 'text-orange-400',
      'uv': 'text-pink-400'
    };
    return colors[mode] || 'text-blue-400';
  };

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* 3D Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        width={width}
        height={height}
      />

      {/* Loading State */}
      <AnimatePresence>
        {isLoading === 'loading' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-white text-sm">Loading 3D Model...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      <AnimatePresence>
        {isLoading === 'error' && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <p className="text-white text-lg font-semibold mb-2">Failed to Load Model</p>
              <p className="text-gray-400 text-sm">Please check the model URL and try again</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Panel */}
      {showUI && enableControls && (
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Box className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">3D Model Viewer</h3>
          </div>

          {/* Model Info */}
          {currentModel && (
            <div className="mb-4">
              <div className="text-white text-sm font-medium mb-1">{currentModel.name}</div>
              <div className="text-gray-400 text-xs">
                {currentModel.format.toUpperCase()} • {Math.round(currentModel.size / 1024)}KB
              </div>
              <div className="text-gray-400 text-xs">
                {currentModel.vertices.toLocaleString()} vertices • {currentModel.faces.toLocaleString()} faces
              </div>
            </div>
          )}

          {/* Playback Controls */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`p-2 rounded transition-colors ${
                isPlaying 
                  ? 'bg-red-600 text-white hover:bg-red-700' 
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button
              onClick={resetView}
              className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              onClick={toggleAutoRotate}
              className={`p-2 rounded transition-colors ${
                settings.autoRotate 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-gray-600 text-white hover:bg-gray-700'
              }`}
            >
              <RotateCw className={`h-4 w-4 ${settings.autoRotate ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Render Mode */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm">Render Mode</label>
            <div className="flex gap-2 mt-2">
              {(['solid', 'wireframe', 'points', 'normals', 'uv'] as RenderMode[]).map(mode => {
                const IconComponent = getRenderModeIcon(mode);
                return (
                  <button
                    key={mode}
                    onClick={() => setRenderMode(mode)}
                    className={`p-2 rounded transition-colors ${
                      renderMode === mode
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-600 text-white hover:bg-gray-700'
                    }`}
                  >
                    <IconComponent className={`h-4 w-4 ${getRenderModeColor(mode)}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Camera Controls */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm">Camera</label>
            <div className="grid grid-cols-3 gap-1 mt-2">
              <button
                onClick={() => handleCameraControl('x', -0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                X-
              </button>
              <button
                onClick={() => handleCameraControl('y', -0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                Y-
              </button>
              <button
                onClick={() => handleCameraControl('z', -0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                Z-
              </button>
              <button
                onClick={() => handleCameraControl('x', 0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                X+
              </button>
              <button
                onClick={() => handleCameraControl('y', 0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                Y+
              </button>
              <button
                onClick={() => handleCameraControl('z', 0.5)}
                className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
              >
                Z+
              </button>
            </div>
          </div>

          {/* Model Controls */}
          <div className="mb-4">
            <label className="text-gray-400 text-sm">Model</label>
            <div className="space-y-2 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">Scale:</span>
                <button
                  onClick={() => handleModelScale(-0.1)}
                  className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  -
                </button>
                <span className="text-white text-xs min-w-[40px] text-center">
                  {modelScale.toFixed(1)}
                </span>
                <button
                  onClick={() => handleModelScale(0.1)}
                  className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-400 text-xs">Rotation:</span>
                <button
                  onClick={() => handleModelRotate('x', 0.1)}
                  className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  X
                </button>
                <button
                  onClick={() => handleModelRotate('y', 0.1)}
                  className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  Y
                </button>
                <button
                  onClick={() => handleModelRotate('z', 0.1)}
                  className="p-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                >
                  Z
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Stats */}
      {showUI && enableStats && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Performance</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">FPS:</span>
              <span className={`font-mono ${
                performanceStats.fps >= 60 ? 'text-green-400' :
                performanceStats.fps >= 30 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {performanceStats.fps}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Draw Calls:</span>
              <span className="text-blue-400 font-mono">{performanceStats.drawCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Triangles:</span>
              <span className="text-purple-400 font-mono">{performanceStats.triangles.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span className="text-orange-400 font-mono">{performanceStats.memoryUsage}MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Render Time:</span>
              <span className="text-green-400 font-mono">{performanceStats.renderTime}ms</span>
            </div>
          </div>
        </div>
      )}

      {/* Settings Button */}
      {showUI && (
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="absolute bottom-4 right-4 p-2 bg-black/80 backdrop-blur-md rounded-lg border border-gray-500/30 text-white hover:bg-black/90 transition-colors"
        >
          <Settings className="h-5 w-5" />
        </button>
      )}

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="absolute bottom-16 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-gray-500/30 w-80"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <h3 className="text-white font-semibold mb-4">Viewer Settings</h3>
            
            <div className="space-y-4">
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
                <label className="text-gray-400 text-sm">Environment Intensity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.environmentIntensity}
                  onChange={(e) => {
                    // Update environment intensity
                  }}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">
                  {settings.environmentIntensity.toFixed(1)}
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Exposure</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.exposure}
                  onChange={(e) => {
                    // Update exposure
                  }}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">
                  {settings.exposure.toFixed(1)}
                </div>
              </div>
              
              <div>
                <label className="text-gray-400 text-sm">Shadow Intensity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.shadowIntensity}
                  onChange={(e) => {
                    // Update shadow intensity
                  }}
                  className="w-full mt-1"
                />
                <div className="text-right text-gray-500 text-xs">
                  {settings.shadowIntensity.toFixed(1)}
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.showGrid}
                    onChange={(e) => {
                      // Toggle grid
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Show Grid</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.showAxes}
                    onChange={(e) => {
                      // Toggle axes
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Show Axes</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.enableLOD}
                    onChange={(e) => {
                      // Toggle LOD
                    }}
                    className="rounded"
                  />
                  <span className="text-gray-400 text-sm">Enable LOD</span>
                </label>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Model Info Panel */}
      {showUI && currentModel && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-purple-500/30 max-w-xs">
          <div className="flex items-center gap-3 mb-3">
            <Info className="h-5 w-5 text-purple-400" />
            <h3 className="text-white font-semibold">Model Info</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Name:</span>
              <span className="text-white ml-2">{currentModel.name}</span>
            </div>
            <div>
              <span className="text-gray-400">Format:</span>
              <span className="text-blue-300 ml-2 uppercase">{currentModel.format}</span>
            </div>
            <div>
              <span className="text-gray-400">Size:</span>
              <span className="text-green-300 ml-2">{Math.round(currentModel.size / 1024)}KB</span>
            </div>
            <div>
              <span className="text-gray-400">Vertices:</span>
              <span className="text-purple-300 ml-2">{currentModel.vertices.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-400">Faces:</span>
              <span className="text-orange-300 ml-2">{currentModel.faces.toLocaleString()}</span>
            </div>
            {currentModel.animations.length > 0 && (
              <div>
                <span className="text-gray-400">Animations:</span>
                <span className="text-pink-300 ml-2">{currentModel.animations.join(', ')}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={() => {
              // Download model
              console.log('Download model:', currentModel.url);
            }}
            className="w-full mt-3 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download Model
          </button>
        </div>
      )}

      {/* 3D Scene Placeholder */}
      {!currentModel && isLoading === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Box className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-white text-xl font-semibold mb-2">
              3D Model Viewer
            </h3>
            <p className="text-gray-400 text-sm">
              Load a 3D model to view it here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
