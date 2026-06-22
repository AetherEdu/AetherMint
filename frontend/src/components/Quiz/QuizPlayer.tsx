import React, { useState } from 'react';
import QuestionCard, { Question } from './QuestionCard';
import Timer from './Timer';
import Results from './Results';
import { ChevronRight } from 'lucide-react';

interface QuizPlayerProps {
  questions: Question[];
  timeLimit?: number; // in seconds
  onComplete?: (score: number) => void;
}

const QuizPlayer: React.FC<QuizPlayerProps> = ({ 
  questions, 
  timeLimit = 600, // 10 minutes default
  onComplete 
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<any[]>(new Array(questions.length).fill(null));
  const [isFinished, setIsFinished] = useState(false);
  const [score, setScore] = useState(0);

  const handleAnswerChange = (value: any) => {
    const newAnswers = [...selectedAnswers];
    newAnswers[currentQuestionIndex] = value;
    setSelectedAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = () => {
    // In a real scenario, this would POST to /api/quizzes/:id/submit
    // For now, we calculate a mock score based on selected values
    let calculatedScore = 0;
    questions.forEach((q, index) => {
      // Basic check for MCQ
      if (q.type === 'multiple-choice' || q.type === 'true-false') {
        const correctOpt = q.options?.findIndex((o: any) => typeof o === 'object' ? o.isCorrect : false);
        if (selectedAnswers[index] === (correctOpt !== -1 ? correctOpt : 0)) {
          calculatedScore++;
        }
      } else if (selectedAnswers[index]) {
        // For other types, we assume attendance for now until backend grades
        calculatedScore++;
      }
    });
    
    setScore(calculatedScore);
    setIsFinished(true);
    if (onComplete) {
      onComplete(calculatedScore);
    }
  };

  const handleTimeUp = () => {
    finishQuiz();
  };

  const handleRetry = () => {
    setCurrentQuestionIndex(0);
    setSelectedAnswers(new Array(questions.length).fill(null));
    setIsFinished(false);
    setScore(0);
  };

  if (isFinished) {
    return (
      <Results 
        score={score} 
        totalQuestions={questions.length} 
        onRetry={handleRetry}
      />
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto w-full px-4 py-8" aria-labelledby="quiz-progress-title">
      <div className="sr-only" aria-live="polite">
        Question {currentQuestionIndex + 1} of {questions.length}. {selectedAnswers[currentQuestionIndex] === null || selectedAnswers[currentQuestionIndex] === '' ? 'No answer selected.' : 'Answer selected.'}
      </div>
      {/* Quiz Progress Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 id="quiz-progress-title" className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <span className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center text-sm">
                Q{currentQuestionIndex + 1}
              </span>
              Progress <span className="text-gray-400 font-normal">({currentQuestionIndex + 1}/{questions.length})</span>
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <Timer duration={timeLimit} onTimeUp={handleTimeUp} />
            <div className="hidden md:block w-px h-10 bg-gray-200 dark:bg-gray-800" />
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Overall Progress</div>
              <div className="flex items-center gap-3">
                <div
                  className="w-32 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"
                  role="progressbar"
                  aria-label="Quiz progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress)}
                >
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-700 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-blue-600">{Math.round(progress)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Question Card Integration */}
        <div className="bg-gray-50 dark:bg-gray-950/50 rounded-2xl p-2">
          <QuestionCard
            question={currentQuestion}
            answer={selectedAnswers[currentQuestionIndex]}
            onChange={handleAnswerChange}
          />
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentQuestionIndex(prev => Math.max(0, prev - 1))}
          disabled={currentQuestionIndex === 0}
          className="px-6 py-3 rounded-xl font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-0 transition-all"
          aria-label="Go to previous question"
        >
          Previous
        </button>
        
        <button
          onClick={handleNext}
          disabled={selectedAnswers[currentQuestionIndex] === null || selectedAnswers[currentQuestionIndex] === ''}
          aria-label={currentQuestionIndex === questions.length - 1 ? 'Complete assessment' : 'Go to next question'}
          className={`group flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all transform hover:scale-105 active:scale-95 ${
            selectedAnswers[currentQuestionIndex] !== null && selectedAnswers[currentQuestionIndex] !== ''
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40'
              : 'bg-gray-200 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
          }`}
        >
          {currentQuestionIndex === questions.length - 1 ? 'Complete Assessment' : 'Next Challenge'}
          <ChevronRight size={22} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
      
      {/* Quick Navigation Dots */}
      <div className="mt-8 flex justify-center gap-2">
        {questions.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentQuestionIndex(idx)}
            aria-current={idx === currentQuestionIndex ? 'step' : undefined}
            aria-label={`Go to question ${idx + 1}${selectedAnswers[idx] !== null ? ', answered' : ', unanswered'}`}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              idx === currentQuestionIndex 
                ? 'bg-blue-600 w-8' 
                : selectedAnswers[idx] !== null ? 'bg-indigo-300 dark:bg-indigo-900' : 'bg-gray-300 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default QuizPlayer;
