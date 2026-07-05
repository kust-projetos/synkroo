# Eixo 2 — Módulo CRM/Contatos (E-04, Onda 2) — Design

> **Tipo:** Spec de módulo (design).
> **Data:** 2026-07-05
> **Status:** Escrito após aprovação do recorte A; pendente revisão do usuário antes do plano de implementação.
> **Escopo:** CRM como lente unificada de contatos: lista, detalhe, timeline, notas e tags.
> **Dependências:** Core, Operacional (patients), Comercial (leads) e Atendimento/Follow-up já migrados para Action Layer.

---

## 0. Contexto

E-05 Comercial estabilizou o bounded context de leads. E-02 Operacional já owns patients. O E-04 CRM/Contatos entra agora como **lente unificada**, sem assumir ownership de `patients` nem `leads`.

Fontes:
- `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md`
- `docs/superpowers/plans/2026-06-06-patients-contacts-boundary.md`
- `docs/planning/stories/e-04-stories.md`
- seams atuais: `src/app/api/contacts/*`, `src/services/contacts/contacts.service.ts`, `src/components/contacts/*`, `src/app/dashboard/contatos/page.tsx`

---

## 1. Decisão de escopo

| Área | Decisão | Motivo |
|---|---|---|
| Lista unificada | Escopo | rota canônica `/dashboard/contatos` |
| Detalhe unificado | Escopo | visão por `{ type, id }` |
| Timeline | Escopo | junta eventos de paciente/lead sem mover dados |
| Notas | Escopo via owner actions | CRM coordena; dono grava |
| Tags | Escopo via owner actions | CRM coordena; dono grava |
| Segmentação campanhas | Fora | próximo slice B |
| Dedup/merge assistido | Fora | próximo slice C |
| Novo schema CRM | Fora | evita duplicar ownership |
| Budgets/financeiro | Fora | pertence a Financeiro futuro/bridges existentes |
| Fusão lead↔patient | Fora | MVP preserva `{ type: 'patient' | 'lead', id }` |

---

## 2. Requisitos EARS

| ID | EARS |
|---|---|
| REQ-CRM-01 | The CRM module shall expose a unified contacts list combining patients from Operacional and leads from Comercial. |
| REQ-CRM-02 | When a user filters contacts by type, search, tag, or status, the CRM module shall apply filters across the selected owner contexts without cross-clinic leakage. |
| REQ-CRM-03 | When a user opens a contact, the CRM module shall resolve it by `{ type, id }` and return one normalized detail model. |
| REQ-CRM-04 | When a user opens timeline, the CRM module shall compose events from owner contexts and sort them by timestamp descending. |
| REQ-CRM-05 | When a user adds a note to a contact, the CRM module shall call the owner action for that contact type and shall not write owner tables directly. |
| REQ-CRM-06 | When a user updates tags, the CRM module shall call the owner action for that contact type and shall not write owner tables directly. |
| REQ-CRM-07 | While CRM module is disabled for an instance, route gates shall hide `/api/contacts/*` and `/dashboard/contatos`. |
| REQ-CRM-08 | If a contact belongs to another clinic, then CRM shall return `not_found` without exposing whether the contact exists. |
| REQ-CRM-09 | Where legacy clients call `/api/contacts/:id?type=patient|lead`, CRM shall preserve that contract for MVP. |
| REQ-CRM-10 | If owner action for notes/tags is missing, then implementation shall add a minimal owner bridge action in Operacional or Comercial before CRM writes through it. |

---

## 3. Estado atual

| Item | Estado | Ação |
|---|---|---|
| `/dashboard/contatos` | `notFound()` até E-04 | reativar como rota canônica |
| `/api/contacts/*` | chama `src/services/contacts` direto | virar adapter gated sobre Actions CRM |
| `src/services/contacts/contacts.service.ts` | seam legado Drizzle direto + `any` | substituir por coordinator/actions CRM |
| `src/components/contacts/*` | UI existe | preservar, ajustar contrato mínimo |
| Patients | owned por `src/modules/operacional` | CRM lê/coordena; writes via Operacional |
| Leads | owned por `src/modules/comercial` | CRM lê/coordena; writes via Comercial |
| Notes lead | `leadActivities` | write via Comercial action |
| Notes patient | `patientObservations` | write via Operacional action |
| Tags | free-text arrays no owner record; `clinic_tags` opcional para sugestão/autocomplete | write via owner action no MVP |

---

## 4. Arquitetura

```
src/modules/crm/
├── actions/
│   ├── listar-contatos.ts
│   ├── obter-contato.ts
│   ├── listar-timeline-contato.ts
│   ├── listar-notas-contato.ts
│   ├── adicionar-nota-contato.ts
│   └── atualizar-tags-contato.ts
├── repositories/
│   └── contact-read-repository.ts   # única exceção read-model cross-schema, SELECT-only
├── services/
│   ├── contact-list-service.ts
│   ├── contact-detail-service.ts
│   ├── contact-timeline-service.ts
│   └── contact-write-coordinator.ts
├── ui/
│   └── route-adapter.ts
├── manifest.ts
├── permissions.ts
└── index.ts
```

Boundary rules:
1. CRM owns no DB table in this MVP.
2. `src/modules/crm/repositories/contact-read-repository.ts` is the only approved cross-schema read-model exception.
3. The read-model repository may import Operacional/Comercial schemas for `SELECT`/`COUNT` only.
4. Boundary lint must whitelist only this file for those schema imports.
5. CRM repository has no `insert`, `update`, `delete`, raw write SQL, or owner table mutation.
6. CRM writes notes/tags only by calling owner actions.
7. Routes call `runAction`; routes do not import service/repository.
8. Identity stays `{ type: 'patient' | 'lead', id }`; no synthetic `contactId` table.
9. `/api/contacts/*` preserves legacy `?type=` contract.

---

## 5. Normalized models

```ts
export type CrmContactType = 'patient' | 'lead';

export type CrmContactId = {
  type: CrmContactType;
  id: string;
};

export type CrmContactSummary = CrmContactId & {
  clinicId: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  tags: string[];
  source: string | null;
  temperature: string | null;
  updatedAt: string;
};

export type CrmTimelineEvent = {
  id: string;
  contact: CrmContactId;
  kind: 'note' | 'appointment' | 'lead_activity' | 'conversion';
  title: string;
  description: string | null;
  occurredAt: string;
  actorId: string | null;
};
```

---

## 6. Actions e permissões

| Action CRM | Permissão | Tipo | Observação |
|---|---|---|---|
| `crm.listarContatos` | `crm:view` | read | lista patients + leads |
| `crm.obterContato` | `crm:view` | read | exige `{ type, id }` |
| `crm.listarTimelineContato` | `crm:view` | read | timeline normalizada |
| `crm.listarNotasContato` | `crm:view` | read | notas normalizadas sem expor timeline completa |
| `crm.adicionarNotaContato` | `crm:manage_notes` | write coordinator | chama owner action |
| `crm.atualizarTagsContato` | `crm:manage_tags` | write coordinator | chama owner action |

Bridge owner actions necessárias se ausentes:

| Owner | Action | Motivo |
|---|---|---|
| Operacional | `operacional.registrarObservacaoPaciente` | nota de patient |
| Operacional | `operacional.atualizarTagsPaciente` | tags de patient |
| Comercial | `comercial.registrarNotaLead` | nota de lead via activity |
| Comercial | `comercial.atualizarTagsLead` | tags de lead |

Tags MVP:
- tags are free-text arrays stored on owner records;
- `clinic_tags` can power suggestions/autocomplete, but is not mandatory source of truth;
- owner actions trim whitespace, remove empties, and deduplicate case-insensitively;
- CRM does not create or own a global tag catalog in this slice.

Manifesto:

```ts
export const crmManifest = {
  id: 'crm',
  name: 'CRM',
  alwaysOn: false,
  menu: [
    { moduleId: 'crm', permission: 'crm:view', label: 'Contatos', path: '/dashboard/contatos', icon: 'UsersIcon' },
  ],
};
```

Permissões:
- `crm:view`
- `crm:manage_notes`
- `crm:manage_tags`

---

## 7. Endpoints

| Route | Target |
|---|---|
| `GET /api/contacts` | `crm.listarContatos` |
| `POST /api/contacts` | `405 Method Not Allowed` no MVP (`crm_mvp_read_only`) |
| `GET /api/contacts/:id?type=patient|lead` | `crm.obterContato` |
| `PUT /api/contacts/:id` | `405 Method Not Allowed` no MVP (`crm_mvp_read_only`) |
| `PATCH /api/contacts/:id` | `405 Method Not Allowed` no MVP (`crm_mvp_read_only`) |
| `GET /api/contacts/:id/timeline?type=...` | `crm.listarTimelineContato` |
| `GET /api/contacts/:id/notes?type=...` | `crm.listarNotasContato` |
| `POST /api/contacts/:id/notes?type=...` | `crm.adicionarNotaContato` |
| `PUT /api/contacts/:id/tags?type=...` | `crm.atualizarTagsContato` |

All routes use `withModuleRoute('crm')` and Action Layer context.

List semantics:
- Default sort: `updatedAt DESC`, then `type ASC`, then `id ASC`.
- Pagination applies after the unified set, not per source.
- `total` equals filtered patients + filtered leads before page cut.
- Read-model uses one global query shape (`UNION ALL` or equivalent) to avoid legacy per-source paging drift.
- Default list hides converted leads with `patientId` or `status='converted'` to avoid duplicate contacts.

---

## 8. Timeline composition

| Event kind | Source | Owner |
|---|---|---|
| `appointment` | `appointments` by patient | Operacional |
| `note` patient | `patient_observations` | Operacional |
| `lead_activity` | `lead_activities` | Comercial |
| `conversion` | lead `convertedAt/patientId` | Comercial |
Atendimento/messages fica deferido para slice futuro; MVP evita acoplar CRM a conversas.

Lead convertido:
- converted lead is hidden from default contacts list when `patientId` exists or `status='converted'`;
- legacy detail `type=lead&id=...` still resolves for compatibility;
- lead timeline shows only `lead_activities` and `conversion` in MVP;
- patient timeline does not stitch pre-conversion lead history in MVP;
- UI may show badge/link "convertido em paciente" when detail opens a converted lead.

Rules:
- sort `occurredAt DESC`;
- filter by `clinicId` before mapping;
- mask phone in logs;
- unknown cross-context event omitted, not failed globally.

---

## 9. UI

| UI | Decisão |
|---|---|
| `/dashboard/contatos` | rota canônica CRM |
| `contact-list-panel` | usar `CrmContactSummary` |
| `contact-detail-panel` | resolver `{ type, id }` |
| `contact-timeline-tab` | usar timeline normalizada |
| `contact-notes-tab` | adicionar nota via Action CRM |
| `contact-create-dialog` | ocultar; criação/edição fora do MVP CRM |
| `contact-custom-fields-tab` | fora do MVP se exigir schema novo |
| financial/budget panels | ocultar ou manter fora do fluxo CRM MVP |

UX rules:
- lead e patient aparecem na mesma lista com badge de tipo;
- converted lead is hidden from default list to avoid duplicate contact;
- converted lead detail can show badge/link to patient;
- Conversão lead→patient continua Comercial/Operacional, não CRM.

---

## 10. Error handling e segurança

| Caso | Resposta |
|---|---|
| sem auth | `401` |
| módulo CRM desabilitado | `404` via gate |
| sem permissão | `403` |
| contato de outra clínica | `404` |
| `type` ausente em rota por id | `400` |
| owner action ausente | erro de implementação; plano deve criar bridge antes |
| owner action falha | propagar `conflict`/`validation_error` normalizado |

Security rules:
- every query scoped by `clinicId`;
- no direct writes in CRM repository;
- no phone/email full in logs;
- no finance/budget data in MVP response.

---

## 11. Fases futuras fora deste spec

| Slice | Conteúdo |
|---|---|
| B | segmentação para campanhas |
| C | deduplicação/merge assistido |
| Financeiro | budgets, payments, inadimplência |
| Marketing E-06 | campanhas avançadas e automações |

---

## 12. Testes

**Tests:**
- Unit (Jest, RED first): normalizers, contact mapping, timeline sorting, permission routing, write coordinator owner selection.
- Snapshot (auto if UI render): `/dashboard/contatos` list/detail empty/loading/error states if touched.
- Contract (auto if external/action boundary): owner action calls for notes/tags with Zod input/output.
- E2E (opt-in, ask after implementation): open Contatos → filter → open lead/patient → add note.
- Mutation (Stryker, ≥70%): contact mapping + timeline composition.
- Coverage ratchet: ≥80% new code.

Integration matrix:

| Scenario | Expected |
|---|---|
| patient + lead same clinic | both listed |
| patient other clinic | hidden |
| lead other clinic | hidden |
| missing `type` by id | 400 |
| note patient | calls Operacional bridge |
| note lead | calls Comercial bridge |
| CRM disabled | `/api/contacts/*` 404 |
| no `crm:view` | 403 |
| global ordering patients+leads | sorted by `updatedAt DESC`, `type ASC`, `id ASC` |
| global pagination | page cut after unified set, `total` before cut |
| `POST/PUT/PATCH /api/contacts*` | 405 with `crm_mvp_read_only` |
| converted lead in default list | hidden |
| converted lead legacy detail | still accessible by `type=lead&id=...` |
| notes list | `crm.listarNotasContato` returns only normalized note events |
| tags update | `PUT /api/contacts/:id/tags?type=...` trims, removes empties, dedups case-insensitively |

---

## 13. Definition of Done

- [ ] `src/modules/crm` exists with actions, services, read-only repository, manifest, permissions and route adapter.
- [ ] `/dashboard/contatos` renders canonical CRM contacts view.
- [ ] `/api/contacts/*` routes are gated adapters over CRM Actions.
- [ ] `src/services/contacts/contacts.service.ts` is removed or reduced to compatibility shim with no Drizzle direct writes.
- [ ] CRM reads patients from Operacional-owned schema/actions and leads from Comercial-owned schema/actions.
- [ ] CRM writes notes/tags only through owner bridge actions.
- [ ] `GET /api/contacts/:id/notes?type=...` uses `crm.listarNotasContato`.
- [ ] `PUT /api/contacts/:id/tags?type=...` uses `crm.atualizarTagsContato`.
- [ ] Legacy `GET /api/contacts/:id?type=patient|lead` contract remains working.
- [ ] Unified list has global ordering, pagination and `total` semantics.
- [ ] Legacy `POST/PUT/PATCH /api/contacts*` mutations return explicit `405 crm_mvp_read_only`.
- [ ] Converted leads do not duplicate default CRM list; legacy lead detail remains accessible.
- [ ] Tags use MVP free-text semantics with owner-side trim and case-insensitive dedup.
- [ ] Segmentação and merge remain absent from MVP implementation.
- [ ] Focused unit/integration tests pass.
- [ ] `typecheck` and boundaries lint pass.

---

## 14. Non-goals

- Criar tabela `contacts`.
- Fundir patient e lead em uma entidade única.
- Implementar segmentação de campanhas.
- Implementar dedup/merge assistido.
- Migrar budgets/payments/financial panels.
- Redesenhar Comercial ou Operacional.
- Criar automação de marketing.

---

## 15. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| CRM virar owner oculto | bloquear writes diretos; testes de boundary |
| `contacts.service.ts` perpetuar bypass | migrar rotas para CRM actions; shim temporário só se necessário |
| UI exigir criação/edição completa | MVP restringe lista/detalhe/timeline/notas/tags |
| Tags sem owner action clara | criar bridge mínima no owner antes da write |
| Timeline acoplar muitos módulos | começar com patient observations, appointments e lead activities |
| Confundir Contatos com Pacientes | badge type + copy de boundary |

---

## 16. Referências

| Documento/arquivo | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | ordem E-05 → E-04 |
| `docs/superpowers/plans/2026-06-06-patients-contacts-boundary.md` | patients vs contacts boundary |
| `docs/planning/stories/e-04-stories.md` | stories CRM |
| `src/modules/operacional/schema/patients.ts` | owner patients |
| `src/modules/comercial/schema/*` | owner leads/pipeline/tasks |
| `src/app/api/contacts/*` | routes a migrar |
| `src/services/contacts/contacts.service.ts` | seam legado |
| `src/components/contacts/*` | UI existente |
