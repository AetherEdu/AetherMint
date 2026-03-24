import React, { useEffect, useState } from 'react';
import { useBiometrics } from '../../hooks/useBiometrics';
import { motion, AnimatePresence } from 'framer-motion';

export const HapticFeedback: React.FC = () => {
  const { lastHapticEvent } = useBiometrics();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (lastHapticEvent) {
      setActive(true);
      const timer = setTimeout(() => setActive(false), 300);
      return () => clearTimeout(timer);
    }
  }, [lastHapticEvent]);

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 0.2, scale: 1.05 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1 }}
        className="fixed inset-0 pointer-events-none z-[9999] border-[10px] border-blue-500 rounded-lg box-border"
      />
      <motion.div
        initial={{ x: -10 }}
        animate={{ x: 10 }}
        transition={{ 
          repeat: 3, 
          duration: 0.05, 
          type: "spring", 
          stiffness: 1000 
        }}
        className="fixed inset-0 pointer-events-none z-[9998]"
        style={{ 
          backgroundColor: lastHapticEvent?.intensity && lastHapticEvent.intensity > 0.7 ? 'rgba(239, 68, 68, 0.05)' : 'transparent' 
        }}
      />
    </AnimatePresence>
  );
};
