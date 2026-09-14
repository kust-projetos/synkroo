# G4 — Profiling SQL com evidência (EXPLAIN ANALYZE) e índices justificados

Data: 2026-09-14 · Branch: `feat/hardening-g4-sql-indexes` · Etapa G4 do plano de hardening.
DB: PostgreSQL local (container `synkroo-db`, porta 55432), migrations até `0031` aplicadas.

## Ressalva metodológica (importante)

As tabelas-alvo estão **vazias** no banco local (counts = 0 em todas; o seed
`seed-test-clinic` não populou este container — só existe a clínica
`00000000-0000-0000-0000-000000000001`). Com seed pequeno/vazio os tempos
absolutos são minúsculos e irrelevantes. **O critério decisório foi o NÓ do
plano (Seq Scan vs Index/Bitmap Scan), não o tempo.** Seq Scan numa tabela que
crescerá (messages, leads) = candidato; acesso já servido por índice
equivalente = não aplicar. Q2 foi evidenciado via `EXPLAIN` (planejado, sem
`ANALYZE`) por não haver linhas; as demais via `EXPLAIN (ANALYZE, BUFFERS)`.

## Índices pré-existentes (levantamento)

`SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN (...)` retornou:

| Tabela | Índice | Colunas |
|---|---|---|
| appointments | `appointments_clinic_id_id_uniq` | (clinic_id, id) |
| appointments | `appointments_clinic_scheduled_status_idx` (0023) | (clinic_id, scheduled_at, status) |
| appointments | `appointments_no_overlap` (GIST parcial) | (clinic_id, dentist_id, range) |
| budgets | `budgets_clinic_id_id_uniq` | (clinic_id, id) |
| conversations | `conversations_clinic_channel_external_unique` (0026) | (clinic_id, channel, external_id) |
| leads | `leads_clinic_phone_normalized_uniq` (parcial) | (clinic_id, phone_normalized) WHERE normalizado não-vazio |
| messages | `messages_external_provider_event_unique` | (external_provider, external_message_id) |
| patients | `patients_clinic_id_id_uniq` | (clinic_id, id) |
| payment_charges | `payment_charges_clinic_budget_uniq` | (clinic_id, budget_id) |
| payment_charges | `payment_charges_clinic_id_id_uniq` | (clinic_id, id) |

## Resultados por query

### Q1 — conversations por clínica ordenadas
Fonte: `src/modules/atendimento/repositories/conversations-repository.ts:findByClinic`
(L69) — `WHERE clinic_id [+status/channel] ORDER BY last_message_at DESC LIMIT 50`.
N.B.: o código real ordena por `last_message_at`, não `updated_at`.
- Antes: `Bitmap Heap Scan` (via `conversations_clinic_channel_external_unique`,
  prefixo clinic_id) + `Sort` em memória. **Não é Seq Scan.**
- Decisão: **avaliado, NÃO aplicado.** O filtro por clínica já é servido por
  índice; resta um `Sort` que só dói com volume alto por clínica. Reavaliar com
  dados reais; candidato futuro seria `(clinic_id, last_message_at DESC)`.

### Q2 — messages por conversation_id + created_at
Fonte: `conversations-repository.ts:findMessagesByConversation` (L280),
`countMessagesByConversation` (L331), `getLastMessage` (L341),
`getConversationContext` (L360) — todas filtram `messages.conversation_id` com
join de tenant em `conversations` e ordenam por `created_at`.
- Antes: **`Seq Scan on messages`** (`Filter: conversation_id = ...`) — nenhum
  índice em `conversation_id` existia. Condições (a)(b)(c) atendidas.
- Depois (`messages_conversation_created_idx`): `Index Scan` no novo índice +
  `Nested Loop` no `conversations_pkey`; o `Sort` sumiu (índice entrega a ordem
  de `created_at`).
- Decisão: **APLICADO** — `messages(conversation_id, created_at)`.

### Q3 — leads por clínica + etapa
Fonte: `src/modules/comercial/repositories/leads-repository.ts:listAllLeadsWithStage`
(L185, `WHERE clinic_id [+stage_id] ORDER BY score DESC`) e `listLeadsByClinic`
(L125). A unique parcial `(clinic_id, phone_normalized)` não serve filtro puro
por clínica.
- Antes: **`Seq Scan on leads`** (`Filter: clinic_id = ...`), 0.025 ms.
- Depois (`leads_clinic_idx`): `Index Scan using leads_clinic_idx`, 0.016 ms.
- Decisão: **APLICADO** — `leads(clinic_id)`. Mantido mínimo (sem `stage_id` /
  `score` no índice: filtro de etapa é opcional e ordenação por score é
  in-memory barata após o filtro por clínica).

### Q4 — patients por clínica + busca
Fonte: `src/modules/operacional/repositories/patients-repository.ts:listPatients`
(L89) — `WHERE clinic_id + deleted_at IS NULL + merge filter [+name ILIKE] ORDER BY name`.
- Plano: `Index Scan using patients_clinic_id_id_uniq` (filtro clinic_id) +
  `Filter` + `Sort`. **Não é Seq Scan.**
- Decisão: **avaliado, NÃO aplicado.** O `ILIKE '%...%'` não usa btree de
  qualquer forma (exigiria `pg_trgm` + GIN — decisão maior, fora do escopo G4);
  o filtro por clínica já é indexado.

### Q5 — appointments por clínica + janela scheduled_at
Fonte: `src/modules/operacional/repositories/appointments-repository.ts:findByClinicWithJoins`
(L115) e `bookedSlots` (L369).
- Plano: `Index Scan using appointments_clinic_scheduled_status_idx`
  (`clinic_id + scheduled_at >= ... AND <= ...`, `deleted_at` como Filter).
- Decisão: **avaliado, NÃO aplicado** — coberto pelo índice da 0023. Nenhum Seq Scan.

### Q6 — budgets/charges por clínica + status
Fonte: `src/modules/financeiro/repositories/financeiro-repository.ts:listBudgets`
(L130, `WHERE clinic_id [+status] ORDER BY created_at DESC`) e
`listOverdueCharges` (L317, `clinic_id + status='pending' + due_date < hoje`).
- Planos: `Index Scan using budgets_clinic_id_id_uniq` + Filter/ Sort;
  `Bitmap Heap Scan` em charges via `payment_charges_clinic_id_id_uniq`;
  `findPaymentChargeByBudget` usa `payment_charges_clinic_budget_uniq`.
  **Nenhum Seq Scan.**
- Decisão: **avaliado, NÃO aplicado.** Sort residual em `created_at` anotado
  como watch futuro (mesmo racional de Q1).

## Migration aplicada

`src/lib/db/migrations/0031_g4_query_indexes.sql` (manual, padrão do repo:
`CREATE INDEX IF NOT EXISTS`, `statement-breakpoint`, entrada `idx: 31` no
`meta/_journal.json`):

- `messages_conversation_created_idx ON messages (conversation_id, created_at)`
- `leads_clinic_idx ON leads (clinic_id)`

Nenhum código de application foi alterado. Scripts temporários de profiling
ficaram em `%TEMP%\opencode\g4-profile*.mjs` (não commitados).

## Antes / depois (resumo)

| Query | Antes | Depois |
|---|---|---|
| Q2 messages | Seq Scan + Sort | Index Scan (novo índice), sem Sort |
| Q3 leads | Seq Scan | Index Scan (`leads_clinic_idx`) |
| Q1/Q4/Q5/Q6 | Index/Bitmap Scan (incidental ou dedicado) | inalterado — sem índice novo |

## Aviso de merge (branch F2)

Foi adicionada 1 migration manual (`0031`), logo `meta/_journal.json` cresceu em
1 entrada. O teste de sincronização `EXPECTED_MIGRATIONS === journal.length`
vive na branch F2 (não mergeada na main): ao fazer merge F2 ↔ G4, a constante
`EXPECTED_MIGRATIONS` na F2 precisa de bump +1. Nenhum conflito estrutural além
disso.
