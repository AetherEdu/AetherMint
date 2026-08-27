/**
 * Admin Smart Contract Simulation Routes
 *
 * Exposes endpoints for performing dry-run contract call simulations, previewing
 * state mutations, emitted events, and resource costs prior to on-chain execution.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { ContractSimulationService } from '../../services/simulation/contractSimulationService';

const router = Router();

/**
 * GET /api/admin/simulate/contracts
 * List available public contract entry point schemas for simulation
 */
router.get(
  '/contracts',
  authenticate,
  requireAdmin,
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const schemas = ContractSimulationService.getContractSchemas();
      res.json({
        success: true,
        data: schemas,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/admin/simulate
 * Run a dry-run smart contract call simulation without on-chain state mutation
 */
router.post(
  '/',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const callerAddress = authReq.user?.id || req.body.callerAddress;
      const { contractAddress, functionName, args = {}, options = {} } = req.body;

      if (!contractAddress || !functionName) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields contractAddress or functionName.',
        });
        return;
      }

      const result = await ContractSimulationService.simulate({
        contractAddress,
        functionName,
        args,
        callerAddress,
        options,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
