/**
 * /api/contacts/duplicates/[id] — Task 5: gated + action-driven.
 */
import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { obterSugestaoDuplicidade } from '@/modules/crm/actions';

async function handleGET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return runCrmAction(obterSugestaoDuplicidade, { id });
}

export const GET = withModuleRoute('crm')(handleGET);