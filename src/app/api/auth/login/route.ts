import { NextResponse } from 'next/server';

/** Login is handled exclusively by NextAuth credentials provider. */
export async function POST(_request: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 404 });
}
