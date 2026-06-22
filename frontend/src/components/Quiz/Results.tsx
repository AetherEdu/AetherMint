import React from 'react';
import { Trophy, RefreshCw, ArrowRight } from 'lucide-react';

interface ResultsProps {
  score: number;
  totalQuestions: number;
  onRetry: () => void;
  onContinue?: () => void;
}

const Results: React.FC<ResultsProps> = ({ score, totalQuestions, onRetry, onContinue }) => {
  const percentage = Math.round((score / totalQuestions) * 100);
  const isPassing = percentage >= 70;

  return (
    <div className="bg-white dark:bg-gray-900 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 text-center max-w-md mx-auto" role="status" aria-live="polite">
      <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
        isPassing ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
      }`}>
        <Trophy size={40} />
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {isPassing ? 'Quiz Completed!' : 'Keep Practicing!'}
      </h2>
      
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        You scored <span className="font-bold text-gray-900 dark:text-white">{score}</span> out of <span className="font-bold text-gray-900 dark:text-white">{totalQuestions}</span>
      </p>

      <div
        className="w-full bg-gray-200 rounded-full h-4 mb-8 overflow-hidden"
        role="progressbar"
        aria-label="Quiz score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
      >
        <div 
          className={`h-full rounded-full ${isPassing ? 'bg-green-500' : 'bg-yellow-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={onRetry}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          <RefreshCw size={18} />
          Retry Quiz
        </button>
        
        {onContinue && isPassing && (
          <button
            onClick={onContinue}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Continue Course
            <ArrowRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Results;
