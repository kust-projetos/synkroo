import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from '@/modules/crm/ui/route-adapter';
import { runAction } from '@/core/actions/run';
import { buildUserContext } from '@/core/actions/context';
import {
  executarMergePatient,
  executarMergeLead,
} from '@/modules/crm/actions';
import { findSuggestionById } from '@/modules/crm/repositories/duplicate-suggestions-repository';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateRequest();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const ctx = await buildUserContext();

  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const mergeAction =
    suggestion.ownerType === 'patient' ? executarMergePatient : executarMergeLead;

  const result = await runAction(mergeAction, { id }, ctx);
  if (result.ok) {
    return NextResponse.json(result.data);
  }
  return NextResponse.json(
    { error: result.error.message },
    { status: result.error.code === 'conflict' ? 409 : 500 },
  );
}
