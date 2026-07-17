/**
 * Atendimento module — action exports.
 * Actions are self-registering via the action registry.
 * Import here to trigger registration; do not call handlers directly from routes —
 * use runActionRoute from ../ui/route-adapter.ts instead.
 */

import { registerActions } from '@/core/actions/registry';
import { iniciarConversa } from './iniciar-conversa';
import { listarConversas } from './listar-conversas';
import { obterConversa } from './obter-conversa';
import { arquivarConversa } from './arquivar-conversa';
import { escalarConversa } from './escalar-conversa';
import { receberMensagem } from './receber-mensagem';
import { classificarIntencao } from './classificar-intencao';
import { extrairEntidades } from './extrair-entidades';
import { historicoMensagens } from './historico-mensagens';
import { enviarMensagem } from './enviar-mensagem';
import { agendarMensagem } from './agendar-mensagem';
import { obterModeloMensagem } from './obter-modelo-mensagem';
import { verificarWebhook } from './verificar-webhook';
import { processarWebhookWhatsApp } from './processar-webhook-whatsapp';
import { statusEvolution } from './status-evolution';
import { verificarWebhookInstagram } from './verificar-webhook-instagram';
import { processarWebhookInstagram } from './processar-webhook-instagram';
import { responderInstagram } from './responder-instagram';
import { receberWidgetMensagem } from './receber-widget-mensagem';
import { enviarMensagemDireta } from './enviar-mensagem-direta';
import { obterQRCode } from './obter-qrcode';

export * from './enviar-mensagem-direta';
export * from './iniciar-conversa';
export * from './listar-conversas';
export * from './obter-conversa';
export * from './arquivar-conversa';
export * from './escalar-conversa';
export * from './receber-mensagem';
export * from './classificar-intencao';
export * from './extrair-entidades';
export * from './historico-mensagens';
export * from './enviar-mensagem';
export * from './agendar-mensagem';
export * from './obter-modelo-mensagem';
export * from './verificar-webhook';
export * from './processar-webhook-whatsapp';
export * from './status-evolution';
export * from './verificar-webhook-instagram';
export * from './processar-webhook-instagram';
export * from './responder-instagram';
export * from './receber-widget-mensagem';
export * from './obter-qrcode';

// Bootstrap registration — idempotent
registerActions([
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
  enviarMensagemDireta,
]);
