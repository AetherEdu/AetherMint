import { useBiometricsContext, BiometricDataPoint } from '../lib/biometrics/BiometricProvider';

/**
 * Hook for components to access biometric data and derived metrics.
 */
export const useBiometrics = () => {
  const { 
    currentData, 
    history, 
    isSimulationActive, 
    setSimulationActive, 
    simulateEvent,
    triggerHaptic,
    lastHapticEvent 
  } = useBiometricsContext();

  const isStressed = currentData.gsrLevel > 70 || currentData.heartRate > 100;
  const isFocused = currentData.eegFocus > 70;
  const isFatigued = currentData.eegRelax > 80 && currentData.eegFocus < 30;

  const stressColor = isStressed ? 'text-red-500' : currentData.gsrLevel > 40 ? 'text-orange-500' : 'text-green-500';
  const focusColor = isFocused ? 'text-blue-500' : 'text-gray-500';

  return {
    biometrics: currentData,
    history,
    isSimulationActive,
    setSimulationActive,
    simulateEvent,
    triggerHaptic,
    lastHapticEvent,
    metrics: {
      isStressed,
      isFocused,
      isFatigued,
      stressColor,
      focusColor
    }
  };
};
