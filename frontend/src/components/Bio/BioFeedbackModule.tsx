import React, { useState, useEffect } from 'react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { motion } from 'framer-motion';
import { Wind, ShieldCheck, Heart } from 'lucide-react';

export const BioFeedbackModule: React.FC = () => {
  const { biometrics, simulateEvent, triggerHaptic } = useBiometrics();
  const [phase, setPhase] = useState<'idle' | 'breathing' | 'success'>('idle');
  const [breathCount, setBreathCount] = useState(0);
  const targetBPM = 65;

  const startModule = () => {
    setPhase('breathing');
    setBreathCount(0);
    // Force a "high stress" state initially to train against it
    simulateEvent('stress');
  };

  useEffect(() => {
    if (phase === 'breathing') {
      const interval = setInterval(() => {
        setBreathCount(c => c + 1);
        triggerHaptic(0.3);
        
        // Simulate progress per breath
        if (biometrics.heartRate > targetBPM) {
          simulateEvent('calm');
        }
      }, 4000); // 4 seconds per breath cycle

      if (biometrics.heartRate <= targetBPM && breathCount > 5) {
        setPhase('success');
        clearInterval(interval);
      }

      return () => clearInterval(interval);
    }
  }, [phase, biometrics.heartRate, breathCount, simulateEvent, triggerHaptic]);

  return (
    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-3xl p-8 text-white text-center shadow-2xl min-h-[400px] flex flex-col items-center justify-center">
      {phase === 'idle' && (
        <>
          <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
            <Wind className="w-10 h-10 text-indigo-300" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Bio-Feedback Training</h2>
          <p className="text-indigo-200 mb-8 max-w-md mx-auto">
            Sync your breathing with the biometric sensor to lower your heart rate and prepare for optimal learning.
          </p>
          <button 
            onClick={startModule}
            className="bg-indigo-500 hover:bg-indigo-400 text-white px-8 py-3 rounded-full font-bold transition-all shadow-lg hover:shadow-indigo-500/50"
          >
            Enter Calm State
          </button>
        </>
      )}

      {phase === 'breathing' && (
        <div className="space-y-8">
          <div className="relative">
            <motion.div
              animate={{ scale: [1, 1.5, 1] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-32 h-32 bg-indigo-500/30 rounded-full flex items-center justify-center"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold uppercase tracking-widest animate-pulse">
                {breathCount % 2 === 0 ? 'Inhale' : 'Exhale'}
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-red-400">
               <Heart className="w-5 h-5 fill-current" />
               <span className="text-4xl font-mono font-bold">{Math.round(biometrics.heartRate)}</span>
               <span className="text-xs uppercase">BPM</span>
            </div>
            <p className="text-indigo-300">Targeting {targetBPM} BPM</p>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-1.5 max-w-xs mx-auto">
            <motion.div 
              className="bg-indigo-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (breathCount / 10) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="space-y-6"
        >
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <ShieldCheck className="w-10 h-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold">Biometric Coherence Reached</h2>
          <p className="text-indigo-200">
            Your physiological markers indicate a readiness level of 98%. You are now ready to continue your course.
          </p>
          <button 
            onClick={() => setPhase('idle')}
            className="bg-green-500 hover:bg-green-400 text-white px-8 py-3 rounded-full font-bold transition-all"
          >
            Return to Lesson
          </button>
        </motion.div>
      )}
    </div>
  );
};
