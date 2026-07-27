# Architecture Decision Records (ADRs)

**Projeto:** Synkroo
**Versão:** 1.0
**Data:** 2026-03-27
**Metodologia:** BMAD v6.2.2

---

## Visão Geral

Este diretório contém os registros de decisões arquiteturais (ADRs) do projeto Synkroo. Cada ADR documenta uma decisão importante de arquitetura, o contexto que a motivou e suas consequências.

---

## Índice de ADRs

| ID | Título | Status | Data |
|----|--------|--------|------|
| [ADR-001](./adr-001-event-driven-architecture.md) | Event-Driven Architecture para Comunicação Assíncrona | ✅ Accepted | 2026-03-27 |
| [ADR-002](./adr-002-claude-agent-sdk.md) | Multi-LLM Provider Strategy (v2) | ✅ Accepted | 2026-03-27 (updated 2026-03-29) |
| [ADR-003](./adr-003-caching-strategy.md) | Estratégia de Caching Multi-Layer | ✅ Accepted | 2026-03-27 |
| [ADR-004](./adr-004-multi-tenant-rls.md) | Multi-Tenancy via Row-Level Security | ✅ Accepted | 2026-03-27 |
| [ADR-005](./adr-005-background-jobs.md) | Background Jobs com Supabase Edge Functions | ✅ Accepted | 2026-03-27 |

---

## Documentação de Arquitetura

Além dos ADRs, a seguinte documentação complementa a arquitetura do sistema:

| Documento | Descrição |
|-----------|-----------|
| [API Contracts](../api-contracts.md) | Contratos de API REST, schemas TypeScript, webhooks |
| [Performance Targets](../performance-targets.md) | SLIs, SLOs, error budgets, alerting |
| [Observability Strategy](../observability.md) | Logs, métricas, traces, dashboards |
| [Testing Strategy](../testing-strategy.md) | Testing Trophy, unit/integration/E2E, fixtures |
| [CI/CD Pipeline](../cicd-pipeline.md) | GitHub Actions, branch strategy, deployments |
| [Disaster Recovery](../disaster-recovery.md) | RPO/RTO, recovery procedures, backups |
| [Cost Model](../cost-model.md) | Cost projections, pricing, break-even analysis |

---

## Template de ADR

```markdown
# ADR-NNN: Título Curto

## Status
[Proposed | Accepted | Deprecated | Superseded]

## Contexto
Descreva a situação que motivou a decisão.

## Decisão
Descreva a decisão tomada.

## Alternativas Consideradas
Liste as alternativas avaliadas.

## Consequências
Descreva os impactos da decisão.

## Referências
- Links relevantes
```

---

**Criado por:** Software Architecture Master Skill
**Baseado em:** PRD v3.4, Architecture v1.0, Epics v1.0