// Aciona o ia-agent (DO) e o ia-bridge a partir do app OpenNext.
// NÃO importar 'agents' (não existe no bundle do app — spike P4-A NO-GO).
// Caminho validado: env.IA_BRIDGE.issueHandle + env.AGENT.idFromName().get().runTurn() (spike P4-B GO).
import type { RunTurnResult, PersonaType } from '@/core/ia-agent/types';

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

interface IaBridgeRpc {
  issueHandle(input: {
    clinicId: string;
    conversationId: string;
    principalRef: string;
    source: 'system' | 'agent_delegated';
    ttlSeconds?: number;
  }): Promise<{ handle: string }>;
}

interface AgentStub {
  runTurn(input: {
    handle: string;
    conversationId: string;
    source: 'system' | 'agent_delegated';
    personaType: PersonaType;
    context: string;
    timezone: string;
    userMessage: string;
    confirmedToken?: string;
    identityVerifiedToken?: string;
  }): Promise<RunTurnResult>;
}

export interface AgentEnv {
  IA_BRIDGE: IaBridgeRpc;
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
}

// Lógica pura (testável): recebe os bindings já resolvidos.
// Anti-hang: qualquer falha no DO/bridge OU estouro de timeout retorna FALLBACK_REPLY
// em vez de throw / hang, para que o caller HTTP (/api/ia/chat) não sofra cancelamento
// do Worker runtime (PartyServer "ctx.id.name not set", bridge indisponível,
// RPC do DO travada, etc — vide smoke tests).
export async function invokeAgentWithEnv(
  env: AgentEnv,
  input: InvokeAgentInput,
  opts: { timeoutMs?: number } = {},
): Promise<RunTurnResult> {
  const timeoutMs = opts.timeoutMs ?? resolveRpcTimeoutMs();

  const runOnce = async (): Promise<RunTurnResult> => {
    // 1. handle (ia-bridge é a autoridade do principal)
    const { handle } = await env.IA_BRIDGE.issueHandle({
      clinicId: input.clinicId,
      conversationId: input.conversationId,
      principalRef: input.principalRef,
      source: input.source,
      ttlSeconds: 120,
    });

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
    });
  };

  try {
    return await raceWithTimeout(runOnce(), timeoutMs, input);
  } catch (err) {
    // Log estruturado para diagnístico sem expor PII; o caller HTTP recebe
    // um fallback controlado e o Worker não é cancelado.
    // eslint-disable-next-line no-console
    console.error('[agent-invoker] runTurn failed, returning fallback reply', {
      conversationId: input.conversationId,
      channel: input.channel,
      timeoutMs,
      error: err instanceof Error ? err.message : String(err),
    });
    return { reply: FALLBACK_REPLY, turnsUsed: 0 };
  }
}

// raceWithTimeout: se a promise não resolver dentro do timeout, devolve
// o fallback. O RPC do DO, uma vez travado, nunca resolve — sem isto o
// worker cancela o request depois de ~30s (miniflare/wrangler).
async function raceWithTimeout<T>(
  p: Promise<T>,
  ms: number,
  input: InvokeAgentInput,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `[agent-invoker] RPC timeout after ${ms}ms (conversationId=${input.conversationId}, channel=${input.channel})`,
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
