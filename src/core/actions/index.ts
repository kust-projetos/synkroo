export * from './types';
export { defineAction, registerActions, getActions, getAction, clearRegistry } from './registry';
// Adaptadores executáveis de tool do agente (`toAgentTool`/`agentToolsFor`) foram
// REMOVIDOS (2026-10-05, allowlist hardening): expunham `runAction` direto,
// contornando confirmação/identidade/anti-replay do agent-bridge. Descoberta de
// tools da IA vive só em `src/core/agent-bridge/tool-catalog.ts` (metadata) +
// `bridge-service.ts` (execução com revalidação da allowlist).
// runAction importado de @/core/actions/run diretamente
// buildUserContext/buildDelegatedContext/buildSystemContext importados de @/core/actions/context diretamente
// (evita que o barrel puxe pg → next-auth no build Workers)
