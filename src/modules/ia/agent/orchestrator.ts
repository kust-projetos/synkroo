import type { AgentTool, agentToolsFor as _agentToolsFor } from '@/core/actions/agent';
import type { ActionContext } from '@/core/actions/types';
import type { LlmProvider, ChatMessage } from '@/modules/ia/llm/provider';
import type { PersonaType } from '@/modules/ia/agent/personas';
import { getPersona } from '@/modules/ia/agent/personas';

// ── Public types ──────────────────────────────────────────────

export interface OrchestratorState {
  personaType: PersonaType;
  history: ChatMessage[];
  turnCount: number;
}

export interface OrchestratorConfig {
  provider?: LlmProvider;
  maxTurns?: number;
  /** Injetável para testes — tools pré-computadas, evita mock de módulo */
  tools?: AgentTool[];
}

export interface OrchestratorInput {
  message: string;
  context: ActionContext;
  state: OrchestratorState;
}

export interface OrchestratorOutput {
  response: string;
  state: OrchestratorState;
}

// ── Constants ─────────────────────────────────────────────────

const DEFAULT_MAX_TURNS = 10;
const FALLBACK_MESSAGE =
  'Desculpe, não consegui processar sua solicitação. Um atendente humano entrará em contato.';

// ── Core loop (testável sem DO real) ─────────────────────────

export async function runOrchestratorLoop(
  input: OrchestratorInput,
  config: OrchestratorConfig,
): Promise<OrchestratorOutput> {
  if (!config.provider) {
    throw new Error('[Orchestrator] LLM provider is required. Pass it via config.provider.');
  }

  const maxTurns = config.maxTurns ?? DEFAULT_MAX_TURNS;
  const provider = config.provider;

  // Resolve tools: use injected if provided, otherwise fetch from registry
  let tools: AgentTool[];
  if (config.tools) {
    tools = config.tools;
  } else {
    // Dynamic import to avoid cycle — agentToolsFor depends on action registry
    const { agentToolsFor } = await import('@/core/actions/agent');
    tools = agentToolsFor(input.context);
  }

  // Build initial history
  const history: ChatMessage[] = [...input.state.history];

  // Add or replace system message with current persona
  const systemContent = getPersona(input.state.personaType).systemPrompt;
  const systemIdx = history.findIndex((m) => m.role === 'system');
  const systemMsg: ChatMessage = { role: 'system', content: systemContent };

  if (systemIdx >= 0) {
    history[systemIdx] = systemMsg;
  } else {
    history.unshift(systemMsg);
  }

  // Add user message
  history.push({ role: 'user', content: input.message });

  let turnCount = input.state.turnCount;

  // ── Loop ──────────────────────────────────────────────
  while (turnCount < maxTurns) {
    turnCount++;

    // Build messages array: system + history (includes previous user/tool/assistant)
    const response = await provider.complete(history, tools);

    // Tool calls → execute and feed back
    if (response.toolCalls.length > 0) {
      for (const tc of response.toolCalls) {
        const tool = tools.find((t) => t.name === tc.name);
        let toolResult: unknown;

        if (tool) {
          try {
            toolResult = await tool.run(tc.arguments);
          } catch (err) {
            toolResult = {
              error: err instanceof Error ? err.message : 'Tool execution failed',
            };
          }
        } else {
          toolResult = { error: `Tool "${tc.name}" not found` };
        }

        history.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          toolCallId: tc.id,
          name: tc.name,
        });
      }

      // If we hit maxTurns after tool execution, return fallback
      if (turnCount >= maxTurns) {
        history.push({ role: 'assistant', content: FALLBACK_MESSAGE });
        return {
          response: FALLBACK_MESSAGE,
          state: { personaType: input.state.personaType, history, turnCount },
        };
      }

      // Continue loop — LLM will process tool results
      continue;
    }

    // Text response (no tool calls) → done
    const text = response.text || '';
    history.push({ role: 'assistant', content: text });

    return {
      response: text,
      state: { personaType: input.state.personaType, history, turnCount },
    };
  }

  // Exhausted turns without response → fallback
  history.push({ role: 'assistant', content: FALLBACK_MESSAGE });
  return {
    response: FALLBACK_MESSAGE,
    state: { personaType: input.state.personaType, history, turnCount },
  };
}

// ── AgentOrchestrator (Agents SDK wrapper — stub for Phase 2) ─

// Use a locally-defined Agent interface to avoid ESM dependency issues at typecheck time.
// The real `agents` package Agent class will be used at runtime in Workers.
interface AgentState {
  personaType: PersonaType;
  history: ChatMessage[];
  turnCount: number;
  clinicId?: string;
  interlocutorKind?: string;
}

const DEFAULT_AGENT_STATE: AgentState = {
  personaType: 'recepcao',
  history: [],
  turnCount: 0,
};

/**
 * Stub Agent class for Phase 2.
 * Real integration with `agents` SDK happens in Phase 3 (channels).
 * Declared locally to avoid ESM import issues with the `agents` package.
 */
export abstract class AgentOrchestrator {
  initialState: AgentState = { ...DEFAULT_AGENT_STATE };

  abstract state: AgentState;
  abstract setState(state: Partial<AgentState>): void;
}
