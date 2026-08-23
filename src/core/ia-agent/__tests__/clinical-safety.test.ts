/**
 * Unit & Contract tests for Clinical Safety & AI Takeover / Escalation (F6.08)
 */

import { analyzeClinicalSafety } from '../clinical-safety';
import { runTurn } from '../orchestrator-logic';
import type { AppBinding, LlmProvider } from '../types';

describe('Clinical Safety & AI Takeover / Escalation (F6.08)', () => {
  describe('analyzeClinicalSafety rule engine', () => {
    it('detects user request for human takeover', () => {
      const phrases = [
        'Quero falar com um atendente',
        'falar com humano',
        'me passa para uma pessoa real',
        'atendente por favor',
        'quero atendimento humano',
        'transferir para atendente',
      ];

      for (const phrase of phrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isTakeoverRequest).toBe(true);
        expect(res.requiresEscalation).toBe(true);
        expect(res.escalationReason).toBe('user_requested_human');
        expect(res.reply).toContain('atendente');
      }
    });

    it('identifies AI assistant when asked about identity', () => {
      const phrases = [
        'Você é um robô?',
        'Você é inteligência artificial?',
        'É uma IA?',
        'Estou falando com um robô ou com uma pessoa?',
      ];

      for (const phrase of phrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isAiIdentityQuery).toBe(true);
        expect(res.reply).toMatch(/assistente virtual|inteligência artificial|IA/i);
      }
    });

    it('detects clinical urgency (dor intensa, sangramento, febre, inchaço, trauma) and escalates', () => {
      const phrases = [
        'Estou com uma dor insuportável no dente',
        'Meu dente quebrou e está sangrando muito',
        'Estou com o rosto muito inchado e febre',
        'É uma emergência odontológica, muita dor',
        'Hemorragia após extração de dente',
      ];

      for (const phrase of phrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isUrgency).toBe(true);
        expect(res.requiresEscalation).toBe(true);
        expect(res.escalationReason).toBe('urgency');
        expect(res.reply).toMatch(/urgência|avaliação profissional|dentista|atendente/i);
      }
    });

    it('detects medication and prescription inquiries, refusing prescription and offering professional evaluation', () => {
      const phrases = [
        'Qual remédio posso tomar para dor de dente?',
        'Posso tomar amoxicilina 500mg?',
        'Quantos mg de ibuprofeno devo tomar?',
        'Me receita um antibiótico para infecção',
        'Qual anti-inflamatório é bom pra dente?',
      ];

      for (const phrase of phrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isMedicationRequest).toBe(true);
        expect(res.requiresEscalation).toBe(true);
        expect(res.escalationReason).toBe('medication_inquiry');
        expect(res.reply).toMatch(/não posso prescrever|receitar|avaliação com um dentista/i);
      }
    });

    it('detects diagnosis requests, refusing clinical diagnosis and offering evaluation appointment', () => {
      const phrases = [
        'Qual é o meu diagnóstico?',
        'O que significa ter uma mancha preta no dente, é canal ou cárie?',
        'Será que eu estou com câncer de boca?',
        'Faça um diagnóstico do meu dente',
      ];

      for (const phrase of phrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isDiagnosisRequest).toBe(true);
        expect(res.reply).toMatch(/não posso formular diagnósticos|avaliação clínica presencial/i);
      }
    });

    it('allows normal operational and commercial conversations without triggering safety escalation', () => {
      const normalPhrases = [
        'Quais horários vocês têm livres amanhã?',
        'Qual o valor da limpeza odontológica?',
        'Gostaria de agendar uma consulta para quinta-feira',
        'Onde fica a clínica?',
      ];

      for (const phrase of normalPhrases) {
        const res = analyzeClinicalSafety(phrase);
        expect(res.isTakeoverRequest).toBe(false);
        expect(res.isUrgency).toBe(false);
        expect(res.isMedicationRequest).toBe(false);
        expect(res.isDiagnosisRequest).toBe(false);
        expect(res.requiresEscalation).toBe(false);
      }
    });
  });

  describe('runTurn safety integration in orchestrator', () => {
    const mockApp: AppBinding = {
      listTools: async () => ({ ok: true, catalog: { version: 'v1', tools: [] } }),
      executeAction: async () => ({ ok: true, data: {} }),
    };

    const mockProvider: LlmProvider = {
      complete: async () => ({ text: 'Resposta padrão', toolCalls: [] }),
    };

    const baseInput = {
      handle: 'h',
      conversationId: 'c1',
      source: 'system' as const,
      personaType: 'paciente' as const,
      context: '',
      timezone: 'America/Sao_Paulo',
    };

    it('runTurn automatically intercepts human takeover and sets escalated=true', async () => {
      const res = await runTurn(
        { provider: mockProvider, app: mockApp, now: new Date() },
        { ...baseInput, userMessage: 'Quero falar com um atendente humano agora' },
      );

      expect(res.escalated).toBe(true);
      expect(res.escalationReason).toBe('user_requested_human');
      expect(res.reply).toMatch(/atendente/i);
    });

    it('runTurn intercepts urgent clinical symptoms, recommends immediate care, and escalates', async () => {
      const res = await runTurn(
        { provider: mockProvider, app: mockApp, now: new Date() },
        { ...baseInput, userMessage: 'Estou com dor insuportável no dente e rosto inchado' },
      );

      expect(res.escalated).toBe(true);
      expect(res.escalationReason).toBe('urgency');
      expect(res.reply).toMatch(/urgência|profissional|atendente/i);
    });

    it('runTurn intercepts medication requests, warns that AI cannot prescribe, and offers evaluation', async () => {
      const res = await runTurn(
        { provider: mockProvider, app: mockApp, now: new Date() },
        { ...baseInput, userMessage: 'Qual antibiótico devo tomar para essa dor?' },
      );

      expect(res.escalated).toBe(true);
      expect(res.escalationReason).toBe('medication_inquiry');
      expect(res.reply).toMatch(/não posso prescrever|receitar|dentista/i);
    });

    it('runTurn transparently responds to AI identity queries', async () => {
      const res = await runTurn(
        { provider: mockProvider, app: mockApp, now: new Date() },
        { ...baseInput, userMessage: 'Você é um robô ou uma pessoa?' },
      );

      expect(res.reply).toMatch(/assistente virtual|inteligência artificial|IA/i);
    });
  });
});
