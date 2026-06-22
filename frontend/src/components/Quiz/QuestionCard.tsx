import React from 'react';

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer' | 'essay' | 'fill-in-the-blank' | 'code-submission' | 'drag-and-drop' | 'image-based';
  question: string;
  options?: string[] | any[];
  imageUrl?: string;
  codeTemplate?: string;
  dropZones?: any[];
}

interface QuestionCardProps {
  question: Question;
  answer: any;
  onChange: (value: any) => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  answer,
  onChange,
}) => {
  const questionTitleId = `question-${question.id}-title`;
  const answerFieldId = `question-${question.id}-answer`;

  const renderMCQ = () => {
    const options = (question.options || []) as (string | { id: string, text: string })[];
    return (
      <div className="space-y-3" role="radiogroup" aria-labelledby={questionTitleId}>
        {options.map((option, index) => {
          const optionText = typeof option === 'string' ? option : option.text;
          const optionId = typeof option === 'string' ? index : option.id;
          const isSelected = answer === optionId;
          
          return (
            <button
              key={index}
              onClick={() => onChange(optionId)}
              role="radio"
              aria-checked={isSelected}
              className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div className="flex items-center">
                <div
                  aria-hidden="true"
                  className={`w-6 h-6 rounded-full border flex items-center justify-center mr-3 ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-400 text-gray-400'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <span>{optionText}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  const renderEssay = () => (
    <>
      <label htmlFor={answerFieldId} className="sr-only">
        Answer for {question.question}
      </label>
      <textarea
        id={answerFieldId}
        value={answer || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here..."
        className="w-full min-h-[200px] p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
      />
    </>
  );

  const renderCode = () => (
    <div className="space-y-4">
      <div className="p-3 bg-gray-100 dark:bg-gray-900 rounded-md text-sm font-mono text-gray-600 dark:text-gray-400">
        {'// Write your code solution here'}
      </div>
      <label htmlFor={answerFieldId} className="sr-only">
        Code answer for {question.question}
      </label>
      <textarea
        id={answerFieldId}
        value={answer || question.codeTemplate || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-h-[300px] p-4 rounded-lg bg-gray-950 text-emerald-400 font-mono text-sm border-none focus:ring-2 focus:ring-emerald-500 focus:outline-none"
        spellCheck="false"
      />
    </div>
  );

  const renderImage = () => (
    <div className="space-y-4">
      {question.imageUrl && (
        <div className="mb-4 overflow-hidden rounded-lg">
          <img src={question.imageUrl} alt={`Question context for ${question.question}`} className="max-w-full h-auto object-cover hover:scale-105 transition-transform duration-500" />
        </div>
      )}
      {renderMCQ()}
    </div>
  );

  const renderContent = () => {
    switch (question.type) {
      case 'multiple-choice':
      case 'true-false':
        return renderMCQ();
      case 'essay':
      case 'short-answer':
      case 'fill-in-the-blank':
        return renderEssay();
      case 'code-submission':
        return renderCode();
      case 'image-based':
        return renderImage();
      default:
        return (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-400 rounded-lg">
            This question type ({question.type}) is currently requiring a specialized interface.
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-800" aria-labelledby={questionTitleId}>
      <div className="mb-6">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wider">
          {question.type.replace('-', ' ')}
        </span>
        <h3 id={questionTitleId} className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
          {question.question}
        </h3>
      </div>
      {renderContent()}
    </div>
  );
};

export default QuestionCard;
