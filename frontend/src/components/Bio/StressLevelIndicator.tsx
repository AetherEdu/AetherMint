import React from 'react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { Brain, AlertCircle, Smile, CheckCircle } from 'lucide-react';

export const StressLevelIndicator: React.FC = () => {
  const { biometrics, metrics } = useBiometrics();

  const getStatus = () => {
    if (metrics.isStressed) return { label: 'Stressed', color: 'bg-red-500', icon: <AlertCircle />, text: 'High physiological response detected. Try breathing exercises.' };
    if (metrics.isFocused) return { label: 'Focused', color: 'bg-blue-500', icon: <Brain />, text: 'Optimal learning state. Flow state achieved.' };
    if (biometrics.gsrLevel < 30) return { label: 'Calm', color: 'bg-green-500', icon: <Smile />, text: 'Relaxed and receptive to new information.' };
    return { label: 'Optimal', color: 'bg-teal-500', icon: <CheckCircle />, text: 'Balanced biological state for active learning.' };
  };

  const status = getStatus();

  return (
    <div className={`p-6 rounded-2xl border transition-all duration-500 ${metrics.isStressed ? 'bg-red-50 border-red-200 shadow-lg shadow-red-100' : 'bg-white border-gray-100 shadow-sm'}`}>
      <div className="flex items-center gap-4 mb-4">
        <div className={`p-3 rounded-xl text-white ${status.color}`}>
          {status.icon}
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800">Learning Readiness</h3>
          <span className={`text-sm font-semibold uppercase tracking-wider ${status.color.replace('bg-', 'text-')}`}>
            {status.label}
          </span>
        </div>
      </div>
      
      <p className="text-gray-600 mb-6">
        {status.text}
      </p>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
            <span>Engagement Level</span>
            <span>{Math.round(biometrics.eegFocus)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 transition-all duration-1000" 
              style={{ width: `${biometrics.eegFocus}%` }}
            />
          </div>
        </div>
        
        <div>
          <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
            <span>Physiological Load (Stress)</span>
            <span>{Math.round(biometrics.gsrLevel)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ${metrics.isStressed ? 'bg-red-500' : 'bg-orange-400'}`}
              style={{ width: `${biometrics.gsrLevel}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
