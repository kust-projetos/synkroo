import type { HandlePayload } from './types';

const encoder = new TextEncoder();

export interface SeenStore {
  wasSeen(jti: string): Promise<boolean>;
  markSeen(jti: string, ttlSeconds: number): Promise<void>;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function encodeJson(obj: unknown): string {
  return b64url(encoder.encode(JSON.stringify(obj)));
}

function decodeJson<T>(seg: string): T {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg))) as T;
}

async function sign(secret: string, data: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return b64url(sig);
}

async function verifySig(
  secret: string,
  data: string,
  signature: string,
): Promise<boolean> {
  const key = await importKey(secret);
  return crypto.subtle.verify(
    'HMAC',
    key,
    b64urlToBytes(signature) as BufferSource,
    encoder.encode(data) as BufferSource,
  );
}

export interface IssueInput
  extends Omit<HandlePayload, 'exp' | 'jti'> {
  ttlSeconds?: number;
}

export async function issueHandle(
  secret: string,
  input: IssueInput,
): Promise<{ handle: string; payload: HandlePayload }> {
  const payload: HandlePayload = {
    clinicId: input.clinicId,
    conversationId: input.conversationId,
    principalRef: input.principalRef,
    source: input.source,
    jti: crypto.randomUUID(),
    exp: Date.now() + (input.ttlSeconds ?? 60) * 1000,
  };
  const payload64 = encodeJson(payload);
  const signature = await sign(secret, payload64);
  return { handle: `${payload64}.${signature}`, payload };
}

export type VerifyError =
  | 'malformed'
  | 'invalid_signature'
  | 'expired'
  | 'conversation_mismatch'
  | 'replayed';

export type VerifyResult =
  | { ok: true; payload: HandlePayload }
  | { ok: false; error: VerifyError };

export async function verifyHandle(
  secret: string,
  handle: string,
  opts: {
    conversationId: string;
    store: SeenStore;
    singleUse?: boolean;
  },
): Promise<VerifyResult> {
  const [payload64, signature] = handle.split('.');
  if (!payload64 || !signature) return { ok: false, error: 'malformed' };

  if (!(await verifySig(secret, payload64, signature))) {
    return { ok: false, error: 'invalid_signature' };
  }

  let payload: HandlePayload;
  try {
    payload = decodeJson<HandlePayload>(payload64);
  } catch {
    return { ok: false, error: 'malformed' };
  }

  if (payload.exp < Date.now()) return { ok: false, error: 'expired' };
  if (payload.conversationId !== opts.conversationId) {
    return { ok: false, error: 'conversation_mismatch' };
  }

  if (opts.singleUse) {
    if (await opts.store.wasSeen(payload.jti)) {
      return { ok: false, error: 'replayed' };
    }
    const ttlSeconds = Math.max(
      Math.ceil((payload.exp - Date.now()) / 1000) + 30,
      60,
    );
    await opts.store.markSeen(payload.jti, ttlSeconds);
  }

  return { ok: true, payload };
}
