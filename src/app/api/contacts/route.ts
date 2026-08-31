/**
 * /api/contacts — Task 5: gated por withModuleRoute('crm') + action system.
 *
 * - GET → crm.listarContatos (paginação, search).
 * - POST → 405 crm_mvp_read_only (criação de contato é via operacional/comercial).
 */
import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runCrmAction, crmReadOnlyResponse } from '@/modules/crm/ui/route-adapter';
import { listarContatos } from '@/modules/crm/actions';

async function handleGET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const input = {
    search: searchParams.get('search') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    offset: searchParams.get('offset') ? Number(searchParams.get('offset')) : undefined,
  };
  return runCrmAction(listarContatos, input);
}

const handlePOST = crmReadOnlyResponse;

export const GET = withModuleRoute('crm')(handleGET);
export const POST = withModuleRoute('crm')(handlePOST);