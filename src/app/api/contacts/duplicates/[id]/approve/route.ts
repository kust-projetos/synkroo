import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/modules/crm/ui/route-adapter';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { aprovarSugestaoDuplicidade } from '@/modules/crm/actions';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateRequest();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ctx = await buildUserContext();
  const result = await runAction(aprovarSugestaoDuplicidade, { id }, ctx);
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(
    { error: result.error.message },
    { status: result.error.code === 'conflict' ? 409 : 500 },
  );
}
