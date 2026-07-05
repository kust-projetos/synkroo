# Eixo 2 — Financeiro & Cobrança — Design

> **Tipo:** Spec de módulo.
> **Data:** 2026-07-05
> **Status:** Revisado após eng review; pendente aprovação final do usuário antes do plano.
> **Escopo:** Orçamentos, parcelas, pagamentos, cobranças, gateways e dashboard financeiro.
> **Dependências:** Core, CRM/Contatos, Comercial, Operacional, Atendimento/WhatsApp.

---

## 0. Contexto

Financeiro entra após CRM/Contatos como módulo dono de receita, cobrança e meios de pagamento.
O legado já tem `budgets`, `budget_items`, `budget_installments`, `payments` e UI parcial em contatos.
Este spec transforma esses seams em módulo contratável via Action Layer, sem quebrar consumidores legados no MVP.

Seams atuais:
- `src/app/api/budgets/**`
- `src/services/budgets/budget.service.ts`
- `src/services/payments/payment.service.ts`
- `src/services/followup/budget-followup.service.ts`
- `src/components/contacts/contact-financial-tab.tsx`
- `src/components/contacts/budget-detail-panel.tsx`
- `src/hooks/usePayments.ts`
- `src/app/api/dashboard/alerts/route.ts`

---

## 1. Escopo sequencial

| Slice | Escopo | Resultado |
|---|---|---|
| 1 | Orçamentos, parcelas, cobrança PIX/link, pagamento manual | vender tratamento e receber |
| 2 | Cobrança atrasada, lembrete manual, job diário WhatsApp | recuperar inadimplência |
| 3 | Dashboard financeiro | visualizar recebido, pendente, atrasado e conversão |

Fora do MVP:
- split payment;
- conciliação bancária;
- cartão recorrente;
- nota fiscal;
- Mercado Pago/Pagar.me/Efi reais no primeiro release.

---

## 2. Requisitos EARS

| ID | EARS |
|---|---|
| REQ-FIN-01 | The Financeiro module shall create budgets for patients and leads without duplicating patient or lead ownership. |
| REQ-FIN-02 | When a budget is created, the Financeiro module shall calculate item totals, discounts, final value and installments deterministically. |
| REQ-FIN-03 | When a lead budget is accepted, the Financeiro module shall call Comercial to convert the lead into a patient without creating an appointment. |
| REQ-FIN-04 | When a manual payment is registered, Financeiro shall create a settled payment and update linked installments. |
| REQ-FIN-05 | When a PIX/link charge is requested, Financeiro shall create a payment charge and resolve gateway routing by campaign, patient, lead and clinic default. |
| REQ-FIN-06 | When Asaas returns a webhook event, Financeiro shall validate it, normalize it, store the event once and settle payment when applicable. |
| REQ-FIN-07 | While a charge or installment is overdue, Financeiro shall expose it in the collections queue. |
| REQ-FIN-08 | When the daily collections job runs, Financeiro shall send configured WhatsApp reminders and save collection attempts. |
| REQ-FIN-09 | When a user opens the dashboard, Financeiro shall show received, pending, overdue and conversion metrics for the selected period. |
| REQ-FIN-10 | While Financeiro is disabled, route gates shall hide `/api/financeiro/*` and `/dashboard/financeiro`, except provider webhooks required to reconcile existing charges. |
| REQ-FIN-11 | If a budget, charge, payment or gateway belongs to another clinic, Financeiro shall return `not_found` without leaking existence. |
| REQ-FIN-12 | Where gateway overrides are configured, Financeiro shall use campaign → patient → lead → clinic default precedence. |
| REQ-FIN-13 | When gateway credentials are read, Financeiro shall return only masked metadata and never return decrypted secrets. |

---

## 3. Ownership e boundaries

| Dono | Responsabilidade |
|---|---|
| Financeiro | budgets, installments, charges, payments, collections, gateway config/events |
| Comercial | leads, lead status, lead→patient conversion |
| Operacional | patients, appointments |
| Atendimento | WhatsApp delivery |
| CRM | contato financeiro read-only summary |

Rules:
- Financeiro never writes `leads` or `patients` directly.
- Financeiro calls Comercial bridge action `converterLeadSemAgendar` for lead→patient conversion.
- Financeiro does not create appointments; agent schedules later through Operacional.
- Financeiro owns gateway contracts and provider-specific adapters.
- CRM may read Financeiro summary but does not own financial state.

---

## 4. Arquitetura

```
src/modules/financeiro/
├── actions/
│   ├── listar-orcamentos.ts
│   ├── obter-orcamento.ts
│   ├── criar-orcamento.ts
│   ├── enviar-orcamento.ts
│   ├── aceitar-orcamento.ts
│   ├── rejeitar-orcamento.ts
│   ├── listar-parcelas.ts
│   ├── salvar-parcelas.ts
│   ├── listar-pagamentos.ts
│   ├── registrar-pagamento.ts
│   ├── gerar-cobranca.ts
│   ├── obter-cobranca.ts
│   ├── cancelar-cobranca.ts
│   ├── listar-cobrancas-atrasadas.ts
│   ├── enviar-lembrete-cobranca.ts
│   ├── salvar-gateway.ts
│   ├── salvar-regra-roteamento.ts
│   └── obter-dashboard.ts
├── gateways/{contracts.ts,registry.ts,providers/asaas/*}
├── repositories/
├── services/
├── ui/
├── manifest.ts
├── permissions.ts
├── types.ts
└── index.ts
```

Boundary exception:
- `financeiro` may import finance-owned schema from `src/lib/db/schema/business.ts` until schema moves into module.
- Future cleanup may move finance schema to `src/modules/financeiro/schema.ts`.

---

## 5. Modelo de dados

### Existing tables: changes

| Tabela | Mudança |
|---|---|
| `budgets` | add `lead_id`, `converted_from_lead_id`, `campaign_id`, `accepted_at`, `rejected_at`, `last_sent_at` |
| `budget_installments` | keep; ensure `payment_id` links only settled payment |
| `payments` | keep as settled money received; add `charge_id nullable`, `status`; keep `paid_at` as canonical settlement timestamp |

### New tables

| Tabela | Uso |
|---|---|
| `payment_charges` | `clinic_id`, `budget_id`, `gateway_id`; PIX/link charge issued through gateway; stores external id, URL, QR code, due date, status |
| `payment_gateways` | `clinic_id`; provider config per clinic; stores encrypted secrets server-side |
| `gateway_routing_rules` | `clinic_id`; clinic/patient/lead/campaign overrides |
| `gateway_events` | `clinic_id`, `gateway_id`, `charge_id nullable`; webhook event log with unique `(provider, external_event_id)` |
| `collection_attempts` | `clinic_id`, `charge_id nullable`, `installment_id nullable`; cobrança manual/automática audit |

### Invariantes

| Caso | Regra |
|---|---|
| Budget draft | exactly one of `patient_id` or `lead_id` exists |
| Lead accepted | Comercial returns `patientId`; budget sets `patient_id`, keeps `converted_from_lead_id` |
| Payment | represents settled money only; never stores provider checkout URL/QR; `paid_at` is canonical settlement timestamp |
| Charge | represents requested external cobrança before settlement |
| Charge paid | webhook or manual confirmation creates/links one settled `payments` row |
| Campaign | `budgets.campaign_id` is routing source of truth; `payment_charges` derives campaign through budget |
| Tenant isolation | new finance tables carry `clinic_id` or mandatory FK to a row with same `clinic_id` |
| Gateway event | `(provider, external_event_id)` unique |
| Gateway default | each clinic has at most one default enabled gateway |
| Routing target | overrides can target only enabled gateways from same clinic |

No polymorphic FK. Use explicit nullable FKs: `patient_id`, `lead_id`, `converted_from_lead_id`.

---

## 6. Gateway multi-provider + roteamento

| Provider | Status |
|---|---|
| Asaas | real implementation |
| Mercado Pago | future adapter |
| Pagar.me | future adapter |
| Efi/Gerencianet | future adapter |

```ts
export interface PaymentGateway {
  createCharge(input: CreateChargeInput): Promise<CreateChargeResult>;
  getCharge(input: GetChargeInput): Promise<GetChargeResult>;
  cancelCharge(input: CancelChargeInput): Promise<CancelChargeResult>;
  handleWebhook(input: WebhookInput): Promise<NormalizedGatewayEvent>;
}
```

Provider-specific fields stay inside `gateways/providers/*`.
Actions expose normalized finance DTOs only.

Routing precedence:
1. `campaign_id` override from `budgets.campaign_id`.
2. `patient_id` override.
3. `lead_id` override.
4. clinic default gateway.

After lead→patient conversion:
- new charges use `patient_id` override first;
- historical charges keep original `gateway_id`;
- if both lead and patient overrides exist during transition, `patient_id` wins.

Credential rules:
- `POST/PUT /api/financeiro/gateways` accepts secrets.
- `GET /api/financeiro/gateways` returns provider, status, masked label and last4 only.
- decrypted credentials are server-only and never exposed to UI, logs, action output or agent tools.

---

## 7. Webhooks, jobs e cobrança

| Processo | Regra |
|---|---|
| Webhook Asaas | validate provider secret, map event, upsert `gateway_events`, update `payment_charges` |
| Module disabled webhook | accepts valid webhook only to reconcile existing charges; never creates new budget/charge |
| Event replay | already processed `(provider, external_event_id)` returns 200 without duplicate settlement |
| Daily collections job | `assertModuleForJob('financeiro')`, find overdue charges/installments, apply rule |
| Manual reminder | user sends WhatsApp reminder from queue |
| Audit | every attempt saved in `collection_attempts` |

Régua MVP:
- D+1: lembrete leve;
- D+3: lembrete firme;
- D+7: alerta interno, no automatic insistence.

Overdue source:
- `payment_charges.status in ('pending','overdue')` with `due_date < today`;
- unpaid `budget_installments.status='pending'` with `due_date < today` and no active charge.

---

## 8. Rotas, compatibilidade e UI

### New canonical routes

| Route | Action |
|---|---|
| `GET /api/financeiro/budgets` | `financeiro.listarOrcamentos` |
| `POST /api/financeiro/budgets` | `financeiro.criarOrcamento` |
| `GET /api/financeiro/budgets/:id` | `financeiro.obterOrcamento` |
| `POST /api/financeiro/budgets/:id/send` | `financeiro.enviarOrcamento` |
| `POST /api/financeiro/budgets/:id/accept` | `financeiro.aceitarOrcamento` |
| `POST /api/financeiro/budgets/:id/reject` | `financeiro.rejeitarOrcamento` |
| `GET/PUT /api/financeiro/budgets/:id/installments` | list/save installments |
| `GET /api/financeiro/budgets/:id/payments` | `financeiro.listarPagamentos` |
| `POST /api/financeiro/payments/manual` | `financeiro.registrarPagamento` |
| `POST /api/financeiro/charges` | `financeiro.gerarCobranca` |
| `GET /api/financeiro/charges/:id` | charge detail; also embedded in `obterOrcamento` |
| `POST /api/financeiro/charges/:id/cancel` | cancel open charge through gateway; no-op for settled charge |
| `GET /api/financeiro/collections` | `financeiro.listarCobrancasAtrasadas` |
| `POST /api/financeiro/collections/:id/reminder` | `financeiro.enviarLembreteCobranca` |
| `GET /api/financeiro/dashboard` | `financeiro.obterDashboard` |
| `GET/POST /api/financeiro/gateways` | list/save gateway config |
| `GET/POST /api/financeiro/gateway-rules` | list/save routing overrides |
| `POST /api/financeiro/webhooks/[provider]` | provider webhook adapter |

All routes use `withModuleRoute('financeiro')` and Action Layer RBAC, except webhook route which validates provider secret and clinic/provider resolution before mutation.
When module is disabled, webhook still reconciles existing charges for financial correctness and returns `404` for unknown provider, unknown gateway or unknown charge.

### Backward compatibility

| Legacy route | MVP decision |
|---|---|
| `src/app/api/budgets/**` | keep as thin adapter over Financeiro actions |
| `src/app/api/budgets/[id]/installments` | keep response shape for current UI/hooks |
| `src/app/api/budgets/[id]/payments` | keep response shape for `usePayments` |
| `src/services/budgets/*`, `src/services/payments/*` | deprecated internally; routes/actions stop importing after migration |
| CRM contact financial tab | remains read-only summary plus links/actions to Financeiro |

### UI

| Page | Scope |
|---|---|
| `/dashboard/financeiro` | dashboard + tabs |
| Aba Orçamentos | list/detail/create/send/accept/reject |
| Aba Parcelas/Pagamentos | installments, manual payments, generated charges |
| Aba Cobranças | overdue queue + manual reminder |
| Aba Config | gateways + clinic/patient/lead/campaign routing |
| CRM contact tab | read-only summary + Financeiro deep links |

---

## 9. Dashboard metrics

Period filters use clinic timezone and inclusive `from`/exclusive `to`.

| Métrica | Fórmula |
|---|---|
| Received | sum `payments.amount` where `paid_at` in period and clinic matches |
| Pending | sum open `payment_charges.amount` + unpaid installments without active charge due in or before period end |
| Overdue | sum open charge/installment amount with `due_date < today` |
| Budget conversion | accepted budgets / sent budgets in period; returns `null` when sent budgets = 0 |
| Collection recovery | paid overdue charges after collection attempt / total overdue amount attempted; returns `null` when attempted amount = 0 |

Dashboard excludes rejected budgets from pending revenue.
Manual payments count by `paid_at`; gateway charges count only after settlement.

---

## 10. Permissões

| Permission | Uso |
|---|---|
| `financeiro:view` | dashboard/read lists |
| `financeiro:create_budget` | create budget |
| `financeiro:manage_budget` | send/accept/reject budget, save installments |
| `financeiro:record_payment` | manual payment |
| `financeiro:manage_collections` | reminders/job config |
| `financeiro:manage_gateways` | gateway credentials/routing |

Agent policy:
- agent may create budget draft only with human-approved input;
- agent may send collection reminders only through configured collection action;
- agent shall not delete payments or alter gateway credentials.

---

## 11. Integrações cross-module

| Origem | Destino | Contrato |
|---|---|---|
| Financeiro | Comercial | `converterLeadSemAgendar(leadId)` returns `patientId` |
| Financeiro | Atendimento | send WhatsApp message for charge/reminder |
| CRM | Financeiro | read financial summary by contact |
| Agent | Financeiro | call Actions exposed by module registry |

Comercial bridge shall evolve existing conversion code instead of duplicating logic:
- reuse `src/modules/comercial/actions/converter-lead.ts` patterns;
- reuse patient creation/update flow from `src/modules/comercial/services/lead-conversion-service.ts`;
- mark lead `converted`, set `convertedAt`, set `patientId`;
- do not schedule appointment.

Campaign routing:
- `budgets.campaign_id` is the only source of truth for campaign-based gateway routing;
- existing `campaignRecipients` is patient-only, so lead-origin budgets may carry `campaign_id` directly from Comercial/campaign context;
- `payment_charges` does not own campaign identity; it resolves campaign through `budget_id`.

---

## 12. Testes

| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | totals, installments, dashboard formulas, routing precedence, collection rule |
| Contract | Jest/Zod/MSW | Asaas create charge + webhook payload |
| Route | Jest | gates, RBAC, webhook secret, charge detail/cancel, masked gateway secrets, legacy adapter shape |
| Integration | Jest + Postgres | lead budget accepted → Comercial conversion → patientId on budget |
| Snapshot | Jest | dashboard/collections/config tabs |
| Mutation | Stryker | finance calculations + routing ≥70% |
| E2E | Playwright | decide after implementation |

Commands:
- `npm test`
- `npm run test:integration`
- `npm run typecheck`
- `npm run lint`

---

## 13. Spec coverage

| Req | Sections |
|---|---|
| REQ-FIN-01 | 3, 5, 11 |
| REQ-FIN-02 | 5, 12 |
| REQ-FIN-03 | 3, 11 |
| REQ-FIN-04 | 5, 8, 12 |
| REQ-FIN-05 | 5, 6, 8 |
| REQ-FIN-06 | 5, 7, 8, 12 |
| REQ-FIN-07 | 7, 8 |
| REQ-FIN-08 | 7, 11 |
| REQ-FIN-09 | 9, 12 |
| REQ-FIN-10 | 8, 10 |
| REQ-FIN-11 | 8, 12 |
| REQ-FIN-12 | 6, 12 |
| REQ-FIN-13 | 6, 8, 10, 12 |

---

## 14. Próximo passo

Após aprovação do usuário: gerar plano em `docs/superpowers/plans/2026-07-05-eixo2-financeiro-cobranca-implementation.md`.
Implementação deve seguir TDD e manter commits por task.
