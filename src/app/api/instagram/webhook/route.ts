import { NextResponse } from 'next/server';

/** Instagram remains disabled in v1; do not route it into the inbound pipeline. */
function disabledResponse(): NextResponse {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export async function GET(_request: Request): Promise<NextResponse> {
  return disabledResponse();
}

export async function POST(_request: Request): Promise<NextResponse> {
  return disabledResponse();
}
