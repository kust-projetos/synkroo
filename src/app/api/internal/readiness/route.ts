import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

function isAuthorizedByCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? request.headers.get('x-cron-secret') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  if (!token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    // timingSafeEqual exige buffers de mesmo tamanho
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { timingSafeEqual } = require('crypto') as typeof import('crypto');
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  // F11.07: barato e protegido — aceita CRON_SECRET (timingSafeEqual) OU sessão autenticada
  if (isAuthorizedByCronSecret(request)) {
    return NextResponse.json({ status: 'ready' });
  }
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({ status: 'ready' });
}
