/**
 * Tests for the WebAuthn Passkey Service
 *
 * Tests cover:
 *  - Registration options generation
 *  - Registration verification
 *  - Authentication options generation
 *  - Authentication verification
 *  - Device management (list, revoke)
 *  - Recovery code flows
 *  - Utility functions
 */

// Mock the WebAuthn server library
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

// Mock the Passkey model
jest.mock('../../models/Passkey', () => ({
  PasskeyModel: {
    find: jest.fn(),
    findOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
  listUserPasskeys,
  revokePasskey,
  verifyRecoveryCode,
  regenerateRecoveryCodes,
  bufferToBase64url,
  base64urlToBuffer,
  generateRecoveryCodes,
  hashRecoveryCode,
} from '../services/auth/passkeys';

import {
  generateRegistrationOptions as mockGenerateRegistrationOptions,
  verifyRegistrationResponse as mockVerifyRegistrationResponse,
  generateAuthenticationOptions as mockGenerateAuthenticationOptions,
  verifyAuthenticationResponse as mockVerifyAuthenticationResponse,
} from '@simplewebauthn/server';

import { PasskeyModel } from '../models/Passkey';

describe('Passkey Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Utility Functions', () => {
    describe('bufferToBase64url', () => {
      it('should convert a buffer to base64url string', () => {
        const buffer = Buffer.from('Hello, World!');
        const result = bufferToBase64url(buffer);
        expect(typeof result).toBe('string');
        expect(result).not.toContain('+');
        expect(result).not.toContain('/');
        expect(result).not.toContain('=');
      });

      it('should handle empty buffer', () => {
        const buffer = Buffer.alloc(0);
        const result = bufferToBase64url(buffer);
        expect(result).toBe('');
      });
    });

    describe('base64urlToBuffer', () => {
      it('should convert base64url string to buffer', () => {
        const original = Buffer.from('Hello, World!');
        const base64url = bufferToBase64url(original);
        const result = base64urlToBuffer(base64url);
        expect(result.equals(original)).toBe(true);
      });

      it('should handle standard base64url characters', () => {
        const buffer = base64urlToBuffer('AQID');
        expect(buffer.length).toBe(3);
        expect(buffer[0]).toBe(1);
        expect(buffer[1]).toBe(2);
        expect(buffer[2]).toBe(3);
      });
    });

    describe('generateRecoveryCodes', () => {
      it('should generate 10 recovery codes', () => {
        const codes = generateRecoveryCodes();
        expect(codes).toHaveLength(10);
      });

      it('should generate codes in XXXX-XXXX-XXXX format', () => {
        const codes = generateRecoveryCodes();
        codes.forEach((code) => {
          expect(code).toMatch(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
        });
      });

      it('should generate unique codes', () => {
        const codes = generateRecoveryCodes();
        const uniqueCodes = new Set(codes);
        expect(uniqueCodes.size).toBe(codes.length);
      });
    });

    describe('hashRecoveryCode', () => {
      it('should hash a recovery code consistently', () => {
        const code = 'ABCD-1234-EFGH';
        const hash1 = hashRecoveryCode(code);
        const hash2 = hashRecoveryCode(code);
        expect(hash1).toBe(hash2);
      });

      it('should produce a sha256 hex string', () => {
        const code = 'ABCD-1234-EFGH';
        const hash = hashRecoveryCode(code);
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('should be case-insensitive', () => {
        const hash1 = hashRecoveryCode('ABCD-1234-EFGH');
        const hash2 = hashRecoveryCode('abcd-1234-efgh');
        expect(hash1).toBe(hash2);
      });
    });
  });

  describe('Registration', () => {
    describe('createRegistrationOptions', () => {
      it('should generate registration options', async () => {
        const mockOptions = {
          challenge: 'test-challenge-123',
          rp: { name: 'AetherMint', id: 'localhost' },
          user: {
            id: Buffer.from('user-123'),
            name: 'test@example.com',
            displayName: 'test@example.com',
          },
        };

        (mockGenerateRegistrationOptions as jest.Mock).mockResolvedValue(
          mockOptions
        );

        const result = await createRegistrationOptions(
          'user-123',
          'test@example.com',
          []
        );

        expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            rpName: expect.any(String),
            rpID: expect.any(String),
            userName: 'test@example.com',
          })
        );
        expect(result).toEqual(mockOptions);
      });

      it('should exclude existing credentials', async () => {
        (mockGenerateRegistrationOptions as jest.Mock).mockResolvedValue({});

        await createRegistrationOptions(
          'user-123',
          'test@example.com',
          ['cred-1', 'cred-2']
        );

        expect(mockGenerateRegistrationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            excludeCredentials: expect.arrayContaining([
              expect.objectContaining({ type: 'public-key' }),
            ]),
          })
        );
      });
    });

    describe('verifyRegistration', () => {
      it('should verify and save a valid registration', async () => {
        const mockVerification = {
          verified: true,
          registrationInfo: {
            credential: {
              id: 'cred-id-123',
              publicKey: new Uint8Array([1, 2, 3]),
              counter: 0,
            },
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
          },
        };

        (mockVerifyRegistrationResponse as jest.Mock).mockResolvedValue(
          mockVerification
        );

        const mockPasskey = {
          credentialId: Buffer.from('cred-id-123'),
          deviceName: 'Test Device',
          recoveryCodes: [],
          save: jest.fn(),
        };

        (PasskeyModel as any).find = jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        });

        const MockPasskeyModel = jest.fn().mockImplementation(() => mockPasskey);
        Object.assign(MockPasskeyModel, PasskeyModel);

        // We need to mock the constructor
        const originalPasskeyModel = PasskeyModel;
        (PasskeyModel as any) = MockPasskeyModel;

        const result = await verifyRegistration(
          'user-123',
          'Test Device',
          'test-challenge',
          {
            id: 'cred-id-123',
            rawId: 'cred-id-123',
            response: { transports: ['internal'] },
            type: 'public-key',
            clientExtensionResults: {},
          } as any
        );

        expect(mockVerifyRegistrationResponse).toHaveBeenCalled();
        expect(result.verified).toBe(true);

        // Restore
        (PasskeyModel as any) = originalPasskeyModel;
      });

      it('should return verified: false for invalid registration', async () => {
        (mockVerifyRegistrationResponse as jest.Mock).mockResolvedValue({
          verified: false,
        });

        const result = await verifyRegistration(
          'user-123',
          'Test Device',
          'test-challenge',
          {
            id: 'cred-id-123',
            rawId: 'cred-id-123',
            response: {},
            type: 'public-key',
            clientExtensionResults: {},
          } as any
        );

        expect(result.verified).toBe(false);
      });
    });
  });

  describe('Authentication', () => {
    describe('createAuthenticationOptions', () => {
      it('should generate authentication options', async () => {
        const mockOptions = {
          challenge: 'auth-challenge-123',
          allowCredentials: [],
          userVerification: 'preferred',
        };

        (mockGenerateAuthenticationOptions as jest.Mock).mockResolvedValue(
          mockOptions
        );

        const result = await createAuthenticationOptions([]);

        expect(mockGenerateAuthenticationOptions).toHaveBeenCalled();
        expect(result).toEqual(mockOptions);
      });

      it('should include allowCredentials when provided', async () => {
        (mockGenerateAuthenticationOptions as jest.Mock).mockResolvedValue({});

        const credIds = [Buffer.from('cred-1'), Buffer.from('cred-2')];
        await createAuthenticationOptions(credIds);

        expect(mockGenerateAuthenticationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            allowCredentials: expect.arrayContaining([
              expect.objectContaining({ type: 'public-key' }),
            ]),
          })
        );
      });
    });

    describe('verifyAuthentication', () => {
      it('should verify a valid authentication', async () => {
        const mockPasskey = {
          credentialId: Buffer.from('cred-id-123'),
          credentialPublicKey: Buffer.from([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
          userId: 'user-123',
          save: jest.fn(),
        };

        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(mockPasskey);

        const mockVerification = {
          verified: true,
          authenticationInfo: {
            newCounter: 1,
          },
        };

        (mockVerifyAuthenticationResponse as jest.Mock).mockResolvedValue(
          mockVerification
        );

        const result = await verifyAuthentication('test-challenge', {
          id: 'cred-id-123',
          rawId: 'cred-id-123',
          response: {},
          type: 'public-key',
          clientExtensionResults: {},
        } as any);

        expect(result.verified).toBe(true);
        expect(result.userId).toBe('user-123');
        expect(mockPasskey.save).toHaveBeenCalled();
      });

      it('should return error for non-existent passkey', async () => {
        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(null);

        const result = await verifyAuthentication('test-challenge', {
          id: 'non-existent',
          rawId: 'non-existent',
          response: {},
          type: 'public-key',
          clientExtensionResults: {},
        } as any);

        expect(result.verified).toBe(false);
        expect(result.error).toBe('Passkey not found or revoked');
      });

      it('should return error for failed verification', async () => {
        const mockPasskey = {
          credentialId: Buffer.from('cred-id-123'),
          credentialPublicKey: Buffer.from([1, 2, 3]),
          counter: 0,
          transports: ['internal'],
        };

        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(mockPasskey);

        (mockVerifyAuthenticationResponse as jest.Mock).mockResolvedValue({
          verified: false,
        });

        const result = await verifyAuthentication('test-challenge', {
          id: 'cred-id-123',
          rawId: 'cred-id-123',
          response: {},
          type: 'public-key',
          clientExtensionResults: {},
        } as any);

        expect(result.verified).toBe(false);
      });
    });
  });

  describe('Device Management', () => {
    describe('listUserPasskeys', () => {
      it('should return list of active passkeys', async () => {
        const mockPasskeys = [
          {
            credentialId: Buffer.from('cred-1'),
            deviceName: 'iPhone 14',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            transports: ['internal'],
          },
        ];

        (PasskeyModel.find as jest.Mock).mockReturnValue({
          select: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(mockPasskeys),
          }),
        });

        const result = await listUserPasskeys('user-123');

        expect(result).toHaveLength(1);
        expect(result[0].deviceName).toBe('iPhone 14');
      });
    });

    describe('revokePasskey', () => {
      it('should revoke an active passkey', async () => {
        const mockPasskey = {
          credentialId: Buffer.from('cred-1'),
          active: true,
          deviceName: 'iPhone 14',
          save: jest.fn(),
        };

        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(mockPasskey);

        const result = await revokePasskey('user-123', 'cred-1-base64url');

        expect(result.success).toBe(true);
        expect(result.deviceName).toBe('iPhone 14');
        expect(mockPasskey.active).toBe(false);
        expect(mockPasskey.save).toHaveBeenCalled();
      });

      it('should return error for non-existent passkey', async () => {
        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(null);

        const result = await revokePasskey('user-123', 'non-existent');

        expect(result.success).toBe(false);
      });
    });
  });

  describe('Recovery Codes', () => {
    describe('verifyRecoveryCode', () => {
      it('should verify a valid recovery code', async () => {
        const code = 'ABCD-1234-EFGH';
        const hashed = hashRecoveryCode(code);

        const mockPasskey = {
          userId: 'user-123',
          recoveryCodes: [hashed, 'other-hash'],
          save: jest.fn(),
        };

        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(mockPasskey);

        const result = await verifyRecoveryCode('user-123', code);

        expect(result.verified).toBe(true);
        expect(result.userId).toBe('user-123');
        // The used code should be removed
        expect(mockPasskey.recoveryCodes).not.toContain(hashed);
        expect(mockPasskey.save).toHaveBeenCalled();
      });

      it('should reject an invalid recovery code', async () => {
        (PasskeyModel.findOne as jest.Mock).mockResolvedValue(null);

        const result = await verifyRecoveryCode('user-123', 'WRONG-CODE');

        expect(result.verified).toBe(false);
      });
    });

    describe('regenerateRecoveryCodes', () => {
      it('should generate new recovery codes for a user', async () => {
        const mockPasskeys = [{ active: true }, { active: true }];

        (PasskeyModel.find as jest.Mock).mockResolvedValue(mockPasskeys);
        (PasskeyModel.updateMany as jest.Mock).mockResolvedValue({});

        const result = await regenerateRecoveryCodes('user-123');

        expect(result.success).toBe(true);
        expect(result.recoveryCodes).toHaveLength(10);
        expect(PasskeyModel.updateMany).toHaveBeenCalled();
      });

      it('should return error if no active passkeys exist', async () => {
        (PasskeyModel.find as jest.Mock).mockResolvedValue([]);

        const result = await regenerateRecoveryCodes('user-123');

        expect(result.success).toBe(false);
        expect(result.error).toBe('No active passkeys found');
      });
    });
  });
});
