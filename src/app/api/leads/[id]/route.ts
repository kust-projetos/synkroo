import { NextRequest, NextResponse } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { obterLead } from '@/modules/comercial/actions/obter-lead';
import { atualizarLead } from '@/modules/comercial/actions/atualizar-lead';
import { updateLead } from '@/modules/comercial/repositories/leads-repository';

const handleGet = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return runComercialAction(obterLead, { leadId: id });
};

const handlePut = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  return runComercialAction(atualizarLead, { leadId: id, ...body });
};

const handleDelete = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  // Mark as lost via repository directly (no dedicated action for delete)
  const { buildUserContext } = await import('@/core/actions/context');
  let ctx;
  try { ctx = await buildUserContext(); } catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
  const updated = await updateLead(id, ctx.clinicId, { status: 'lost', lostReason: 'Archived' });
  if (!updated) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  return NextResponse.json({ success: true });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
export const PUT = withModuleRoute('comercial', moduleManifest)(handlePut);
export const DELETE = withModuleRoute('comercial', moduleManifest)(handleDelete);
