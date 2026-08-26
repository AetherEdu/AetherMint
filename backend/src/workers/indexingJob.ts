/**
 * Course Content Indexing Worker (Issue #406)
 *
 * Periodically indexes course material into the vector store so the AGI
 * tutor RAG pipeline can retrieve relevant context. The job is idempotent:
 * unchanged content is skipped (see RagPipeline.indexContent) and failures
 * are logged without crashing the process, so the worker fails open when the
 * vector store is unreachable (e.g. local development without Docker).
 */

import { ragPipeline } from '../services/tutor';
import logger from '../utils/logger';

let intervalId: NodeJS.Timeout | null = null;
let isRunning = false;

export const runIndexingJob = async (): Promise<void> => {
  if (isRunning) {
    return;
  }
  isRunning = true;
  try {
    await ragPipeline.indexContent();
  } catch (err) {
    logger.error('Course content indexing job failed', err);
  } finally {
    isRunning = false;
  }
};

export const startIndexingJob = (intervalMs?: number): void => {
  if (intervalId) {
    return;
  }
  const resolvedInterval =
    intervalMs ?? parseInt(process.env.RAG_INDEX_INTERVAL_MS ?? '300000', 10);

  // Index once at startup, then poll for content changes.
  runIndexingJob();
  intervalId = setInterval(runIndexingJob, resolvedInterval);
  logger.info(
    `Course content indexing worker started (interval ${resolvedInterval}ms)`
  );
};

export const stopIndexingJob = (): void => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isRunning = false;
  logger.info('Course content indexing worker stopped');
};
