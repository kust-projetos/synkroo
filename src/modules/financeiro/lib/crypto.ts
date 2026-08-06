/**
 * Financeiro — server-only encryption helpers.
 *
 * AES-256-GCM encrypt/decrypt for gateway credentials.
 * Key derived from ENCRYPTION_KEY env var (min 32 hex chars = 128 bits, but
 * we derive a 256-bit key via SHA-256 for AES-256).
 *
 * ⚠ Server-only — never import in client components.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag
const KEY_ITERATIONS = 100_000;

/**
 * Derive a 256-bit key from the ENCRYPTION_KEY env var.
 */
function deriveKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error(
      '[financeiro/crypto] ENCRYPTION_KEY env var required (min 16 chars)',
    );
  }
  // Use SHA-256 to derive a consistent 256-bit key from the raw secret
  return crypto.createHash('sha256').update(raw, 'utf-8').digest();
}

export interface EncryptedPayload {
  /** Hex-encoded initialization vector */
  iv: string;
  /** Hex-encoded ciphertext */
  data: string;
  /** Hex-encoded GCM auth tag */
  tag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns IV + ciphertext + auth tag (all hex-encoded).
 */
export function encrypt(plaintext: string): EncryptedPayload {
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * Decrypt an EncryptedPayload back to the original plaintext.
 * Throws on tampered data (GCM auth tag verification fails).
 */
export function decrypt(payload: EncryptedPayload): string {
  const key = deriveKey();
  const iv = Buffer.from(payload.iv, 'hex');
  const tag = Buffer.from(payload.tag, 'hex');
  const encrypted = Buffer.from(payload.data, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf-8');
}

export interface GatewayCredentials {
  apiKey: string;
  webhookToken?: string;
}

export function encryptGatewayCredentials(apiKey: string, webhookToken?: string): EncryptedPayload {
  const plaintext = webhookToken ? JSON.stringify({ apiKey, webhookToken }) : apiKey;
  return encrypt(plaintext);
}

export function decryptGatewayCredentials(payload: EncryptedPayload): GatewayCredentials {
  const plaintext = decrypt(payload);
  try {
    const parsed = JSON.parse(plaintext) as Partial<GatewayCredentials>;
    if (typeof parsed.apiKey === 'string') {
      return {
        apiKey: parsed.apiKey,
        webhookToken: typeof parsed.webhookToken === 'string' ? parsed.webhookToken : undefined,
      };
    }
  } catch {
    // Backward-compatible payload: legacy records encrypt the API key directly.
  }
  return { apiKey: plaintext };
}
