import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { saveOfflineProgress } from '../../utils/offlineDB';

export interface InteractiveQuizProps {
  quizId: string;
  title: string;
  description: string;
  questions: QuizQuestion[];
  timeLimit?: number;
  allowReview?: boolean;
  showCorrectAnswers?: boolean;
  adaptiveDifficulty?: boolean;
  onQuizComplete: (results: QuizResults) => void;
  onProgressUpdate?: (progress: QuizProgress) => void;
  accessibilityMode?: boolean;
}

export interface QuizQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'fill-blank' | 'matching' | 'ordering' | 'essay';
  question: string;
  options?: string[];
  correctAnswer: string | string[];
  explanation?: string;
  hints?: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  timeLimit?: number;
  points: number;
  media?: {
    type: 'image' | 'video' | 'audio';
    url: string;
    caption?: string;
  };
}

export interface QuizProgress {
  currentQuestion: number;
  totalQuestions: number;
  timeSpent: number;
  answers: { [questionId: string]: any };
  score: number;
  maxScore: number;
}

export interface QuizResults {
  quizId: string;
  userId: string;
  score: number;
  maxScore: number;
  percentage: number;
  timeSpent: number;
  answers: QuestionResult[];
  difficulty: string;
  category: string;
  completedAt: Date;
}

export interface QuestionResult {
  questionId: string;
  userAnswer: any;
  correctAnswer: any;
  isCorrect: boolean;
  timeSpent: number;
  attempts: number;
  hintsUsed: number;
  points: number;
}

const InteractiveQuiz: React.FC<InteractiveQuizProps> = ({
  quizId,
  title,
  description,
  questions,
  timeLimit,
  allowReview = true,
  showCorrectAnswers = true,
  adaptiveDifficulty = false,
  onQuizComplete,
  onProgressUpdate,
  accessibilityMode = false
}) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [timeSpent, setTimeSpent] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [showResults, setShowResults] = useState(false);
  const [quizResults, setQuizResults] = useState<QuizResults | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: any }>({});
  const [attempts, setAttempts] = useState<{ [key: string]: number }>({});
  const [hintsUsed, setHintsUsed] = useState<{ [key: string]: number }>({});
  const [showHint, setShowHint] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(timeLimit ? timeLimit * 60 : null);
  const { isOnline } = useNetworkStatus();

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
      if (timeRemaining !== null) {
        setTimeRemaining(prev => {
          if (prev !== null && prev <= 1) {
            handleSubmitQuiz();
            return 0;
          }
          return prev !== null ? prev - 1 : null;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // Update progress
  useEffect(() => {
    const currentScore = Object.keys(answers).reduce((total, questionId) => {
      const question = questions.find(q => q.id === questionId);
      if (!question) return total;
      
      const userAnswer = answers[questionId];
      const correctAnswer = question.correctAnswer;
      const isCorrect = Array.isArray(correctAnswer) 
        ? JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)
        : userAnswer === correctAnswer;
      
      return total + (isCorrect ? question.points : 0);
    }, 0);

    const maxScore = questions.reduce((total, q) => total + q.points, 0);

    onProgressUpdate?.({
      currentQuestion: currentQuestionIndex,
      totalQuestions: questions.length,
      timeSpent,
      answers,
      score: currentScore,
      maxScore
    });
  }, [answers, currentQuestionIndex, timeSpent, questions, onProgressUpdate]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerSelect = useCallback((answer: any) => {
    if (isSubmitted) return;
    
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setSelectedAnswers({ ...selectedAnswers, [currentQuestion.id]: answer });
    
    // Increment attempts
    setAttempts(prev => ({
      ...prev,
      [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1
    }));

    // Provide immediate feedback
    provideFeedback(answer);
  }, [answers, selectedAnswers, currentQuestion, isSubmitted]);

  const provideFeedback = useCallback((answer: any) => {
    const correctAnswer = currentQuestion.correctAnswer;
    const isCorrect = Array.isArray(correctAnswer) 
      ? JSON.stringify(answer) === JSON.stringify(correctAnswer)
      : answer === correctAnswer;

    if (isCorrect) {
      setCurrentFeedback('✅ Correct! Well done!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    } else {
      setCurrentFeedback('❌ Not quite right. Try again or use a hint!');
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 3000);
    }
  }, [currentQuestion]);

  const handleHint = useCallback(() => {
    if (!currentQuestion.hints || currentQuestion.hints.length === 0) return;
    
    const currentHintCount = hintsUsed[currentQuestion.id] || 0;
    if (currentHintCount >= currentQuestion.hints.length) return;

    setShowHint(true);
    setHintsUsed(prev => ({
      ...prev,
      [currentQuestion.id]: currentHintCount + 1
    }));

    setTimeout(() => setShowHint(false), 5000);
  }, [currentQuestion, hintsUsed]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setQuestionStartTime(Date.now());
      setShowFeedback(false);
      setShowHint(false);
    } else {
      handleSubmitQuiz();
    }
  }, [currentQuestionIndex, questions.length]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setQuestionStartTime(Date.now());
      setShowFeedback(false);
      setShowHint(false);
    }
  }, [currentQuestionIndex]);

  const handleSubmitQuiz = useCallback(async () => {
    const results: QuizResults = {
      quizId,
      userId: 'current-user', // Would come from auth context
      score: Object.keys(answers).reduce((total, questionId) => {
        const question = questions.find(q => q.id === questionId);
        if (!question) return total;
        
        const userAnswer = answers[questionId];
        const correctAnswer = question.correctAnswer;
        const isCorrect = Array.isArray(correctAnswer) 
          ? JSON.stringify(userAnswer) === JSON.stringify(correctAnswer)
          : userAnswer === correctAnswer;
        
        return total + (isCorrect ? question.points : 0);
      }, 0),
      maxScore: questions.reduce((total, q) => total + q.points, 0),
      percentage: 0, // Will be calculated below
      timeSpent,
      answers: questions.map(question => ({
        questionId: question.id,
        userAnswer: answers[question.id],
        correctAnswer: question.correctAnswer,
        isCorrect: Array.isArray(question.correctAnswer) 
          ? JSON.stringify(answers[question.id]) === JSON.stringify(question.correctAnswer)
          : answers[question.id] === question.correctAnswer,
        timeSpent: 0, // Would need to track per-question time
        attempts: attempts[question.id] || 0,
        hintsUsed: hintsUsed[question.id] || 0,
        points: Array.isArray(question.correctAnswer) 
          ? JSON.stringify(answers[question.id]) === JSON.stringify(question.correctAnswer)
            ? question.points : 0
          : answers[question.id] === question.correctAnswer ? question.points : 0
      })),
      difficulty: 'medium', // Could be calculated based on questions
      category: 'general', // Could be calculated based on questions
      completedAt: new Date()
    };

    results.percentage = (results.score / results.maxScore) * 100;

    // Offline-first capability: Save locally and trigger background sync if offline
    if (!isOnline) {
      await saveOfflineProgress(`quiz-${quizId}-${Date.now()}`, results).catch(console.error);
    } else {
      // Standard API sync would go here if online
    }

    setQuizResults(results);
    setShowResults(true);
    setIsSubmitted(true);
    onQuizComplete(results);
  }, [answers, attempts, hintsUsed, onQuizComplete, questions, quizId, timeSpent]);

  const renderQuestion = () => {
    switch (currentQuestion.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            {currentQuestion.options?.map((option, index) => (
              <motion.button
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswerSelect(option)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  selectedAnswers[currentQuestion.id] === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={isSubmitted}
              >
                <span className="font-medium">{String.fromCharCode(65 + index)}.</span> {option}
              </motion.button>
            ))}
          </div>
        );

      case 'true-false':
        return (
          <div className="grid grid-cols-2 gap-4">
            {['True', 'False'].map((option) => (
              <motion.button
                key={option}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswerSelect(option.toLowerCase())}
                className={`p-6 rounded-lg border-2 transition-all ${
                  selectedAnswers[currentQuestion.id] === option.toLowerCase()
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isSubmitted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                disabled={isSubmitted}
              >
                <span className="text-lg font-semibold">{option}</span>
              </motion.button>
            ))}
          </div>
        );

      case 'fill-blank':
        return (
          <div>
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              placeholder="Type your answer here..."
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none"
              disabled={isSubmitted}
            />
          </div>
        );

      case 'essay':
        return (
          <div>
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => handleAnswerSelect(e.target.value)}
              placeholder="Write your answer here..."
              rows={6}
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
              disabled={isSubmitted}
            />
          </div>
        );

      default:
        return <div>Question type not supported</div>;
    }
  };

  if (showResults && quizResults) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto"
      >
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-4">Quiz Complete!</h2>
          <div className="mb-6">
            <div className="text-6xl font-bold text-blue-600 mb-2">
              {quizResults.percentage.toFixed(1)}%
            </div>
            <p className="text-xl text-gray-600">
              {quizResults.score} out of {quizResults.maxScore} points
            </p>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{formatTime(quizResults.timeSpent)}</p>
              <p className="text-sm text-gray-600">Time Spent</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {quizResults.answers.filter(a => a.isCorrect).length}/{quizResults.answers.length}
              </p>
              <p className="text-sm text-gray-600">Correct Answers</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">
                {quizResults.answers.reduce((total, a) => total + a.attempts, 0)}
              </p>
              <p className="text-sm text-gray-600">Total Attempts</p>
            </div>
          </div>
        </div>

        {showCorrectAnswers && (
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Answer Review</h3>
            {questions.map((question, index) => {
              const result = quizResults.answers.find(a => a.questionId === question.id);
              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-lg border-2 ${
                    result?.isCorrect
                      ? 'bg-green-50 border-green-300'
                      : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800">
                      Question {index + 1}: {question.question}
                    </h4>
                    <span className={`text-sm font-medium ${
                      result?.isCorrect ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {result?.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Your answer:</strong> {result?.userAnswer || 'Not answered'}</p>
                    {!result?.isCorrect && (
                      <p><strong>Correct answer:</strong> {result?.correctAnswer}</p>
                    )}
                    {question.explanation && (
                      <p><strong>Explanation:</strong> {question.explanation}</p>
                    )}
                    <p><strong>Points:</strong> {result?.points}/{question.points}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Take Quiz Again
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600">{description}</p>
      </div>

      {/* Offline Mode Indicator */}
      {!isOnline && (
        <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded" role="alert">
          <p className="font-bold text-sm">Offline Mode</p>
          <p className="text-sm">You are currently offline. Your quiz progress will be saved locally and will sync automatically when you reconnect.</p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-600">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-sm text-gray-600">{Math.round(progress)}% Complete</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <motion.div
            className="bg-blue-500 h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Timer */}
      {timeLimit && (
        <div className="mb-6 text-center">
          <div className={`inline-flex items-center px-4 py-2 rounded-lg ${
            timeRemaining && timeRemaining < 60 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'
          }`}>
            <span className="font-medium">Time Remaining:</span>
            <span className="ml-2 font-bold">{formatTime(timeRemaining || 0)}</span>
          </div>
        </div>
      )}

      {/* Question */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800 flex-1">
            {currentQuestion.question}
          </h3>
          <div className="flex items-center gap-2 ml-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-600' :
              currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-600' :
              'bg-red-100 text-red-600'
            }`}>
              {currentQuestion.difficulty}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-600 rounded-full text-xs font-medium">
              {currentQuestion.points} points
            </span>
          </div>
        </div>

        {/* Question Media */}
        {currentQuestion.media && (
          <div className="mb-4">
            {currentQuestion.media.type === 'image' && (
              <img
                src={currentQuestion.media.url}
                alt={currentQuestion.media.caption}
                className="max-w-full h-auto rounded-lg"
              />
            )}
            {currentQuestion.media.caption && (
              <p className="text-sm text-gray-600 mt-2 italic">{currentQuestion.media.caption}</p>
            )}
          </div>
        )}

        {/* Question Options */}
        {renderQuestion()}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 p-4 rounded-lg ${
              currentFeedback.includes('Correct') ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
            }`}
          >
            {currentFeedback}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint */}
      <AnimatePresence>
        {showHint && currentQuestion.hints && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-lg"
          >
            <strong>Hint:</strong> {currentQuestion.hints[hintsUsed[currentQuestion.id] - 1]}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-3">
          {currentQuestionIndex > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrevious}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Previous
            </motion.button>
          )}
          
          {currentQuestion.hints && currentQuestion.hints.length > 0 && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleHint}
              disabled={hintsUsed[currentQuestion.id] >= currentQuestion.hints.length}
              className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Hint ({hintsUsed[currentQuestion.id] || 0}/{currentQuestion.hints.length})
            </motion.button>
          )}
        </div>

        <div>
          {currentQuestionIndex === questions.length - 1 ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmitQuiz}
              className="px-8 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              {isOnline ? 'Submit Quiz' : 'Submit & Save Offline'}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Next
            </motion.button>
          )}
        </div>
      </div>

      {/* Question Navigation */}
      {allowReview && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-3">Quick Navigation:</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-10 h-10 rounded-lg font-medium transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-blue-500 text-white'
                    : answers[questions[index].id]
                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveQuiz;
