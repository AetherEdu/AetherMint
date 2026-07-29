import { Router } from 'express';
import { auditController } from '../controllers/auditController';
import { requireAdmin } from '../middleware/auth';

const router = Router();

router.get('/', requireAdmin, auditController.getAuditLogs);
router.get('/statistics', requireAdmin, auditController.getStatistics);
router.get('/:id', requireAdmin, auditController.getAuditLogById);
router.post('/archive', requireAdmin, auditController.archiveOldLogs);

export default router;