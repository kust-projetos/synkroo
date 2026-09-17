# Relatório de Progresso — Hardening, Reliability & Scale v1.0 (2026-09-17)

> Execução do plano `docs/superpowers/specs/2026-09-17-hardening-reliability-scale-v1-plano.md`.
> Range: `73754a9..cc49648d` (20 commits por domínio). Execução orquestrada multi-agente
> (explorers → coders por domínio → reviewer independente, 5 rounds, veredito final **APPROVED**).

## Estado final dos gates

| Gate | Resultado |
|---|---|
| `npm run lint` | PASS (`--max-warnings=0`) |
| `npm run typecheck` | PASS (+ typecheck:ia-agent) |
| `npm test` (unit) | **362 suites / 2700 testes** (2695 passed, 5 skipped) |
| `npm run test:integration:run` | **57 suites / 302 testes — PASS** (runner isolado loopback) |
| `npm run build` | PASS |
| Gitleaks (pre-commit local + CI action pinada) | PASS em todos os commits |

## Implementado (por etapa)

- **0 — Baseline:** `docs/audit/hardening-v2-baseline.md` (gates medidos em `73754a9`); drift documental resolvido (contagens manuais removidas de README/AGENTS — SYN-DOC-001/002/003; link `ADR-INDEX.md` corrigido); `@neondatabase/serverless` removida após verificação de órfão; env validation com teste existente cobrindo fail-fast.
- **1 — Cache:** factory completada (`treatmentPlans`/`treatmentPlan`/`financialSummary`); helper `invalidateAppointmentChanged` (coleção + detalhe + calendário + dashboard, tenant-scoped, fail-closed sem clínica); RescheduleDialog invalida tudo; `useUpdateSession` recebe `patient_id` do handler (server-derived) e invalida `financial-summary` por paciente; SYN-CACHE-003 registrada como decisão (comentário). Gate de query keys permanece verde.
- **2 — Contratos:** teste negativo de reatribuição `patientId` cross-tenant (404, byte-identical) + snake `patient_id` stripado (HTTP real, 2 clínicas); `change-password` no helper canônico `apiRateLimited`; `handleApiError`/`RateLimitError` com `@deprecated`; **2.5:** auditoria Zod de 35 rotas candidatas — 31 cobertas pelo gate central, 3 gaps corrigidos (`noshow-prediction`, `ia/chat`, `widget/session`), 1 exceção deliberada documentada (`docs/audit/runtime-schema-audit.md`).
- **3 — Multi-tenancy:** matriz em `docs/audit/tenant-resource-matrix.md`; suíte negativa nova em 8 domínios (26 casos HTTP real: 404/401/403, DB intacto) + membership (sem sessão/malformada/removida). **Zero vazamento real encontrado.** Gap sem vazamento registrado: obter/atualizar dentista/procedimento retorna `data:null` (não 404 opaco) — decisão de contrato pendente.
- **4 — Integridade/concorrência:** corridas reais de remarcação (2 moveSlot no mesmo slot → 1 vencedor + `23P01`) e create-vs-move; idempotency-key em criação de appointment e pagamento (`withIdempotency` + fingerprint + `result_ref` — migrations 0032/0033 aditivas; replay por ID tenant-scoped, mismatch → 409 `CONFLICT`, fail-closed sem binding); update de appointment + last_visit em transação (repo-owns-tx); cancel/waitlist best-effort documentado como exceção; 6 testes novos de timezone (meia-noite, DST NY, SP sem DST, user≠clinic tz).
- **5 — Financeiro:** `money.ts` (centavos exatos, half-up); budget/installment/charge em aritmética de centavos com teste-first (16 casos); regra nova: `unitPrice` quantizado a centavos na entrada (preço × qtd == total exato); audit fields ADR-BASE-12 estendidos para agendar/cancelar/remarcar/atualizar consulta e atualizar-orçamento/registrar-pagamento (telemetria de reatribuição de patientId incluída — SYN-API-002).
- **6 — Webhooks:** replay determinístico de Evolution provado; inventário de integrações em `docs/audit/integrations-inventory.md` (auth/timeout/retry/dedup por provider, com dívidas registradas).
- **7 — CI/supply chain:** checkout/setup-node/gitleaks-action pinados por SHA; gitleaks via action oficial (fim do curl|tar); Dependabot (npm + github-actions, majors separados, sem auto-merge); E2E production verificado **bloqueante** (decisão 7.6 superada — `docs/ops/ci-supply-chain.md`).
- **8 — Migrations:** job `migrations-from-zero` (banco vazio → migrate 2× idempotente → smoke de tabelas-chave); política expand/contract + proibição de contract em produção (`docs/audit/migrations-policy.md`); inventário: nenhuma destrutiva pendente.
- **9 — DR:** `docs/runbooks/database-recovery.md` (RPO/RTO propostos, restore-test com checklist, 4 cenários, rotação de credenciais); primeiro restore real **PENDENTE-RUNTIME**.
- **10 — Rate limiting/runtime:** limiting adicionado a login, signup, messages/send, ia/chat, knowledge/search, lgpd/export (claims anteriores do AGENTS eram falsos — corrigidos); limitação in-memory documentada com gatilho de migração para DO/KV (`docs/ops/rate-limiting.md`); checklist de runtime CF (`docs/ops/cloudflare-runtime-checklist.md`).
- **11 — Observabilidade:** `redactLogValue`/`SENSITIVE_LOG_KEYS` exportados + 14 chaves PII/LGPD; worker edge coberto (evento estruturado sem PII); contrato requestId documentado (`docs/ops/observability.md`) com inventário de métricas/alertas.
- **12 — IA/LGPD:** evals offline da camada de decisão (23 casos em 8 categorias — injection, cross-tenant, financeiro, refusal, dangerous mutation; zero chamada a LLM); `docs/lgpd/data-inventory.md` (11 categorias, retenção marcada "A DEFINIR — jurídico").
- **13 — FE/a11y:** CollectionTab/BudgetTab com pending/error/success (useMutation + toasts + invalidação pela factory); `src/app/dashboard/error.tsx`; aria-busy/aria-live nos dialogs de calendário; `e2e/accessibility-axe.spec.ts` com guarda (dep `@axe-core/playwright` instalada; execução real no CI).
- **14 — Auditoria final:** reviewer independente, 5 rounds (R1: 2 majors + 2 minors; R2: 2 majors + 1 minor; R3: 1 major + 1 minor; R4: 1 low; R5: **APPROVED**). Todos os majors/minors resolvidos com commits de fix.

## Problemas encontrados adicionalmente

- Claims falsos de segurança no AGENTS.md: login e messages/send **não tinham** rate limiting (documentado como tendo).
- `budget-service` aceitava preço com 3 decimais gerando total inconsistente com `numeric(10,2)`.
- `concurrency-dedup.integration.test.ts` com select sem escopo de clínica + resíduo de runs crashados (falha só com banco persistente poluído).
- `EXPECTED_MIGRATIONS` do readiness precisou acompanhar as migrations novas (gate funcionou como projetado).
- Pre-commit hook exigia binário gitleaks local (instalado 8.24.0, mesma versão do CI).
- `gitleaks-action` v2 exige `GITLEAKS_LICENSE` em repositórios de organização — monitorar primeiro run no CI.

## Problemas resolvidos

Ver "Implementado" — todos os itens CONFIRMADO/CANDIDATO executáveis estaticamente foram corrigidos ou provados por teste; todos os majors/minors dos 5 rounds de review foram fechados.

## Problemas adiados (com registro)

- Floats legados em `src/services/*` (reports/installments/payments/budgets legacy, `obter-dashboard`, `dispatch-charge-job`) — sem teste provando erro; registrados em `docs/audit/integrations-inventory.md` §3.
- Contrato `data:null` vs 404 opaco em dentistas/procedimentos (sem vazamento; decisão de API).
- Rate limiter distribuído (DO/KV) — decisão + gatilho documentados; in-memory aceito hoje.
- Charge-service sem fingerprint (chave determinística por budget; reuso legítimo — follow-up opcional).
- `useRecordPayment` sem UI; form de criar/editar orçamento não existe no frontend.
- lacunas menores de rate limit documentadas (`lgpd/anonymize`, alguns cron/*, `[...nextauth]`).

## Testes adicionados (síntese)

~90 testes novos no período: suíte tenant-negativa (26), idempotência appointments/payments (13, incl. corridas reais e mismatches 409), corridas de remarcação (2), money-precision (16), audit-fields (4), replay Evolution (1), timezone (6), evals IA (25), logger PII (2), rate limiting (novos casos 429 em 7 rotas), zod gaps (3+), FE financeiro (3), fail-closed helper (2), a11y spec (CI).

## Riscos restantes

- **PENDENTE-RUNTIME** (exigem ambiente real, fora do escopo estático): validação Cloudflare/Hyperdrive sob carga; teste de restore com backup de produção; compatibilidade de rollout entre versões adjacentes na janela de deploy; verde do axe/E2E no CI; comportamento do gitleaks-action em repo de organização.
- Retenção de dados LGPD: decisão jurídica pendente (marcada no inventário).
- Flakiness observado 1× sob contenção extrema de CPU (lgpd t3 com npm test paralelo) — passou isolado e no runner.

## Próxima fase

1. Acompanhar primeiro run do CI (gitleaks-action, migrations-from-zero, Dependabot).
2. Executar checklist de runtime Cloudflare + primeiro restore test (runbooks prontos).
3. Decidir contrato `data:null`→404 e retenção LGPD com owners.
4. Drenar floats legados de `src/services/*` guiado por testes.
