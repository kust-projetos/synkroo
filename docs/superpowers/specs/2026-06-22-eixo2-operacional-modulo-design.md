# Eixo 2 — Módulo Operacional (E-02, Onda 1) — Design

> **Tipo:** Spec de módulo (design). Segundo módulo do Eixo 2; primeiro da Onda 1.
> **Data:** 2026-06-22
> **Status:** Aprovado em substância (brainstorming). Pendente revisão do spec escrito antes do plano de implementação.
> **Escopo:** apenas planejamento/documentação. Implementação por outro agente, guiado pelo plano derivado deste.
> **Dependências:** Onda 0 (Core) fechada — template canônico, Action Layer, RBAC, manifesto, gates (mecanismo), lint de fronteira em `error`. Nenhum outro módulo da Onda 1.

## 0. Contexto e objetivo

O **Operacional (E-02)** é o segundo item do Eixo 2 e o primeiro da **Onda 1** (slice WhatsApp→agenda ponta-a-ponta). Refatora o sistema de **agendamento maduro** (existente, ~950 LOC de services + 13 rotas API) para o **template canônico** estabelecido pelo Core — `app → action → service → repository → Drizzle` — expondo as operações **só** via Action Layer.

Dois papéis:

1. **Produzir as Actions centrais** (`agendar` / `remarcar` / `confirmar` / `cancelar` / `noShow`) que E-01 (Atendimento) e o **Agente IA** consomem. Habilitar o módulo expõe essas Actions ao agente automaticamente (sem tools paralelas).
2. **Validar a fundação inteira em produção** — runtime Cloudflare Workers + Action Layer + primeira aplicação **real** dos gates (`withModuleRoute`/`assertModuleForJob`), que o Core entregou apenas como mecanismo.

**Fronteira do módulo (decidida no brainstorming):** bounded context **completo** — Agendamentos + Pacientes + Dentistas + Procedimentos, **incluindo** a separação física do `schema/core.ts` misturado que o Core deferiu explicitamente.

**Fonte de verdade superior:** roadmap-mestre (`2026-06-17-...-roadmap-design.md`) §5 (Action Layer), §6 (template), §9.1 (modularidade CRM). Sequenciamento: `2026-06-21-eixo2-sequenciamento-design.md` (§4, Onda 1). Referência de padrão: `2026-06-21-eixo2-core-modulo-design.md`.

---

## 1. Princípio organizador — fases ordenadas

Um único spec/plano, decomposto em **6 fases ordenadas** (estilo Tipo A/B do Core). A ordem front-loada a peça mais churny (separação de schema) para de-riscar o que empilha em cima, e prioriza o **caminho crítico de agendamento** (o que valida a Onda 1) antes da largura de domínio. Cada fase fecha **teste → implementação → verificação** e é revisável isolada.

| Fase | Conteúdo | Razão da posição |
|---|---|---|
| **F1 Schema** | Separação física `core.ts`/`appointments.ts` → `modules/operacional/schema/` + seam público | De-risca: tudo abaixo importa do schema novo |
| **F2 Integridade** | Constraint de exclusão (anti-overbooking) + reconectar disponibilidade (`TODO W5.3`) | Invariante de dados antes de construir escrita sobre ela |
| **F3 Vertical de agendamento** | Actions `agendar/remarcar/confirmar/cancelar/noShow` → service → repo | Caminho crítico da Onda 1; consumido por E-01 e agente |
| **F4 Largura de domínio** | Pacientes (CRUD + dedup + preferências), Dentistas, Procedimentos | Admin do bounded context, apoiado em F1–F3 |
| **F5 Crons + Gates** | `withModuleRoute` em `/api/appointments/*`; `assertModuleForJob` no `cron/reminders`; confirmação 24h / lembrete 2h migrados | Aplicação real dos gates do Core; precisa das Actions de F3 |
| **F6 Registro** | `operacionalManifest` + permissões `operacional:*` no `bootstrapActions`; lint verde | Ativa o módulo como contratável; fecha o template |

---

## 2. Estado atual (reconhecimento — verificado em 2026-06-22)

| Item | Estado | Evidência |
|---|---|---|
| Services de agendamento | ⚠️ maduros, fora do template | `services/appointments/appointment-actions.service.ts` (418 LOC), `confirmation-handler.service.ts` (363), `incomplete-treatment.service.ts` (168) |
| Repository de appointments | ✅ existe (a reaproveitar) | `repositories/appointments/index.ts` |
| Detecção de conflito | ❌ read-then-write (corrida TOCTOU) | `repositories/appointments/index.ts:547-573` (`select conflicts → if length>0`) |
| Disponibilidade | ❌ **stubbada** | `app/api/appointments/availability/route.ts:35` `TODO(W5.3): reconnect availability to new scheduling backend` |
| Schema de appointments | ⚠️ central, arquivo limpo | `lib/db/schema/appointments.ts` (6 tabelas, ≈9 importadores) |
| Schema de pacientes/clínico | ⚠️ **misturado** em `core.ts` | `lib/db/schema/core.ts` (8 das 11 tabelas são Operacional) |
| Rotas `/api/appointments/*` | ⚠️ sem gate de entitlement | 13 rotas; sem `withModuleRoute` |
| `cron/reminders` | ⚠️ sem gate de job | `app/api/cron/reminders/route.ts` → `services/reminders/processAllReminders` |
| Confirmação/resposta | ⚠️ fora do template | `confirmation-handler.service.ts`, `app/api/appointments/confirm-response` |
| Módulo `operacional` | ❌ não existe | só `src/modules/core/` |

> **Descobertas-chave:**
> - `schema/core.ts` mistura **Core** (clinics, users, userCredentials) e **Operacional** (dentists, procedures, patients, patientObservations, patientPreferences, patientRiskScores, patientFeedback, procedureGuidelines). A separação que o Core deferiu ("quando E-02 migrar") acontece **aqui**.
> - Coexistem `procedures` (`core.ts`) **e** `procedureTypes` (`appointments.ts`) — **duplicação provável**. Consolidação é **deferida** (só documentar a fronteira; resolver isso é mudança de modelo, fora do escopo da migração).
> - `waitlist` está em `appointments.ts` e é acoplada a `cancelAppointment` (`processWaitlistOnCancellation`) → pertence ao Operacional.

---

## 3. Fronteiras do módulo

Três cortes, todos **decididos**:

| Domínio | Dono | Comportamento |
|---|---|---|
| Agendamento, disponibilidade, waitlist, **confirmação/lembrete de consulta**, no-show | **E-02 (este)** | `cron/reminders` migra para cá; é lifecycle do agendamento |
| Pacientes, Dentistas, Procedimentos (+ observações, preferências, risk scores, feedback, guidelines) | **E-02 (este)** | schema sai de `core.ts` |
| Reativação/retenção, `cron/followups`, `services/followup/*` | **E-03** | **fora**; E-02 só expõe as Actions de agendamento que E-03 consumirá |
| clinics, users, userCredentials | **Core** | permanece no seam do Core; E-02 importa via `@/modules/core/schema` (ou path central) |
| Contatos (lente unificada) | **E-04** | inalterado |
| Orquestração conversacional (router/scheduler/sales) | **Agente IA** (passo 4 da Onda 1) | **fora**; nasce depois, consumindo as Actions deste módulo |

**Corte E-02/E-03 (decisão registrada):** confirmação 24h + lembrete 2h + processamento de resposta de confirmação são **lifecycle do agendamento** → E-02. Retenção/reativação de paciente inativo e budget-followup → E-03. `cron/reminders` (consulta) = E-02; `cron/followups` (retenção) = E-03.

**Princípio §9.1 preservado:** Operacional funciona **sem** CRM. Nada aqui assume E-04.

---

## 4. Estrutura do módulo (espelha o Core)

```
src/modules/operacional/
├── actions/
│   ├── agendar-consulta.ts          # operacional:manage_appointments
│   ├── remarcar-consulta.ts
│   ├── confirmar-consulta.ts
│   ├── cancelar-consulta.ts
│   ├── registrar-no-show.ts
│   ├── listar-consultas.ts          # operacional:view (read-action)
│   ├── consultar-disponibilidade.ts # operacional:view (read-action)
│   ├── criar-paciente.ts            # operacional:manage_patients
│   ├── atualizar-paciente.ts
│   ├── listar-pacientes.ts
│   └── (dentistas / procedimentos CRUD)  # operacional:manage_catalog
├── repositories/   # appointments, patients, dentists, procedures (queries Drizzle)
├── services/       # scheduling (invariante overbooking + waitlist), availability,
│                   # patients (dedup), reminders (confirmação/lembrete)
├── schema/
│   ├── appointments.ts   # move limpo de lib/db/schema/appointments.ts
│   ├── patients.ts       # patients + observations + preferences + riskScores + feedback
│   ├── clinical.ts       # dentists + procedures + procedureGuidelines
│   └── index.ts          # seam público: re-exporta o local + clinics/users de @/lib/db/schema/core
├── ui/             # reaproveita src/components/calendar/* existentes (server→client plumbing como no Core)
├── manifest.ts     # operacionalManifest (alwaysOn:false — contratável)
├── permissions.ts  # operacional:*
└── index.ts        # operacionalActions, operacionalManifest, operacionalAccessPermissions
```

Fluxo canônico idêntico ao Core:

```
app (UI/route) → runAction(action, input, ctx) → service (regra+invariante) → repository (Drizzle) → DB
                       │
                       └─ gates: input (Zod) + entitlement (operacional) + RBAC (requires) + ctx + audit
```

---

## 5. Separação de schema (F1)

- **`appointments.ts`** (6 tabelas: appointments, scheduleBlocks, appointmentReminders, waitlist, appointmentReminderConfigs, procedureTypes) → `modules/operacional/schema/appointments.ts`. Move limpo (≈9 importadores), igual ao `rbac.ts` do Core.
- **8 tabelas de `core.ts`** → `modules/operacional/schema/{patients,clinical}.ts`. `core.ts` mantém **só** clinics, users, userCredentials. Extração **parcial** (não move de arquivo inteiro): atualizar apenas os importadores das tabelas Operacional; importadores de clinics/users ficam.
- **Referências cruzadas:** `appointments` referencia `patients`/`dentists` (intra-módulo, ok); `patients` referencia `clinics` (Operacional → Core, via import do schema do Core). Direção de dependência permitida (módulo → core).
- **Seam público** `modules/operacional/schema/index.ts`: exporta as tabelas locais e **re-exporta** clinics/users do Core (para o módulo ter uma superfície única de schema).
- **Agregação Drizzle preservada:** `lib/db/schema/index.ts` passa a re-exportar de `@/modules/operacional/schema/*` (como já faz com `rbac`). **Gate obrigatório:** `db:generate` → "No schema changes" pós-move.
- **Caveat (registrar):** com o eslint atual (`boundaries`: `lib` allow-by-default), o seam é **forward-looking, não enforçado** — ainda é possível importar `@/lib/db/schema` direto. É ownership estabelecido, não enforçado (mesma honestidade do Core B1).

---

## 6. Integridade — anti-overbooking + disponibilidade (F2)

**Constraint de exclusão (DB-enforced):**

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    dentist_id WITH =,
    tstzrange(scheduled_at, scheduled_at + (duration_minutes * interval '1 minute')) WITH &&
  ) WHERE (status IN ('scheduled','confirmed'));
```

- Double-booking torna-se **estruturalmente impossível**, independente de qualquer corrida no app. Atende o KPI "0 conflitos" do epic e o cenário Gherkin "dois pacientes simultâneos → só um confirma".
- O `WHERE` parcial só restringe agendamentos **ativos** (`scheduled`/`confirmed`) — cancelados/no-show não bloqueiam o slot.
- Insert/reschedule conflitante → Postgres erro `23P01` → o **service** captura e traduz para `ActionError('conflict', '...')`. A checagem read-then-write atual (`repositories/appointments/index.ts:547-573`) deixa de ser a garantia (pode permanecer como pré-validação amigável para UX, mas a **fonte da verdade é a constraint**).

**Disponibilidade (`TODO W5.3`):** reconectar `app/api/appointments/availability` ao backend real (geração de slots em `repositories/appointments` já existe, linhas 403-468), exposta via read-action `consultarDisponibilidade`. Slots ocupados derivados de appointments ativos + `scheduleBlocks`.

---

## 7. Catálogo de Actions (F3/F4)

Todas `module:'operacional'`, registradas em `operacionalActions` (expostas à UI via `runAction` **e** ao agente via `agentToolsFor` — sem duplicação, padrão validado no Core).

| Action | `requires` | Tipo | Service |
|---|---|---|---|
| `agendarConsulta` | `operacional:manage_appointments` | escrita | scheduling (constraint → conflict) |
| `remarcarConsulta` | `operacional:manage_appointments` | escrita | scheduling |
| `confirmarConsulta` | `operacional:manage_appointments` | escrita | scheduling |
| `cancelarConsulta` | `operacional:manage_appointments` | escrita | scheduling (+ waitlist) |
| `registrarNoShow` | `operacional:manage_appointments` | escrita | scheduling |
| `listarConsultas` | `operacional:view` | leitura | scheduling |
| `consultarDisponibilidade` | `operacional:view` | leitura | availability |
| `criarPaciente` / `atualizarPaciente` | `operacional:manage_patients` | escrita | patients (dedup tel/CPF) |
| `listarPacientes` | `operacional:view` | leitura | patients |
| `criar/atualizar/listar` Dentista, Procedimento | `operacional:manage_catalog` | escrita/leitura | (repos) |

Nenhum `getDb()` direto em `actions/` (regra do template). Dedup de paciente vive no **service** (invariante de domínio), não na action.

---

## 8. Crons + Gates (F5)

- **`withModuleRoute('operacional', manifest)`** envolve os handlers de `/api/appointments/*` — retorna **404** se o módulo não estiver contratado. **Primeira aplicação real** dos gates, fechando o que o Core entregou apenas como mecanismo (Core B2).
- **`assertModuleForJob('operacional', manifest)`** no `cron/reminders` — o job não roda para instâncias sem o módulo.
- **Confirmação 24h / lembrete 2h / processamento de resposta** migram de `services/reminders/*` e `confirmation-handler.service.ts` para `modules/operacional/services/reminders.ts`, disparados pelo cron gated. Segurança do cron (CRON_SECRET + `timingSafeEqual`) preservada.

---

## 9. Manifesto + permissões (F6)

```ts
// manifest.ts
export const operacionalManifest = {
  id: 'operacional',
  name: 'Operacional',
  alwaysOn: false,                 // contratável
  menu: [
    { moduleId:'operacional', permission:'operacional:view', label:'Agenda', path:'/dashboard/agenda', icon:'CalendarIcon' },
    { moduleId:'operacional', permission:'operacional:view', label:'Pacientes', path:'/dashboard/pacientes', icon:'UserGroupIcon' },
  ],
  jobs: ['operacional.reminders'] as string[],
};

// permissions.ts
export const operacionalAccessPermissions: PermissionEntry[] = [
  { key:'operacional:view',                module:'operacional', label:'Ver agenda e pacientes' },
  { key:'operacional:manage_appointments', module:'operacional', label:'Gerenciar consultas' },
  { key:'operacional:manage_patients',     module:'operacional', label:'Gerenciar pacientes' },
  { key:'operacional:manage_catalog',      module:'operacional', label:'Gerenciar dentistas e procedimentos' },
];
```

`index.ts` exporta `operacionalActions` (todas as actions), `operacionalManifest`, `operacionalAccessPermissions`; `bootstrapActions` passa a registrar também o Operacional (idempotente, como o Core). **Teste-guarda** afirmando que toda action em `actions/*` é descobrível via registry (padrão herdado da correção final do Core).

> **Migração do menu estático:** o Core deixou `navItems` estáticos (Agenda/Pacientes incluídos) como dívida documentada, a migrar "por-módulo, ao migrar". Este módulo **remove** os `navItems` estáticos de agenda/pacientes do `sidebar.tsx` e os traz via `operacionalManifest` (condicionados a `isEnabled` + RBAC), cumprindo o refino do sequenciamento.

---

## 10. Error handling

- `runAction` mapeia `ActionError(code, msg)` → `{ result:'error', errorCode }`. Overbooking usa `ActionError('conflict', ...)` (traduzido do `23P01`).
- `not_found` para appointment/paciente inexistente; `forbidden` sem a permissão; `unauthorized` sem sessão. Nunca vaza dados de outra clínica — `ctx` injeta `clinicId` e toda query do repository filtra por ele.
- Falha de import pós-move de schema (F1): capturada por `tsc` (gate de build) — verificação obrigatória no plano.

---

## 11. Testing

- **Integração (Postgres real, `jest.integration.config.js`):**
  - **Overbooking concorrente** — dois inserts simultâneos no mesmo slot/dentista: exatamente 1 sucede, o outro recebe `conflict` (valida a constraint, não o app).
  - Fluxo `agendar → confirmar → noShow`; `cancelar` libera slot e dispara waitlist.
  - Disponibilidade reflete slots ocupados + `scheduleBlocks`.
  - Dedup de paciente (mesmo telefone/CPF não duplica).
  - Gates: rota `/api/appointments/*` → 404 com módulo desabilitado; `cron/reminders` no-op sem o módulo.
  - Escopo por clínica em todas as read-actions.
- **Unit:** invariantes de service (tradução `23P01`→conflict; dedup); registro das actions no registry.
- **Gates de build:** `typecheck` 0 erros; `db:generate` "No schema changes" pós-move (F1); `lint` 0 violações de fronteira (boundaries em `error` desde o Core).

---

## 12. Definition of Done

- [ ] **F1** `appointments.ts` + 8 tabelas de `core.ts` movidas para `modules/operacional/schema/`; seam público; `core.ts` só com clinics/users/userCredentials; `db:generate` limpo; caveat de não-enforço registrado.
- [ ] **F2** constraint `appointments_no_overlap` (+ `btree_gist`) ativa; service traduz `23P01`→`conflict`; disponibilidade reconectada (`TODO W5.3` resolvido).
- [ ] **F3** Actions `agendar/remarcar/confirmar/cancelar/noShow` + reads no template (`action→service→repo`, sem `getDb()` em actions); testes de integração verdes, incluindo overbooking concorrente.
- [ ] **F4** Pacientes (CRUD + dedup + preferências), Dentistas, Procedimentos via template.
- [ ] **F5** `withModuleRoute` nas `/api/appointments/*` (404 sem contrato); `assertModuleForJob` no `cron/reminders`; confirmação 24h / lembrete 2h migrados e disparados pelo cron gated.
- [ ] **F6** `operacionalManifest` + `operacional:*` registrados no `bootstrapActions`; menu de agenda/pacientes via manifesto (estáticos removidos do `sidebar.tsx`); teste-guarda de registry; agente lista as Actions do Operacional via `agentToolsFor`.
- [ ] `typecheck` 0 erros; unit + integração verdes; `db:generate` limpo; lint verde.
- [ ] **Critério Onda 1 (parcial):** as Actions necessárias para "WhatsApp → agendar/remarcar/confirmar" existem e passam pela Action Layer com RBAC/entitlement — prontas para o agente (passo 4) consumir.

---

## 13. Fora de escopo (deferido com razão)

- **Orquestração conversacional do agente** (router/scheduler) — passo 4 da Onda 1, nasce após E-02/E-01/E-03.
- **Consolidação `procedures` × `procedureTypes`** — mudança de modelo; só documentar a duplicação agora.
- **Retenção / follow-up / reativação** (`cron/followups`, `services/followup/*`) — E-03.
- **CRM / Contatos** (modelo unificado) — E-04 (§9.1).
- **Lista de espera automática avançada** e **reagendamento automático pós-cancelamento** — P1/P2 do epic, ondas seguintes.
- **Separação física de clinics/users** — permanecem no Core.

---

## 14. Riscos

- **Constraint sobre dados existentes (Pitfall 7):** `ADD CONSTRAINT EXCLUDE` **falha** se já houver appointments ativos sobrepostos em produção. Mitigação: o plano deve (a) detectar overlaps existentes antes de aplicar, (b) resolvê-los/normalizá-los, e só então criar a constraint; o `WHERE status IN (...)` parcial reduz a exposição a registros ativos.
- **Move parcial de `core.ts` (F1):** extração de 8 de 11 tabelas, ≈23 importadores no total → quebra de import silenciosa. Mitigação: `tsc` + `db:generate` + suíte; codemod de path + verificação, como no `rbac.ts` do Core.
- **Disponibilidade stubbada (W5.3):** reconexão pode revelar drift entre slot-generation e o estado real. Mitigação: testes de integração de disponibilidade contra dados semeados.
- **Acoplamento waitlist↔cancelamento:** `cancelAppointment` dispara waitlist; ao migrar, manter o efeito colateral coberto por teste.
- **LGPD (Pitfall 3):** pacientes carregam dado sensível; manter o escopo por `clinicId` e não vazar em erros/logs.

---

## 15. Referências

| Documento | Papel |
|---|---|
| `2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§5 Action Layer, §6 template, §9.1) |
| `2026-06-21-eixo2-sequenciamento-design.md` | Sequenciamento (§4 Onda 1: E-02 primeiro) |
| `2026-06-21-eixo2-core-modulo-design.md` | Padrão canônico do módulo (template, gates, seam de schema) |
| `2026-06-21-eixo2-core-modulo-refinements.md` | Refino gates/menu vs sequenciamento (dívida dos estáticos que E-02 fecha p/ agenda/pacientes) |
| `docs/planning/epics.md` (Epic E-02) | RFs, critérios de aceitação, KPIs |
| `.planning/research/PITFALLS.md` | Pitfalls 3 (LGPD), 4 (WhatsApp), 7 (migração) — consultar ao escrever o plano |
