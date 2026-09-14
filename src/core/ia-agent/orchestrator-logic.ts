import { z } from 'zod';
import type {
  AppBinding,
  ChatMessage,
  ConsumePendingResult,
  LlmProvider,
  LlmTool,
  PendingAction,
  PendingConsumeExpected,
  RunTurnInput,
  RunTurnResult,
} from './types';
import { BRIDGE_RPC_VERSION } from '@/core/agent-bridge/rpc-contract';
import { personaSystemPrompt, wrapUserData } from './personas';
import { analyzeClinicalSafety } from './clinical-safety';
import {
  normalizeCode,
  noopTelemetry,
  type TelemetryEvent,
  type TelemetrySink,
} from './telemetry';

/**
 * B1 — comparação constant-time de tokens (mesmo padrão do `matchesSecret`
 * do repo: sha256 dos dois lados + comparação sem early-exit).
 *
 * Implementado sobre WebCrypto (`crypto.subtle`) em vez de `node:crypto`:
 * o tsconfig do worker ia-agent só inclui `@cloudflare/workers-types`
 * (sem tipos do Node), e `subtle` existe nos três runtimes (DO/workerd,
 * Node/jest, edge). O hash fixa o tamanho (tokens de tamanhos diferentes
 * não vazam por early-exit) e o fold XOR percorre todos os 32 bytes sempre.
 */
export async function safeTokenEquals(a: string, b: string): Promise<boolean> {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length === 0 || b.length === 0) {
    return false;
  }
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const xa = new Uint8Array(ha);
  const xb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < xa.length; i++) diff |= xa[i] ^ xb[i];
  return diff === 0;
}

/**
 * B1 — forma válida de um tool_call vindo do LLM: id e nome presentes,
 * arguments como string (parse JSON feito abaixo). Fora disso → erro
 * estruturado realimentado ao modelo, sem executar ação.
 */
const LlmToolCallSchema = z.object({
  id: z.string().min(1),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }),
});

export interface RunTurnDeps {
  provider: LlmProvider;
  app: AppBinding;
  now: Date;
  maxIterations?: number;
  newToken?: () => string;
  /**
   * B1-review — deadline real do turno (default TURN_BUDGET_MS) e relógio
   * injetável (default Date.now) para testes determinísticos.
   */
  turnBudgetMs?: number;
  nowMs?: () => number;
  /**
   * B1-review — reserva validada da pendingAction no DO storage.
   * `peek` lê sem destruir; `consume` (condicional: só deleta se o valor
   * atual casar com `expected`) reserva na mesma transação do storage.
   * Quando presentes, o confirm usa ambos (ver caminho de confirmação).
   */
  peekPendingAction?: () => Promise<PendingAction | undefined>;
  consumePendingAction?: (
    expected: PendingConsumeExpected,
  ) => Promise<ConsumePendingResult>;
  /** B2: sink de telemetria estruturada (default: noop — o DO injeta o real). */
  telemetry?: TelemetrySink;
}

/**
 * B1 (timeout budget) — budget ENFORÇADO do turno: 20s. Antes de cada
 * iteração o loop verifica o restante; sem budget, encerra com fallback sem
 * chamar o provider nem executar tool. A chamada em curso recebe um
 * AbortSignal amarrado ao deadline. O pior caso do provider com 1 retry
 * (2 × ZEN_CALL_TIMEOUT_MS = 18s) cabe aqui, que cabe no RPC total do
 * invoker (INVOKER_RPC_TIMEOUT_MS = 25s), abaixo do cancel do workerd (~30s).
 * NÃO aumentar o invoker.
 */
export const TURN_BUDGET_MS = 20_000;

function isAbortError(err: unknown): boolean {
  // DOMException de abort NÃO é instanceof Error — checar por nome.
  const name = (err as { name?: unknown })?.name;
  const message = (err as { message?: unknown })?.message;
  return name === 'AbortError' || (typeof message === 'string' && message.includes('aborted'));
}

const FALLBACK = 'Só um momento — vou verificar e já te retorno.';

function errorReply(error: string): string {
  if (error === 'escalate_human')
    return 'Vou encaminhar você para um atendente da clínica para concluir isso. Um instante.';
  return 'Não consegui concluir agora. Posso ajudar de outra forma?';
}

async function hasCurrentBridgeContract(
  app: AppBinding,
  correlationId?: string,
): Promise<boolean> {
  try {
    const ping = await app.ping({ contractVersion: BRIDGE_RPC_VERSION, correlationId });
    return ping.ok && ping.contractVersion === BRIDGE_RPC_VERSION;
  } catch {
    return false;
  }
}

export async function runTurn(
  deps: RunTurnDeps,
  input: RunTurnInput,
): Promise<RunTurnResult> {
  const maxIterations = deps.maxIterations ?? 5;
  const newToken = deps.newToken ?? (() => crypto.randomUUID());
  const emit: TelemetrySink = deps.telemetry ?? noopTelemetry;
  const correlationId = input.correlationId;
  const clinicId = input.clinicId;
  const startedAt = Date.now();
  const log = (e: Omit<TelemetryEvent, 'correlationId' | 'clinicId'>): void =>
    emit({
      correlationId,
      clinicId,
      durationMs: Date.now() - startedAt,
      ...e,
    });
  // Fallback amigável ao usuário + erro estruturado preservado no log e no
  // resultado interno (nunca vaza código/detalhe na reply; logs levam só code
  // de allowlist + descrição estática — sem texto de exceção/payload).
  const fallback = (code: string, turnsUsed = 0): RunTurnResult => {
    log({ operation: 'run_turn', status: 'fallback', code });
    return { reply: FALLBACK, turnsUsed, errorCode: code };
  };

  // B1-review HIGH: deadline ÚNICO do turno, criado aqui e compartilhado por
  // confirm e loop — o confirm também está sob budget (antes ele executava
  // fora de qualquer deadline).
  const turnBudgetMs = deps.turnBudgetMs ?? TURN_BUDGET_MS;
  const nowMs = deps.nowMs ?? Date.now;
  const deadline = nowMs() + turnBudgetMs;
  // B1-review HIGH: budget revalidado (a) antes do execute confirmado,
  // (b) após cada complete, (c) antes de cada executeAction.
  const budgetExhausted = (where: string): boolean => {
    if (nowMs() < deadline) return false;
    // eslint-disable-next-line no-console
    console.error('[ia-agent] turn budget exhausted, skipping ' + where, {
      correlationId: input.correlationId,
      conversationId: input.conversationId,
    });
    return true;
  };

  // ── 0. Clinical Safety & Takeover Interception ─────────────────────────────
  if (input.userMessage && input.userMessage.trim().length > 0) {
    const safety = analyzeClinicalSafety(input.userMessage);
    if (safety.requiresEscalation) {
      return {
        reply: safety.reply ?? errorReply('escalate_human'),
        turnsUsed: 0,
        escalated: true,
        escalationReason: safety.escalationReason,
        pendingActionWrite: 'keep',
      };
    }
    if (safety.isAiIdentityQuery && safety.reply) {
      return {
        reply: safety.reply,
        turnsUsed: 0,
        pendingActionWrite: 'keep',
      };
    }
  }

  // O handshake é por turno para não deixar uma versão de bridge presa no
  // isolate. Nenhuma operação de tool é enviada sem confirmar v2.
  // Integração B1×B2: fallback estruturado com errorCode (log correlacionado)
  // + pendingActionWrite 'keep' (at-most-once: nada reservado, nada se escreve).
  if (!(await hasCurrentBridgeContract(deps.app, correlationId))) {
    return { ...fallback('contract_version_mismatch'), pendingActionWrite: 'keep' as const };
  }

  // ── Caminho de confirmação ────────────────────────────────────────────────
  // Reexecuta os args ORIGINAIS (não os do modelo). Vincula alias+args.
  // B1-review — reserva validada + binding de principal:
  //  - mensagem normal (sem confirmedToken) NUNCA toca a pending;
  //  - com confirmedToken: peek (sem destruir) → valida token (timing-safe)
  //    + principalId → consume CONDICIONAL (só deleta se o valor atual ainda
  //    for o peekado) → revalida o reservado (mismatch/perdeu a corrida =
  //    fallback fail-closed, sem executar);
  //  - fail-closed: sem pending, sem token, ou principal ausente/divergente
  //    em qualquer lado → recusa (segue o fluxo normal, sem executar);
  //  - falha pós-reserva NÃO re-arma a pending: erro normal ao usuário.
  //  - sem callbacks (testes/unit), usa `input.pendingAction` direto.
  let reservedPa: PendingAction | undefined;
  if (input.confirmedToken) {
    const peeked = deps.peekPendingAction
      ? await deps.peekPendingAction()
      : input.pendingAction;
    if (
      peeked &&
      input.principalId &&
      peeked.principalId &&
      input.principalId === peeked.principalId &&
      (await safeTokenEquals(input.confirmedToken, peeked.token))
    ) {
      // B1-review HIGH: sem budget NÃO consome nem executa — a pending
      // permanece (só peek até aqui) para confirmação futura dentro do budget.
      if (budgetExhausted('confirm-execute')) {
        return { reply: FALLBACK, turnsUsed: 0, pendingActionWrite: 'keep' };
      }
      if (deps.consumePendingAction) {
        const { reserved, mismatch } = await deps.consumePendingAction({
          token: peeked.token,
          principalId: peeked.principalId,
        });
        // taken e peeked são ambos server-side: === aqui não vaza timing.
        if (
          !mismatch &&
          reserved &&
          reserved.token === peeked.token &&
          reserved.principalId === peeked.principalId
        ) {
          reservedPa = reserved;
        } else {
          // Pending trocada entre peek e consume (turno intercalado) —
          // fail-closed: fallback sem executar, nova pending intacta.
          return { reply: FALLBACK, turnsUsed: 1, pendingActionWrite: 'keep' };
        }
      } else {
        reservedPa = peeked;
      }
    }
  }
  if (reservedPa) {
    const pa = reservedPa;
    const identityVerified =
      !!input.identityVerifiedToken &&
      (await safeTokenEquals(input.identityVerifiedToken, pa.token));
    const exec = await deps.app.executeAction({
      contractVersion: BRIDGE_RPC_VERSION,
      correlationId,
      handle: input.handle,
      conversationId: input.conversationId,
      idempotencyKey: pa.token,
      alias: pa.alias,
      input: pa.args,
      flags: { confirmed: true, identityVerified },
    });
    if (exec.contractVersion !== BRIDGE_RPC_VERSION) {
      // Integração B1×B2: pós-reserva NÃO se re-arma (clear condicional da
      // pending reservada) + errorCode estruturado no log/resultado.
      return { ...fallback('contract_version_mismatch'), pendingActionWrite: 'clear' as const, clearedToken: pa.token };
    }
    if (!exec.ok) {
      // needs_identity / needs_confirmation: a bridge pede outra rodada —
      // re-arma a pending consumida (set) para a confirmação futura; o fluxo
      // segue pedindo ao usuário em vez de executar.
      if (exec.error === 'needs_identity' || exec.error === 'needs_confirmation') {
        const ask =
          exec.error === 'needs_identity'
            ? 'preciso confirmar sua identidade'
            : 'você confirma esta ação';
        log({ operation: 'execute_action', status: 'ok', code: exec.error });
        return {
          reply: `Para prosseguir, ${ask}. Posso seguir?`,
          turnsUsed: 1,
          pendingAction: pa,
          pendingActionWrite: 'set' as const,
        };
      }
      log({
        operation: 'execute_action',
        status: 'error',
        code: normalizeCode(exec.error, 'provider_error'),
      });
      return {
        reply: errorReply(exec.error),
        turnsUsed: 1,
        escalated: exec.error === 'escalate_human',
        escalationReason: exec.error === 'escalate_human' ? 'action_escalate_human' : undefined,
        // Integração B1×B2: falha pós-reserva NÃO re-arma (clear condicional)
        // + errorCode estruturado (log correlacionado, DTO filtra no HTTP).
        pendingActionWrite: 'clear' as const,
        clearedToken: pa.token,
        errorCode: normalizeCode(exec.error, 'provider_error'),
      };
    }
    log({ operation: 'run_turn', status: 'ok', code: 'confirmed' });
    return {
      reply: 'Pronto, confirmado e executado.',
      turnsUsed: 1,
      pendingActionWrite: 'clear' as const,
      clearedToken: pa.token,
    };
  }

  // ── 1. Catálogo ──────────────────────────────────────────────────────────
  const toolsResp = await deps.app.listTools({
    contractVersion: BRIDGE_RPC_VERSION,
    correlationId,
    handle: input.handle,
    conversationId: input.conversationId,
  });
  if (!toolsResp.ok || toolsResp.contractVersion !== BRIDGE_RPC_VERSION)
    return {
      ...fallback(
        !toolsResp.ok ? normalizeCode(toolsResp.error, 'provider_error') : 'contract_version_mismatch',
      ),
      pendingActionWrite: 'keep' as const,
    };

  const llmTools: LlmTool[] = toolsResp.catalog.tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.alias,
      description: t.description,
      parameters: t.inputSchemaJson,
    },
  }));

  // ── 2. Prompt COM histórico ──────────────────────────────────────────────
  // B1: falas do usuário (atual + turnos anteriores) entram como DADO
  // delimitado — o histórico persistido no DO tem origem externa e pode
  // conter injeção. Turnos assistant/tool são saída do próprio modelo/servidor.
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: personaSystemPrompt(
        input.personaType,
        input.context,
        deps.now,
        input.timezone,
      ),
    },
    ...(input.history ?? []).map((m) =>
      m.role === 'user' ? { ...m, content: wrapUserData(m.content) } : m,
    ),
    { role: 'user', content: wrapUserData(input.userMessage) },
  ];

  // ── 3. Loop LLM↔tools ───────────────────────────────────────────────────
  // B1-review: deadline real (criado no topo, compartilhado com o confirm) —
  // sem budget restante, encerra com fallback sem iniciar nova chamada ao
  // provider nem executar tool.
  let turnsUsed = 0;
  for (let i = 0; i < maxIterations; i++) {
    if (nowMs() >= deadline) {
      // eslint-disable-next-line no-console
      console.error('[ia-agent] turn budget exhausted, stopping loop', {
        correlationId: input.correlationId,
        conversationId: input.conversationId,
        iteration: i,
        turnsUsed,
      });
      return { reply: FALLBACK, turnsUsed, pendingActionWrite: 'keep' };
    }
    turnsUsed = i + 1;
    // Integração B1×B2: abort amarrado ao deadline (B1 — a chamada em curso
    // é cancelada ao estourar o budget) + erro estruturado sem PII (B2 —
    // nunca se loga texto de exceção/payload; só o code fechado).
    // Erro não-abort vira fallback com errorCode (o invoker/DTO tratam o
    // HTTP); abort do deadline vira fallback neutro com 'keep'.
    const iterController = new AbortController();
    const abortTimer = setTimeout(
      () => iterController.abort(),
      Math.max(0, deadline - nowMs()),
    );
    let completion;
    try {
      completion = await deps.provider.complete(messages, llmTools, {
        correlationId,
        signal: iterController.signal,
      });
    } catch (err) {
      // Abort do deadline → fallback neutro (sem código interno), não crash.
      if (isAbortError(err)) {
        // eslint-disable-next-line no-console
        console.error('[ia-agent] provider call aborted by turn deadline', {
          correlationId,
          conversationId: input.conversationId,
          iteration: i,
        });
        return { reply: FALLBACK, turnsUsed, pendingActionWrite: 'keep' as const };
      }
      // Texto da exceção NUNCA vai para o log (pode conter corpo do provider).
      // Lê-se só o code fechado (LlmError.code); o resto é descartado.
      const rawCode =
        err !== null && typeof err === 'object'
          ? (err as { code?: unknown }).code
          : undefined;
      const code = normalizeCode(rawCode);
      log({
        operation: 'provider_call',
        status: 'error',
        code,
      });
      return { ...fallback(code, turnsUsed), pendingActionWrite: 'keep' as const };
    } finally {
      clearTimeout(abortTimer);
    }

    // B1-review HIGH (a): budget pode ter estourado DURANTE o complete —
    // revalida antes de usar a resposta; sem budget, fallback sem executar tool.
    if (budgetExhausted('tool-batch')) {
      return { reply: FALLBACK, turnsUsed, pendingActionWrite: 'keep' };
    }

    // Sem tool calls → resposta final
    if (!completion.toolCalls.length) {
      const text = completion.text ?? '';
      if (!text.trim()) return fallback('empty_completion', turnsUsed);
      log({ operation: 'run_turn', status: 'ok' });
      return {
        reply: text.trim(),
        turnsUsed,
        pendingActionWrite: 'keep',
      };
    }

    messages.push({
      role: 'assistant',
      content: completion.text ?? '',
      tool_calls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      // B1: valida a forma do tool_call ANTES de qualquer execução.
      const parsedCall = LlmToolCallSchema.safeParse({
        id: call.id,
        function: { name: call.function?.name, arguments: call.function?.arguments },
      });
      if (!parsedCall.success) {
        messages.push({
          role: 'tool',
          tool_call_id: typeof call.id === 'string' ? call.id : 'unknown',
          content: JSON.stringify({
            error: 'invalid_tool_call',
            level: 'proibido',
            message: 'Tool call malformada ignorada: id/nome/arguments inválidos.',
          }),
        });
        continue;
      }
      const alias = parsedCall.data.function.name;
      let args: unknown;
      try {
        args = JSON.parse(parsedCall.data.function.arguments || '{}');
      } catch {
        messages.push({
          role: 'tool',
          tool_call_id: parsedCall.data.id,
          content: JSON.stringify({
            error: 'invalid_tool_call',
            level: 'proibido',
            message: 'Argumentos da tool call não são JSON válido; nada foi executado.',
          }),
        });
        continue;
      }
      // Args precisam ser objeto (o bridge revalida via Zod no runAction —
      // ver teste de confirm-revalidation; aqui barramos escalar/array).
      if (typeof args !== 'object' || args === null || Array.isArray(args)) {
        messages.push({
          role: 'tool',
          tool_call_id: parsedCall.data.id,
          content: JSON.stringify({
            error: 'invalid_tool_call',
            level: 'proibido',
            message: 'Argumentos da tool call precisam ser um objeto JSON; nada foi executado.',
          }),
        });
        continue;
      }

      // B1-review HIGH (b): revalida o budget imediatamente ANTES de cada
      // executeAction — sem budget, fallback e a tool NÃO executa.
      if (budgetExhausted(`execute:${alias}`)) {
        return { reply: FALLBACK, turnsUsed, pendingActionWrite: 'keep' };
      }

      const exec = await deps.app.executeAction({
        contractVersion: BRIDGE_RPC_VERSION,
        correlationId,
        handle: input.handle,
        conversationId: input.conversationId,
        idempotencyKey: call.id, // key crua (tool_call_id)
        alias,
        input: args,
        flags: { confirmed: false },
      });

      if (exec.contractVersion !== BRIDGE_RPC_VERSION) {
        return { ...fallback('contract_version_mismatch'), pendingActionWrite: 'keep' as const };
      }
      if (!exec.ok) {
        if (
          exec.error === 'needs_confirmation' ||
          exec.error === 'needs_identity'
        ) {
          const ask =
            exec.error === 'needs_identity'
              ? 'preciso confirmar sua identidade'
              : 'você confirma esta ação';
          log({ operation: 'execute_action', status: 'ok', code: exec.error });
          return {
            reply: `Para prosseguir, ${ask}. Posso seguir?`,
            turnsUsed,
            pendingAction: { alias, args, token: newToken(), principalId: input.principalId },
            pendingActionWrite: 'set',
          };
        }

        if (exec.error === 'escalate_human') {
          log({ operation: 'execute_action', status: 'fallback', code: 'escalate_human' });
          return {
            reply: errorReply('escalate_human'),
            turnsUsed,
            escalated: true,
            escalationReason: 'action_escalate_human',
            // Integração B1×B2: nada a escrever na pending (keep) + errorCode
            // estruturado (log correlacionado, DTO filtra no HTTP).
            pendingActionWrite: 'keep' as const,
            errorCode: 'escalate_human' as const,
          };
        }

        // Erro estruturado realimentado ao modelo (conteúdo de tool, não log)
        // e registrado no log só com o code — sem exec.message.
        log({
          operation: 'execute_action',
          status: 'error',
          code: normalizeCode(exec.error, 'provider_error'),
        });
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify({
            error: exec.error,
            level: exec.level,
            message: exec.message,
          }),
        });
        continue;
      }

      // Tool executou com sucesso
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(exec.data),
      });
    }
  }

  // Integração B1×B2: iterações esgotadas → fallback estruturado com code
  // fechado + 'keep' (nada a escrever na pending).
  return { ...fallback('max_iterations_exhausted', turnsUsed), pendingActionWrite: 'keep' as const };
}
