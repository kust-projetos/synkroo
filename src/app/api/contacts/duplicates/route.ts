/**
 * /api/contacts/duplicates — Task 5: gated + action-driven (runCrmAction).
 */
import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runCrmAction } from '@/modules/crm/ui/route-adapter';
import { listarSugestoesDuplicidade } from '@/modules/crm/actions';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = {
    status: searchParams.get('status') ?? undefined,
    ownerType: (searchParams.get('owner_type') as 'patient' | 'lead' | null) ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
  };
  return runCrmAction(listarSugestoesDuplicidade, input);
}

export const GET = withModuleRoute('crm')(handleGET);