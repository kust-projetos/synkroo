# Synkroo Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar achados da auditoria de 2026-08-03 e produzir evidência de Go/No-Go.

**Architecture:** Execução serial por ondas de risco. App deriva tenant de contexto confiável;
webhooks usam instalação do provider; efeitos externos usam inbox/outbox PostgreSQL e idempotência
atômica. Cada onda começa RED, termina com gate completo e commit revisável.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, NextAuth v4, PostgreSQL 17, Drizzle,
Jest, Playwright, Stryker, OpenNext, Cloudflare Workers.

**Agent Orchestration:** Supervisor-Workers — supervisor serializa ondas; workers atuam em tarefas
independentes dentro da onda; reviewer AppSec aprova cada gate.

**Spec:** `docs/superpowers/specs/2026-08-03-auditoria-remediacao-completa-design.md`

---

## 1. Contexto

Baseline auditado: `13e688405578007c5f63ddc7ee4b42852eb5231a`. Lint, typecheck, unit,
integração, security suite e build passaram. E2E terminou com 60 passes, 20 falhas e 171 não
executados. Cinco bloqueadores P0: cross-clinic, tenant de webhook, replay Asaas, revogação
privilegiada e PII em audit logs.

## 2. Stack

| Camada | Versão | Motivo |
|---|---|---|
| Next.js/React | 15/19 | base atual; sem migração |
| NextAuth | 4.24 | autoridade canônica de sessão |
| PostgreSQL/Drizzle | 17/0.45 | constraints, inbox/outbox, integração real |
| Jest/Playwright | 29/1.59 | regressão unit/integration/E2E |
| Stryker | 8.7 | mutação de regras críticas |
| OpenNext/Wrangler | 1.19/4.101 | runtime e dry-run Cloudflare |

## 3. Arquitetura

```text
src/
├── app/api/                 # transporte; sem regra de negócio
├── core/actions/            # auth, RBAC, manifesto, audit allowlist
├── lib/auth/                # NextAuth único + validação de revogação
├── lib/idempotency/         # claim atômico
├── lib/db/schema/infra.ts   # inbox, outbox, idempotency
├── modules/operacional/     # confirmação tenant-scoped
├── modules/financeiro/      # cobrança, webhook, conciliação
├── services/followup/       # campanha agendada/idempotente
└── components/              # correções UX focadas
```

Boundary rules:

1. Payload não escolhe tenant.
2. Evento externo só vira `processed` após commit do domínio.
3. Efeito externo nasce na mesma transação que cria outbox.
4. Audit persiste metadata allowlisted.
5. Migration aplicada nunca é editada.

## 4. Planos executáveis

| Ordem | Plano | Dependência | Saída |
|---:|---|---|---|
| 0–1 | `2026-08-03-audit-remediation-w01-security.md` | baseline | cinco P0 fechados |
| 2 | `2026-08-03-audit-remediation-w02-auth-idempotency.md` | P0 verde | auth/side effects seguros |
| 3 | `2026-08-03-audit-remediation-w03-hardening.md` | schema W2 | hardening estrutural |
| 4 | `2026-08-03-audit-remediation-w04-product-e2e.md` | APIs estáveis | UX/E2E verdes |
| 5 | `2026-08-03-audit-remediation-w05-release.md` | W1–W4 | Go/No-Go |

## 5. Dependências

```text
W0 baseline
  └─> W1 tenancy/webhooks/audit
        └─> W2 auth/idempotency/outbox
              └─> W3 hardening/schema
                    └─> W4 UI/E2E/docs
                          └─> W5 Cloudflare/release
```

Nenhuma onda posterior pode reclassificar falha anterior. Hotfix P0 usa branch isolada e repete
gates da onda afetada.

## 6. Milestones

| Milestone | Dias | Entregáveis |
|---|---:|---|
| M0 Evidência | 1–2 | ledger, fixtures, testes RED |
| M1 P0 | 4–6 | tenancy, webhooks, revogação, audit |
| M2 Plataforma | 6–9 | NextAuth único, claim, outbox, replay |
| M3 Hardening | 4–6 | headers, CSV, consent, embeddings, deps |
| M4 Produto | 5–8 | rotas, KPIs, mobile, a11y, E2E |
| M5 Release | 2–3 | Cloudflare, staging, rollback, decisão |

Estimativa: 22–34 dias para uma pessoa-equipe.

## 7. Protocolo por tarefa

- [ ] Criar teste RED que reproduz achado.
- [ ] Executar teste isolado e registrar falha esperada no ledger.
- [ ] Implementar mudança mínima.
- [ ] Executar teste isolado até GREEN.
- [ ] Refatorar sem aumentar complexidade ou duplicação.
- [ ] Executar gate local da tarefa.
- [ ] Atualizar ledger com comando e resultado.
- [ ] Commitar somente capability e testes correspondentes.

## 8. Gates de onda

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:integration
npm run test:security
npm run build
```

W4 adiciona duas execuções consecutivas:

```bash
npm run test:e2e
npm run test:e2e
```

W5 adiciona:

```bash
npm audit --omit=dev --audit-level=high
gitleaks detect --source . --no-banner --redact --log-opts='--all'
wsl npx opennextjs-cloudflare build
wsl npx wrangler deploy --dry-run --config wrangler.toml
```

## 9. Rastreabilidade da spec

| Requisito | Plano/tarefa |
|---|---|
| REM-01–02 | W01 Task 2 |
| REM-03 | W01 Task 3 |
| REM-04 | W01 Task 4 |
| REM-05 | W01 Task 5; W02 Tasks 1–3 |
| REM-06 | W01 Task 6 |
| REM-07–08 | W02 Tasks 4–7 |
| REM-09 | W02 Task 7 |
| REM-10 | W02 Task 3 |
| REM-11 | W03 Task 3 |
| REM-12 | W04 Task 2 |
| REM-13 | W04 Tasks 3–5 |
| REM-14 | W04 Tasks 6–7 |
| REM-15 | W05 Tasks 6–7 |

## 10. Testes

| Tipo | Ferramenta | Cobertura | Escopo |
|---|---|---:|---|
| Unit RED-first | Jest | ≥80% novo | policies, states, serializers |
| Integration | Jest/PostgreSQL | caminhos críticos | tenancy, constraints, races |
| Contract | Jest/Zod/MSW | todos providers tocados | Asaas, Evolution, embeddings |
| Mutation | Stryker | ≥70% | auth, audit, idempotency |
| Snapshot | RTL | somente UI alterada | vazio, zero, erro, mobile |
| E2E | Playwright | jornadas críticas | auth, agenda, CRM, FUP, FIN |

## 11. Trade-offs

| Decisão | Razão | Rejeitado |
|---|---|---|
| ondas seriais | reduz blast radius | trilhas amplas paralelas |
| inbox/outbox PostgreSQL | atomicidade local | chamada externa na transaction |
| NextAuth único | elimina cookies divergentes | auth manual permanente |
| UI focada | corrige auditoria | redesign total |
| docs por evidência | impede fechamento fictício | status por intenção |

## 12. Definition of Done

- [ ] Todos os REM-01..REM-15 ligados a teste verde.
- [ ] Zero P0/P1 aberto ou rebaixado sem evidência.
- [ ] Gates estáticos, unitários, integração, segurança e build verdes.
- [ ] E2E completo verde duas vezes; sem setup vazio, catch ou skip silencioso.
- [ ] Zero high/critical em dependência de produção.
- [ ] Cloudflare build, dry-run, staging smoke e rollback comprovados.
- [ ] ADRs, plano mestre e ledger refletem estado real.
- [ ] Reviewer correctness + AppSec aprova diff final.
