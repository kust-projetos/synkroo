import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/modules/crm/ui/route-adapter';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { dispensarSugestaoDuplicidade } from '@/modules/crm/actions';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateRequest();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ctx = await buildUserContext();
  const result = await runAction(
    dispensarSugestaoDuplicidade,
    { id, dismissReason: body.dismiss_reason },
    ctx,
  );
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(
    { error: result.error.message },
    { status: result.error.code === 'conflict' ? 409 : 500 },
  );
}
