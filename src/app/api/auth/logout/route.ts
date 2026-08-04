import { NextResponse } from 'next/server';

/** Logout is handled exclusively by NextAuth signOut. */
export async function POST(_request: Request): Promise<NextResponse> {
  return new NextResponse(null, { status: 404 });
}
