/**
 * Atendimento Multicanal — module public surface.
 *
 * Exports: actions array, manifest, permissions.
 * Bootstrap (core/actions/bootstrap.ts) handles registerActions() via
 * the exported atendimentoActions array.
 */

import { iniciarConversa } from './actions/iniciar-conversa';
import { listarConversas } from './actions/listar-conversas';
import { obterConversa } from './actions/obter-conversa';
import { arquivarConversa } from './actions/arquivar-conversa';
import { escalarConversa } from './actions/escalar-conversa';
import { receberMensagem } from './actions/receber-mensagem';
import { classificarIntencao } from './actions/classificar-intencao';
import { extrairEntidades } from './actions/extrair-entidades';
import { historicoMensagens } from './actions/historico-mensagens';
import { enviarMensagem } from './actions/enviar-mensagem';
import { agendarMensagem } from './actions/agendar-mensagem';
import { obterModeloMensagem } from './actions/obter-modelo-mensagem';
import { verificarWebhook } from './actions/verificar-webhook';
import { processarWebhookWhatsApp } from './actions/processar-webhook-whatsapp';
import { statusEvolution } from './actions/status-evolution';
import { verificarWebhookInstagram } from './actions/verificar-webhook-instagram';
import { processarWebhookInstagram } from './actions/processar-webhook-instagram';
import { responderInstagram } from './actions/responder-instagram';
import { receberWidgetMensagem } from './actions/receber-widget-mensagem';
import { obterQRCode } from './actions/obter-qrcode';

export const atendimentoActions = [
  iniciarConversa,
  listarConversas,
  obterConversa,
  arquivarConversa,
  escalarConversa,
  receberMensagem,
  classificarIntencao,
  extrairEntidades,
  historicoMensagens,
  enviarMensagem,
  agendarMensagem,
  obterModeloMensagem,
  verificarWebhook,
  processarWebhookWhatsApp,
  statusEvolution,
  verificarWebhookInstagram,
  processarWebhookInstagram,
  responderInstagram,
  receberWidgetMensagem,
  obterQRCode,
];

// ─── Manifest & Permissions ────────────────────────────────────────────────────
export { atendimentoManifest } from './manifest';
export { atendimentoAccessPermissions } from './permissions';
