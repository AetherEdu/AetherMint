import React, { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface TimerProps {
  duration: number; // in seconds
  onTimeUp: () => void;
}

const Timer: React.FC<TimerProps> = ({ duration, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeUp();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft, onTimeUp]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeLeft < 60;

  return (
    <div
      className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border transition-all duration-300 ${
      isLowTime 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 animate-pulse ring-2 ring-red-500/20' 
        : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300'
    }`}
      role="timer"
      aria-live={isLowTime ? 'assertive' : 'polite'}
      aria-label={`Time remaining ${formatTime(timeLeft)}`}
    >
      <Clock size={18} className={isLowTime ? 'animate-spin-slow' : ''} aria-hidden="true" />
      <span className="font-mono text-lg font-bold tracking-tight">
        {formatTime(timeLeft)}
      </span>
    </div>
  );
};

export default Timer;
