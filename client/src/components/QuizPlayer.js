import React, { useState, useEffect } from 'react';
import { PlayCircle, PauseCircle, RotateCcw, Volume2, Maximize2, Download, Share2 } from 'lucide-react';

const QuizPlayer = ({ 
  content, 
  onProgress, 
  onComplete,
  onBookmark,
  bookmarks = [],
  startTime = 0 
}) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [timeSpent, setTimeSpent] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (onProgress) {
      onProgress({
        currentQuestion: currentQuestion + 1,
        totalQuestions: content.metadata?.questions?.length || 0,
        timeSpent,
        answers: Object.keys(answers).length
      });
    }
  }, [currentQuestion, answers, timeSpent, onProgress, content]);

  const questions = content.metadata?.questions || [];
  const currentQ = questions[currentQuestion];

  const handleAnswer = (questionIndex, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer
    }));
  };

  const nextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const submitQuiz = () => {
    let correctCount = 0;
    questions.forEach((question, index) => {
      if (answers[index] === question.correctAnswer) {
        correctCount++;
      }
    });
    
    setScore(correctCount);
    setShowResults(true);
    setIsSubmitted(true);
    
    if (onComplete) {
      onComplete({
        score: correctCount,
        totalQuestions: questions.length,
        percentage: (correctCount / questions.length) * 100,
        timeSpent,
        answers
      });
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResults(false);
    setScore(0);
    setTimeSpent(0);
    setIsSubmitted(false);
    setReviewMode(false);
  };

  const addBookmark = () => {
    if (onBookmark) {
      onBookmark({
        contentId: content._id,
        timestamp: currentQuestion,
        note: `Question ${currentQuestion + 1}: ${currentQ?.question?.substring(0, 50)}...`
      });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderQuestion = (question, index) => {
    const userAnswer = answers[index];
    const isCorrect = userAnswer === question.correctAnswer;
    const showCorrect = reviewMode || (showResults && isSubmitted);

    return (
      <div className="bg-white rounded-lg shadow-lg p-6" key={index}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold mb-2">
              Question {index + 1} of {questions.length}
            </span>
            {question.difficulty && (
              <span className={`inline-block ml-2 px-2 py-1 rounded text-xs ${
                question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {question.difficulty}
              </span>
            )}
          </div>
          <div className="text-sm text-gray-500">
            {question.points || 1} point{question.points !== 1 ? 's' : ''}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {question.question}
        </h3>

        {question.image && (
          <div className="mb-4">
            <img 
              src={question.image} 
              alt="Question visual"
              className="max-w-full h-auto rounded-lg"
            />
          </div>
        )}

        {/* Multiple Choice */}
        {question.type === 'multiple-choice' && (
          <div className="space-y-3">
            {question.options.map((option, optIndex) => (
              <label
                key={optIndex}
                className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                  showCorrect && option === question.correctAnswer
                    ? 'border-green-500 bg-green-50'
                    : showCorrect && userAnswer === option && option !== question.correctAnswer
                    ? 'border-red-500 bg-red-50'
                    : userAnswer === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name={`question-${index}`}
                    value={option}
                    checked={userAnswer === option}
                    onChange={() => handleAnswer(index, option)}
                    disabled={showResults}
                    className="mr-3"
                  />
                  <span className="text-gray-700">{option}</span>
                  {showCorrect && option === question.correctAnswer && (
                    <span className="ml-auto text-green-600 text-sm font-semibold">✓ Correct</span>
                  )}
                  {showCorrect && userAnswer === option && option !== question.correctAnswer && (
                    <span className="ml-auto text-red-600 text-sm font-semibold">✗ Incorrect</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* True/False */}
        {question.type === 'true-false' && (
          <div className="space-y-3">
            {['True', 'False'].map((option) => (
              <label
                key={option}
                className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                  showCorrect && option === question.correctAnswer
                    ? 'border-green-500 bg-green-50'
                    : showCorrect && userAnswer === option && option !== question.correctAnswer
                    ? 'border-red-500 bg-red-50'
                    : userAnswer === option
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center">
                  <input
                    type="radio"
                    name={`question-${index}`}
                    value={option}
                    checked={userAnswer === option}
                    onChange={() => handleAnswer(index, option)}
                    disabled={showResults}
                    className="mr-3"
                  />
                  <span className="text-gray-700">{option}</span>
                  {showCorrect && option === question.correctAnswer && (
                    <span className="ml-auto text-green-600 text-sm font-semibold">✓ Correct</span>
                  )}
                  {showCorrect && userAnswer === option && option !== question.correctAnswer && (
                    <span className="ml-auto text-red-600 text-sm font-semibold">✗ Incorrect</span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Text Input */}
        {question.type === 'text' && (
          <div>
            <textarea
              value={userAnswer || ''}
              onChange={(e) => handleAnswer(index, e.target.value)}
              placeholder="Type your answer here..."
              disabled={showResults}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
            />
            {showCorrect && (
              <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Correct Answer:</strong> {question.correctAnswer}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Explanation */}
        {question.explanation && (showResults || reviewMode) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Explanation:</strong> {question.explanation}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (!questions || questions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-gray-500">
          <PlayCircle size={48} className="mx-auto mb-4" />
          <p>No questions available for this quiz</p>
        </div>
      </div>
    );
  }

  if (showResults) {
    const percentage = (score / questions.length) * 100;
    const passed = percentage >= (content.metadata?.passingScore || 70);

    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className={`inline-block p-4 rounded-full mb-4 ${
              passed ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <div className={`text-3xl font-bold ${
                passed ? 'text-green-600' : 'text-red-600'
              }`}>
                {Math.round(percentage)}%
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {passed ? 'Congratulations!' : 'Keep Practicing!'}
            </h2>
            <p className="text-gray-600">
              You scored {score} out of {questions.length} questions
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Time taken: {formatTime(timeSpent)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{score}</div>
              <div className="text-sm text-gray-600">Correct</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{questions.length - score}</div>
              <div className="text-sm text-gray-600">Incorrect</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{formatTime(timeSpent)}</div>
              <div className="text-sm text-gray-600">Time</div>
            </div>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={() => setReviewMode(!reviewMode)}
              className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {reviewMode ? 'Hide Review' : 'Review Answers'}
            </button>
            <button
              onClick={resetQuiz}
              className="flex-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <RotateCcw size={16} className="inline mr-2" />
              Retake Quiz
            </button>
          </div>
        </div>

        {/* Review Mode */}
        {reviewMode && (
          <div className="mt-6 space-y-4">
            {questions.map((question, index) => renderQuestion(question, index))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Quiz Header */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{content.title}</h1>
            <p className="text-gray-600 mt-1">{content.description}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={addBookmark}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Add bookmark"
            >
              <Download size={20} />
            </button>
            <button
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Share"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
            <span>Progress</span>
            <span>{currentQuestion + 1} of {questions.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Quiz Info */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-500">Questions</div>
            <div className="font-semibold">{questions.length}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Time</div>
            <div className="font-semibold">{formatTime(timeSpent)}</div>
          </div>
          <div className="text-center">
            <div className="text-gray-500">Answered</div>
            <div className="font-semibold">{Object.keys(answers).length}</div>
          </div>
        </div>
      </div>

      {/* Current Question */}
      {currentQ && renderQuestion(currentQ, currentQuestion)}

      {/* Navigation */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between">
          <button
            onClick={previousQuestion}
            disabled={currentQuestion === 0}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="text-sm text-gray-600">
            {Object.keys(answers).length} of {questions.length} answered
          </div>

          {currentQuestion === questions.length - 1 ? (
            <button
              onClick={submitQuiz}
              disabled={Object.keys(answers).length === 0}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Quiz
            </button>
          ) : (
            <button
              onClick={nextQuestion}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizPlayer;
