# P0 Baseline — vNext AI-Native Business OS

**Data:** 2026-10-05
**Tranche:** P0 — Baseline (`docs/superpowers/plans/2026-10-05-synkroo-vnext-ai-native-business-os-implementation.md` §2)
**Issue:** #23
**Método:** auditoria read-only por 3 exploradores independentes (capacidades, actions, dívida), verificada por leitura direta de arquivo/linha — não por grep solto nem por confiança na documentação.
**HEAD auditado:** `39b7feb7` (main, 2026-10-05)

## 1. Posição no roadmap

```text
P0 — Baseline          ← ESTA TRANCHE (documental + 4 defeitos de confiança em PR irmão)
P1 — Infra provider-neutral   (SYNKROO_VPS_ENV; 3 scripts já mapeados)
P2 — Hostinger → Contabo      (runbook pronto; Contabo já com bootstrap/hardening)
P3 — Evolution → WAHA         (ADR-BASE-08 já supersedado; adapter pendente)
P4+ — AI Control Plane ...
```

A direção vNext está documentada e coerente (spec, plan, runbook, ADR-BASE-08, README, vps-access).
O código atual é a verdade operacional. Nada do vNext deve ser tratado como implementado.

## 2. Matriz consolidada de gaps

| # | Item | Estado | Evidência principal | Gap | Próxima ação (tranche) |
|---|---|---|---|---|---|
| 1 | Core/RBAC | IMPLEMENTADO | `src/modules/core/**`, `src/core/rbac/**` | `/api/auth/login` stub 404; sem API de roles | nenhum para vNext |
| 2 | Atendimento | IMPLEMENTADO | `src/modules/atendimento/**` + 21 actions | 3 componentes WhatsApp órfãos | P6/P8 (limpeza) |
| 3 | CRM | PARCIAL | `src/modules/crm/**` | contatos read-only por contrato (405 `crm_mvp_read_only`); `contact-create-dialog` quebrado | decisão de produto antes de P6 |
| 4 | Comercial | IMPLEMENTADO | `src/modules/comercial/**` + 28 actions | `crm/pipeline` faz POST ad-hoc | P2/P8 |
| 5 | Agenda/Operacional | PARCIAL | 32 actions, `src/modules/operacional/**` | treatment-plans sem UI; reminders/config sem UI | P6/P8 |
| 6 | Follow-up/Reativação | PARCIAL | `src/modules/followup/**` + 11 actions | `/dashboard/followup` é stub | P7 (Journey Engine) |
| 7 | Campanhas | PARCIAL | dupla camada service↔action | fora do action registry (IA não alcança) — CORRETO por enquanto | P5/P6 |
| 8 | Financeiro | IMPLEMENTADO | 22 actions + gateways + Asaas | strangler `/api/budgets/*` sem consumidor | P1/P2 (dreno) |
| 9 | IA | PARCIAL | DO + bridge + evals offline | `pending_actions`/`decision_logs` sem writer; `src/lib/llm/*` morto | P4 |
| 10 | Knowledge/RAG | PARCIAL | pgvector + embeddings | **agente não consulta a RAG** (`orchestrator-logic.ts` não importa rag.service) | P4 |
| 11 | Analytics | PARCIAL | 4 services + rotas | 3 dashboards órfãos; alerts sem UI; **fake data** (ver §3) | P0-fix + P8 |
| 12 | LGPD | PARCIAL | registry fail-closed | diálogos export/anonymize órfãos (API-only) | P8 |
| 13 | WhatsApp | IMPLEMENTADO | Evolution v2.3.7 + channel-service | duas trilhas de webhook sem fonte canônica; wire-format fora do módulo | P3 |
| 14 | Instagram | PARCIAL | webhook HMAC + Meta Graph | onboarding self-service ausente (botão disabled) | P9 |
| 15 | Jobs/cron | IMPLEMENTADO | 7/8 jobs ativos | `smart-triggers` 410 + fora do schedule (capacidade morta) | P4 (reconciliar) |
| 16 | Queues | PARCIAL | outbox Postgres robusto | **Cloudflare Queues ausente**; `agent_queue`/`agent_dlq` sem writer | P4 (decidir outbox vs Queues) |
| 17 | Workers | IMPLEMENTADO | DO + bridge RPC + service bindings | Agents SDK não usado (DO cru, limitação cross-worker documentada) | nenhum (ADR-BASE-07) |
| 18 | Dashboard | PARCIAL | stats + alerts API | painel passivo; alerts sem consumidor | P8 (Control Center) |

## 3. Defeitos de confiança descobertos (P0-fix, PR irmão #25 — STATUS DEPENDENCY-AWARE)

> Legenda: `CORRIGIDO NO BRANCH/PR` = fix existe no branch `fix/p0-trust-defects-2026-10-05` (PR #25) mas **NÃO está na `main`**; `MERGEADO NA MAIN` = presente no HEAD da `main`; `PENDENTE` = sem fix; `VALIDADO` = na `main` + gates verdes + revalidação. **O P0 NÃO está concluído enquanto o PR #25 estiver aberto, houver thread crítica aberta ou CI obrigatório vermelho.**

Estes quatro defeitos impedem a "visão confiável" que o P0 exige. Status em 2026-10-06: **CORRIGIDOS NO BRANCH/PR #25, PENDENTES DE MERGE NA MAIN, NÃO VALIDADOS**:

| # | Defeito | Status | Evidência do fix (branch/PR #25) |
|---|---|---|---|
| 1 | IDOR cross-tenant com PHI no POST noshow-prediction | CORRIGIDO NO BRANCH/PR #25 — PENDENTE MERGE/VALIDAÇÃO NA MAIN | `noshow-prediction/route.ts:79` (clinicId do auth) + `service.ts:174` (`and(eq(id),eq(clinicId))`) + 404 opaco |
| 2 | Risk score fabricado (paciente inexistente/erro DB) | CORRIGIDO NO BRANCH/PR #25 — PENDENTE MERGE/VALIDAÇÃO NA MAIN | service retorna `null` → 404; catch fail-closed com rethrow |
| 3 | Enum inválido `'pending' as any` em alerts | CORRIGIDO NO BRANCH/PR #25 — PENDENTE MERGE/VALIDAÇÃO NA MAIN (+ pendência adicional §3.1) | `alerts.ts:139` → `'scheduled'`; `as any` removido |
| 4 | `atRiskRevenue: 0` hardcoded | CORRIGIDO NO BRANCH/PR #25 — PENDENTE MERGE/VALIDAÇÃO NA MAIN (+ pendência adicional §3.2) | `patients/inactive/route.ts:89` via `getInactivityStats(ctx.clinicId)`; DB failure → 500 |

### 3.1 Pendência adicional P0 (review PR #25): soft-delete em alerts

A query reativada em `alerts.ts` não exclui `deletedAt != null` (soft-delete só marca `deletedAt`, mantém `status='scheduled'`). **PENDENTE** — fix exigido: mesmo predicado `deletedAt IS NULL` das queries de `dashboard/stats.ts`.

### 3.2 Pendência adicional P0 (review PR #25): overcount cumulativo de receita

`getInactivityStats` define buckets cumulativos e soma os 4 → paciente 180d contado 4x. **PENDENTE** — fix exigido: buckets mutuamente exclusivos OU receita do conjunto distinto `inactive_30`.

Detalhe original dos quatro defeitos (para auditoria):

1. **IDOR cross-tenant com PHI** — `POST /api/analytics/noshow-prediction` nunca lia `clinicId` do contexto de auth; qualquer usuário autenticado de qualquer clínica lia nome + risco de paciente de outro tenant. O `GET` da mesma rota estava correto, provando defeito e não política. (`noshow-prediction/route.ts:61-78`, `noshow-prediction.service.ts:169`)
2. **Risk score fabricado** — paciente inexistente recebia `risk_score: 40` + fatores inventados como se computados. Agora retorna 404. (`noshow-prediction.service.ts:171-185`)
3. **Enum inválido `'pending' as any`** — alerta de agendamentos não-confirmados retornava zero há meses; segundo incidente do mesmo bug documentado no AGENTS.md (o `as any` derrotou o typecheck). Corrigido para `'scheduled'`, alinhado ao fix canônico de `dashboard/stats.ts`. (`api-handlers/dashboard/alerts.ts:137`)
4. **`atRiskRevenue: 0` hardcoded** — stats de inativos reportavam receita em risco literalmente zero. (`patients/inactive/route.ts:87`)

## 4. Achados estruturais que orientam P1–P4

1. **Allowlist do agente (8 actions, todas `operacional.*`) está correta e congelada.** Política: `AUTO`/`CONFIRM` proposta por action em `2026-10-05-vnext-p0-action-inventory.md`; nenhuma promoção de autonomia antes do Policy Engine (P5). Escala real hoje é `SecurityLevel` (`livre|confirmacao|verificacao_forte|proibido`), deny-by-default — não R0–R3.
2. **Scaffold morto de risco/aprovação**: `pending_actions`/`decision_logs` têm colunas ricas (`riskScore`, `undoPayload`, `approval`…) mas **nenhum writer em runtime**; confirmação viva vive no DO storage. P4 deve reutilizar/ migrar conscientemente — nunca "ligar" sem gate.
3. **Dois bypasses latentes do allowlist**: `agentToolsFor` (`src/core/actions/agent.ts:25`) e `buildToolCatalog` (`tool-catalog.ts:60`) filtram só por RBAC, sem `isAgentSafeAction`. Sem consumidor em produção hoje; devem exigir o gate antes de qualquer uso (P4/P5).
4. **Dívida de tenant-scope é problema de API dupla**: o padrão correto (`findByIdScoped`) já existe; a variante sem guarda mantém o nome default e fica exportada (`repositories/patients/index.ts:48,329,360`).
5. **Silent failure (`catch → 0/[]`) é a classe dominante de risco de corretude** — analytics, ROI, dashboard, followup, contacts. Zero marcadores TODO/FIXME em produção: a dívida é invisível no próprio arquivo.
6. **`src/modules/*` é autoritativo** (gate eslint services→modules); 11 pares duplicados mapeados no register, incluindo divergência real de `validateTemplate` em 3 implementações.
7. **3 scripts hardcodam `../vps-hostinger/.env`** (`migrate-vps.ts:41`, `update-hyperdrive.ts:14`, `setup-staging-db.ts:14,30` — este último ESCREVE no caminho) — exatamente o escopo P1 (`SYNKROO_VPS_ENV`).

## 5. Documentação reconciliada nesta tranche

- `MANUAL-ADMINISTRACAO.md` — removida a afirmação falsa de backup automático pelo Supabase (mecanismo real: `scripts/db-backup.mjs` + `docs/runbooks/database-recovery.md`).
- `MVP-CHECKLIST.md`, `CONFIGURACAO-LEMBRETES.md`, `docs/security/credential-inventory.md` — marcados como históricos nos pontos que descrevem Supabase como stack atual.
- `docs/planning/*` (technical-research, prd, product-brief, e-01-stories) — marcados como históricos nos pontos Claude SDK / Supabase-only; runtime real é multi-provider (`src/lib/llm/`) + `core/ia-agent/provider-zen.ts`.
- `AGENTS.md` — tabela de módulos API corrigida (7 módulos listados não existiam como rotas; 36 diretórios reais mapeados).
- Novo `docs/adr/ADR-VNEXT-01-ai-control-plane.md`.

## 6. Próximas tranches

1. **P1**: `SYNKROO_VPS_ENV` nos 3 scripts (+ deduplicar `loadVpsEnv`), deprecation do fallback legado, sem renomear secrets de runtime Cloudflare.
2. **P2**: inventário Hostinger remoto (runbook §3) + fundação Contabo + restore rehearsal. Não executar cutover de DB e WhatsApp na mesma janela.
3. **P3.1**: `WhatsAppProviderAdapter` + registry; `channel-service` para de importar Evolution; wire-format de webhook migra para dentro do módulo.
4. **P4**: AI Control Plane conforme ADR-VNEXT-01, reutilizando `pending_actions`/`decision_logs`/outbox; fechar bypasses `agentToolsFor`/`buildToolCatalog`; wiring RAG no orchestrator.

## Artefatos desta tranche

- `2026-10-05-vnext-p0-capability-inventory.md` — 18 capacidades, cadeia completa por domínio.
- `2026-10-05-vnext-p0-action-inventory.md` — 144 actions, allowlist, fluxo de política, classificação proposta.
- `2026-10-05-vnext-p0-debt-register.md` — registro de dívida com severidade e tranche sugerida.
