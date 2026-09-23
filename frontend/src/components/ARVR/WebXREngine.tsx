'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Glasses, Scan, Monitor, Settings, Play, Pause, RotateCw, Eye, Hand, Users, Globe } from 'lucide-react';

export type XRMode = 'vr' | 'ar' | 'none';
export type XRSessionState = 'idle' | 'starting' | 'active' | 'ending' | 'error';
export type HandTrackingMode = 'none' | 'basic' | 'full';

export interface XRDevice {
  id: string;
  name: string;
  type: 'vr' | 'ar';
  capabilities: {
    handTracking: boolean;
    spatialTracking: boolean;
    eyeTracking: boolean;
    controllers: boolean;
    passthrough: boolean;
  };
  supported: boolean;
}

export interface XRSession {
  id: string;
  mode: XRMode;
  state: XRSessionState;
  device: XRDevice;
  startTime: number;
  frameRate: number;
  latency: number;
  trackingQuality: 'high' | 'medium' | 'low';
  batteryLevel?: number;
}

/**
 * A live browser WebXR session. This aliases the DOM `XRSession` type (which
 * the component-level `XRSession` interface above shadows) and adds the
 * non-standard, mock-only `requestInputSources` hook used by this simulated
 * engine. Available in `lib.dom` for browsers with the WebXR types enabled.
 */
type XRBrowserSession = globalThis.XRSession & {
  requestInputSources?: (options?: {
    optional?: Array<{ handedness?: string }>;
  }) => Promise<Array<{ handedness?: string | null }>>;
};

export interface XRController {
  id: string;
  hand: 'left' | 'right';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  buttons: boolean[];
  axes: number[];
  tracking: boolean;
  visible: boolean;
}

export interface XRHand {
  id: string;
  hand: 'left' | 'right';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  joints: {
    wrist: { x: number; y: number; z: number };
    thumb: { x: number; y: number; z: number };
    index: { x: number; y: number; z: number };
    middle: { x: number; y: number; z: number };
    ring: { x: number; y: number; z: number };
    pinky: { x: number; y: number; z: number };
  };
  tracking: boolean;
  gesture: string;
  confidence: number;
}

export interface XRSettings {
  targetFrameRate: 30 | 60 | 72 | 90 | 120;
  enableHandTracking: boolean;
  enableEyeTracking: boolean;
  enableSpatialAudio: boolean;
  enablePassthrough: boolean;
  antiAliasing: boolean;
  shadows: boolean;
  lodOptimization: boolean;
  performanceMode: 'quality' | 'balanced' | 'performance';
}

export interface WebXREngineProps {
  onSessionStart?: (session: XRSession) => void;
  onSessionEnd?: (session: XRSession) => void;
  onControllerConnected?: (controller: XRController) => void;
  onHandDetected?: (hand: XRHand) => void;
  onDeviceConnected?: (device: XRDevice) => void;
  enableVR?: boolean;
  enableAR?: boolean;
  handTrackingMode?: HandTrackingMode;
  settings?: XRSettings;
  showDebugInfo?: boolean;
}

const DEFAULT_SETTINGS: XRSettings = {
  targetFrameRate: 60,
  enableHandTracking: true,
  enableEyeTracking: false,
  enableSpatialAudio: true,
  enablePassthrough: false,
  antiAliasing: true,
  shadows: true,
  lodOptimization: true,
  performanceMode: 'balanced'
};

export function WebXREngine({
  onSessionStart,
  onSessionEnd,
  onControllerConnected,
  onHandDetected,
  onDeviceConnected,
  enableVR = true,
  enableAR = true,
  handTrackingMode = 'basic',
  settings = DEFAULT_SETTINGS,
  showDebugInfo = true
}: WebXREngineProps) {
  const [xrSupported, setXrSupported] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<XRDevice[]>([]);
  const [currentSession, setCurrentSession] = useState<XRSession | null>(null);
  const [controllers, setControllers] = useState<XRController[]>([]);
  const [hands, setHands] = useState<XRHand[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<{
    frameRate: number;
    latency: number;
    drawCalls: number;
    triangles: number;
    memoryUsage: number;
    trackingQuality: 'high' | 'medium' | 'low';
  }>({
    frameRate: 0,
    latency: 0,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    trackingQuality: 'high'
  });

  const xrSessionRef = useRef<XRBrowserSession | null>(null);
  const xrFrameRef = useRef<XRFrame | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize WebXR
  useEffect(() => {
    initializeWebXR();
    return () => {
      cleanupWebXR();
    };
  }, []);

  // Initialize WebXR
  const initializeWebXR = async () => {
    try {
      // Check WebXR support
      if (!navigator.xr) {
        console.error('WebXR not supported');
        return;
      }

      setXrSupported(true);

      // Check for VR support
      let vrSupported = false;
      if (enableVR) {
        vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      }

      // Check for AR support
      let arSupported = false;
      if (enableAR) {
        arSupported = await navigator.xr.isSessionSupported('immersive-ar');
      }

      // Discover available devices
      const devices = await discoverXRDevices(vrSupported, arSupported);
      setAvailableDevices(devices);

      // Notify about connected devices
      devices.forEach(device => {
        if (device.supported) {
          onDeviceConnected?.(device);
        }
      });

      setIsInitialized(true);
      console.log('WebXR initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebXR:', error);
    }
  };

  // Discover XR devices
  const discoverXRDevices = async (vrSupported: boolean, arSupported: boolean): Promise<XRDevice[]> => {
    const devices: XRDevice[] = [];

    // Simulate device discovery (in production, would use actual device APIs)
    if (vrSupported) {
      devices.push({
        id: 'meta-quest-2',
        name: 'Meta Quest 2',
        type: 'vr',
        capabilities: {
          handTracking: true,
          spatialTracking: true,
          eyeTracking: false,
          controllers: true,
          passthrough: false
        },
        supported: true
      });

      devices.push({
        id: 'meta-quest-3',
        name: 'Meta Quest 3',
        type: 'vr',
        capabilities: {
          handTracking: true,
          spatialTracking: true,
          eyeTracking: true,
          controllers: true,
          passthrough: true
        },
        supported: true
      });

      devices.push({
        id: 'valve-index',
        name: 'Valve Index',
        type: 'vr',
        capabilities: {
          handTracking: false,
          spatialTracking: true,
          eyeTracking: false,
          controllers: true,
          passthrough: false
        },
        supported: true
      });
    }

    if (arSupported) {
      devices.push({
        id: 'ios-ar',
        name: 'iOS AR (ARKit)',
        type: 'ar',
        capabilities: {
          handTracking: true,
          spatialTracking: true,
          eyeTracking: true,
          controllers: false,
          passthrough: true
        },
        supported: true
      });

      devices.push({
        id: 'android-ar',
        name: 'Android AR (ARCore)',
        type: 'ar',
        capabilities: {
          handTracking: true,
          spatialTracking: true,
          eyeTracking: false,
          controllers: false,
          passthrough: true
        },
        supported: true
      });
    }

    return devices;
  };

  // Start XR session
  const startXRSession = useCallback(async (mode: XRMode, deviceId?: string) => {
    try {
      if (!navigator.xr) {
        throw new Error('WebXR not supported');
      }

      // Find device
      const device = deviceId 
        ? availableDevices.find(d => d.id === deviceId && d.type === mode)
        : availableDevices.find(d => d.type === mode && d.supported);

      if (!device) {
        throw new Error(`No supported device found for ${mode} mode`);
      }

      // Map our internal mode onto the WebXR session mode enum.
      const sessionMode: XRSessionMode = mode === 'vr' ? 'immersive-vr' : 'immersive-ar';

      // Create session
      const session = (await navigator.xr.requestSession(sessionMode, {
        requiredFeatures: ['local', 'input'],
        optionalFeatures: [
          'hand-tracking',
          'eye-tracking',
          'spatial-tracking',
          'anchors',
          'planes',
          'meshes',
          'hit-test'
        ]
      })) as XRBrowserSession;

      // Initialize session
      await initializeXRSession(session, device, mode);

      // Create session object
      const xrSession: XRSession = {
        id: (session as { id?: string }).id ?? `xr-${Date.now()}`,
        mode,
        state: 'active',
        device,
        startTime: Date.now(),
        frameRate: 0,
        latency: 0,
        trackingQuality: 'high'
      };

      setCurrentSession(xrSession);
      xrSessionRef.current = session;
      onSessionStart?.(xrSession);

      console.log(`XR session started in ${mode} mode`);
    } catch (error) {
      console.error('Failed to start XR session:', error);
      
      const errorSession: XRSession = {
        id: 'error',
        mode,
        state: 'error',
        device: availableDevices[0] || { id: 'unknown', name: 'Unknown', type: mode, capabilities: {}, supported: false },
        startTime: Date.now(),
        frameRate: 0,
        latency: 0,
        trackingQuality: 'low'
      };
      
      setCurrentSession(errorSession);
    }
  }, [availableDevices, onSessionStart]);

  // Initialize XR session
  const initializeXRSession = async (session: XRBrowserSession, device: XRDevice, mode: XRMode) => {
    // Setup render loop
    session.requestAnimationFrame(onXRFrame);

    // Setup input sources
    await setupInputSources(session, device);

    // Setup hand tracking
    if (device.capabilities.handTracking && settings.enableHandTracking) {
      await setupHandTracking(session);
    }

    // Setup eye tracking
    if (device.capabilities.eyeTracking && settings.enableEyeTracking) {
      await setupEyeTracking(session);
    }
  };

  // Setup input sources
  const setupInputSources = async (session: XRBrowserSession, device: XRDevice) => {
    if (!device.capabilities.controllers) return;

    try {
      // Request controller input sources (mock-only hook, guarded at runtime).
      const inputSources = session.requestInputSources
        ? await session.requestInputSources({
            optional: [
              { handedness: 'left' },
              { handedness: 'right' }
            ]
          })
        : [];

      // Create controller objects
      const newControllers: XRController[] = [];
      
      for (const inputSource of inputSources) {
        const controller: XRController = {
          id: inputSource.handedness || 'unknown',
          hand: inputSource.handedness as 'left' | 'right',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          buttons: [],
          axes: [],
          tracking: true,
          visible: true
        };
        
        newControllers.push(controller);
        onControllerConnected?.(controller);
      }

      setControllers(newControllers);
    } catch (error) {
      console.error('Failed to setup input sources:', error);
    }
  };

  // Setup hand tracking
  const setupHandTracking = async (session: XRBrowserSession) => {
    try {
      // Request hand tracking
      await session.requestReferenceSpace('viewer');
      
      // Simulate hand tracking setup
      console.log('Hand tracking enabled');
    } catch (error) {
      console.error('Failed to setup hand tracking:', error);
    }
  };

  // Setup eye tracking
  const setupEyeTracking = async (session: XRBrowserSession) => {
    try {
      // Request eye tracking
      await session.requestReferenceSpace('viewer');
      
      // Simulate eye tracking setup
      console.log('Eye tracking enabled');
    } catch (error) {
      console.error('Failed to setup eye tracking:', error);
    }
  };

  // XR frame callback
  const onXRFrame = useCallback((time: DOMHighResTimeStamp, frame: XRFrame) => {
    xrFrameRef.current = frame;

    // Update performance stats
    updatePerformanceStats(frame);

    // Update controllers
    updateControllers(frame);

    // Update hands
    updateHands(frame);

    // Continue render loop
    if (xrSessionRef.current) {
      xrSessionRef.current.requestAnimationFrame(onXRFrame);
    }
  }, []);

  // Update performance stats
  const updatePerformanceStats = (frame: XRFrame) => {
    const stats = {
      frameRate: 60, // Would be calculated from frame timing
      latency: 0, // Would be calculated from frame timestamp
      drawCalls: 0, // Would be calculated from WebGL stats
      triangles: 0, // Would be calculated from geometry stats
      memoryUsage: 0, // Would be calculated from memory stats
      trackingQuality:
        (frame as { trackingQuality?: 'high' | 'medium' | 'low' }).trackingQuality || 'high'
    };

    setPerformanceStats(stats);
  };

  // Update controllers
  const updateControllers = (frame: XRFrame) => {
    // Simulate controller updates
    const updatedControllers = controllers.map(controller => ({
      ...controller,
      position: {
        x: Math.sin(Date.now() * 0.001) * 0.5,
        y: Math.cos(Date.now() * 0.001) * 0.3,
        z: 0.5
      },
      rotation: {
        x: Math.sin(Date.now() * 0.002) * 0.1,
        y: Math.cos(Date.now() * 0.002) * 0.1,
        z: 0
      }
    }));

    setControllers(updatedControllers);
  };

  // Update hands
  const updateHands = (frame: XRFrame) => {
    // Simulate hand tracking updates
    const updatedHands = hands.map(hand => ({
      ...hand,
      position: {
        x: Math.sin(Date.now() * 0.001 + (hand.hand === 'left' ? 0 : Math.PI)) * 0.3,
        y: 0.2,
        z: 0.4
      },
      rotation: {
        x: 0,
        y: Math.sin(Date.now() * 0.001) * 0.2,
        z: 0
      },
      gesture: 'open',
      confidence: 0.9
    }));

    setHands(updatedHands);
  };

  // End XR session
  const endXRSession = useCallback(async () => {
    if (!xrSessionRef.current) return;

    try {
      await xrSessionRef.current.end();
      
      const session = currentSession;
      if (session) {
        const endedSession: XRSession = { ...session, state: 'ending' };
        setCurrentSession(endedSession);
        onSessionEnd?.(endedSession);
      }

      xrSessionRef.current = null;
      setCurrentSession(null);
      setControllers([]);
      setHands([]);

      console.log('XR session ended');
    } catch (error) {
      console.error('Failed to end XR session:', error);
    }
  }, [currentSession, onSessionEnd]);

  // Cleanup WebXR
  const cleanupWebXR = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (xrSessionRef.current) {
      xrSessionRef.current.end();
    }
  };

  // Get device icon
  const getDeviceIcon = (device: XRDevice) => {
    switch (device.type) {
      case 'vr': return Glasses;
      case 'ar': return Scan;
      default: return Monitor;
    }
  };

  // Get device color
  const getDeviceColor = (device: XRDevice) => {
    switch (device.type) {
      case 'vr': return 'text-blue-400';
      case 'ar': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Initializing WebXR...</p>
        </div>
      </div>
    );
  }

  if (!xrSupported) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            WebXR Not Supported
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Your browser or device doesn't support WebXR
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {/* XR Status Display */}
      <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-5 w-5 text-blue-400" />
          <h3 className="text-white font-semibold">WebXR Engine</h3>
        </div>

        {/* Session Status */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Status:</span>
            <span className={
              currentSession?.state === 'active' ? 'text-green-400' :
              currentSession?.state === 'error' ? 'text-red-400' :
              'text-yellow-400'
            }>
              {currentSession?.state || 'Idle'}
            </span>
          </div>
          
          {currentSession && (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Mode:</span>
                <span className="text-blue-400 text-sm capitalize">
                  {currentSession.mode}
                </span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Device:</span>
                <span className="text-purple-400 text-sm">
                  {currentSession.device.name}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Runtime:</span>
                <span className="text-green-400 text-sm">
                  {Math.floor((Date.now() - currentSession.startTime) / 1000)}s
                </span>
              </div>
            </>
          )}
        </div>

        {/* Available Devices */}
        <div className="mb-4">
          <h4 className="text-white text-sm font-medium mb-2">Available Devices</h4>
          <div className="space-y-2">
            {availableDevices.map((device) => {
              const IconComponent = getDeviceIcon(device);
              return (
                <div
                  key={device.id}
                  className={`flex items-center gap-3 p-2 rounded ${
                    device.supported 
                      ? 'bg-green-900/20 border border-green-500/30' 
                      : 'bg-gray-900/20 border border-gray-500/30 opacity-50'
                  }`}
                >
                  <IconComponent className={`h-4 w-4 ${getDeviceColor(device)}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">
                      {device.name}
                    </div>
                    <div className="text-gray-400 text-xs capitalize">
                      {device.type}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {device.capabilities.handTracking && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full" title="Hand Tracking" />
                    )}
                    {device.capabilities.controllers && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Controllers" />
                    )}
                    {device.capabilities.eyeTracking && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full" title="Eye Tracking" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Session Controls */}
        <div className="space-y-2">
          {currentSession?.state === 'active' ? (
            <button
              onClick={endXRSession}
              className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <Pause className="h-4 w-4" />
              End Session
            </button>
          ) : (
            <div className="space-y-2">
              {(enableVR && availableDevices.some(d => d.type === 'vr' && d.supported)) && (
                <button
                  onClick={() => startXRSession('vr')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Glasses className="h-4 w-4" />
                  Start VR
                </button>
              )}
              
              {(enableAR && availableDevices.some(d => d.type === 'ar' && d.supported)) && (
                <button
                  onClick={() => startXRSession('ar')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Scan className="h-4 w-4" />
                  Start AR
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Stats */}
      {showDebugInfo && currentSession?.state === 'active' && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Performance</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Frame Rate:</span>
              <span className={`font-mono ${
                performanceStats.frameRate >= 60 ? 'text-green-400' :
                performanceStats.frameRate >= 30 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {performanceStats.frameRate} FPS
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Latency:</span>
              <span className="text-blue-400 font-mono">{performanceStats.latency}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tracking:</span>
              <span className="text-purple-400 font-mono capitalize">
                {performanceStats.trackingQuality}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Controllers:</span>
              <span className="text-green-400 font-mono">{controllers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Hands:</span>
              <span className="text-blue-400 font-mono">{hands.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Controller Visualization */}
      {showDebugInfo && controllers.length > 0 && currentSession?.state === 'active' && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Controllers</h3>
          </div>

          <div className="space-y-2">
            {controllers.map((controller) => (
              <div key={controller.id} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${
                  controller.visible ? 'bg-green-500' : 'bg-gray-500'
                }`} />
                <span className="text-white capitalize">{controller.hand}</span>
                <span className="text-gray-400">
                  ({controller.position.x.toFixed(2)}, {controller.position.y.toFixed(2)}, {controller.position.z.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hand Tracking Visualization */}
      {showDebugInfo && hands.length > 0 && currentSession?.state === 'active' && (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Hand Tracking</h3>
          </div>

          <div className="space-y-2">
            {hands.map((hand) => (
              <div key={hand.id} className="flex items-center gap-2 text-sm">
                <div className={`w-3 h-3 rounded-full ${
                  hand.tracking ? 'bg-green-500' : 'bg-gray-500'
                }`} />
                <span className="text-white capitalize">{hand.hand}</span>
                <span className="text-gray-400">{hand.gesture}</span>
                <span className="text-blue-400">{Math.round(hand.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* XR Scene Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {currentSession?.state === 'active' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="mb-4"
              >
                <Globe className="h-16 w-16 text-blue-400" />
              </motion.div>
              <h3 className="text-white text-xl font-semibold mb-2">
                {currentSession.mode.toUpperCase()} Session Active
              </h3>
              <p className="text-gray-400 text-sm">
                {currentSession.device.name}
              </p>
            </>
          ) : (
            <>
              <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-2">
                WebXR Ready
              </h3>
              <p className="text-gray-400 text-sm">
                Select a device to start
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
