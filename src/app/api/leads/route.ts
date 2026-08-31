import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { listarLeads } from '@/modules/comercial/actions/listar-leads';
import { capturarLead } from '@/modules/comercial/actions/capturar-lead';

/**
 * GET /api/leads — List leads
 */
const handleGet = async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const temperature = searchParams.get('temperature') || undefined;
  const source = searchParams.get('source') || undefined;
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  return runComercialAction(listarLeads, {
    status,
    temperature,
    source,
    limit,
    offset,
  });
};

/**
 * POST /api/leads — Create a lead
 */
const handlePost = async (request: NextRequest) => {
  const body = await request.json();
  const { name, phone, source, email } = body;

  return runComercialAction(capturarLead, {
    name,
    phone,
    source: source || 'other',
    email,
  });
};

export const GET = withModuleRoute('comercial')(handleGet);
export const POST = withModuleRoute('comercial')(handlePost);
