// Aciona o ia-agent (DO) e o ia-bridge a partir do app OpenNext.
// NÃO importar 'agents' (não existe no bundle do app — spike P4-A NO-GO).
// Caminho validado: env.IA_BRIDGE.issueHandle + env.AGENT.idFromName().get().runTurn() (spike P4-B GO).
import type { RunTurnResult, PersonaType } from '@/core/ia-agent/types';

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
export async function invokeAgentWithEnv(
  env: AgentEnv,
  input: InvokeAgentInput,
): Promise<RunTurnResult> {
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
  return stub.runTurn({
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
