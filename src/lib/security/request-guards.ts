import type { NextRequest } from 'next/server';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SESSION_COOKIE_NAMES = new Set([
  'next-auth.session-token',
  '__Secure-next-auth.session-token',
]);

export function hasSessionCookie(request: Pick<NextRequest, 'cookies'>): boolean {
  return Array.from(SESSION_COOKIE_NAMES).some((name) => Boolean(request.cookies.get(name)?.value));
}

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

export function isSameOriginRequest(request: Pick<NextRequest, 'headers' | 'nextUrl'>): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const expectedOrigin = request.nextUrl.origin;
  const source = origin ?? (referer ? safeOrigin(referer) : null);
  return source === expectedOrigin;
}

function safeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function shouldRejectCsrf(request: NextRequest): boolean {
  return isMutatingMethod(request.method) && hasSessionCookie(request) && !isSameOriginRequest(request);
}

export function exceedsBodyLimit(request: Pick<NextRequest, 'headers'>, maxBytes = 1_048_576): boolean {
  const contentLength = request.headers.get('content-length');
  return contentLength !== null && Number.isFinite(Number(contentLength)) && Number(contentLength) > maxBytes;
}
