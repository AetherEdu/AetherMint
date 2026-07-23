/**
 * Credential Service
 *
 * In-memory backing store for the credentials module. Keeps the
 * Idempotency-Key feature (#264) testable without standing up a DB.
 * Replace with a persistent store when wiring into Mongo/Postgres.
 */

import { v4 as uuidv4 } from 'uuid';
import { Credential, CredentialStatus, CredentialType } from '../models/Credential';

interface CreateCredentialInput {
  recipientId: string;
  recipientAddress?: string;
  issuerId: string;
  type: CredentialType;
  title: string;
  description?: string;
  courseId?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

const credentials = new Map<string, Credential>();

export class CredentialService {
  async createCredential(input: CreateCredentialInput): Promise<Credential> {
    const id = uuidv4();
    const credential: Credential = {
      id,
      recipientId: input.recipientId,
      recipientAddress: input.recipientAddress,
      issuerId: input.issuerId,
      type: input.type,
      title: input.title,
      description: input.description,
      courseId: input.courseId,
      status: 'issued' as CredentialStatus,
      issuedAt: new Date().toISOString(),
      expiresAt: input.expiresAt,
      metadata: input.metadata,
    };
    credentials.set(id, credential);
    return credential;
  }

  async getCredential(id: string): Promise<Credential | null> {
    return credentials.get(id) ?? null;
  }

  async listCredentialsForRecipient(
    recipientId: string
  ): Promise<Credential[]> {
    return Array.from(credentials.values()).filter(
      (c) => c.recipientId === recipientId
    );
  }

  /** Test helper. */
  __resetForTests(): void {
    credentials.clear();
  }
}

export const credentialService = new CredentialService();
