import type { Interlocutor } from './types';
import type { RunTurnResult } from '@/core/ia-agent/types';

export interface WebhookRouterDeps {
  resolveInterlocutor(clinicId: string, phone: string): Promise<Interlocutor>;
  invokeAgent(input: {
    clinicId: string;
    conversationId: string;
    channel: 'whatsapp';
    peerId: string;
    principalRef: string;
    source: 'system';
    personaType: Interlocutor['personaType'];
    context: string;
    timezone: string;
    userMessage: string;
  }): Promise<RunTurnResult>;
  sendReply(conversationId: string, message: string): Promise<boolean>;
  timezone: string;
}

// Substitui o antigo "AI disabled": roteia a mensagem inbound ao agente e envia a resposta.
// Usa conv.id (conversa persistida), NÃO chave sintética.
export async function routeInboundToAgent(
  deps: WebhookRouterDeps,
  args: { clinicId: string; conversationId: string; phone: string; content: string },
): Promise<{ from: string; action: string }> {
  const who = await deps.resolveInterlocutor(args.clinicId, args.phone);
  const result = await deps.invokeAgent({
    clinicId: args.clinicId,
    conversationId: args.conversationId,
    channel: 'whatsapp',
    peerId: args.phone,
    principalRef: 'agente',
    source: 'system',
    personaType: who.personaType,
    context: who.context,
    timezone: deps.timezone,
    userMessage: args.content,
  });

  if (!result.reply) return { from: args.phone, action: 'no_reply' };

  const sent = await deps.sendReply(args.conversationId, result.reply);
  if (!sent) return { from: args.phone, action: 'send_failed' };

  return {
    from: args.phone,
    action: result.escalated ? 'escalated' : 'agent_replied',
  };
}
