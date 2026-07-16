/**
 * /api/contacts/duplicates/[id]/merge — Task 5: gated + action-driven.
 *
 * dispatch por ownerType da sugestão (patient → executarMergePatient,
 * lead → executarMergeLead). lookup do suggestion via repositório.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { buildUserContext } from '@/core/actions/context';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import {
  executarMergePatient,
  executarMergeLead,
} from '@/modules/crm/actions';
import { findSuggestionById } from '@/modules/crm/repositories/duplicate-suggestions-repository';

async function handlePOST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await buildUserContext();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === 'unauthenticated') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Authentication error' }, { status: 500 });
  }

  const suggestion = await findSuggestionById(ctx.clinicId, id);
  if (!suggestion) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const mergeAction =
    suggestion.ownerType === 'patient' ? executarMergePatient : executarMergeLead;

  // Injeta clinicId via runCrmAction (que já faz buildUserContext de novo).
  // Aqui construímos o input com clinicId manualmente porque já temos o ctx.
  return runCrmAction(mergeAction, { id });
}

export const POST = withModuleRoute('crm', moduleManifest)(handlePOST);