'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Settings, Activity, Monitor, Cpu, MemoryStick, Gauge, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Eye, Layers } from 'lucide-react';

export type PerformanceMode = 'quality' | 'balanced' | 'performance' | 'mobile';
export type OptimizationStrategy = 'adaptive' | 'manual' | 'automatic';
export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'vr' | 'ar';

export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  memoryUsage: number;
  textureMemory: number;
  geometryMemory: number;
  cpuUsage: number;
  gpuUsage: number;
  latency: number;
  droppedFrames: number;
  renderTime: number;
}

export interface LODSettings {
  enabled: boolean;
  levels: number;
  distances: number[];
  qualityLevels: {
    near: number;
    medium: number;
    far: number;
  };
  autoAdjust: boolean;
}

export interface RenderSettings {
  resolution: {
    width: number;
    height: number;
    scale: number;
  };
  quality: {
    shadows: boolean;
    antiAliasing: boolean;
    anisotropicFiltering: boolean;
    textureQuality: 'low' | 'medium' | 'high' | 'ultra';
    mipmapQuality: 'low' | 'medium' | 'high';
  };
  effects: {
    bloom: boolean;
    ssao: boolean;
    dof: boolean;
    motionBlur: boolean;
    postProcessing: boolean;
  };
}

export interface OptimizationSettings {
  mode: PerformanceMode;
  strategy: OptimizationStrategy;
  targetFPS: number;
  adaptiveQuality: boolean;
  frameRateLimit: boolean;
  culling: {
    frustum: boolean;
    occlusion: boolean;
    distance: boolean;
  };
  batching: boolean;
  instancing: boolean;
  compression: {
    textures: boolean;
    geometry: boolean;
    audio: boolean;
  };
  pooling: {
    objects: boolean;
    textures: boolean;
    particles: boolean;
  };
}

export interface PerformanceOptimizerProps {
  deviceType: DeviceType;
  onPerformanceUpdate?: (metrics: PerformanceMetrics) => void;
  onOptimizationChange?: (settings: OptimizationSettings) => void;
  onQualityChange?: (quality: number) => void;
  enableAutoOptimization?: boolean;
  showPerformanceUI?: boolean;
  enableMonitoring?: boolean;
  targetFPS?: number;
  maxMemoryUsage?: number;
}

const DEFAULT_SETTINGS: OptimizationSettings = {
  mode: 'balanced',
  strategy: 'adaptive',
  targetFPS: 60,
  adaptiveQuality: true,
  frameRateLimit: true,
  culling: {
    frustum: true,
    occlusion: true,
    distance: true
  },
  batching: true,
  instancing: true,
  compression: {
    textures: true,
    geometry: true,
    audio: true
  },
  pooling: {
    objects: true,
    textures: true,
    particles: true
  }
};

export function PerformanceOptimizer({
  deviceType,
  onPerformanceUpdate,
  onOptimizationChange,
  onQualityChange,
  enableAutoOptimization = true,
  showPerformanceUI = true,
  enableMonitoring = true,
  targetFPS = 60,
  maxMemoryUsage = 512
}: PerformanceOptimizerProps) {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    frameTime: 16.67,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    textureMemory: 0,
    geometryMemory: 0,
    cpuUsage: 0,
    gpuUsage: 0,
    latency: 0,
    droppedFrames: 0,
    renderTime: 0
  });
  const [optimizationSettings, setOptimizationSettings] = useState<OptimizationSettings>(DEFAULT_SETTINGS);
  const [renderSettings, setRenderSettings] = useState<RenderSettings>({
    resolution: { width: 1920, height: 1080, scale: 1.0 },
    quality: {
      shadows: true,
      antiAliasing: true,
      anisotropicFiltering: true,
      textureQuality: 'high',
      mipmapQuality: 'high'
    },
    effects: {
      bloom: true,
      ssao: true,
      dof: false,
      motionBlur: false,
      postProcessing: true
    }
  });
  const [lodSettings, setLodSettings] = useState<LODSettings>({
    enabled: true,
    levels: 3,
    distances: [10, 50, 100],
    qualityLevels: {
      near: 1.0,
      medium: 0.7,
      far: 0.3
    },
    autoAdjust: true
  });
  const [showSettings, setShowSettings] = useState(false);
  const [performanceHistory, setPerformanceHistory] = useState<number[]>([]);
  const [alerts, setAlerts] = useState<Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    message: string;
    timestamp: number;
  }>>([]);

  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const frameCountRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const performanceBufferRef = useRef<number[]>([]);

  // Initialize performance monitoring
  useEffect(() => {
    if (enableMonitoring) {
      startMonitoring();
    }
    
    return () => {
      stopMonitoring();
    };
  }, [enableMonitoring]);

  // Auto-optimization
  useEffect(() => {
    if (enableAutoOptimization && optimizationSettings.strategy === 'adaptive') {
      const interval = setInterval(() => {
        performAutoOptimization();
      }, 1000); // Check every second
      
      return () => clearInterval(interval);
    }
  }, [enableAutoOptimization, optimizationSettings.strategy]);

  // Start performance monitoring
  const startMonitoring = () => {
    monitoringIntervalRef.current = setInterval(() => {
      updatePerformanceMetrics();
    }, 100); // Update every 100ms
  };

  // Stop performance monitoring
  const stopMonitoring = () => {
    if (monitoringIntervalRef.current) {
      clearInterval(monitoringIntervalRef.current);
    }
  };

  // Update performance metrics
  const updatePerformanceMetrics = useCallback(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastFrameTimeRef.current;
    const fps = Math.round(1000 / deltaTime);
    
    frameCountRef.current++;
    lastFrameTimeRef.current = currentTime;
    
    // Add to performance buffer
    performanceBufferRef.current.push(fps);
    if (performanceBufferRef.current.length > 60) {
      performanceBufferRef.current.shift();
    }
    
    // Calculate average FPS
    const avgFPS = performanceBufferRef.current.reduce((sum, fps) => sum + fps, 0) / performanceBufferRef.current.length;
    
    // Simulate other metrics (in production would use actual WebGL/Performance API)
    const metrics: PerformanceMetrics = {
      fps: avgFPS,
      frameTime: deltaTime,
      drawCalls: Math.floor(Math.random() * 100 + 50),
      triangles: Math.floor(Math.random() * 10000 + 5000),
      memoryUsage: Math.random() * 200 + 100,
      textureMemory: Math.random() * 100 + 50,
      geometryMemory: Math.random() * 50 + 25,
      cpuUsage: Math.random() * 30 + 10,
      gpuUsage: Math.random() * 40 + 20,
      latency: Math.random() * 10 + 5,
      droppedFrames: Math.max(0, Math.floor((60 - avgFPS) / 60 * 10)),
      renderTime: deltaTime * 0.7 // Render time is typically 70% of frame time
    };
    
    setCurrentMetrics(metrics);
    setPerformanceHistory(prev => [...prev.slice(-60), fps]);
    
    // Check for performance issues
    checkPerformanceIssues(metrics);
    
    // Notify parent component
    onPerformanceUpdate?.(metrics);
  }, [onPerformanceUpdate]);

  // Check for performance issues
  const checkPerformanceIssues = (metrics: PerformanceMetrics) => {
    const newAlerts: Array<{
      id: string;
      type: 'warning' | 'error' | 'info';
      message: string;
      timestamp: number;
    }> = [];
    
    // Low FPS warning
    if (metrics.fps < targetFPS * 0.8) {
      newAlerts.push({
        id: `low-fps-${Date.now()}`,
        type: 'warning',
        message: `Low FPS: ${metrics.fps} (target: ${targetFPS})`,
        timestamp: Date.now()
      });
    }
    
    // High memory usage warning
    if (metrics.memoryUsage > maxMemoryUsage * 0.9) {
      newAlerts.push({
        id: `high-memory-${Date.now()}`,
        type: 'warning',
        message: `High memory usage: ${Math.round(metrics.memoryUsage)}MB`,
        timestamp: Date.now()
      });
    }
    
    // High latency warning
    if (metrics.latency > 20) {
      newAlerts.push({
        id: `high-latency-${Date.now()}`,
        type: 'error',
        message: `High latency: ${Math.round(metrics.latency)}ms`,
        timestamp: Date.now()
      });
    }
    
    // Dropped frames warning
    if (metrics.droppedFrames > 5) {
      newAlerts.push({
        id: `dropped-frames-${Date.now()}`,
        type: 'error',
        message: `Dropped frames: ${metrics.droppedFrames}`,
        timestamp: Date.now()
      });
    }
    
    setAlerts(prev => [...prev.slice(-5), ...newAlerts]);
  };

  // Perform automatic optimization
  const performAutoOptimization = useCallback(() => {
    if (!enableAutoOptimization) return;
    
    setIsOptimizing(true);
    
    const metrics = currentMetrics;
    const newSettings = { ...optimizationSettings };
    
    // Adjust based on performance
    if (metrics.fps < targetFPS * 0.8) {
      // Performance is poor, reduce quality
      if (renderSettings.quality.shadows) {
        renderSettings.quality.shadows = false;
        addAlert('warning', 'Disabled shadows for better performance');
      }
      
      if (renderSettings.effects.bloom) {
        renderSettings.effects.bloom = false;
        addAlert('warning', 'Disabled bloom for better performance');
      }
      
      if (renderSettings.resolution.scale > 0.8) {
        renderSettings.resolution.scale = Math.max(0.5, renderSettings.resolution.scale - 0.1);
        addAlert('warning', `Reduced resolution to ${Math.round(renderSettings.resolution.scale * 100)}%`);
      }
      
      // Enable more aggressive culling
      newSettings.culling.occlusion = true;
      newSettings.culling.distance = true;
      
      // Reduce LOD distances
      if (lodSettings.enabled) {
        lodSettings.distances = lodSettings.distances.map(d => d * 0.8);
        addAlert('warning', 'Reduced LOD distances for better performance');
      }
    } else if (metrics.fps > targetFPS * 1.2) {
      // Performance is good, can increase quality
      if (!renderSettings.quality.shadows && deviceType !== 'mobile') {
        renderSettings.quality.shadows = true;
        addAlert('info', 'Enabled shadows for better visuals');
      }
      
      if (!renderSettings.effects.bloom && deviceType !== 'mobile') {
        renderSettings.effects.bloom = true;
        addAlert('info', 'Enabled bloom for better visuals');
      }
      
      if (renderSettings.resolution.scale < 1.0 && deviceType !== 'mobile') {
        renderSettings.resolution.scale = Math.min(1.0, renderSettings.resolution.scale + 0.1);
        addAlert('info', `Increased resolution to ${Math.round(renderSettings.resolution.scale * 100)}%`);
      }
    }
    
    setOptimizationSettings(newSettings);
    onOptimizationChange?.(newSettings);
    
    setTimeout(() => setIsOptimizing(false), 500);
  }, [currentMetrics, enableAutoOptimization, deviceType, renderSettings, lodSettings, onOptimizationChange]);

  // Add alert
  const addAlert = (type: 'warning' | 'error' | 'info', message: string) => {
    setAlerts(prev => [...prev, {
      id: `alert-${Date.now()}`,
      type,
      message,
      timestamp: Date.now()
    }]);
  };

  // Manual optimization
  const optimizeForDevice = useCallback((device: DeviceType) => {
    setIsOptimizing(true);
    
    const settings = { ...optimizationSettings };
    const render = { ...renderSettings };
    const lod = { ...lodSettings };
    
    switch (device) {
      case 'mobile':
        settings.mode = 'performance';
        settings.targetFPS = 30;
        render.resolution.scale = 0.7;
        render.quality.shadows = false;
        render.quality.antiAliasing = false;
        render.quality.textureQuality = 'medium';
        render.effects.bloom = false;
        render.effects.ssao = false;
        render.effects.dof = false;
        render.effects.motionBlur = false;
        lod.enabled = true;
        lod.levels = 2;
        lod.distances = [5, 25];
        settings.culling.occlusion = false;
        settings.culling.distance = true;
        break;
        
      case 'tablet':
        settings.mode = 'balanced';
        settings.targetFPS = 60;
        render.resolution.scale = 0.9;
        render.quality.shadows = true;
        render.quality.antiAliasing = true;
        render.quality.textureQuality = 'high';
        render.effects.bloom = false;
        render.effects.ssao = false;
        render.effects.dof = false;
        render.effects.motionBlur = false;
        lod.enabled = true;
        lod.levels = 3;
        lod.distances = [10, 50, 100];
        break;
        
      case 'vr':
        settings.mode = 'performance';
        settings.targetFPS = 90;
        render.resolution.scale = 1.0;
        render.quality.shadows = false;
        render.quality.antiAliasing = true;
        render.quality.textureQuality = 'medium';
        render.effects.bloom = false;
        render.effects.ssao = false;
        render.effects.dof = false;
        render.effects.motionBlur = false;
        lod.enabled = true;
        lod.levels = 2;
        lod.distances = [8, 40];
        settings.culling.occlusion = true;
        settings.culling.distance = true;
        break;
        
      case 'ar':
        settings.mode = 'balanced';
        settings.targetFPS = 60;
        render.resolution.scale = 0.8;
        render.quality.shadows = false;
        render.quality.antiAliasing = true;
        render.quality.textureQuality = 'medium';
        render.effects.bloom = false;
        render.effects.ssao = false;
        render.effects.dof = false;
        render.effects.motionBlur = false;
        lod.enabled = true;
        lod.levels = 2;
        lod.distances = [6, 30];
        break;
        
      case 'desktop':
      default:
        settings.mode = 'quality';
        settings.targetFPS = 60;
        render.resolution.scale = 1.0;
        render.quality.shadows = true;
        render.quality.antiAliasing = true;
        render.quality.textureQuality = 'ultra';
        render.effects.bloom = true;
        render.effects.ssao = true;
        render.effects.dof = false;
        render.effects.motionBlur = false;
        lod.enabled = true;
        lod.levels = 4;
        lod.distances = [15, 75, 150, 300];
        break;
    }
    
    setOptimizationSettings(settings);
    setRenderSettings(render);
    setLodSettings(lod);
    
    addAlert('info', `Optimized for ${device} device`);
    
    setTimeout(() => setIsOptimizing(false), 1000);
  }, []);

  // Get performance color
  const getPerformanceColor = (value: number, target: number, isLowerBetter = false) => {
    const ratio = value / target;
    if (isLowerBetter) {
      if (ratio <= 0.8) return 'text-green-400';
      if (ratio <= 1.2) return 'text-yellow-400';
      return 'text-red-400';
    } else {
      if (ratio >= 1.2) return 'text-green-400';
      if (ratio >= 0.8) return 'text-yellow-400';
      return 'text-red-400';
    }
  };

  // Get device icon
  const getDeviceIcon = (device: DeviceType) => {
    const icons = {
      'desktop': Monitor,
      'mobile': Cpu,
      'tablet': MemoryStick,
      'vr': Eye,
      'ar': Layers
    };
    return icons[device] || Monitor;
  };

  // Get alert icon
  const getAlertIcon = (type: 'warning' | 'error' | 'info') => {
    const icons = {
      'warning': AlertTriangle,
      'error': AlertTriangle,
      'info': CheckCircle
    };
    return icons[type] || AlertTriangle;
  };

  // Get alert color
  const getAlertColor = (type: 'warning' | 'error' | 'info') => {
    const colors = {
      'warning': 'text-yellow-400',
      'error': 'text-red-400',
      'info': 'text-blue-400'
    };
    return colors[type] || 'text-gray-400';
  };

  if (!showPerformanceUI) {
    return null;
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* Performance Visualization */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-900/20 to-blue-900/20">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <Zap className="h-16 w-16 text-green-400 mx-auto mb-4 animate-pulse" />
              <div className="absolute -inset-2 bg-green-400/20 rounded-full animate-ping" />
            </div>
            <h3 className="text-white text-xl font-semibold mb-2">Performance Optimizer</h3>
            <p className="text-gray-400 text-sm">Real-time performance monitoring</p>
          </div>
        </div>

        {/* Performance Graph */}
        <div className="absolute bottom-4 left-4 right-4 h-32">
          <div className="relative h-full bg-black/50 rounded-lg p-2">
            <div className="absolute top-2 left-2 text-green-400 text-xs font-mono">
              FPS: {Math.round(currentMetrics.fps)}
            </div>
            <div className="absolute top-2 right-2 text-blue-400 text-xs font-mono">
              Target: {targetFPS}
            </div>
            <svg className="w-full h-full" viewBox="0 0 400 100">
              {/* Grid lines */}
              {[...Array(6)].map((_, i) => (
                <line
                  key={`grid-${i}`}
                  x1="0"
                  y1={i * 20}
                  x2="400"
                  y2={i * 20}
                  stroke="#374151"
                  strokeWidth="0.5"
                />
              ))}
              
              {/* Target line */}
              <line
                x1="0"
                y1={100 - (targetFPS / 120) * 100}
                x2="400"
                y2={100 - (targetFPS / 120) * 100}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="5,5"
              />
              
              {/* Performance line */}
              <polyline
                points={performanceHistory.map((fps, index) => 
                  `${index * (400 / 60)},${100 - (fps / 120) * 100}`
                ).join(' ')}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
              />
            </svg>
          </div>
        </div>

        {/* Metrics Display */}
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30 max-w-xs">
          <div className="flex items-center gap-3 mb-4">
            <Gauge className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Performance</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">FPS:</span>
              <span className={`font-mono ${getPerformanceColor(currentMetrics.fps, targetFPS)}`}>
                {Math.round(currentMetrics.fps)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Frame Time:</span>
              <span className={`font-mono ${getPerformanceColor(currentMetrics.frameTime, 16.67, true)}`}>
                {currentMetrics.frameTime.toFixed(1)}ms
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Memory:</span>
              <span className={`font-mono ${getPerformanceColor(currentMetrics.memoryUsage, maxMemoryUsage, true)}`}>
                {Math.round(currentMetrics.memoryUsage)}MB
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Draw Calls:</span>
              <span className="text-blue-400 font-mono">{currentMetrics.drawCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Triangles:</span>
              <span className="text-purple-400 font-mono">{currentMetrics.triangles.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">CPU:</span>
              <span className="text-orange-400 font-mono">{Math.round(currentMetrics.cpuUsage)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">GPU:</span>
              <span className="text-red-400 font-mono">{Math.round(currentMetrics.gpuUsage)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Latency:</span>
              <span className={`font-mono ${getPerformanceColor(currentMetrics.latency, 16, true)}`}>
                {currentMetrics.latency.toFixed(1)}ms
              </span>
            </div>
          </div>
        </div>

        {/* Device Optimization Panel */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30 max-w-xs">
          <div className="flex items-center gap-3 mb-4">
            {(() => {
              const IconComponent = getDeviceIcon(deviceType);
              return <IconComponent className="h-5 w-5 text-blue-400" />;
            })()}
            <h3 className="text-white font-semibold">Device: {deviceType}</h3>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Mode:</span>
              <span className="text-blue-300 capitalize">{optimizationSettings.mode}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Target FPS:</span>
              <span className="text-green-300">{optimizationSettings.targetFPS}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Resolution:</span>
              <span className="text-purple-300">{Math.round(renderSettings.resolution.scale * 100)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">LOD:</span>
              <span className="text-yellow-300">{lodSettings.levels} levels</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => optimizeForDevice(deviceType)}
              disabled={isOptimizing}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isOptimizing ? 'Optimizing...' : 'Optimize for Device'}
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => optimizeForDevice('mobile')}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                Mobile
              </button>
              <button
                onClick={() => optimizeForDevice('desktop')}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                Desktop
              </button>
              <button
                onClick={() => optimizeForDevice('vr')}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                VR
              </button>
              <button
                onClick={() => optimizeForDevice('ar')}
                className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
              >
                AR
              </button>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <AnimatePresence>
          {alerts.length > 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-y-2">
              {alerts.slice(-3).map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`bg-black/80 backdrop-blur-sm rounded-lg p-3 border ${
                    alert.type === 'error' ? 'border-red-500/50' :
                    alert.type === 'warning' ? 'border-yellow-500/50' :
                    'border-blue-500/50'
                  } max-w-md`}
                >
                  <div className="flex items-center gap-2">
                    {(() => {
                      const IconComponent = getAlertIcon(alert.type);
                      return <IconComponent className={`h-4 w-4 ${getAlertColor(alert.type)}`} />;
                    })()}
                    <span className={`text-sm ${getAlertColor(alert.type)}`}>
                      {alert.message}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>

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
              <h3 className="text-white font-semibold mb-4">Performance Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-gray-400 text-sm">Performance Mode</label>
                  <select 
                    className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                    value={optimizationSettings.mode}
                    onChange={(e) => {
                      const newSettings = { ...optimizationSettings, mode: e.target.value as PerformanceMode };
                      setOptimizationSettings(newSettings);
                      onOptimizationChange?.(optimizationSettings);
                    }}
                  >
                    <option value="quality">Quality</option>
                    <option value="balanced">Balanced</option>
                    <option value="performance">Performance</option>
                    <option value="mobile">Mobile</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm">Target FPS</label>
                  <input
                    type="number"
                    min="15"
                    max="120"
                    value={optimizationSettings.targetFPS}
                    onChange={(e) => {
                      const newSettings = { ...optimizationSettings, targetFPS: parseInt(e.target.value) };
                      setOptimizationSettings(newSettings);
                      onOptimizationChange?.(optimizationSettings);
                    }}
                    className="w-full mt-1 p-2 bg-black/50 border border-gray-500/30 rounded text-white"
                  />
                </div>
                
                <div>
                  <label className="text-gray-400 text-sm">Resolution Scale</label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.1"
                    value={renderSettings.resolution.scale}
                    onChange={(e) => {
                      const newRender = { ...renderSettings, resolution: { ...renderSettings.resolution, scale: parseFloat(e.target.value) } };
                      setRenderSettings(newRender);
                    }}
                    className="w-full mt-1"
                  />
                  <div className="text-right text-gray-500 text-xs">
                    {Math.round(renderSettings.resolution.scale * 100)}%
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={renderSettings.quality.shadows}
                      onChange={(e) => {
                        const newRender = { ...renderSettings, quality: { ...renderSettings.quality, shadows: e.target.checked } };
                        setRenderSettings(newRender);
                      }}
                      className="rounded"
                    />
                    <span className="text-gray-400 text-sm">Shadows</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={renderSettings.effects.bloom}
                      onChange={(e) => {
                        const newRender = { ...renderSettings, effects: { ...renderSettings.effects, bloom: e.target.checked } };
                        setRenderSettings(newRender);
                      }}
                      className="rounded"
                    />
                    <span className="text-gray-400 text-sm">Bloom</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={lodSettings.enabled}
                      onChange={(e) => {
                        const newLod = { ...lodSettings, enabled: e.target.checked };
                        setLodSettings(newLod);
                      }}
                      className="rounded"
                    />
                    <span className="text-gray-400 text-sm">LOD</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={optimizationSettings.culling.frustum}
                      onChange={(e) => {
                        const newSettings = { ...optimizationSettings, culling: { ...optimizationSettings.culling, frustum: e.target.checked } };
                      setOptimizationSettings(newSettings);
                      onOptimizationChange?.(newSettings);
                    }}
                      className="rounded"
                    />
                    <span className="text-gray-400 text-sm">Frustum Culling</span>
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Optimization Status */}
        {isOptimizing && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-blue-500/20 backdrop-blur-sm rounded-lg p-3 border border-blue-500/50">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />
              <span className="text-blue-400 text-sm font-medium">Optimizing Performance...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
