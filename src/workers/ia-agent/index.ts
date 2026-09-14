import { DurableObject } from 'cloudflare:workers';
import { createZenProvider } from '@/core/ia-agent/provider-zen';
import { runTurn as runAgentTurn } from '@/core/ia-agent/orchestrator-logic';
import {
  createTelemetryLogger,
  resolveCorrelationId,
} from '@/core/ia-agent/telemetry';
import { parseRuntimeEnv } from '@/lib/runtime-env';
import type { AppBinding } from '@/core/agent-bridge/rpc-contract';
import type {
  RunTurnInput,
  RunTurnResult,
  ChatMessage,
  PendingAction,
} from '@/core/ia-agent/types';

// Estende Cloudflare.Env (gerado por wrangler types) para satisfazer
// Agent<Env extends Cloudflare.Env>. APP/AGENT vêm com tipos genéricos;
// AppBinding e AgentOrchestrator são aplicados via cast no ponto de uso.
export interface Env extends Cloudflare.Env {
  OPENCODE_ZEN_API_KEY: string;
}

/**
 * AgentOrchestrator — DO que processa turnos do agente IA.
 *
 * NOTA sobre PartyServer + cross-worker DO bindings (workers SDK):
 *   No miniflare, DOs endereçados via env.AGENT.idFromName().get() de
 *   OUTRO worker não têm ctx.id.name populado. PartyServer/agents SDK
 *   dependem de setName() (via getAgentByName) ou do header x-partykit-room
 *   para inicializar. Sem isso, this.name lança, this.onStart e this.state
 *   travam, e o Workers runtime cancela o DO.
 *
 *   SOLUÇÃO ADOTADA: o DO usa DurableObject diretamente em vez de Agent.
 *   RPC exposto via método runTurn() chamado por stub.runTurn() (binding).
 *   Persistência via this.ctx.storage (history + pendingAction por conversa).
 */
const STATE_VERSION = 2;
// Retention: DO state 30 days (F6.12 / F10.08 — docs/ops/w10-retention-policy.md)
// Purge via alarm + deleteAll(); re-embedding/purge por clinicId via pgvector (não Vectorize)
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class AgentOrchestrator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    parseRuntimeEnv('agent', env as unknown as Record<string, unknown>);
    super(ctx, env);
    // F6.12 versioned state — lazy migration on first turn (non-blocking)
    void this.ctx.storage.get<number>('STATE_VERSION').then((v) => {
      if (v !== STATE_VERSION) void this.ctx.storage.put('STATE_VERSION', STATE_VERSION);
    });
  }

  // F6.12 retention purge — alarm fires after RETENTION_MS, wipes history/pendingAction
  async alarm(): Promise<void> {
    await this.ctx.storage.delete('history');
    await this.ctx.storage.delete('pendingAction');
    // keep STATE_VERSION for migration tracking
  }

  /**
   * RPC exposto: chamado pelo app via env.AGENT.idFromName(n).get().runTurn(i).
   * Sem Agent SDK — PartyServer/observability bypassados.
   * Estado entre turnos persiste via this.ctx.storage (KV durable do DO).
   */
  async runTurn(
    input: Omit<RunTurnInput, 'history' | 'pendingAction'>,
  ): Promise<RunTurnResult> {
    // Carrega estado persistido entre turnos da mesma conversa.
    const history = (await this.ctx.storage.get<ChatMessage[]>('history')) ?? [];

    // B2: telemetria estruturada edge-safe (JSON via console; sem src/lib/logger).
    // O correlationId viaja no input (invoker → DO); validação de formato
    // único — inválido/ausente gera novo em vez de logar texto externo.
    const correlationId = resolveCorrelationId(input.correlationId);
    const emit = createTelemetryLogger('ia-agent');
    const provider = createZenProvider({
      apiKey: this.env.OPENCODE_ZEN_API_KEY,
      model: this.env.IA_LLM_MODEL,
      baseUrl: this.env.IA_LLM_BASE_URL,
      onMetric: (m) =>
        emit({
          correlationId: m.correlationId ?? correlationId,
          clinicId: input.clinicId,
          operation: 'provider_call',
          durationMs: m.latencyMs,
          status: m.success ? 'ok' : 'error',
          code: m.errorCode,
          attempt: m.attempt,
          provider: m.provider,
          model: m.model,
          usage: m.usage,
        }),
    });

    const app = this.env.APP as unknown as AppBinding;
    const result = await runAgentTurn(
      {
        provider,
        app,
        now: new Date(),
        // Integração B1×B2: telemetria estruturada (B2 — o DO injeta o sink
        // real) + reserva atômica da pending (B1 — peek/consume).
        telemetry: emit,
        // B1-review — peek lê sem destruir (mensagem normal nunca consome);
        // consume CONDICIONAL: dentro da MESMA transação, só deleta se o
        // valor atual ainda for o esperado (token+principal do peek). Se um
        // turno intercalou e trocou a pending, NÃO deleta (mismatch).
        peekPendingAction: async () =>
          (await this.ctx.storage.get<PendingAction | null>('pendingAction')) ?? undefined,
        // B1-review — reserva atômica por shard: segunda confirmação
        // (concorrente ou seguida) do mesmo token recebe reserved undefined
        // → recusada (at-most-once).
        consumePendingAction: async (expected) => {
          return this.ctx.storage.transaction(async (txn) => {
            const cur = await txn.get<PendingAction | null>('pendingAction');
            if (!cur) return { reserved: undefined, mismatch: false };
            if (cur.token !== expected.token || cur.principalId !== expected.principalId) {
              return { reserved: undefined, mismatch: true };
            }
            await txn.delete('pendingAction');
            return { reserved: cur, mismatch: false };
          });
        },
      },
      {
        ...input,
        correlationId,
        history,
      },
    );

    // Persiste estado atualizado (janela curta: 20 turnos).
    const nextHistory: ChatMessage[] = [
      ...history,
      { role: 'user' as const, content: input.userMessage },
      { role: 'assistant' as const, content: result.reply },
    ].slice(-20);
    await this.ctx.storage.put('history', nextHistory);
    // B1-review — semântica explícita de escrita da pending:
    // 'set' (orchestrator criou nova) → grava; 'clear' (confirm consumiu) →
    // apaga SOMENTE se o valor atual for null/ausente ou a MESMA pending que
    // esta execução reservou (`clearedToken`); pending nova de turno
    // intercalado durante o await do executeAction é preservada;
    // 'keep'/ausente (turno normal, confirm inválido, budget estourado,
    // mismatch) → NÃO escreve, preserva a existente.
    if (result.pendingActionWrite === 'set') {
      await this.ctx.storage.put('pendingAction', result.pendingAction ?? null);
    } else if (result.pendingActionWrite === 'clear') {
      // Leitura+escrita na MESMA transação: sem janela check-then-act.
      const clearedToken = result.clearedToken;
      await this.ctx.storage.transaction(async (txn) => {
        const cur = await txn.get<PendingAction | null>('pendingAction');
        if (cur === null || cur === undefined || (clearedToken && cur.token === clearedToken)) {
          await txn.put('pendingAction', null);
        } else {
          // eslint-disable-next-line no-console
          console.warn('[ia-agent] clear condicional ignorado: pending nova preservada', {
            conversationId: input.conversationId,
          });
        }
      });
    }
    // F6.12 retention — reschedule purge alarm on every turn
    await this.ctx.storage.setAlarm(Date.now() + RETENTION_MS);

    return result;
  }
}

const worker = {
  async fetch(_request: Request, _env: Env) {
    parseRuntimeEnv('agent', _env as unknown as Record<string, unknown>);
    return new Response('ia-agent up', { status: 200 });
  },
};

export default worker;
