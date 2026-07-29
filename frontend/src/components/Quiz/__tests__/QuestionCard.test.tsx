import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionCard from '../QuestionCard';

describe('QuestionCard', () => {
  const onChange = jest.fn();

  it('renders question type badge', () => {
    render(
      <QuestionCard
        question={{ id: 'q1', type: 'multiple-choice', question: 'Test question?', options: ['A', 'B'] }}
        answer={null}
        onChange={onChange}
      />
    );
    expect(screen.getByText('multiple choice')).toBeInTheDocument();
  });

  it('renders the question text', () => {
    render(
      <QuestionCard
        question={{ id: 'q1', type: 'multiple-choice', question: 'What is 2+2?', options: ['3', '4'] }}
        answer={null}
        onChange={onChange}
      />
    );
    expect(screen.getByText('What is 2+2?')).toBeInTheDocument();
  });

  describe('multiple-choice type', () => {
    const mcqQuestion = {
      id: 'q2',
      type: 'multiple-choice' as const,
      question: 'Pick one',
      options: ['Option A', 'Option B', 'Option C'],
    };

    it('renders all options', () => {
      render(<QuestionCard question={mcqQuestion} answer={null} onChange={onChange} />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
      expect(screen.getByText('Option C')).toBeInTheDocument();
    });

    it('marks selected option', () => {
      render(<QuestionCard question={mcqQuestion} answer={1} onChange={onChange} />);
      const optionB = screen.getByText('Option B').closest('label');
      expect(optionB?.className).toContain('border-blue-500');
    });

    it('calls onChange when option is clicked', () => {
      render(<QuestionCard question={mcqQuestion} answer={null} onChange={onChange} />);
      fireEvent.click(screen.getByText('Option A'));
      expect(onChange).toHaveBeenCalledWith(0);
    });
  });

  describe('true-false type', () => {
    const tfQuestion = {
      id: 'q3',
      type: 'true-false' as const,
      question: 'Is this true?',
      options: [
        { id: 'true', text: 'True' },
        { id: 'false', text: 'False' },
      ],
    };

    it('renders true and false options', () => {
      render(<QuestionCard question={tfQuestion} answer={null} onChange={onChange} />);
      expect(screen.getByText('True')).toBeInTheDocument();
      expect(screen.getByText('False')).toBeInTheDocument();
    });

    it('calls onChange with option id', () => {
      render(<QuestionCard question={tfQuestion} answer={null} onChange={onChange} />);
      fireEvent.click(screen.getByText('True'));
      expect(onChange).toHaveBeenCalledWith('true');
    });
  });

  describe('essay type', () => {
    const essayQuestion = {
      id: 'q4',
      type: 'essay' as const,
      question: 'Write an essay',
    };

    it('renders textarea', () => {
      render(<QuestionCard question={essayQuestion} answer="" onChange={onChange} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
    });

    it('calls onChange when typing', () => {
      render(<QuestionCard question={essayQuestion} answer="" onChange={onChange} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'My answer' } });
      expect(onChange).toHaveBeenCalledWith('My answer');
    });
  });

  describe('code-submission type', () => {
    const codeQuestion = {
      id: 'q5',
      type: 'code-submission' as const,
      question: 'Write code',
      codeTemplate: 'function hello() { }',
    };

    it('renders code textarea with template', () => {
      render(<QuestionCard question={codeQuestion} answer={null} onChange={onChange} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveValue('function hello() { }');
    });

    it('calls onChange when code is edited', () => {
      render(<QuestionCard question={codeQuestion} answer="function hello() { }" onChange={onChange} />);
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'function world() { }' } });
      expect(onChange).toHaveBeenCalledWith('function world() { }');
    });
  });

  describe('image-based type', () => {
    const imageQuestion = {
      id: 'q6',
      type: 'image-based' as const,
      question: 'Identify this',
      imageUrl: '/test.jpg',
      options: ['Cat', 'Dog'],
    };

    it('renders the image', () => {
      render(<QuestionCard question={imageQuestion} answer={null} onChange={onChange} />);
      const img = screen.getByAltText('Question context for Identify this');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', '/test.jpg');
    });

    it('renders MCQ options below image', () => {
      render(<QuestionCard question={imageQuestion} answer={null} onChange={onChange} />);
      expect(screen.getByText('Cat')).toBeInTheDocument();
      expect(screen.getByText('Dog')).toBeInTheDocument();
    });
  });

  describe('unknown type', () => {
    it('shows fallback message', () => {
      render(
        <QuestionCard
          question={{ id: 'q7', type: 'drag-and-drop' as any, question: 'Drag items' }}
          answer={null}
          onChange={onChange}
        />
      );
      expect(screen.getByText(/requires a specialized interface/)).toBeInTheDocument();
    });
  });
});