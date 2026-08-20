import { QuestionGeneratorService } from '../services/questionGen/questionGenerator';
import quizService from '../services/quizService';

const sourceText = [
  'Soroban smart contracts execute business rules on the Stellar network with predictable transaction costs.',
  'A verifiable credential contains claims that can be checked by a trusted issuer and verifier.',
  'Course transcripts capture spoken explanations that can be reviewed alongside written lesson material.',
  'Human review keeps generated assessment items out of published quizzes until an educator approves them.',
].join(' ');

describe('QuestionGeneratorService', () => {
  it('generates questions with distractors, difficulty, and quality metadata', async () => {
    const service = new QuestionGeneratorService({ autoProcess: false });
    const job = await service.createJob({
      courseId: 'course-407',
      title: 'Course foundations check',
      sourceText,
      questionCount: 3,
      questionTypes: ['multiple-choice'],
    }, 'instructor-407');

    expect(job.status).toBe('pending');
    const completed = await service.processJob(job.id);

    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(100);
    expect(completed.questions).toHaveLength(3);
    expect(completed.questions[0].options).toHaveLength(4);
    expect(completed.questions[0].options.some(option => option.isCorrect)).toBe(true);
    expect(completed.questions[0].difficulty).toMatch(/easy|medium|hard/);
    expect(completed.questions[0].qualityScore).toBeGreaterThanOrEqual(0);
    expect(completed.questions[0].qualityScore).toBeLessThanOrEqual(1);
    expect(completed.questions[0].reviewStatus).toBe('pending');
  });

  it('requires approval before importing and exports only approved questions', async () => {
    const service = new QuestionGeneratorService({ autoProcess: false });
    const job = await service.createJob({
      courseId: 'course-407-review',
      title: 'Review-gated quiz',
      sources: [{ type: 'lesson', title: 'Lesson one', text: sourceText }],
      questionCount: 2,
    }, 'instructor-review');
    await service.processJob(job.id);

    await expect(service.importApprovedQuiz(job.id, 'instructor-review')).rejects.toThrow('Approve at least one');

    const firstQuestion = service.getJob(job.id)!.questions[0];
    service.updateQuestion(job.id, firstQuestion.id, {
      question: 'Which statement is supported by the lesson material?',
      status: 'approved',
    });
    const exported = service.exportApproved(job.id);
    expect(exported.questions).toHaveLength(1);
    expect(exported.questions[0].reviewStatus).toBe('approved');

    const quiz = await service.importApprovedQuiz(job.id, 'instructor-review');
    expect(quiz.courseId).toBe('course-407-review');
    expect(quiz.questions).toHaveLength(1);
    expect(service.getJob(job.id)?.importedQuizId).toBe(quiz.id);

    const storedQuiz = await quizService.getQuizById(quiz.id);
    expect(storedQuiz.data?.title).toBe('Review-gated quiz');
  });

  it('supports batch review and prevents edits after import', async () => {
    const service = new QuestionGeneratorService({ autoProcess: false });
    const job = await service.createJob({
      courseId: 'course-407-batch',
      title: 'Batch review',
      sourceText,
      questionCount: 2,
    }, 'instructor-batch');
    await service.processJob(job.id);

    const questionIds = service.getJob(job.id)!.questions.map(question => question.id);
    const reviewed = service.reviewQuestions(job.id, questionIds, 'approved');
    expect(reviewed.questions.every(question => question.reviewStatus === 'approved')).toBe(true);

    const quiz = await service.importApprovedQuiz(job.id, 'instructor-batch');
    expect(() => service.updateQuestion(job.id, questionIds[0], { question: 'Updated question text' }))
      .toThrow('cannot be changed');
    expect(quiz.questions.length).toBe(2);
  });
});
