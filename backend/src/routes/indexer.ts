import { Router } from 'express';
import { indexerService } from '../services/indexer/IndexerService';
import { startIndexerJob, stopIndexerJob } from '../workers/indexerJob';

const router = Router();

router.get('/events', async (req, res) => {
  try {
    const { contractId, topic, limit, skip } = req.query;
    
    const events = await indexerService.getEvents(
      contractId as string,
      topic as string,
      limit ? parseInt(limit as string) : 50,
      skip ? parseInt(skip as string) : 0
    );
    
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin endpoints to manage the indexer worker
router.post('/start', (req, res) => {
  startIndexerJob();
  res.json({ message: 'Indexer started' });
});

router.post('/stop', (req, res) => {
  stopIndexerJob();
  res.json({ message: 'Indexer stopped' });
});

export default router;
