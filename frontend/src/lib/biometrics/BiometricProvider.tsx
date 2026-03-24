import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

/**
 * Biometric data points for heart rate, EEG, and GSR.
 */
export interface BiometricDataPoint {
  timestamp: number;
  heartRate: number; // BPM
  eegFocus: number;  // 0-100
  eegRelax: number;  // 0-100
  gsrLevel: number;  // 0-100 (Stress indicator)
}

interface BiometricContextType {
  currentData: BiometricDataPoint;
  history: BiometricDataPoint[];
  isSimulationActive: boolean;
  setSimulationActive: (active: boolean) => void;
  simulateEvent: (type: 'stress' | 'focus' | 'calm') => void;
  triggerHaptic: (intensity: number) => void;
  lastHapticEvent: { timestamp: number; intensity: number } | null;
}

const BiometricContext = createContext<BiometricContextType | undefined>(undefined);

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSimulationActive, setSimulationActive] = useState(true);
  const [history, setHistory] = useState<BiometricDataPoint[]>([]);
  const [lastHapticEvent, setLastHapticEvent] = useState<{ timestamp: number; intensity: number } | null>(null);
  
  const [currentData, setCurrentData] = useState<BiometricDataPoint>({
    timestamp: Date.now(),
    heartRate: 72,
    eegFocus: 50,
    eegRelax: 50,
    gsrLevel: 20,
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerHaptic = useCallback((intensity: number) => {
    setLastHapticEvent({ timestamp: Date.now(), intensity });
  }, []);

  const simulateEvent = useCallback((type: 'stress' | 'focus' | 'calm') => {
    setCurrentData(prev => {
      switch (type) {
        case 'stress':
          return {
            ...prev,
            heartRate: Math.min(120, prev.heartRate + 20),
            gsrLevel: Math.min(100, prev.gsrLevel + 40),
            eegFocus: Math.max(0, prev.eegFocus - 20),
          };
        case 'focus':
          return {
            ...prev,
            eegFocus: Math.min(100, prev.eegFocus + 30),
            eegRelax: Math.max(0, prev.eegRelax - 10),
          };
        case 'calm':
          return {
            ...prev,
            heartRate: Math.max(60, prev.heartRate - 15),
            gsrLevel: Math.max(10, prev.gsrLevel - 30),
            eegRelax: Math.min(100, prev.eegRelax + 30),
          };
        default:
          return prev;
      }
    });
  }, []);

  useEffect(() => {
    if (!isSimulationActive) return;

    timerRef.current = setInterval(() => {
      setCurrentData(prev => {
        // Random walk simulation
        const nextHR = prev.heartRate + (Math.random() - 0.5) * 2;
        const nextFocus = prev.eegFocus + (Math.random() - 0.5) * 4;
        const nextRelax = prev.eegRelax + (Math.random() - 0.5) * 4;
        const nextGSR = prev.gsrLevel + (Math.random() - 0.5) * 3;

        const newData = {
          timestamp: Date.now(),
          heartRate: Math.max(60, Math.min(140, nextHR)),
          eegFocus: Math.max(0, Math.min(100, nextFocus)),
          eegRelax: Math.max(0, Math.min(100, nextRelax)),
          gsrLevel: Math.max(0, Math.min(100, nextGSR)),
        };

        setHistory(h => [...h.slice(-20), newData]);
        return newData;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSimulationActive]);

  return (
    <BiometricContext.Provider
      value={{
        currentData,
        history,
        isSimulationActive,
        setSimulationActive,
        simulateEvent,
        triggerHaptic,
        lastHapticEvent,
      }}
    >
      {children}
    </BiometricContext.Provider>
  );
};

export const useBiometricsContext = () => {
  const context = useContext(BiometricContext);
  if (context === undefined) {
    throw new Error('useBiometricsContext must be used within a BiometricProvider');
  }
  return context;
};
