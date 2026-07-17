import { z } from 'zod';
import { defineAction } from '@/core/actions';
import type { ActionContext } from '@/core/actions/types';

interface IntentRule { pattern: RegExp; intent: string; }
const RULES: IntentRule[] = [
  { pattern: /agend[ae]r|marcar|consulta|hor[áa]rio|vaga|dispon[ií]vel/i, intent: 'agendamento' },
  { pattern: /cancel[ae]r|desmarcar|desistir/i, intent: 'cancelamento' },
  { pattern: /confirm[ae]r|confirmo|confirmado|presença/i, intent: 'confirmacao' },
  { pattern: /reagend[ae]r|remarcar|adiar|transferir/i, intent: 'reagendamento' },
  { pattern: /urgente|dor|emerg[eê]ncia|sangramento|quebr[oua]|acidente|inchado/i, intent: 'emergencia' },
  { pattern: /valor|pre[çc]o|quanto[sc]? custa|or[çc]amento|parcel[ae]r/i, intent: 'duvida' },
  { pattern: /reclam[aeç]|insatisfeito|péssimo|ruim|problema/i, intent: 'reclamacao' },
  { pattern: /fal[ae]r com (algu[ée]m|humano|atendente|pessoa)/i, intent: 'escalacao' },
  { pattern: /obrigad[oa]|brigado|valeu|obg/i, intent: 'outros' },
];

function classify(text: string): { intent: string; confidence: number } {
  for (const rule of RULES) {
    const match = text.match(rule.pattern);
    if (match) {
      // Higher confidence for longer matches
      const confidence = Math.min(0.5 + (match[0].length / text.length) * 0.5, 0.95);
      return { intent: rule.intent, confidence: Math.round(confidence * 100) / 100 };
    }
  }
  return { intent: 'outros', confidence: 0.3 };
}

export const classificarIntencao = defineAction({
  name: 'atendimento.classificarIntencao',
  module: 'atendimento',
  requires: 'atendimento:manage_messages',
  label: 'Classificar intenção da mensagem',
  input: z.object({
    message: z.string().min(1),
  }),
  handler: async (input, _ctx: ActionContext) => {
    const result = classify(input.message);
    return {
      intent: result.intent,
      confidence: result.confidence,
      entities: {} as Record<string, unknown>,
    };
  },
});
