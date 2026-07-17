import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { atualizarEtapaPipeline } from '@/modules/comercial/actions/atualizar-etapa-pipeline';
import { removerEtapaPipeline } from '@/modules/comercial/actions/remover-etapa-pipeline';

const handlePatch = async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await request.json();
  const { name, color, sort_order } = body;
  return runComercialAction(atualizarEtapaPipeline, {
    stageId: id,
    name,
    color,
    position: sort_order,
  });
};

const handleDelete = async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return runComercialAction(removerEtapaPipeline, { stageId: id });
};

export const PATCH = withModuleRoute('comercial', moduleManifest)(handlePatch);
export const DELETE = withModuleRoute('comercial', moduleManifest)(handleDelete);
