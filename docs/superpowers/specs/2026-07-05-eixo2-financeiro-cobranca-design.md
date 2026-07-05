# Eixo 2 — Financeiro & Cobrança — Design

> **Tipo:** Spec de módulo.
> **Data:** 2026-07-05
> **Status:** Aprovado em sessão; pendente revisão final do usuário antes do plano de implementação.
> **Escopo:** Orçamentos, parcelas, pagamentos, gateways, cobrança atrasada e dashboard financeiro.
> **Dependências:** Core, CRM/Contatos, Comercial, Operacional, Atendimento/WhatsApp.

---

## 0. Contexto

Financeiro entra após CRM/Contatos como módulo dono de receita, cobrança e meios de pagamento.
O legado já tem `budgets`, `budget_items`, `budget_installments` e `payments`, além de UI parcial em contatos.
Este spec converte esses seams em módulo contratável via Action Layer e prepara gateways por clínica, pessoa e campanha.

Seams atuais:
- `src/app/api/budgets/**`
- `src/services/budgets/budget.service.ts`
- `src/services/payments/payment.service.ts`
- `src/services/followup/budget-followup.service.ts`
- `src/components/contacts/contact-financial-tab.tsx`
- `src/components/contacts/budget-detail-panel.tsx`
- `src/app/api/dashboard/alerts/route.ts`

---

## 1. Decisão de escopo

| Slice | Escopo | Resultado |
|---|---|---|
| 1 | Orçamentos + parcelas + pagamentos | vender tratamento e receber |
| 2 | Cobrança atrasada | recuperar inadimplência |
| 3 | Dashboard financeiro | visualizar recebido, pendente, atrasado |

Fora do MVP:
- split payment
- conciliação bancária
- cartão recorrente
- nota fiscal
- múltiplos providers reais no primeiro release

---

## 2. Requisitos EARS

| ID | EARS |
|---|---|
| REQ-FIN-01 | The Financeiro module shall create budgets for patients and leads without duplicating patient or lead ownership. |
| REQ-FIN-02 | When a budget is created, the Financeiro module shall calculate item totals, discounts, final value and installments deterministically. |
| REQ-FIN-03 | When a lead budget is accepted, the Financeiro module shall call Comercial to convert the lead into a patient without creating an appointment. |
| REQ-FIN-04 | When a payment is registered manually, the Financeiro module shall update payment and installment status without calling an external gateway. |
| REQ-FIN-05 | When a PIX/link charge is requested, the Financeiro module shall resolve gateway routing by campaign, person and clinic default. |
| REQ-FIN-06 | When Asaas returns a webhook event, the Financeiro module shall validate it, normalize it and process it idempotently. |
| REQ-FIN-07 | While a payment is overdue, the Financeiro module shall expose it in the collections queue. |
| REQ-FIN-08 | When the daily collections job runs, the Financeiro module shall send configured WhatsApp reminders and save collection attempts. |
| REQ-FIN-09 | When a user opens the finance dashboard, the Financeiro module shall show received, pending, overdue and conversion metrics for the selected period. |
| REQ-FIN-10 | While the Financeiro module is disabled for an instance, route gates shall hide `/api/financeiro/*` and `/dashboard/financeiro`. |
| REQ-FIN-11 | If a budget, payment or gateway belongs to another clinic, then Financeiro shall return `not_found` without leaking existence. |
| REQ-FIN-12 | Where gateway overrides are configured for person or campaign, the Financeiro module shall use the most specific rule before clinic default. |

---

## 3. Ownership e boundaries

| Dono | Responsabilidade |
|---|---|
| Financeiro | budgets, installments, payments, collections, gateway config, gateway events |
| Comercial | leads, lead status, lead→patient conversion |
| Operacional | patients, appointments |
| Atendimento | WhatsApp delivery |
| CRM | contato financeiro read-only summary |

Rules:
- Financeiro never writes `leads` or `patients` directly.
- Financeiro calls a Comercial bridge action for lead→patient conversion without scheduling.
- Financeiro does not create appointments; agent schedules later through Operacional.
- Financeiro owns gateway provider contracts and provider-specific adapters.
- CRM may read Financeiro summary but does not own financial state.

---

## 4. Arquitetura

```
src/modules/financeiro/
├── actions/
│   ├── criar-orcamento.ts
│   ├── aceitar-orcamento.ts
│   ├── rejeitar-orcamento.ts
│   ├── registrar-pagamento.ts
│   ├── gerar-cobranca.ts
│   ├── listar-cobrancas-atrasadas.ts
│   ├── enviar-lembrete-cobranca.ts
│   ├── salvar-gateway.ts
│   ├── salvar-regra-roteamento.ts
│   └── obter-dashboard.ts
├── gateways/
│   ├── contracts.ts
│   ├── registry.ts
│   └── providers/asaas/
│       ├── client.ts
│       ├── mapper.ts
│       └── webhook.ts
├── repositories/
├── services/
├── ui/
├── manifest.ts
├── permissions.ts
├── types.ts
└── index.ts
```

Boundary exception:
- `financeiro` may import finance-owned schema from `src/lib/db/schema/business.ts` until schema is moved into module.
- Future cleanup may move finance schema to `src/modules/financeiro/schema.ts`.

---

## 5. Modelo de dados

### Existing tables: changes

| Tabela | Mudança |
|---|---|
| `budgets` | add `lead_id`, `converted_from_lead_id`, `gateway_id`, `accepted_at`, `rejected_at` |
| `payments` | add `gateway_id`, `external_charge_id`, `payment_url`, `pix_qr_code`, `status`, `due_date` |
| `budget_installments` | keep; link paid installment to payment |

### New tables

| Tabela | Uso |
|---|---|
| `payment_gateways` | provider config per clinic |
| `gateway_routing_rules` | clinic/person/campaign overrides |
| `gateway_events` | idempotent webhook event log |
| `collection_attempts` | cobrança manual/automática audit |

### Invariantes

| Caso | Regra |
|---|---|
| Budget draft | exactly one of `patient_id` or `lead_id` exists |
| Lead accepted | Comercial returns `patientId`; budget sets `patient_id` and `converted_from_lead_id` |
| Payment | requires `patient_id` before final settlement |
| Gateway event | `(provider, external_event_id)` unique |
| Routing | most specific wins: campaign → person → clinic default |

No polymorphic FK. Use explicit nullable FKs: `patient_id`, `lead_id`, `converted_from_lead_id`.

---

## 6. Gateway multi-provider

### MVP provider

| Provider | Status |
|---|---|
| Asaas | real implementation |
| Mercado Pago | future adapter |
| Pagar.me | future adapter |
| Efi/Gerencianet | future adapter |

### Contract

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

### Routing

```txt
charge context
  → campaign override
  → person override
  → clinic default gateway
```

Overrides are editable in MVP:
- clinic default gateway
- person-specific gateway
- campaign-specific gateway

---

## 7. Webhooks e jobs

| Processo | Regra |
|---|---|
| Webhook Asaas | validate provider secret, map event, update payment |
| Idempotência | skip already processed `(provider, external_event_id)` |
| Daily collections job | find overdue installments/payments and apply collection rule |
| Manual reminder | user sends WhatsApp reminder from queue |
| Audit | every attempt saved in `collection_attempts` |

Régua MVP:
- D+1: lembrete leve
- D+3: lembrete firme
- D+7: alerta interno sem insistir automaticamente

---

## 8. Rotas e UI

### Routes

| Route | Action |
|---|---|
| `GET /api/financeiro/budgets` | `financeiro.listarOrcamentos` |
| `POST /api/financeiro/budgets` | `financeiro.criarOrcamento` |
| `POST /api/financeiro/budgets/:id/accept` | `financeiro.aceitarOrcamento` |
| `POST /api/financeiro/budgets/:id/reject` | `financeiro.rejeitarOrcamento` |
| `POST /api/financeiro/payments/manual` | `financeiro.registrarPagamento` |
| `POST /api/financeiro/payments/charge` | `financeiro.gerarCobranca` |
| `GET /api/financeiro/collections` | `financeiro.listarCobrancasAtrasadas` |
| `POST /api/financeiro/collections/:id/reminder` | `financeiro.enviarLembreteCobranca` |
| `GET /api/financeiro/dashboard` | `financeiro.obterDashboard` |
| `GET/POST /api/financeiro/gateways` | `financeiro.salvarGateway` / list config |
| `POST /api/financeiro/webhooks/[provider]` | provider webhook adapter |

All routes use `withModuleRoute('financeiro')` and Action Layer RBAC.

### UI

| Page | Scope |
|---|---|
| `/dashboard/financeiro` | dashboard + tabs |
| Aba Orçamentos | create/send/accept/reject |
| Aba Cobranças | overdue queue + manual reminder |
| Aba Config | gateways + routing overrides |
| CRM contact tab | read-only finance summary + open Financeiro links |

---

## 9. Permissões

| Permission | Uso |
|---|---|
| `financeiro:view` | dashboard/read lists |
| `financeiro:create_budget` | create budget |
| `financeiro:manage_budget` | accept/reject/send budget |
| `financeiro:record_payment` | manual payment |
| `financeiro:manage_collections` | reminders/job config |
| `financeiro:manage_gateways` | gateway credentials/routing |

Agent policy:
- agent may create budget draft only with human-approved input.
- agent may send collection reminders only through configured collection action.
- agent shall not delete payments or alter gateway credentials.

---

## 10. Integrações cross-module

| Origem | Destino | Contrato |
|---|---|---|
| Financeiro | Comercial | `converterLeadSemAgendar(leadId)` returns `patientId` |
| Financeiro | Atendimento | send WhatsApp message for charge/reminder |
| CRM | Financeiro | read financial summary by contact |
| Agent | Financeiro | call Actions exposed by module registry |

New Comercial bridge:
- create or update patient from lead data.
- mark lead as `converted`.
- set `convertedAt`.
- do not schedule appointment.

---

## 11. Testes

| Type | Tool | Scope |
|---|---|---|
| Unit | Jest | totals, installments, routing precedence, collection rule |
| Contract | Jest/Zod/MSW | Asaas create charge + webhook payload |
| Route | Jest | gates, RBAC, webhook secret, not_found isolation |
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

## 12. Spec coverage

| Req | Sections |
|---|---|
| REQ-FIN-01 | 3, 5, 10 |
| REQ-FIN-02 | 5, 11 |
| REQ-FIN-03 | 3, 10 |
| REQ-FIN-04 | 8, 11 |
| REQ-FIN-05 | 6, 8 |
| REQ-FIN-06 | 7, 8, 11 |
| REQ-FIN-07 | 7, 8 |
| REQ-FIN-08 | 7, 10 |
| REQ-FIN-09 | 8, 11 |
| REQ-FIN-10 | 8, 9 |
| REQ-FIN-11 | 8, 11 |
| REQ-FIN-12 | 6, 11 |

---

## 13. Próximo passo

Após revisão do usuário: gerar plano em `docs/superpowers/plans/2026-07-05-eixo2-financeiro-cobranca-implementation.md`.
Implementação deve seguir TDD e manter commits por task.
