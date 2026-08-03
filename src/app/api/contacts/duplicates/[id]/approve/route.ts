/**
 * /api/contacts/duplicates/[id]/approve — Task 5: gated + action-driven.
 */
import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { aprovarSugestaoDuplicidade } from '@/modules/crm/actions';

async function handlePOST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return runCrmAction(aprovarSugestaoDuplicidade, { id });
}

export const POST = withModuleRoute('crm', moduleManifest)(handlePOST);