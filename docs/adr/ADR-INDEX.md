# ADR Index — Synkroo Foundations

**Última atualização:** 2026-10-11
**Verificação:** estado herdado de 2026-09-14 (remediation gates ✅ | outbox scheduled consumer ✅ | production audit high/critical ✅) — **não reexecutado** em 2026-10-10/11; a atualização destas datas cobre apenas o índice de ADRs

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
| [ADR-BASE-13](ADR-BASE-13-cloudflare-queues.md) | Outbox de jobs com consumer Cron Cloudflare | ✅ Implementado | Cloudflare Queue nativa é alternativa futura |
| [ADR-BASE-14](ADR-BASE-14-sem-master.md) | Sem Master permanente no banco | ✅ Implementado | Nenhum |
| [ADR-BASE-15](ADR-BASE-15-multitenancy-boundary.md) | Boundary de tenancy (sessão→membership→ActionContext) | ✅ Implementado | Exceções documentadas (ex.: signup) |
| [ADR-BASE-16](ADR-BASE-16-retry-idempotency-policy.md) | Política de timeout/retry/idempotência das integrações | ✅ Implementado | Nenhum |
| [ADR-BASE-17](ADR-BASE-17-llm-untrusted-data.md) | Dados não confiáveis no LLM (delimitação, allowlist, validação) | ✅ Implementado | Eval adversarial periódico (complementar) |
| [ADR-BASE-18](ADR-BASE-18-ai-control-plane.md) | AI Control Plane — Event/Run/Outcome como fundação da autonomia | 🏗️ Decidido (fundação P4) | Implementação tranche a tranche (writer/reader de runtime) |
| [ADR-BASE-19](ADR-BASE-19-budget-send-legacy-exception.md) | Exceção permanente: send legado de orçamentos fora de Action | ✅ Documentado (exceção) | Extinção bloqueada até decisão de produto |
| [ADR-BASE-20](ADR-BASE-20-action-contracts-deny-audit.md) | Contratos de Action: DENY absoluto, ok/unknown e auditoria fail-closed | ✅ Implementado (tranche E3) | Nenhum |
| [ADR-BASE-21](ADR-BASE-21-contabo-postgres-private-connectivity.md) | Conectividade privada do PostgreSQL (Contabo): no-go da exposição `0.0.0.0:15433`; destino Tunnel + Access | 🟡 Proposta condicional — **não implementada** | Gates pendentes de autorização no caminho único D3 → D4 (D3 verificado ativo é pré-requisito do corte; G1–G5 na ordem; Fase 2 do corte em produção em janela de produção autorizada separadamente; exposição atual NO-GO até o corte); Workers VPC só após gates conta/plano/TLS |
| [ADR-LLM-01](adr-llm-embedding.md) | Escolha de LLM Provider, Modelo de Embedding e Dimensão pgvector | ✅ Implementado | Nenhum |

## Gates

> Estado herdado do inventário de 2026-09-14; os números abaixo **não foram
> reexecutados** desde então (a atualização de 2026-10-10 cobriu apenas o índice de ADRs).

| Gate | Meta | Atual |
|---|---|---|
| Lint | zero erro | ✅ zero |
| Typecheck | zero erro | ✅ zero |
| Test suites | 100% verde | ✅ 201/201 |
| Coverage | ≥80% | 🟡 53% (floor previne regressão) |
| Contract tests | HTTP passando | ✅ 17/17 + boundary 8/8 |
| ADRs documentados | 22/22 | ✅ todos no índice (BASE-21 é proposta condicional, não implementada) |

## Coverage Roadmap

A meta de 80% é aspiracional e requer campanha dedicada. Estratégia:
1. **Floor atual (53%)**: previne regressão — todo PR mantém ou sobe
2. **Domínios prioritários**: auth, RBAC, Actions, financeiro (mutation testing ≥70%)
3. **Dead code removal**: serviços em `src/services/` com 0% coverage que não são usados
4. **Meta intermediária**: 65% (Q3 2026), 80% (pré-piloto)
