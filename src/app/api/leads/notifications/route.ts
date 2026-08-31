import { NextRequest } from 'next/server';
import { withModuleRoute } from '@/core/modules/gates';
import { createManifest } from '@/core/modules/manifest';
import { runComercialAction } from '@/modules/comercial/ui/route-adapter';
import { listarNotificacoes } from '@/modules/comercial/actions/listar-notificacoes';
import { processarNotificacoesLeadsQuentes } from '@/modules/comercial/actions/processar-notificacoes-leads-quentes';

/**
 * GET /api/leads/notifications — List hot lead notifications.
 */
const handleGet = async () => {
  return runComercialAction(listarNotificacoes, {});
};

/**
 * POST /api/leads/notifications — Manually trigger hot lead check.
 */
const handlePost = async () => {
  return runComercialAction(processarNotificacoesLeadsQuentes, {});
};

export const GET = withModuleRoute('comercial')(handleGet);
export const POST = withModuleRoute('comercial')(handlePost);
