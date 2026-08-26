import request from 'supertest';
import express, { Application } from 'express';
import verifyRoutes from '../routes/verify';
import { SorobanService } from '../services/sorobanService';

// Mock SorobanService
jest.mock('../services/sorobanService');

const app: Application = express();
app.use(express.json());
app.use('/api/v1/verify', verifyRoutes);

describe('Verify Endpoint API Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return credential details for a valid hash', async () => {
    const mockCredential = {
      id: 1,
      status: 0, // Active
      title: 'Valid Credential',
      issuer: 'issuer_address',
      recipient: 'recipient_address',
    };

    (SorobanService.prototype.invokeContract as jest.Mock).mockResolvedValue('scval_mock');
    (SorobanService.prototype.nativeToScVal as jest.Mock).mockReturnValue('scval_mock');
    (SorobanService.prototype.scValToNative as jest.Mock).mockReturnValue(mockCredential);

    const response = await request(app).get('/api/v1/verify/1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(mockCredential);
  });

  it('should return error for revoked credential', async () => {
    const mockRevokedCredential = {
      id: 2,
      status: 2, // Revoked
      title: 'Revoked Credential'
    };

    (SorobanService.prototype.invokeContract as jest.Mock).mockResolvedValue('scval_mock');
    (SorobanService.prototype.nativeToScVal as jest.Mock).mockReturnValue('scval_mock');
    (SorobanService.prototype.scValToNative as jest.Mock).mockReturnValue(mockRevokedCredential);

    const response = await request(app).get('/api/v1/verify/2');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Credential revoked');
    expect(response.body.credential).toEqual(mockRevokedCredential);
  });

  it('should return 404 for unknown hash', async () => {
    (SorobanService.prototype.invokeContract as jest.Mock).mockRejectedValue(new Error('Credential not found'));

    const response = await request(app).get('/api/v1/verify/999');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Credential not found');
  });

  it('should return 400 for invalid hash format', async () => {
    const response = await request(app).get('/api/v1/verify/invalid-hash');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Invalid credential ID or hash format');
  });
});
