import crypto from 'crypto';

export enum PredicateType {
  Equals = 0,
  GreaterThanOrEqual = 1,
  Range = 2,
}

export interface ZkProofPayload {
  credentialCommitment: string; // 32-byte hex string (64 chars)
  nullifier: string;            // 32-byte hex string (64 chars)
  predicateType: PredicateType;
  attributeName: string;
  publicParam1: bigint;
  publicParam2: bigint;
  challenge: string;            // 32-byte hex string (64 chars)
  response: string;             // 32-byte hex string (64 chars)
  holderBinding: string;        // 32-byte hex string (64 chars)
}

export interface GenerateProofParams {
  credentialId: bigint;
  holderAddress: string;
  verifierAddress: string;
  attributeName: string;
  attributeValue: bigint;
  predicateType: PredicateType;
  publicParam1: bigint;
  publicParam2?: bigint;
}

export class ZkService {
  /**
   * Computes SHA-256 hash of buffer/string payload
   */
  public static sha256(data: Buffer | string): Buffer {
    return crypto.createHash('sha256').update(data).digest();
  }

  /**
   * Computes credential attribute commitment:
   * H(credential_id || holder || attribute_name || attribute_value || salt)
   */
  public static computeCredentialCommitment(
    credentialId: bigint,
    holderAddress: string,
    attributeName: string,
    attributeValue: bigint,
    salt?: Buffer
  ): { commitment: Buffer; salt: Buffer } {
    const actualSalt = salt || crypto.randomBytes(32);
    
    const credIdBuf = Buffer.alloc(8);
    credIdBuf.writeBigUInt64BE(credentialId);

    const valBuf = Buffer.alloc(8);
    valBuf.writeBigUInt64BE(attributeValue);

    const holderBuf = Buffer.from(holderAddress, 'utf-8');
    const attrBuf = Buffer.from(attributeName, 'utf-8');

    const commitment = this.sha256(
      Buffer.concat([credIdBuf, holderBuf, attrBuf, valBuf, actualSalt])
    );

    return { commitment, salt: actualSalt };
  }

  /**
   * Computes verifier-scoped non-transferable nullifier:
   * H(holder || verifier || credential_id || nonce)
   */
  public static computeNullifier(
    holderAddress: string,
    verifierAddress: string,
    credentialId: bigint,
    nonce?: Buffer
  ): { nullifier: Buffer; nonce: Buffer } {
    const actualNonce = nonce || crypto.randomBytes(32);

    const credIdBuf = Buffer.alloc(8);
    credIdBuf.writeBigUInt64BE(credentialId);

    const holderBuf = Buffer.from(holderAddress, 'utf-8');
    const verifierBuf = Buffer.from(verifierAddress, 'utf-8');

    const nullifier = this.sha256(
      Buffer.concat([holderBuf, verifierBuf, credIdBuf, actualNonce])
    );

    return { nullifier, nonce: actualNonce };
  }

  /**
   * Computes holder binding hash:
   * H(holder || commitment || nullifier || challenge)
   */
  public static computeHolderBinding(
    holderAddress: string,
    commitment: Buffer,
    nullifier: Buffer,
    challenge: Buffer
  ): Buffer {
    const holderBuf = Buffer.from(holderAddress, 'utf-8');
    return this.sha256(
      Buffer.concat([holderBuf, commitment, nullifier, challenge])
    );
  }

  /**
   * Computes Fiat-Shamir non-interactive challenge:
   * H(commitment || nullifier || attribute_name || param1 || param2 || r_reconstructed)
   */
  public static computeFiatShamirChallenge(
    commitment: Buffer,
    nullifier: Buffer,
    attributeName: string,
    param1: bigint,
    param2: bigint,
    rReconstructed: Buffer
  ): Buffer {
    const attrBuf = Buffer.from(attributeName, 'utf-8');
    const p1Buf = Buffer.alloc(8);
    p1Buf.writeBigUInt64BE(param1);
    const p2Buf = Buffer.alloc(8);
    p2Buf.writeBigUInt64BE(param2);

    return this.sha256(
      Buffer.concat([commitment, nullifier, attrBuf, p1Buf, p2Buf, rReconstructed])
    );
  }

  /**
   * Generates a zero-knowledge proof for selective attribute disclosure.
   */
  public static generateProof(params: GenerateProofParams): ZkProofPayload {
    const {
      credentialId,
      holderAddress,
      verifierAddress,
      attributeName,
      attributeValue,
      predicateType,
      publicParam1,
      publicParam2 = 0n,
    } = params;

    // Validate predicate constraints
    if (predicateType === PredicateType.Equals && attributeValue !== publicParam1) {
      throw new Error(`Attribute value ${attributeValue} does not satisfy Equals(${publicParam1})`);
    }
    if (predicateType === PredicateType.GreaterThanOrEqual && attributeValue < publicParam1) {
      throw new Error(`Attribute value ${attributeValue} does not satisfy GreaterThanOrEqual(${publicParam1})`);
    }
    if (predicateType === PredicateType.Range && (attributeValue < publicParam1 || attributeValue > publicParam2)) {
      throw new Error(`Attribute value ${attributeValue} out of range [${publicParam1}, ${publicParam2}]`);
    }

    const { commitment } = this.computeCredentialCommitment(
      credentialId,
      holderAddress,
      attributeName,
      attributeValue
    );

    const { nullifier } = this.computeNullifier(
      holderAddress,
      verifierAddress,
      credentialId
    );

    const secretResponse = crypto.randomBytes(32);

    // Compute expected r payload
    const p1Buf = Buffer.alloc(8);
    p1Buf.writeBigUInt64BE(publicParam1);
    const p2Buf = Buffer.alloc(8);
    p2Buf.writeBigUInt64BE(publicParam2);

    const dummyChallenge = this.sha256(Buffer.from('challenge_seed'));
    
    let payload = Buffer.concat([secretResponse, dummyChallenge, p1Buf]);
    if (predicateType === PredicateType.Range) {
      payload = Buffer.concat([payload, p2Buf]);
    }
    const rReconstructed = this.sha256(payload);

    const initialChallenge = this.computeFiatShamirChallenge(
      commitment,
      nullifier,
      attributeName,
      publicParam1,
      publicParam2,
      rReconstructed
    );

    let finalPayload = Buffer.concat([secretResponse, initialChallenge, p1Buf]);
    if (predicateType === PredicateType.Range) {
      finalPayload = Buffer.concat([finalPayload, p2Buf]);
    }
    const finalR = this.sha256(finalPayload);

    const challenge = this.computeFiatShamirChallenge(
      commitment,
      nullifier,
      attributeName,
      publicParam1,
      publicParam2,
      finalR
    );

    const holderBinding = this.computeHolderBinding(
      holderAddress,
      commitment,
      nullifier,
      challenge
    );

    return {
      credentialCommitment: commitment.toString('hex'),
      nullifier: nullifier.toString('hex'),
      predicateType,
      attributeName,
      publicParam1,
      publicParam2,
      challenge: challenge.toString('hex'),
      response: secretResponse.toString('hex'),
      holderBinding: holderBinding.toString('hex'),
    };
  }
}
