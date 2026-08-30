import { Router, Request, Response } from 'express';
import { createDIDRegistryClient } from '../services/did/didRegistryClient';

const router = Router();
const soroban = createDIDRegistryClient();

/**
 * @route GET /api/v1/verify/:hash
 * @desc Public endpoint to verify a credential by ID/hash
 * @access Public
 */
router.get('/:hash', async (req: Request, res: Response) => {
  try {
    const { hash } = req.params;
    
    // Convert hash to ID if it's numeric, or we just pass it to the contract
    const credentialId = parseInt(hash, 10);
    
    if (isNaN(credentialId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid credential ID or hash format'
      });
    }

    try {
      // Use the newly added strictly read-only helper on the contract
      const credential = await soroban.getCredentialsForDid(String(credentialId));
      const parsedCredential = { credentialId, linkedCredentialIds: credential.map(Number), status: 0 };
      
      // status: 0 = Active, 1 = Expired, 2 = Revoked, 3 = Pending
      if (parsedCredential.status === 2) {
         return res.status(400).json({
            success: false,
            error: 'Credential revoked',
            credential: parsedCredential
         });
      }

      return res.json({
        success: true,
        data: parsedCredential
      });
    } catch (contractError: any) {
      if (contractError.message?.includes('Credential not found') || contractError.message?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: 'Credential not found'
        });
      }
      throw contractError;
    }
  } catch (error: any) {
    console.error('Verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify credential'
    });
  }
});

export default router;
