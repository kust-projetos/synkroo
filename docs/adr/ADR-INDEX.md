# ADR Index — Synkroo Foundations

**Última atualização:** 2026-07-29  
**Verificação:** lint/tsc ✅ | tests: 201 suites / 1465 pass ✅ | coverage: 53% (meta 80%)

| ID | Decisão | Status | Gap |
|---|---|---|---|
| [ADR-BASE-01](ADR-BASE-01-modular-monolith.md) | Modular monolith por bounded context | ✅ Implementado | Nenhum |
| [ADR-BASE-02](ADR-BASE-02-nextjs-opennext-worker.md) | Next.js 15 + OpenNext em Workers | ✅ Implementado | Smoke test em staging pendente |
| [ADR-BASE-03](ADR-BASE-03-drizzle-pg-hyperdrive.md) | PostgreSQL 17 + Drizzle + pg + Hyperdrive | ✅ Implementado | Nenhum |
| [ADR-BASE-04](ADR-BASE-04-pgvector.md) | pgvector como vector store único v1 | ✅ Implementado | Índice de performance (IVF/HNSW) |
| [ADR-BASE-05](ADR-BASE-05-nextauth-auth-secret.md) | NextAuth v4 + AUTH_SECRET ≥32 bytes | ✅ Implementado | Nenhum |
| [ADR-BASE-06](ADR-BASE-06-action-layer.md) | Action Layer como entrada de negócio | ✅ Implementado | Nenhum |
| [ADR-BASE-07](ADR-BASE-07-durable-object-condicionado.md) | Durable Object condicionado a smoke | ⏸️ Deferido | Revisitar pós-smoke staging |
| [ADR-BASE-08](ADR-BASE-08-evolution-provider.md) | Evolution API provider principal | ✅ Implementado | Nenhum |
| [ADR-BASE-09](ADR-BASE-09-playwright-sidecar.md) | Playwright sidecar default off | ✅ Implementado | Nenhum |
| [ADR-BASE-10](ADR-BASE-10-api-contracts.md) | API camelCase com `{ data, meta? }` | ✅ Implementado | Migração gradual de rotas |
| [ADR-BASE-11](ADR-BASE-11-onboarding-gerenciado.md) | Onboarding gerenciado | ✅ Implementado | Nenhum |
| [ADR-BASE-12](ADR-BASE-12-audit-allowlist.md) | Audit allowlist (LGPD) | ✅ Implementado | allowedAuditFields nas ações existentes |
| [ADR-BASE-13](ADR-BASE-13-cloudflare-queues.md) | Cloudflare Queues para jobs | 🟡 Em progresso | Consumer Worker + migration de cron |
| [ADR-BASE-14](ADR-BASE-14-sem-master.md) | Sem Master permanente no banco | 🔴 Decisão pendente | Remover isMaster, usar master:* |

## Gates

| Gate | Meta | Atual |
|---|---|---|
| Lint | zero erro | ✅ zero |
| Typecheck | zero erro | ✅ zero |
| Test suites | 100% verde | ✅ 201/201 |
| Coverage | ≥80% | 🟡 53% (floor previne regressão) |
| Contract tests | HTTP passando | ✅ 17/17 + boundary 8/8 |
| ADRs documentados | 14/14 | ✅ todos atualizados |

## Coverage Roadmap

A meta de 80% é aspiracional e requer campanha dedicada. Estratégia:
1. **Floor atual (53%)**: previne regressão — todo PR mantém ou sobe
2. **Domínios prioritários**: auth, RBAC, Actions, financeiro (mutation testing ≥70%)
3. **Dead code removal**: serviços em `src/services/` com 0% coverage que não são usados
4. **Meta intermediária**: 65% (Q3 2026), 80% (pré-piloto)
