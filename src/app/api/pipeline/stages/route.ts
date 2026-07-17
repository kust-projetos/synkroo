import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { listarPipeline } from '@/modules/comercial/actions/listar-pipeline';
import { criarEtapaPipeline } from '@/modules/comercial/actions/criar-etapa-pipeline';

const handleGet = async (_request: NextRequest) => {
  return runComercialAction(listarPipeline, {});
};

const handlePost = async (request: NextRequest) => {
  const body = await request.json();
  const { name, color, sort_order } = body;
  return runComercialAction(criarEtapaPipeline, {
    name,
    color: color || '#6b7280',
    position: sort_order ?? 0,
  });
};

export const GET = withModuleRoute('comercial', moduleManifest)(handleGet);
export const POST = withModuleRoute('comercial', moduleManifest)(handlePost);
