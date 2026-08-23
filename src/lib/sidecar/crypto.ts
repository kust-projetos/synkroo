/**
 * Sidecar HMAC SHA-256 Signature with Nonce, Timestamp & Idempotency (F6.14)
 */

import type { NonceSeenStore, SidecarSignPayload, VerifySidecarResult } from './types';

const encoder = new TextEncoder();

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return toHex(digest);
}

export function buildSignatureCanonicalString(
  payload: SidecarSignPayload,
  bodyHash: string,
): string {
  return `${payload.timestamp}.${payload.nonce}.${payload.idempotencyKey}.${bodyHash}`;
}

/**
 * Signs sidecar payload using HMAC-SHA256 over timestamp.nonce.idempotencyKey.bodyHash.
 */
export async function signSidecarRequest(
  secret: string,
  payload: SidecarSignPayload,
): Promise<string> {
  const bodyHash = await sha256(payload.body);
  const canonical = buildSignatureCanonicalString(payload, bodyHash);
  const key = await importKey(secret);
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(canonical));
  return toHex(signatureBytes);
}

/**
 * Verifies sidecar signature, checks timestamp window (default 300s) and enforces single-use nonce.
 */
export async function verifySidecarSignature(
  secret: string,
  signature: string,
  payload: SidecarSignPayload,
  seenStore: NonceSeenStore,
  maxSkewMs = 300_000,
): Promise<VerifySidecarResult> {
  if (!signature || !payload.nonce || !payload.idempotencyKey || !payload.timestamp) {
    return { ok: false, error: 'malformed' };
  }

  // 1. Timestamp validation (reject clock skew > 300s)
  const now = Date.now();
  if (Math.abs(now - payload.timestamp) > maxSkewMs) {
    return { ok: false, error: 'expired_timestamp' };
  }

  // 2. Nonce replay check
  if (await seenStore.wasSeen(payload.nonce)) {
    return { ok: false, error: 'replayed_nonce' };
  }

  // 3. Cryptographic signature verification
  const bodyHash = await sha256(payload.body);
  const canonical = buildSignatureCanonicalString(payload, bodyHash);
  const key = await importKey(secret);

  const isValid = await crypto.subtle.verify(
    'HMAC',
    key,
    hexToBytes(signature) as BufferSource,
    encoder.encode(canonical) as BufferSource,
  );

  if (!isValid) {
    return { ok: false, error: 'invalid_signature' };
  }

  // 4. Mark nonce as seen for remaining validity window + grace period
  const ttlSeconds = Math.max(Math.ceil(maxSkewMs / 1000) + 60, 120);
  await seenStore.markSeen(payload.nonce, ttlSeconds);

  return { ok: true, payload };
}
