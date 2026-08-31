import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { obterLead } from '@/modules/comercial/actions/obter-lead';
import { atualizarLead } from '@/modules/comercial/actions/atualizar-lead';
import { arquivarLead } from '@/modules/comercial/actions/arquivar-lead';

const handleGet = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return runComercialAction(obterLead, { leadId: id });
};

const handlePut = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  return runComercialAction(atualizarLead, { leadId: id, ...body });
};

const handleDelete = async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return runComercialAction(arquivarLead, { leadId: id });
};

export const GET = withModuleRoute('comercial')(handleGet);
export const PUT = withModuleRoute('comercial')(handlePut);
export const DELETE = withModuleRoute('comercial')(handleDelete);
