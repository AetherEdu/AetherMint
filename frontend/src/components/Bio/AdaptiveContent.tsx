import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Coffee, Info } from 'lucide-react';

interface AdaptiveContentProps {
  children: React.ReactNode;
}

export const AdaptiveContent: React.FC<AdaptiveContentProps> = ({ children }) => {
  const { metrics, triggerHaptic } = useBiometrics();
  const [showBreakSuggestion, setShowBreakSuggestion] = useState(false);
  const [contentSpeed, setContentSpeed] = useState(1);

  useEffect(() => {
    if (metrics.isStressed) {
      triggerHaptic(0.8);
      setShowBreakSuggestion(true);
      setContentSpeed(0.5); // "Slow down" content or interactions
    } else if (metrics.isFocused) {
      setShowBreakSuggestion(false);
      setContentSpeed(1.2); // "Speed up" for flow state
    } else {
      setShowBreakSuggestion(false);
      setContentSpeed(1);
    }
  }, [metrics.isStressed, metrics.isFocused, triggerHaptic]);

  return (
    <div className="relative">
      <AnimatePresence>
        {showBreakSuggestion && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-100 border-l-4 border-amber-500 p-4 mb-4 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <Coffee className="text-amber-600 w-6 h-6" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Elevated Physiological Stress Detected</p>
                <p className="text-amber-800 text-xs">We've simplified the content layout. Consider taking a 2-minute bio-feedback break.</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div 
        className={`transition-all duration-700 ${metrics.isStressed ? 'blur-[0.5px] grayscale-[0.2] scale-[0.99] opacity-90' : ''}`}
        style={{ 
          filter: metrics.isStressed ? 'contrast(90%)' : 'none',
          transition: 'all 0.5s ease'
        }}
      >
        {/* Pass down the content speed if children are interactive, 
            but for now we just apply visual filters to "simplify" the UI */}
        <div className={metrics.isStressed ? 'pointer-events-none opacity-80' : ''}>
           {children}
        </div>
        
        {metrics.isStressed && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 to-transparent p-6 text-center">
             <button 
               onClick={() => console.log("Start Bio-Feedback")}
               className="bg-amber-500 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-amber-600 transition-colors"
             >
               Start Bio-Feedback Session
             </button>
          </div>
        )}
      </div>

      {metrics.isFocused && (
        <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
          <Info className="w-3 h-3" /> Flow Mode Active
        </div>
      )}
    </div>
  );
};
