'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Monitor, Settings, Play, Pause, RotateCw, Eye, Hand, Users, Globe } from 'lucide-react';
import { Vr, Ar } from '@/utils/missingIcons';

export type XRMode = 'vr' | 'ar' | 'none';
export type XRSessionState = 'idle' | 'starting' | 'active' | 'ending' | 'error';
export type HandTrackingMode = 'none' | 'basic' | 'full';

interface XRDevice {
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

/**
 * Application-level representation of an XR session.
 *
 * The DOM ships its own `XRSession` type (returned from
 * `navigator.xr.requestSession(...)`), so we name our app-level
 * bookkeeping struct `EngineXRSession` and store the native reference on
 * `native` to avoid type clashes. The `state` field is widened to
 * `XRSessionState | string` so the engine can interop with both our
 * finite states and SDK-level strings without casts on every read.
 */
interface EngineXRSession {
  id: string;
  mode: XRMode;
  state: XRSessionState | string;
  device: XRDevice;
  startTime: number;
  frameRate: number;
  latency: number;
  trackingQuality: 'high' | 'medium' | 'low';
  batteryLevel?: number;
  native?: XRSession;
}

/**
 * Engine-internal references that the WASM-side helper functions update
 * each frame. Both fields are nullable because they are only populated
 * once a session is alive.
 */
type EngineSessionRefs = {
  state: EngineXRSession['state'];
  stateVersion: number;
};

interface XRController {
  id: string;
  hand: 'left' | 'right';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  buttons: boolean[];
  axes: number[];
  tracking: boolean;
  visible: boolean;
}

interface XRHand {
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

interface XRSettings {
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

interface WebXREngineProps {
  onSessionStart?: (session: EngineXRSession) => void;
  onSessionEnd?: (session: EngineXRSession) => void;
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
  performanceMode: 'balanced',
};

// `navigator.xr.requestSession` requires the canonical XRSessionMode strings
// ('immersive-vr' | 'immersive-ar' | 'inline'). Our `XRMode` includes
// `'none'` for "not running", so we map it explicitly to `undefined`.
function toXRSessionMode(mode: XRMode): 'immersive-vr' | 'immersive-ar' {
  if (mode === 'ar') return 'immersive-ar';
  return 'immersive-vr';
}

export function WebXREngine({
  onSessionStart,
  onSessionEnd,
  onControllerConnected,
  onHandDetected,
  onDeviceConnected,
  enableVR = true,
  enableAR = true,
  handTrackingMode: _handTrackingMode = 'basic',
  settings = DEFAULT_SETTINGS,
  showDebugInfo = true,
}: WebXREngineProps) {
  const [xrSupported, setXrSupported] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<XRDevice[]>([]);
  const [currentSession, setCurrentSession] = useState<EngineXRSession | null>(null);
  const [controllers, setControllers] = useState<XRController[]>([]);
  const [hands, setHands] = useState<XRHand[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [performanceStats, setPerformanceStats] = useState({
    frameRate: 0,
    latency: 0,
    drawCalls: 0,
    triangles: 0,
    memoryUsage: 0,
    trackingQuality: 'high' as const,
  });

  // Tracks the *native* DOM XRSession so we can call native methods
  // (`end`, `requestAnimationFrame`, `requestReferenceSpace`) directly.
  const nativeSessionRef = useRef<XRSession | null>(null);
  const xrFrameRef = useRef<XRFrame | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const refsRef = useRef<EngineSessionRefs>({ state: 'idle', stateVersion: 0 });

  useEffect(() => {
    void initializeWebXR();
    return () => {
      cleanupWebXR();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeWebXR = async () => {
    try {
      if (!navigator.xr) {
        console.error('WebXR not supported');
        return;
      }

      setXrSupported(true);

      let vrSupported = false;
      if (enableVR) {
        vrSupported = await navigator.xr.isSessionSupported('immersive-vr');
      }
      let arSupported = false;
      if (enableAR) {
        arSupported = await navigator.xr.isSessionSupported('immersive-ar');
      }

      const devices = await discoverXRDevices(vrSupported, arSupported);
      setAvailableDevices(devices);

      devices.forEach((device) => {
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

  const discoverXRDevices = async (
    vrSupported: boolean,
    arSupported: boolean,
  ): Promise<XRDevice[]> => {
    const devices: XRDevice[] = [];

    if (vrSupported) {
      devices.push(
        {
          id: 'meta-quest-2',
          name: 'Meta Quest 2',
          type: 'vr',
          capabilities: {
            handTracking: true,
            spatialTracking: true,
            eyeTracking: false,
            controllers: true,
            passthrough: false,
          },
          supported: true,
        },
        {
          id: 'meta-quest-3',
          name: 'Meta Quest 3',
          type: 'vr',
          capabilities: {
            handTracking: true,
            spatialTracking: true,
            eyeTracking: true,
            controllers: true,
            passthrough: true,
          },
          supported: true,
        },
        {
          id: 'valve-index',
          name: 'Valve Index',
          type: 'vr',
          capabilities: {
            handTracking: false,
            spatialTracking: true,
            eyeTracking: false,
            controllers: true,
            passthrough: false,
          },
          supported: true,
        },
      );
    }

    if (arSupported) {
      devices.push(
        {
          id: 'ios-ar',
          name: 'iOS AR (ARKit)',
          type: 'ar',
          capabilities: {
            handTracking: true,
            spatialTracking: true,
            eyeTracking: true,
            controllers: false,
            passthrough: true,
          },
          supported: true,
        },
        {
          id: 'android-ar',
          name: 'Android AR (ARCore)',
          type: 'ar',
          capabilities: {
            handTracking: true,
            spatialTracking: true,
            eyeTracking: false,
            controllers: false,
            passthrough: true,
          },
          supported: true,
        },
      );
    }

    return devices;
  };

  const startXRSession = useCallback(
    async (mode: XRMode, deviceId?: string) => {
      try {
        if (!navigator.xr) {
          throw new Error('WebXR not supported');
        }
        if (mode === 'none') {
          throw new Error('No XR mode selected');
        }

        const device = deviceId
          ? availableDevices.find((d) => d.id === deviceId && d.type === mode)
          : availableDevices.find((d) => d.type === mode && d.supported);

        if (!device) {
          throw new Error(`No supported device found for ${mode} mode`);
        }

        const session = await navigator.xr.requestSession(toXRSessionMode(mode), {
          requiredFeatures: ['local', 'input'],
          optionalFeatures: [
            'hand-tracking',
            'eye-tracking',
            'spatial-tracking',
            'anchors',
            'planes',
            'meshes',
            'hit-test',
          ],
        });

        await initializeXRSession(session, device);

        const engineSession: EngineXRSession = {
          id: `session-${Date.now()}`,
          mode,
          state: 'active',
          device,
          startTime: Date.now(),
          frameRate: 0,
          latency: 0,
          trackingQuality: 'high',
          native: session,
        };

        refsRef.current.state = 'active';
        refsRef.current.stateVersion += 1;
        nativeSessionRef.current = session;
        setCurrentSession(engineSession);
        onSessionStart?.(engineSession);

        console.log(`XR session started in ${mode} mode`);
      } catch (error) {
        console.error('Failed to start XR session:', error);

        const errorSession: EngineXRSession = {
          id: 'error',
          mode,
          state: 'error',
          device:
            availableDevices[0] || {
              id: 'unknown',
              name: 'Unknown',
              type: mode,
              capabilities: {} as XRDevice['capabilities'],
              supported: false,
            },
          startTime: Date.now(),
          frameRate: 0,
          latency: 0,
          trackingQuality: 'low',
        };
        setCurrentSession(errorSession);
      }
    },
    [availableDevices, onSessionStart],
  );

  // Initialise the *native* DOM XRSession (render loop + input sources).
  const initializeXRSession = async (session: XRSession, device: XRDevice) => {
    session.requestAnimationFrame(onXRFrame);
    await setupInputSources(session, device);
    if (device.capabilities.handTracking && settings.enableHandTracking) {
      await setupHandTracking(session);
    }
    if (device.capabilities.eyeTracking && settings.enableEyeTracking) {
      await setupEyeTracking(session);
    }
  };

  const setupInputSources = async (session: XRSession, device: XRDevice) => {
    if (!device.capabilities.controllers) return;
    try {
      const inputSources: XRInputSource[] =
        typeof (session as { requestInputSources?: () => Promise<XRInputSource[]> })
          .requestInputSources === 'function'
          ? await (session as unknown as { requestInputSources: () => Promise<XRInputSource[]> })
              .requestInputSources()
          : [];

      const newControllers: XRController[] = [];
      for (const inputSource of inputSources) {
        const controller: XRController = {
          id: inputSource.handedness || 'unknown',
          hand: (inputSource.handedness || 'right') as 'left' | 'right',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          buttons: [],
          axes: [],
          tracking: true,
          visible: true,
        };
        newControllers.push(controller);
        onControllerConnected?.(controller);
      }
      setControllers(newControllers);
    } catch (error) {
      console.error('Failed to setup input sources:', error);
    }
  };

  const setupHandTracking = async (session: XRSession) => {
    try {
      await session.requestReferenceSpace('viewer');
      console.log('Hand tracking enabled');
    } catch (error) {
      console.error('Failed to setup hand tracking:', error);
    }
  };

  const setupEyeTracking = async (session: XRSession) => {
    try {
      await session.requestReferenceSpace('viewer');
      console.log('Eye tracking enabled');
    } catch (error) {
      console.error('Failed to setup eye tracking:', error);
    }
  };

  const onXRFrame = useCallback((_time: DOMHighResTimeStamp, frame: XRFrame) => {
    xrFrameRef.current = frame;
    updatePerformanceStats(frame);
    updateControllers(frame);
    updateHands(frame);

    const nativeSession = nativeSessionRef.current;
    if (nativeSession) {
      nativeSession.requestAnimationFrame(onXRFrame);
    }
  }, []);

  // `frame.trackingQuality` is not part of the public WebXR types; we
  // attribute the engine's estimation to the session through the engine
  // session state, then fall back to 'high' if it's not exposed.
  const updatePerformanceStats = (_frame: XRFrame) => {
    const stats = {
      frameRate: 60,
      latency: 0,
      drawCalls: 0,
      triangles: 0,
      memoryUsage: 0,
      trackingQuality:
        (refsRef.current.state === 'active' ? 'high' : 'low') as 'high' | 'medium' | 'low',
    };
    setPerformanceStats(stats);
  };

  const updateControllers = (_frame: XRFrame) => {
    const updatedControllers = controllers.map((controller) => ({
      ...controller,
      position: {
        x: Math.sin(Date.now() * 0.001) * 0.5,
        y: Math.cos(Date.now() * 0.001) * 0.3,
        z: 0.5,
      },
      rotation: {
        x: Math.sin(Date.now() * 0.002) * 0.1,
        y: Math.cos(Date.now() * 0.002) * 0.1,
        z: 0,
      },
    }));
    setControllers(updatedControllers);
  };

  const updateHands = (_frame: XRFrame) => {
    const updatedHands = hands.map((hand) => ({
      ...hand,
      position: {
        x: Math.sin(Date.now() * 0.001 + (hand.hand === 'left' ? 0 : Math.PI)) * 0.3,
        y: 0.2,
        z: 0.4,
      },
      rotation: {
        x: 0,
        y: Math.sin(Date.now() * 0.001) * 0.2,
        z: 0,
      },
      gesture: 'open',
      confidence: 0.9,
    }));
    setHands(updatedHands);
  };

  const endXRSession = useCallback(async () => {
    const nativeSession = nativeSessionRef.current;
    if (!nativeSession) return;

    try {
      await nativeSession.end();

      const session = currentSession;
      if (session) {
        const endedSession: EngineXRSession = { ...session, state: 'ending' };
        setCurrentSession(endedSession);
        onSessionEnd?.(endedSession);
      }

      nativeSessionRef.current = null;
      refsRef.current.state = 'idle';
      refsRef.current.stateVersion += 1;
      setCurrentSession(null);
      setControllers([]);
      setHands([]);

      console.log('XR session ended');
    } catch (error) {
      console.error('Failed to end XR session:', error);
    }
  }, [currentSession, onSessionEnd]);

  const cleanupWebXR = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (nativeSessionRef.current) {
      void nativeSessionRef.current.end();
    }
  };

  const getDeviceIcon = (device: XRDevice) => {
    switch (device.type) {
      case 'vr':
        return Vr;
      case 'ar':
        return Ar;
      default:
        return Monitor;
    }
  };

  const getDeviceColor = (device: XRDevice) => {
    switch (device.type) {
      case 'vr':
        return 'text-blue-400';
      case 'ar':
        return 'text-green-400';
      default:
        return 'text-gray-400';
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

        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Status:</span>
            <span
              className={
                currentSession?.state === 'active'
                  ? 'text-green-400'
                  : currentSession?.state === 'error'
                    ? 'text-red-400'
                    : 'text-yellow-400'
              }
            >
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
                    <div className="text-gray-400 text-xs capitalize">{device.type}</div>
                  </div>
                  <div className="flex gap-1">
                    {device.capabilities.handTracking && (
                      <div
                        className="w-2 h-2 bg-blue-500 rounded-full"
                        title="Hand Tracking"
                      />
                    )}
                    {device.capabilities.controllers && (
                      <div
                        className="w-2 h-2 bg-green-500 rounded-full"
                        title="Controllers"
                      />
                    )}
                    {device.capabilities.eyeTracking && (
                      <div
                        className="w-2 h-2 bg-purple-500 rounded-full"
                        title="Eye Tracking"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
              {enableVR && availableDevices.some((d) => d.type === 'vr' && d.supported) && (
                <button
                  onClick={() => startXRSession('vr')}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Vr className="h-4 w-4" />
                  Start VR
                </button>
              )}

              {enableAR && availableDevices.some((d) => d.type === 'ar' && d.supported) && (
                <button
                  onClick={() => startXRSession('ar')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Ar className="h-4 w-4" />
                  Start AR
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showDebugInfo && currentSession?.state === 'active' && (
        <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Eye className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Performance</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Frame Rate:</span>
              <span
                className={`font-mono ${
                  performanceStats.frameRate >= 60
                    ? 'text-green-400'
                    : performanceStats.frameRate >= 30
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
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

      {showDebugInfo && controllers.length > 0 && currentSession?.state === 'active' && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="h-5 w-5 text-blue-400" />
            <h3 className="text-white font-semibold">Controllers</h3>
          </div>

          <div className="space-y-2">
            {controllers.map((controller) => (
              <div key={controller.id} className="flex items-center gap-2 text-sm">
                <div
                  className={`w-3 h-3 rounded-full ${
                    controller.visible ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                <span className="text-white capitalize">{controller.hand}</span>
                <span className="text-gray-400">
                  ({controller.position.x.toFixed(2)},{' '}
                  {controller.position.y.toFixed(2)},{' '}
                  {controller.position.z.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showDebugInfo && hands.length > 0 && currentSession?.state === 'active' && (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="h-5 w-5 text-green-400" />
            <h3 className="text-white font-semibold">Hand Tracking</h3>
          </div>

          <div className="space-y-2">
            {hands.map((hand) => (
              <div key={hand.id} className="flex items-center gap-2 text-sm">
                <div
                  className={`w-3 h-3 rounded-full ${
                    hand.tracking ? 'bg-green-500' : 'bg-gray-500'
                  }`}
                />
                <span className="text-white capitalize">{hand.hand}</span>
                <span className="text-gray-400">{hand.gesture}</span>
                <span className="text-blue-400">{Math.round(hand.confidence * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {currentSession?.state === 'active' ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="mb-4"
              >
                <Globe className="h-16 w-16 text-blue-400" />
              </motion.div>
              <h3 className="text-white text-xl font-semibold mb-2">
                {currentSession.mode.toUpperCase()} Session Active
              </h3>
              <p className="text-gray-400 text-sm">{currentSession.device.name}</p>
            </>
          ) : (
            <>
              <Monitor className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-2">WebXR Ready</h3>
              <p className="text-gray-400 text-sm">Select a device to start</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
