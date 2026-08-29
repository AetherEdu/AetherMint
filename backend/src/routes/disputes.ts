import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../middleware/auth';
import { disputeService } from '../services/disputes/disputeService';

const router = Router();
const actor = (req: AuthenticatedRequest) => ({ id: req.user!.id, role: req.user!.role as string });
const meta = (req: AuthenticatedRequest) => ({ ipAddress: req.ip, userAgent: req.get('user-agent') });

router.use(authenticate as any);

router.post('/', async (req: any, res: Response, next) => {
  try { res.status(201).json({ success: true, data: await disputeService.open(actor(req), req.body, meta(req)) }); } catch (error) { next(error); }
});
router.get('/', async (req: any, res: Response, next) => {
  try { res.json({ success: true, data: await disputeService.list(actor(req), req.query.status as any) }); } catch (error) { next(error); }
});
router.get('/:id', async (req: any, res: Response, next) => {
  try { res.json({ success: true, data: await disputeService.get(actor(req), req.params.id) }); } catch (error) { next(error); }
});
router.post('/:id/evidence', async (req: any, res: Response, next) => {
  try { res.json({ success: true, data: await disputeService.addEvidence(actor(req), req.params.id, req.body.content, meta(req)) }); } catch (error) { next(error); }
});
router.post('/:id/resolve', requireAdmin as any, async (req: any, res: Response, next) => {
  try { res.json({ success: true, data: await disputeService.resolve(actor(req), req.params.id, req.body.resolution, meta(req)) }); } catch (error) { next(error); }
});

export default router;
