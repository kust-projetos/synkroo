# ADR-BASE-01: Modular Monolith por Bounded Context

**Status:** ✅ Implementado  
**Data:** 2026-07-28 (canonizado pela spec)

## Decisão

Arquitetura modular monolith com bounded contexts explícitos. Cada módulo possui actions, services, repositories, schema, manifest e permissions próprios.

## Evidência

- `src/modules/` com 8 bounded contexts: operacional, comercial, crm, financeiro, atendimento, followup, ia, core
- `src/core/actions/` como Action Layer compartilhada
- Cada módulo tem `manifest.ts`, `permissions.ts`, `index.ts` (interface pública)
- `src/core/modules/gates.ts` para gates de módulo

## Alternativas rejeitadas

- Microservices por domínio: custo operacional alto, boundaries testáveis sem rede

## Gap (2026-08-28 W7 em progresso)

Boundaries declarativas com dependsOn e definitions.ts validados, mas imports legados (`src/services`, `src/repositories`) e cross-module internos via `repositories/**` ainda existem em produção. Guard `boundaries/dependencies` permanece permissivo até W7.2 concluir migração. Marcar Implementado após W7 completo.
