import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

export function isAuthorized(req: IncomingMessage): boolean {
  const secret = process.env.WHATSAPP_FALLBACK_SECRET;
  if (!secret) return false;

  const authHeader = req.headers['authorization'] || '';
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (!token) return false;

  try {
    const a = Buffer.from(token, 'utf8');
    const b = Buffer.from(secret, 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
