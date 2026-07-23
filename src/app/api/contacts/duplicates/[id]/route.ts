import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/modules/crm/ui/route-adapter';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { obterSugestaoDuplicidade } from '@/modules/crm/actions';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateRequest();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ctx = await buildUserContext();
  const input = { id };
  const result = await runAction(obterSugestaoDuplicidade, input, ctx);
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(
    { error: result.error.message },
    { status: result.error.code === 'not_found' ? 404 : 409 },
  );
}
