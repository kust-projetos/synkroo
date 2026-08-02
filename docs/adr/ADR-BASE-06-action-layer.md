# ADR-BASE-06: Action Layer como Entrada de Negócio

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Toda entrada de negócio (UI e IA) passa por uma Action Layer unificada. Actions validam input, aplicam policy e delegam a services. Route handlers são só transporte.

## Evidência

- `src/core/actions/`: registry, context, bootstrap, run, types, agent, audit-writer
- `src/core/actions/run.ts`: executável central com validação e policy
- Módulos usam `runActionRoute` via `ui/route-adapter.ts`
- `src/core/agent-bridge/`: tool catalog e policy para IA
- Testes em `src/core/actions/__tests__/` (registry, context, bootstrap, run, agent)

## Alternativas rejeitadas

- Regra de negócio em route handler: duplicação, bypass de policy

## Gap

Nenhum. Action Layer implementada conforme spec.
