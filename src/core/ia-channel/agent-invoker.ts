// Aciona o ia-agent (DO) e o issuer do ia-bridge a partir do app OpenNext.
// NÃO importar 'agents' (não existe no bundle do app — spike P4-A NO-GO).
// O app só recebe o capability de emitir handles; o executor fica no agent.
import {
  BRIDGE_RPC_VERSION,
  type HandleIssuerBinding,
  type IssueHandleResult,
} from '@/core/agent-bridge/rpc-contract';
import type { PersonaType, RunTurnInput, RunTurnResult } from '@/core/ia-agent/types';
import {
  createTelemetryLogger,
  type TelemetrySink,
} from '@/core/ia-agent/telemetry';

// Fallback quando o DO/bridge falha ou estoura o timeout (anti-hang / worker-cancel).
// Contrato: invokeAgentWithEnv SEMPRE resolve com um RunTurnResult controlado;
// nunca propaga erro para o caller HTTP, para que /api/ia/chat não cancele o Worker.
const FALLBACK_REPLY =
  'Tive uma instabilidade momentânea ao processar sua mensagem. Pode repetir em alguns instantes?';

// Timeout duro da chamada RPC completa (issueHandle + runTurn). Abaixo do limite
// padrão de cancel do workerd (~30s) para que o invokeAgentWithEnv consiga
// devolver o fallback ao caller antes do runtime matar o request.
// Configurável por injeção (env.RPC_TIMEOUT_MS / window.__RPC_TIMEOUT_MS / default).
function resolveRpcTimeoutMs(): number {
  // SSR/edge runtime: não há window; o limite é o que o caller passar ou o default.
  // Mantemos a função pura para testabilidade — unit test sobrescreve via spy.
  const DEFAULT_MS = 25_000;
  try {
    if (typeof process !== 'undefined' && process.env?.RPC_TIMEOUT_MS) {
      const n = Number(process.env.RPC_TIMEOUT_MS);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch { /* ignore */ }
  return DEFAULT_MS;
}

interface AgentStub {
  runTurn(input: Omit<RunTurnInput, 'history' | 'pendingAction'>): Promise<RunTurnResult>;
}

export interface AgentEnv {
  IA_HANDLE_ISSUER: HandleIssuerBinding;
  AGENT: {
    idFromName(name: string): unknown;
    get(id: unknown): AgentStub;
  };
}

export interface InvokeAgentInput {
  clinicId: string;
  conversationId: string;
  channel: 'whatsapp' | 'chat';
  peerId: string;
  principalRef: string;
  source: 'system' | 'agent_delegated';
  personaType: PersonaType;
  context: string;
  timezone: string;
  userMessage: string;
  confirmedToken?: string;
  identityVerifiedToken?: string;
  /** B2: x-request-id da rota; gerado aqui quando ausente. */
  correlationId?: string;
}

// Lógica pura (testável): recebe os bindings já resolvidos.
// Anti-hang: qualquer falha no DO/bridge OU estouro de timeout retorna FALLBACK_REPLY
// em vez de throw / hang, para que o caller HTTP (/api/ia/chat) não sofra cancelamento
// do Worker runtime (PartyServer "ctx.id.name not set", bridge indisponível,
// RPC do DO travada, etc — vide smoke tests).
export async function invokeAgentWithEnv(
  env: AgentEnv,
  input: InvokeAgentInput,
  opts: { timeoutMs?: number; telemetry?: TelemetrySink } = {},
): Promise<RunTurnResult> {
  const timeoutMs = opts.timeoutMs ?? resolveRpcTimeoutMs();
  // B2: correlation id ponta a ponta — a rota gera/ecoa x-request-id; aqui é
  // o fallback de geração para callers que não passam (ex.: WhatsApp inbound).
  const correlationId = input.correlationId ?? crypto.randomUUID();
  const emit = opts.telemetry ?? createTelemetryLogger('ia-channel:agent-invoker');
  const startedAt = Date.now();

  const runOnce = async (): Promise<RunTurnResult> => {
    // 1. handle (ia-bridge é a autoridade do principal)
    const issued: IssueHandleResult = await env.IA_HANDLE_ISSUER.issueHandle({
      contractVersion: BRIDGE_RPC_VERSION,
      correlationId,
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      principalRef: input.principalRef,
      source: input.source,
      ttlSeconds: 120,
    });
    if (!('handle' in issued) || issued.contractVersion !== BRIDGE_RPC_VERSION) {
      throw new Error('[agent-invoker] handle issuer contract version mismatch');
    }
    const { handle } = issued;

    // 2. DO por CONVERSA (shard por conversationId — não por peerId; senão o mesmo usuário
    //    em 2 conversas compartilharia history/pendingAction no DO).
    const id = env.AGENT.idFromName(
      `${input.clinicId}:${input.channel}:${input.conversationId}`,
    );
    const stub = env.AGENT.get(id);

    // 3. roda o turno
    return await stub.runTurn({
      handle,
      conversationId: input.conversationId,
      source: input.source,
      personaType: input.personaType,
      context: input.context,
      timezone: input.timezone,
      userMessage: input.userMessage,
      confirmedToken: input.confirmedToken,
      identityVerifiedToken: input.identityVerifiedToken,
      correlationId,
      clinicId: input.clinicId,
    });
  };

  try {
    return await raceWithTimeout(runOnce(), timeoutMs, input, correlationId);
  } catch (err) {
    // Log estruturado para diagnóstico (com correlation id) sem expor PII;
    // o caller HTTP recebe um fallback controlado e o Worker não é cancelado.
    const message = err instanceof Error ? err.message : String(err);
    const code = message.includes('RPC timeout')
      ? 'rpc_timeout'
      : message.includes('contract version mismatch')
        ? 'contract_version_mismatch'
        : 'invoke_failed';
    emit({
      correlationId,
      clinicId: input.clinicId,
      operation: 'invoke_agent',
      durationMs: Date.now() - startedAt,
      status: 'fallback',
      code,
      detail: message.slice(0, 300),
    });
    return { reply: FALLBACK_REPLY, turnsUsed: 0, errorCode: code };
  }
}

// raceWithTimeout: se a promise não resolver dentro do timeout, devolve
// o fallback. O RPC do DO, uma vez travado, nunca resolve — sem isto o
// worker cancela o request depois de ~30s (miniflare/wrangler).
async function raceWithTimeout<T>(
  p: Promise<T>,
  ms: number,
  input: InvokeAgentInput,
  correlationId: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `[agent-invoker] RPC timeout after ${ms}ms (conversationId=${input.conversationId}, channel=${input.channel}, corr=${correlationId})`,
        ),
      );
    }, ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Wrapper runtime: resolve env via getCloudflareContext (sync, fallback async — fiel ao spike).
export async function invokeAgent(input: InvokeAgentInput): Promise<RunTurnResult> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare/cloudflare-context');
  let env: AgentEnv;
  try {
    env = (getCloudflareContext() as unknown as { env: AgentEnv }).env;
  } catch {
    env = ((await getCloudflareContext({ async: true })) as unknown as { env: AgentEnv }).env;
  }
  return invokeAgentWithEnv(env, input);
}
