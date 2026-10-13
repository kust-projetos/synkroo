# ADR-BASE-06: Action Layer como Entrada de Negócio

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Toda entrada de negócio (UI e IA) passa por uma Action Layer unificada. Actions validam input, aplicam policy e delegam a services. Route handlers são só transporte.

## Evidência

- `src/core/actions/`: registry, context, bootstrap, run, types, audit-writer, tenant-scope
- `src/core/actions/run.ts`: executável central com validação e policy
- Módulos usam `runActionRoute` via `ui/route-adapter.ts`
- `src/core/agent-bridge/`: tool catalog e policy para IA (único dono da allowlist `AGENT_SAFE_ACTIONS`)
- Testes em `src/core/actions/__tests__/` (registry, context, bootstrap, run, tenant-scope/scope/input-guard, guard `agent-adapters-retired`)

> **Nota (2026-10-05, allowlist hardening):** `src/core/actions/agent.ts` (`toAgentTool`/`agentToolsFor`) foi removido — adaptava a Action com `run()` chamando `runAction` direto, sem os gates de handle/confirmação/identidade/anti-replay do agent-bridge. A exposição de tools para a IA é hoje o catálogo metadata-only `buildToolCatalog` em `src/core/agent-bridge/tool-catalog.ts`; a execução é de `bridge-service.ts`. Detalhes em [ADR-BASE-17](ADR-BASE-17-llm-untrusted-data.md).

## Alternativas rejeitadas

- Regra de negócio em route handler: duplicação, bypass de policy

## Gap (2026-08-28 W5 em progresso)

Remoção de `.handler` direto e `buildSystemContext` em workflows humanos concluída parcialmente (CRM services via public seam, comercial lead-conversion sem buildSystemContext, financeiro parcialmente). Bootstrap determinístico com Promise memoizada, validação pré-commit e rollback implementado. Marcar Implementado após W5 completo (todos os workflows sem .handler/system substitution).
