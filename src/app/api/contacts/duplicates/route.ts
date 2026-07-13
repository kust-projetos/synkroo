import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/modules/crm/ui/route-adapter';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import { listarSugestoesDuplicidade } from '@/modules/crm/actions';

export async function GET(request: NextRequest) {
  const auth = await validateRequest();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const input = {
    status: searchParams.get('status') || undefined,
    ownerType: (searchParams.get('owner_type') as 'patient' | 'lead') || undefined,
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
    offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
  };

  const ctx = await buildUserContext();
  const result = await runAction(listarSugestoesDuplicidade, input, ctx);
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json({ error: result.error.message }, { status: 500 });
}
