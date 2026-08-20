import { Job } from '../services/jobQueue';
import questionGeneratorService from '../services/questionGen/questionGenerator';

/**
 * Processes one question-generation queue item and keeps queue progress in sync
 * with the generation service.
 */
export async function processQuestionGenerationJob(job: Job): Promise<void> {
  const generationId = job.payload.generationId;
  if (typeof generationId !== 'string' || !generationId) {
    throw new Error('Question generation job is missing generationId');
  }

  job.progress = 10;
  await questionGeneratorService.processJob(generationId);
  job.progress = 100;
}

export default processQuestionGenerationJob;
