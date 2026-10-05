# P0 — Registro de Dívida Arquitetural (Synkroo vNext)

**Data:** 2026-10-05 · **Issue:** #23 · **Método:** grep + leitura direta de cada item citado. Severidade = impacto no baseline vNext.
**Destaque:** as categorias temidas (acoplamento Evolution, residue Claude SDK, residue Supabase de runtime, UI→provider, regra de negócio em rota) estão **bem contidas** — rendem itens P1–P3. O conjunto P0 real é mais estreito e mais nítido (§10).

## 1. Residue Supabase

**Runtime CLEAN** — zero deps `@supabase/*`, zero `supabase.from`/`.rpc(` em `src/`, zero chaves `SUPABASE_*` em `src/lib/env.ts:9-53`, CI clean. Residue é documental + scaffold de teste morto:

- `src/__tests__/api/auth/auth.mocks.ts:51-52` — `createMockSupabaseClient()` emulando "Supabase SSR"; consumido só por README de teste. (baixa) — P2
- `src/services/contacts/contacts.service.ts:9-12` — casts `as any` porque "patients Drizzle não tem status/active que existiam no Supabase"; possível drift real schema-DB. (alta) — P1
- `src/services/followup/followup.service.ts:422-433` — resposta "matching Supabase relational shape" congelada no contrato. (média) — P2
- `src/repositories/appointments/index.ts:538` — comentário citando RPC Supabase aposentado. (baixa) — P3

**Docs tratando Supabase como verdade atual** (corrigidos nesta tranche, marcados históricos):

- `docs/MANUAL-ADMINISTRACAO.md:153-158` — afirmava backup automático diário pelo Supabase (falso desde a remoção; mecanismo real: `scripts/db-backup.mjs` + recovery runbook). **(alta — direção errada de operador)** — corrigido P0
- `docs/MVP-CHECKLIST.md:14-15,127`, `docs/CONFIGURACAO-LEMBRETES.md:21`, `docs/security/credential-inventory.md:44-45` — marcados históricos P0.

## 2. Acoplamento Evolution API

Contido melhor que o esperado; seams existem e são usados:

- `src/lib/whatsapp/send.ts` — forwarder limpo; consumers (budgets, reminders, lead-notification) não tocam Evolution. **Sem ação.**
- `src/modules/atendimento/services/channel-service.ts:50` — seleção por env dentro do módulo dono. **Sem ação.**
- `src/app/api/whatsapp/evolution/route.ts:13-58` — **wire-format parseado na rota** (`normalizeEvolutionGoMessage`, `extractPhone/@lid`, `extractContent`, filtro de eventos, descarte `fromMe`): reimplementa o contrato do provider fora de `evolution-service.ts`; um segundo provider (WAHA) exigiria fork da rota. (média) — **P3.1**
- `src/app/api/whatsapp/evolution/route.ts:68-119` + `channel-service` — literal `'evolution'` como discriminador `provider` em linhas do banco (lock-in de dado; migração exigirá pass de mapeamento). (média) — P3
- `src/lib/env.ts:38-40` — `EVOLUTION_*` no contrato de env (referência global inevitável até cleanup pós-cutover). (baixa) — P3.8
- `src/app/page.tsx:258`, `src/app/dashboard/configuracoes/page.tsx:599` — nome do vendor em copy/UI. (baixa) — P2

UI: **zero** componentes chamando endpoints Evolution diretamente (verificado por grep exaustivo).

## 3. Hardcoding de nome de provider (`vps-hostinger`)

Bloqueador único e mais acionável do alvo `SYNKROO_VPS_ENV` — é **código**, não docs:

- `scripts/migrate-vps.ts:41` (+ mensagens :105-137) — caminho hardcoded. (alta) — **P1**
- `scripts/update-hyperdrive.ts:14` (+ :70-87) — idem; muta config **de produção** Hyperdrive. (alta) — **P1**
- `scripts/setup-staging-db.ts:14,30` (+ `updateVpsEnv()` :29-67) — idem; **ESCREVE** no `.env` nomeado por provider (rotaciona `VPS_STAGING_PASSWORD`). (alta) — **P1**
- 3 implementações byte-idênticas de `loadVpsEnv()` — duplicação garante que os 3 precisam ser corrigidos juntos. (média) — P1
- `SYNKROO_VPS_ENV` existe só como plano (`vps-access.md:7`, plano vNext :44). (alta) — **P1**
- Docs-only (sem impacto em código): `vps-access.md`, `w11-rollout-runbook.md:15`, `cloudflare-runtime-checklist.md:95`.
- CLEAN: `package.json`, `.github/workflows/`, `ops/vps/whatsapp-sidecar/package.json`.

## 4. Residue Claude SDK

**Runtime CLEAN** — zero `@anthropic-ai/sdk`/`claude-agent-sdk` em `src/`. Factory multi-provider (`src/lib/llm/`) é o único ponto LLM app-side. Residue:

- `src/lib/llm/providers/openrouter.ts:8` — `OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'` (modelo de 2024, defasado). (média) — P1
- `docs/planning/technical-research.md:11,39,75`, `docs/planning/prd.md:2299-2300,2491`, `docs/planning/product-brief.md:628`, `docs/planning/stories/e-01-stories.md:168,173,665` — Claude SDK/`@anthropic-ai/sdk` como stack do MVP. **Marcados históricos P0.**
- `docs/planning/epics.md:149-151` — já tem nota corretiva. **Sem ação.**
- Nota: o LLM vivo do agente é `core/ia-agent/provider-zen.ts` (fora da factory) — reconciliar em P4 (uma fonte canônica de provider LLM).

## 5. Duplicação `src/services` vs `src/modules`

**Regra de autoridade (verificada):** `eslint.config.mjs:50-74` — services não importam modules exceto seams (`index.ts`, `public.ts`, `schema/**`). **`src/modules/*` é autoritativo.**

| Service legado | Contraparte no módulo | Evidência |
|---|---|---|
| `services/payments/payment.service.ts` (234 ln) | `modules/financeiro/services/payment-service.ts` | legacy reimplementa `getSessionCostParts`/`autoCompleteSessions`/`checkAndUpdateBudgetStatus` inline (:53-130) |
| `services/installments/installment.service.ts` (91 ln) | `modules/financeiro/services/installment-service.ts` | legacy :86 chama o módulo de "padrão canônico" |
| `services/budgets/budget.service.ts` | `modules/financeiro/services/budget-service.ts` | par homônimo no mesmo contexto |
| `services/followup/followup.service.ts` (:422 shape Supabase) | `modules/followup/services/followup-service.ts` | ambos fazem join+filter `status='completed'` |
| `services/followup/campaign.service.ts` | `modules/followup/services/campaign-service.ts` | par homônimo |
| `services/followup/budget-followup.service.ts:20` | `modules/followup/services/budget-followup-service.ts` | `findUnconvertedBudgets` duplicado; legado com catch→`[]` |
| `services/followup/inactive-patient.service.ts` | `modules/followup/services/inactive-service.ts` | par homônimo |
| `services/appointments/incomplete-treatment.service.ts` | `modules/operacional/services/incomplete-treatment-service.ts` | par homônimo |
| `services/appointments/confirmation-handler.service.ts:176,213,319` | `modules/operacional/services/confirmation-service.ts:107,121,177` | **transições de estado byte-idênticas** (`'confirmed' as any`, `'cancelled' as any`) |
| `services/reminders/procedure-reminder-config.service.ts:168` | `modules/operacional/services/procedure-reminder-config-service.ts:102` | **divergente** — ver abaixo |
| `services/contacts/*` | `modules/crm/services/contact-*-service.ts` | CRM tem 13 services; contacts.service é implementação plana paralela |

**Divergência de maior sinal — `validateTemplate` em 3 vias:** services empurra 2 erros por placeholder ruim (:168-190); módulo usa if/else-if e devolve no máx. 1 (:102-111); `components/whatsapp/reminder-config-types.ts:25` tem terceira cópia client com shape diferente. Cliente e servidor podem discordar sobre validade de template de lembrete. (alta) — **P1**

Também duplicados por nome: `services/analytics/*` (4, sem `modules/analytics`); `services/api-handlers/**` (árvore inteira fora de bounded context). (média) — P2

## 6. Regras de negócio em rotas

**Estruturalmente limpo:** zero `route.ts` importa `@/lib/db/client`/schema (grep exaustivo). Ofensores são lógica-na-rota, não SQL-na-rota:

- `api/patients/inactive/route.ts:135-140` — política de segmentação (`inactive_30/60/90/180`) hardcoded no handler, bypass do módulo dono. (alta) — P1
- `api/patients/inactive/route.ts:87` — **`atRiskRevenue: 0` hardcoded** apesar do valor real existir em `getInactivityStats`. (alta) — **corrigido P0**
- `api/patients/inactive/route.ts:119-129` — paginação ilimitada `while(hasMore)` em memória. (média) — P1
- `api/financeiro/webhooks/[provider]/route.ts:37` — `if (provider !== 'asaas') 404` contradiz intent multi-gateway. (média) — P1

## 7. UI → provider direto

**CLEAN.** Nenhum componente importa SDK de provider, db client, repositories ou services para acesso a dados (imports de tipo apenas). Exceção (vazamento de regra, não de provider): `components/whatsapp/template-editor.tsx:5` importa `validateTemplate` do service (puxa DB imports para o bundle client) enquanto o irmão `reminder-config-card.tsx:8` usa a cópia local — **dois irmãos validando contra duas implementações**. (alta) — **P1**

## 8. Silent failure / fake success

O bug histórico `todayAppointments` está **meio-corrigido**: `dashboard/stats.ts:57` usa `'scheduled'` ✓; o mesmo literal inválido sobreviveu um arquivo ao lado:

- `src/services/api-handlers/dashboard/alerts.ts:137` — `eq(appointments.status, 'pending' as any)`; enum real (`enums.ts:8`): scheduled|confirmed|in_progress|completed|cancelled|no_show. Alerta de não-confirmados retorna **zero há meses**. (alta) — **corrigido P0**
- `src/services/analytics/noshow-prediction.service.ts:171-185` — **risk score fabricado** (40/medium + fatores inventados) para paciente inexistente. (alta) — **corrigido P0**
- `src/services/analytics/roi.service.ts:121,135,152` — catch→0 para mensagens IA, agendamentos IA, no-shows recuperados. Erro de DB vira relatório de ROI **0**. Money-path. (alta) — P1
- `src/services/api-handlers/dashboard/stats.ts:69-72,90-93,96-99` — `.catch(→ zeros)` por query: é o padrão de mascaramento que escondeu o bug original. (alta) — P1
- `src/services/analytics/analytics.service.ts` (6× catch→`[]`/0) (média); `budget-followup.service.ts:20` (catch→`[]`, alimenta alerts) (média); `contacts.service.ts:85` (catch→null: not-found ≡ DB down) (média); `patient-tags.service.ts:92-115` (baixa) — P1/P2
- `api/patients/inactive/route.ts:158` — `success: true` mesmo com todas as reativações falhando (`errors` contado). (alta) — P1

Padrão correto a **não mexer**: `financeiro/webhooks/[provider]/route.ts:72-74` `catch {}` deliberado fail-closed em path de auth.

## 9. Tenant scope ausente

**Um vazamento ativo + padrão sistêmico de repositório duplo:**

- `api/analytics/noshow-prediction/route.ts:58-80` — **IDOR cross-tenant ATIVO (PHI)**: POST nunca lê `clinicId`, encaminha `patientId` do body para query unscoped; qualquer usuário autenticado lê nome + risco de paciente de outro tenant. O **GET do mesmo arquivo está correto** (:31,:38) — defeito, não política. (alta/IDOR+PHI) — **corrigido P0**
- `repositories/patients/index.ts:48-74` (`findById` com cpf/phone/email/birthDate sem clinicId), `:329-355` (`update` unscoped), `:360-366` (`softDelete` unscoped) — a variante segura `findByIdScoped` (:186-210) já existe; a dívida é a API dupla com o nome default perigoso. (alta) — P1
- `services/patients/patient-tags.service.ts:84-126` — read-modify-write cross-tenant completo via `findById`+`update` unscoped; **latente** (zero callers de produção). (média) — P2
- `services/patients/patient-history.service.ts:48-53` — obrigação de segurança empurrada ao caller, documentada em comentário; test-only. (média) — P2
- `repositories/knowledge/index.ts:71-165` — find/update/delete por id **sem clinicId**, enquanto o twin RAG (`rag.service.ts:181,267,307`) escopa corretamente — duas vias de acesso com garantias opostas. (alta) — P1
- `services/installments/installment.service.ts:54-76` — writes financeiros **sem clinicId na assinatura**. (alta) — P1
- `services/payments/payment.service.ts:58-128` — `eq(budgets.id,…)`/`eq(treatmentPlans.id,…)` unscoped em writes de dinheiro/sessão. (alta) — P1
- `services/patients/patient-dedup.service.ts:179,215` — **merge** por id sem filtro de clínica (destrutivo). (alta) — P1
- `repositories/campaigns/index.ts:151` (média); `contacts/timeline.service.ts:220` (média); `repositories/memory/index.ts:152` (média) — P2
- `repositories/dentists|procedures` — sem clinicId; prováveis catálogos globais por design — **confirmar** em P1. (baixa) — P3

## 10. TODOs críticos

**Praticamente zero** — 5 hits, nenhum em código de produção. O achado é a própria ausência: **toda a dívida acima está desmarcada** — sem TODO/FIXME, sem `@deprecated`, sem shim nos 11 services duplicados. Invisível para quem lê o arquivo. Recomendação: marcadores greppable (`LEGADO: superseded by modules/X — remove after callers drain`) nos services duplicados. (P1)

## Top-10 priorizado

| # | Item | Evidência | Sev | Tranche |
|---|---|---|---|---|
| 1 | IDOR cross-tenant + PHI no POST noshow-prediction | route:61,76,78 → service:169 | alta | **P0-fix** ✅ |
| 2 | Risk score fabricado p/ paciente inexistente | service:171-185 | alta | **P0-fix** ✅ |
| 3 | Enum `'pending' as any` — alerta sempre vazio (2º incidente do padrão) | alerts.ts:137 vs enums.ts:8 | alta | **P0-fix** ✅ |
| 4 | `atRiskRevenue: 0` hardcoded | inactive/route.ts:87 | alta | **P0-fix** ✅ |
| 5 | Runbook admin afirmava backup Supabase inexistente | MANUAL-ADMINISTRACAO.md:155 | alta | **P0** ✅ (docs) |
| 6 | 3 scripts hardcoded `../vps-hostinger/.env` (1 escrita) | migrate-vps:41, update-hyperdrive:14, setup-staging-db:14,30 | alta | **P1** |
| 7 | Primitivas de repositório de pacientes unscoped (findById/update/softDelete) | patients/index.ts:68,352,365 | alta | P1 |
| 8 | `validateTemplate` divergente em 3 vias | reminder-config service:168 vs module:102 vs types:25 | alta | P1 |
| 9 | catch→0 em money-path (ROI, installments, stats) | roi.service:121,135,152; stats.ts:69-99 | alta | P1 |
| 10 | 11 services duplicados + writes unscoped dentro deles | confirmation-handler ≡ confirmation-service; installment:54-76; payment:58-128 | alta | P1 |

**Temas transversais:** (1) tenant-scope é problema de **API dupla** — o padrão certo existe (`findByIdScoped`), a variante perigosa é que mantém o nome default; (2) **silent failure é a classe dominante de risco de corretude** e não está marcada em lugar nenhum; `as any` sobre coluna de enum derrotou o typecheck 2× — tratar como classe (lint rule), não como fixes pontuais.
