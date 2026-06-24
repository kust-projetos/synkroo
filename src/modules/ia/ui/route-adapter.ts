import { NextResponse } from 'next/server';
import { buildDelegatedContext } from '@/core/actions/context';
import { createInterlocutorResolver } from '@/modules/ia/agent/interlocutor';
import { runOrchestratorLoop } from '@/modules/ia/agent/orchestrator';
import { createLlmProvider } from '@/modules/ia/llm/provider';

/**
 * Handle an authenticated chat request from the dashboard.
 * Resolves the user as funcionario/gestao and runs the orchestrator loop.
 */
export async function handleChatRequest(
  userId: string,
  clinicId: string,
  message: string,
): Promise<NextResponse> {
  // Validate message
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Build ActionContext (delegated — inherits user's real permissions)
  let ctx;
  try {
    ctx = await buildDelegatedContext(userId, clinicId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unauthorized';
    if (msg.includes('unauthenticated') || msg.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Resolve interlocutor (userId → always funcionario/gestao)
  const interlocutor = createInterlocutorResolver();
  const result = await interlocutor.resolve({ userId, clinicId });

  // Build initial orchestrator state
  const state = {
    personaType: result.personaType,
    history: [],
    turnCount: 0,
  };

  // Run orchestrator loop
  const output = await runOrchestratorLoop(
    {
      message,
      context: ctx,
      state,
    },
    {
      provider: createLlmProvider(),
    },
  );

  return NextResponse.json({
    response: output.response,
    turnCount: output.state.turnCount,
  });
}
