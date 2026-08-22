import React from 'react';

export interface Question {
  id: string;
  type:
    | 'multiple-choice'
    | 'true-false'
    | 'short-answer'
    | 'essay'
    | 'fill-in-the-blank'
    | 'code-submission'
    | 'drag-and-drop'
    | 'image-based';
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
  const helpTextId = `question-${question.id}-help`;

  const renderMCQ = () => {
    const options = (question.options || []) as (
      | string
      | { id: string; text: string }
    )[];

    return (
      <fieldset className="space-y-3" aria-labelledby={questionTitleId} aria-describedby={helpTextId}>
        <legend className="sr-only">{question.question}</legend>
        {options.map((option, index) => {
          const optionText = typeof option === 'string' ? option : option.text;
          const optionId = typeof option === 'string' ? index : option.id;
          const inputId = `${answerFieldId}-${String(optionId)}`;
          const isSelected = String(answer) === String(optionId);

          return (
            <label
              key={String(optionId)}
              htmlFor={inputId}
              className={`flex cursor-pointer items-center rounded-lg border p-4 transition-all duration-200 focus-within:ring-2 focus-within:ring-blue-500 ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name={question.id}
                checked={isSelected}
                onChange={() => onChange(optionId)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`mr-3 flex h-6 w-6 items-center justify-center rounded-full border ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500 text-white'
                    : 'border-gray-400 text-gray-400'
                }`}
              >
                {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              <span>{optionText}</span>
            </label>
          );
        })}
      </fieldset>
    );
  };

  const renderEssay = () => (
    <>
      <label htmlFor={answerFieldId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Answer for {question.question}
      </label>
      <textarea
        id={answerFieldId}
        value={answer || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Write your answer here..."
        className="mt-2 w-full min-h-[200px] rounded-lg border border-gray-200 bg-white p-4 text-gray-900 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
    </>
  );

  const renderCode = () => (
    <div className="space-y-4">
      <div className="rounded-md bg-gray-100 p-3 font-mono text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
        {'// Write your code solution here'}
      </div>
      <label htmlFor={answerFieldId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Code answer for {question.question}
      </label>
      <textarea
        id={answerFieldId}
        value={answer || question.codeTemplate || ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full min-h-[300px] rounded-lg border border-gray-200 bg-gray-950 p-4 font-mono text-sm text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-gray-800"
        spellCheck="false"
      />
    </div>
  );

  const renderImage = () => (
    <div className="space-y-4">
      {question.imageUrl && (
        <figure className="overflow-hidden rounded-lg">
          <img
            src={question.imageUrl}
            alt={`Question context for ${question.question}`}
            className="h-auto max-w-full object-cover transition-transform duration-500 hover:scale-105"
          />
        </figure>
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
          <div className="rounded-lg bg-yellow-50 p-4 text-yellow-700 dark:bg-yellow-900/10 dark:text-yellow-400">
            This question type ({question.type}) currently requires a specialized interface.
          </div>
        );
    }
  };

  return (
    <section
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-800 dark:bg-gray-900"
      aria-labelledby={questionTitleId}
      aria-describedby={helpTextId}
    >
      <div className="mb-6">
        <span className="mb-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {question.type.replace('-', ' ')}
        </span>
        <h3
          id={questionTitleId}
          className="text-xl font-bold leading-tight text-gray-900 dark:text-white"
        >
          {question.question}
        </h3>
        <p id={helpTextId} className="sr-only">
          Use the keyboard to answer the question. Multiple choice questions use radio buttons.
        </p>
      </div>
      {renderContent()}
    </section>
  );
};

export default QuestionCard;
