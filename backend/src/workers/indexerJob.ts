import { indexerService } from '../services/indexer/IndexerService';

let isJobRunning = false;
let intervalId: NodeJS.Timeout | null = null;

export const startIndexerJob = (intervalMs = 5000) => {
  if (isJobRunning) return;
  isJobRunning = true;

  console.log(`Starting indexer worker (polling every ${intervalMs}ms)`);

  intervalId = setInterval(async () => {
    try {
      await indexerService.syncEvents();
    } catch (err) {
      console.error('Indexer worker encountered an error:', err);
    }
  }, intervalMs);
};

export const stopIndexerJob = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  isJobRunning = false;
  console.log('Stopped indexer worker');
};
