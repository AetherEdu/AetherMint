/**
 * Credential Model
 *
 * Minimal model for the new credential issuance endpoint that powers
 * the Idempotency-Key middleware target (#264). Stored in process for
 * now; production deployment swaps in a Mongo/Postgres-backed store.
 */

export type CredentialType =
  | 'course-completion'
  | 'skill'
  | 'achievement'
  | 'participation';

export type CredentialStatus =
  | 'issued'
  | 'revoked'
  | 'expired';

export interface Credential {
  id: string;
  recipientId: string;
  recipientAddress?: string;
  issuerId: string;
  type: CredentialType;
  title: string;
  description?: string;
  courseId?: string;
  status: CredentialStatus;
  issuedAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}
