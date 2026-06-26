import { Agent, callable, getAgentByName, routeAgentRequest } from 'agents';
import { createZenProvider } from '@/core/ia-agent/provider-zen';
import { runTurn as runAgentTurn } from '@/core/ia-agent/orchestrator-logic';
import type {
  AppBinding,
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

type SessionState = {
  history: ChatMessage[];
  pendingAction: PendingAction | null;
};

export class AgentOrchestrator extends Agent<Env, SessionState> {
  initialState: SessionState = { history: [], pendingAction: null };

  // Exposto via RPC ao caller (Plano 3):
  // const a = await getAgentByName(env.AGENT, id); await a.runTurn({...})
  @callable()
  async runTurn(
    input: Omit<RunTurnInput, 'history' | 'pendingAction'>,
  ): Promise<RunTurnResult> {
    const provider = createZenProvider({
      apiKey: this.env.OPENCODE_ZEN_API_KEY,
      model: this.env.IA_LLM_MODEL,
      baseUrl: this.env.IA_LLM_BASE_URL,
    });

    const result = await runAgentTurn(
      { provider, app: this.env.APP as unknown as AppBinding, now: new Date() },
      {
        ...input,
        history: this.state.history, // memória real entre turnos
        pendingAction: this.state.pendingAction ?? undefined,
      },
    );

    // único scratchpad: this.state (janela curta). Transcript durável = app-side (Plano 3).
    const nextHistory = [
      ...this.state.history,
      { role: 'user' as const, content: input.userMessage },
      { role: 'assistant' as const, content: result.reply },
    ].slice(-20);
    this.setState({
      history: nextHistory,
      pendingAction: result.pendingAction ?? null,
    });
    return result;
  }
}

const worker = {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    // Smoke do RPC do Agent: prova getAgentByName + @callable runTurn.
    // Sem handle válido, listTools falha no ia-bridge → fallback; o ponto é validar o FIO RPC.
    if (url.pathname === '/rpc-smoke') {
      const agent = await getAgentByName(env.AGENT as any, 'smoke');
      const out: RunTurnResult = await (agent as any).runTurn({
        handle: 'smoke',
        conversationId: 'smoke',
        source: 'system',
        personaType: 'recepcao',
        context: '',
        timezone: 'America/Sao_Paulo',
        userMessage: 'ping',
      });
      return Response.json({ rpcOk: true, reply: out.reply });
    }

    return (
      (await routeAgentRequest(request, env)) ??
      new Response('ia-agent up', { status: 200 })
    );
  },
};

export default worker;
