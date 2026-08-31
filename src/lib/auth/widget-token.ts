import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_CONTEXT = 'synkroo.widget.ingress.v1';
const MAX_TTL_SECONDS = 5 * 60;

export type WidgetTokenClaims = {
  installationId: string;
  origin: string;
  nonce: string;
  expiresAt: number;
};

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function decode(value: string): string | null {
  try {
    return Buffer.from(value, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

function sign(payload: string, secret: string): Buffer {
  return createHmac('sha256', `${TOKEN_CONTEXT}:${secret}`).update(payload).digest();
}

export function issueWidgetToken(
  secret: string,
  input: { installationId: string; origin: string; ttlSeconds?: number },
  now = Date.now(),
): { token: string; claims: WidgetTokenClaims } {
  if (!secret) throw new Error('widget token secret is required');
  const ttlSeconds = Math.min(Math.max(Math.floor(input.ttlSeconds ?? MAX_TTL_SECONDS), 1), MAX_TTL_SECONDS);
  const claims: WidgetTokenClaims = {
    installationId: input.installationId,
    origin: input.origin,
    nonce: randomBytes(18).toString('base64url'),
    expiresAt: Math.floor(now / 1000) + ttlSeconds,
  };
  const payload = encode(JSON.stringify({ v: 1, ...claims }));
  const signature = sign(payload, secret).toString('base64url');
  return { token: `${payload}.${signature}`, claims };
}

export function verifyWidgetToken(
  secret: string,
  token: string,
  now = Date.now(),
): WidgetTokenClaims | null {
  if (!secret || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = sign(parts[0], secret);
  let provided: Buffer;
  try {
    provided = Buffer.from(parts[1], 'base64url');
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  const decoded = decode(parts[0]);
  if (!decoded) return null;
  try {
    const value = JSON.parse(decoded) as Record<string, unknown>;
    if (
      value.v !== 1 ||
      typeof value.installationId !== 'string' ||
      typeof value.origin !== 'string' ||
      typeof value.nonce !== 'string' ||
      typeof value.expiresAt !== 'number' ||
      !Number.isSafeInteger(value.expiresAt) ||
      value.expiresAt <= Math.floor(now / 1000)
    ) return null;
    return {
      installationId: value.installationId,
      origin: value.origin,
      nonce: value.nonce,
      expiresAt: value.expiresAt,
    };
  } catch {
    return null;
  }
}
