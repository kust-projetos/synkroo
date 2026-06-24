import { runOrchestratorLoop } from '../orchestrator';
import type {
  OrchestratorInput,
  OrchestratorConfig,
  OrchestratorOutput,
  OrchestratorState,
} from '../orchestrator';
import type { LlmProvider, LlmResponse, ChatMessage, ToolCall } from '@/modules/ia/llm/provider';
import type { AgentTool } from '@/core/actions/agent';
import type { ActionContext } from '@/core/actions/types';
import { z } from 'zod';

// ── Helpers ──────────────────────────────────────────────

function makeMockActionContext(overrides?: Partial<ActionContext>): ActionContext {
  return {
    source: 'user',
    clinicId: 'clinic-1',
    user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
    role: 'admin',
    can: jest.fn().mockReturnValue(true),
    hasModule: jest.fn().mockReturnValue(true),
    audit: { actor: 'user-1' },
    ...overrides,
  };
}

function makeMockTool(name: string, description: string, runResult: unknown = 'tool result'): AgentTool {
  return {
    name,
    description,
    inputSchema: z.object({ param: z.string().optional() }),
    run: jest.fn().mockResolvedValue(runResult),
  };
}

function makeMockProvider(responses: LlmResponse[]): LlmProvider {
  let callIndex = 0;
  return {
    complete: jest.fn().mockImplementation(async (_messages: ChatMessage[], _tools: AgentTool[]) => {
      const response = responses[callIndex] ?? { text: 'Fallback', toolCalls: [] };
      callIndex++;
      return response;
    }),
  };
}

function makeInitialState(personaType: OrchestratorState['personaType'] = 'recepcao'): OrchestratorState {
  return {
    personaType,
    history: [],
    turnCount: 0,
  };
}

function makeInput(message: string, state?: OrchestratorState): OrchestratorInput {
  return {
    message,
    context: makeMockActionContext(),
    state: state ?? makeInitialState(),
  };
}

// ── Tests ─────────────────────────────────────────────────

describe('runOrchestratorLoop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('simple message (no tools)', () => {
    it('returns direct response when LLM responds with text only', async () => {
      const provider = makeMockProvider([
        { text: 'Olá! Como posso ajudar?', toolCalls: [] },
      ]);
      const input = makeInput('Oi');

      const result = await runOrchestratorLoop(input, { provider });

      expect(result.response).toBe('Olá! Como posso ajudar?');
      expect(result.state.turnCount).toBe(1);
      expect(result.state.history).toHaveLength(3); // system + user + assistant
    });

    it('includes system prompt from persona in messages', async () => {
      const provider = makeMockProvider([
        { text: 'Resposta', toolCalls: [] },
      ]);
      const input = makeInput('Oi', makeInitialState('vendas'));

      await runOrchestratorLoop(input, { provider });

      const messages = (provider.complete as jest.Mock).mock.calls[0][0] as ChatMessage[];
      const systemMsg = messages.find((m) => m.role === 'system');
      expect(systemMsg).toBeDefined();
      expect(systemMsg!.content).toContain('SDR');
      expect(systemMsg!.content).toContain('qualificar leads');
    });

    it('accumulates user message in history', async () => {
      const provider = makeMockProvider([
        { text: 'Olá', toolCalls: [] },
      ]);
      const input = makeInput('Minha mensagem');

      const result = await runOrchestratorLoop(input, { provider });

      const userMsg = result.state.history.find((m) => m.role === 'user');
      expect(userMsg).toBeDefined();
      expect(userMsg!.content).toBe('Minha mensagem');
    });

    it('accumulates assistant message in history', async () => {
      const provider = makeMockProvider([
        { text: 'Resposta do assistente', toolCalls: [] },
      ]);
      const input = makeInput('Pergunta');

      const result = await runOrchestratorLoop(input, { provider });

      const assistantMsg = result.state.history.filter((m) => m.role === 'assistant');
      expect(assistantMsg).toHaveLength(1);
      expect(assistantMsg[0].content).toBe('Resposta do assistente');
    });
  });

  describe('tool calling', () => {
    it('executes tool when LLM returns tool call and feeds result back', async () => {
      const tool = makeMockTool('search_patients', 'Search patients', { found: 2 });
      const provider = makeMockProvider([
        {
          text: null as unknown as string,
          toolCalls: [
            {
              id: 'call_1',
              name: 'search_patients',
              arguments: { query: 'joão' },
            },
          ],
        },
        { text: 'Encontrei 2 pacientes: João Silva e João Souza', toolCalls: [] },
      ]);

      const input: OrchestratorInput = {
        message: 'Buscar João',
        context: makeMockActionContext(),
        state: makeInitialState(),
      };

      const result = await runOrchestratorLoop(input, {
        provider,
        maxTurns: 5,
        tools: [tool],
      });

      expect(result.response).toBe('Encontrei 2 pacientes: João Silva e João Souza');
      expect(result.state.turnCount).toBeGreaterThanOrEqual(2);
      expect(result.state.history.some((m) => m.role === 'tool')).toBe(true);
      expect(tool.run).toHaveBeenCalledWith({ query: 'joão' });
    });

    it('runs multiple tool calls in sequence (2+ iterations)', async () => {
      const tool1 = makeMockTool('tool_a', 'Tool A', { step: 'a' });
      const tool2 = makeMockTool('tool_b', 'Tool B', { step: 'b' });

      const provider = makeMockProvider([
        {
          text: null as unknown as string,
          toolCalls: [{ id: 'call_1', name: 'tool_a', arguments: { x: 1 } }],
        },
        {
          text: null as unknown as string,
          toolCalls: [{ id: 'call_2', name: 'tool_b', arguments: { y: 2 } }],
        },
        { text: 'Todas as ferramentas executadas', toolCalls: [] },
      ]);

      const result = await runOrchestratorLoop(makeInput('test'), {
        provider,
        maxTurns: 5,
        tools: [tool1, tool2],
      });

      expect(result.response).toBe('Todas as ferramentas executadas');
      expect(result.state.turnCount).toBe(3);
      expect(tool1.run).toHaveBeenCalledWith({ x: 1 });
      expect(tool2.run).toHaveBeenCalledWith({ y: 2 });
      // Tool results should be in history
      const toolMsgs = result.state.history.filter((m) => m.role === 'tool');
      expect(toolMsgs).toHaveLength(2);
    });
  });

  describe('anti-loop guard', () => {
    it('returns fallback message when maxTurns reached', async () => {
      const loopTool = makeMockTool('loop_tool', 'Loops forever', 'looped');
      // Provider always returns tool calls, forcing infinite loop
      const provider = makeMockProvider(
        Array(15).fill({
          text: null as unknown as string,
          toolCalls: [
            { id: 'call_x', name: 'loop_tool', arguments: {} },
          ],
        }),
      );

      const state = makeInitialState();
      state.turnCount = 9; // nearly at limit

      const input: OrchestratorInput = {
        message: 'Message',
        context: makeMockActionContext(),
        state,
      };

      const result = await runOrchestratorLoop(input, {
        provider,
        maxTurns: 10,
        tools: [loopTool],
      });

      expect(result.response).toContain('Desculpe');
      expect(result.response).toContain('atendente humano');
    });
  });

  describe('history preservation', () => {
    it('preserves existing history when passed in state', async () => {
      const provider = makeMockProvider([
        { text: 'Nova resposta', toolCalls: [] },
      ]);

      const existingHistory: ChatMessage[] = [
        { role: 'user', content: 'Mensagem anterior' },
        { role: 'assistant', content: 'Resposta anterior' },
      ];

      const state: OrchestratorState = {
        personaType: 'recepcao',
        history: existingHistory,
        turnCount: 1,
      };

      const input: OrchestratorInput = {
        message: 'Nova mensagem',
        context: makeMockActionContext(),
        state,
      };

      const result = await runOrchestratorLoop(input, { provider });

      // System message gets replaced by actual persona prompt.
      // User/assistant messages should be preserved + new messages appended.
      expect(result.state.history.length).toBeGreaterThanOrEqual(5);
      expect(result.state.history[0].role).toBe('system');
      expect(result.state.history[1]).toEqual(existingHistory[0]);
      expect(result.state.history[2]).toEqual(existingHistory[1]);
      expect(result.state.history[3].role).toBe('user');
      expect(result.state.history[3].content).toBe('Nova mensagem');
    });
  });

  describe('maxTurns config', () => {
    it('uses default maxTurns when not provided', async () => {
      const provider = makeMockProvider([
        { text: 'OK', toolCalls: [] },
      ]);

      const result = await runOrchestratorLoop(makeInput('test'), { provider });
      expect(result.response).toBe('OK');
      // Default maxTurns should be 10 (no early termination)
    });

    it('respects custom maxTurns', async () => {
      const loopTool = makeMockTool('t', 'loops', 'looped');
      // Provider loops 3 times, maxTurns=2 — should hit guard
      const provider = makeMockProvider(
        Array(5).fill({
          text: null as unknown as string,
          toolCalls: [{ id: 'c', name: 't', arguments: {} }],
        }),
      );

      const result = await runOrchestratorLoop(makeInput('test'), {
        provider,
        maxTurns: 2,
        tools: [loopTool],
      });

      expect(result.response).toContain('Desculpe');
    });
  });
});
