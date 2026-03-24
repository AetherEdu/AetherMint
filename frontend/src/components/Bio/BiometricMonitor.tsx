import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { useBiometrics } from '../../hooks/useBiometrics';
import { Activity, Zap, Droplets } from 'lucide-react';

export const BiometricMonitor: React.FC = () => {
  const { history, biometrics } = useBiometrics();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Heart Rate Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Activity className="text-red-500 w-5 h-5 animate-pulse" />
            <h3 className="font-semibold text-gray-700 text-sm">Heart Rate</h3>
          </div>
          <span className="text-2xl font-bold text-red-600">{Math.round(biometrics.heartRate)} <span className="text-xs font-normal text-gray-400">BPM</span></span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip 
                labelStyle={{ display: 'none' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Line 
                type="monotone" 
                dataKey="heartRate" 
                stroke="#ef4444" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* EEG Focus Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Zap className="text-blue-500 w-5 h-5" />
            <h3 className="font-semibold text-gray-700 text-sm">EEG Focus</h3>
          </div>
          <span className="text-2xl font-bold text-blue-600">{Math.round(biometrics.eegFocus)} <span className="text-xs font-normal text-gray-400">%</span></span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={[0, 100]} hide />
              <Line 
                type="monotone" 
                dataKey="eegFocus" 
                stroke="#3b82f6" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* GSR / Stress Card */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <Droplets className="text-orange-500 w-5 h-5" />
            <h3 className="font-semibold text-gray-700 text-sm">GSR (Stress)</h3>
          </div>
          <span className="text-2xl font-bold text-orange-600">{Math.round(biometrics.gsrLevel)} <span className="text-xs font-normal text-gray-400">μS</span></span>
        </div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="timestamp" hide />
              <YAxis domain={[0, 100]} hide />
              <Line 
                type="monotone" 
                dataKey="gsrLevel" 
                stroke="#f97316" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
