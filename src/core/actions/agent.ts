import type { ActionContext, ActionDefinition } from './types';
import { getActions } from './registry';

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: ActionDefinition['input'];
  run: (rawInput: unknown) => Promise<unknown>;
}

export function toAgentTool(action: ActionDefinition<any, any>, ctx: ActionContext): AgentTool {
  // import dinâmico evita ciclo run.ts <-> agent.ts
  return {
    name: action.name,
    description: action.description ?? action.label,
    inputSchema: action.input,
    run: async (rawInput: unknown) => {
      const { runAction } = await import('./run');
      return runAction(action, rawInput, ctx);
    },
  };
}

// Filtra o registry pelo manifesto (hasModule) E pela permissão (can) do principal.
export function agentToolsFor(ctx: ActionContext): AgentTool[] {
  return getActions()
    .filter((a) => ctx.hasModule(a.module) && ctx.can(a.requires))
    .map((a) => toAgentTool(a, ctx));
}
