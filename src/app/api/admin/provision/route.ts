import { NextResponse } from 'next/server';

/** Provisioning is owned by an external operational control plane. */
export async function POST(_request: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 404 });
}
