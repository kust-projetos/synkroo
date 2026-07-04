# Eixo 2 — Módulo Comercial (E-05, Onda 2) — Design

> **Tipo:** Spec de módulo (design). Primeiro módulo sugerido da Onda 2, após Onda 1 + hardening.
> **Data:** 2026-07-04
> **Status:** Aprovado em recorte pelo usuário (Opção B). Pendente revisão do spec escrito antes do plano de implementação.
> **Escopo:** planejamento/documentação. Implementação por plano derivado, sem código neste documento.
> **Dependências:** Core, Operacional (E-02), Atendimento (E-01), Follow-up (E-03) e IA base fechados. Comercial consome Actions de Atendimento/Operacional; não depende de CRM (E-04).

## 0. Contexto e objetivo

O **Comercial (E-05)** cobre captura, qualificação, pipeline e conversão de leads em avaliações/agendamentos. É o próximo módulo canônico depois da Onda 1, conforme `2026-06-21-eixo2-sequenciamento-design.md` (§5): E-05 antes de E-04 CRM, pois estabiliza o bounded context de leads que o CRM depois referencia.

**Recorte aprovado:** implementar **Opção B** — migrar **leads + pipeline + conversão para avaliação** agora. Orçamentos/budgets ficam como **bridge** para E-03/Financeiro futuro; não entram como ownership principal deste módulo.

**Fonte de verdade superior:** roadmap-mestre `2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`; sequenciamento `2026-06-21-eixo2-sequenciamento-design.md`; histórias `docs/planning/stories/e-05-stories.md`.

---

## 1. Decisão de escopo

| Área | Decisão | Motivo |
|---|---|---|
| Leads | **Escopo** | Núcleo E-05: captura, dedup, scoring, status |
| Pipeline stages | **Escopo** | Kanban comercial já existe e pertence a vendas |
| Lead activities / tasks | **Escopo** | Histórico e próximos passos do vendedor/agente |
| Conversão para paciente | **Escopo via bridge E-02** | Comercial atualiza lead; Operacional cria/usa paciente |
| Agendamento de avaliação | **Escopo via Action E-02** | E-05 orquestra intenção comercial; E-02 mantém agenda |
| Notificação de lead quente | **Escopo via Action E-01 + job E-05** | E-05 decide/dedup; Atendimento envia mensagem |
| Budgets/orçamentos | **Bridge, não ownership** | Tabelas atuais ficam em `business.ts`; Financeiro futuro assume |
| CRM unificado/contatos | **Fora** | E-04 redesenha Lead ↔ Paciente ↔ Contato depois |
| Marketing/campanhas | **Fora** | E-06/E-03; Comercial só lê origem/campaignId |

**Trade-off registrado:** mover budgets junto parece completo, mas mistura vendas com cobrança/financeiro e aumenta risco. Manter bridge preserva follow-up de orçamentos já usado por E-03 e evita reabrir Financeiro antes da hora.

---

## 2. Requisitos EARS

| ID | EARS | Fonte |
|---|---|---|
| REQ-COM-01 | When a WhatsApp or Instagram interaction shows purchase interest, the Comercial module shall create or update one lead for the clinic without duplication. | E-05-S01 |
| REQ-COM-02 | When a lead is created or updated, the Comercial module shall calculate score and temperature from source, contact data, interest, urgency, budget signal, engagement, and previous-patient signal. | E-05-S02 |
| REQ-COM-03 | When a lead score crosses the hot threshold, the Comercial module shall enqueue a hot-lead notification, deduplicate it for 24h, and log the activity. | E-05-S04 |
| REQ-COM-04 | When a user moves a lead between pipeline stages, the Comercial module shall update stage/status and record the activity. | Existing pipeline |
| REQ-COM-05 | When a hot lead accepts evaluation scheduling, the Comercial module shall ensure a patient exists via Operacional, call Operacional scheduling action, and mark the lead as converted only after scheduling succeeds. | E-05-S03 |
| REQ-COM-06 | While the Comercial module is disabled for an instance, route gates shall hide all Comercial API surfaces and menu entries. | Core gates |
| REQ-COM-07 | If a lead belongs to another clinic, then the Comercial module shall return not_found or forbidden without exposing data. | LGPD/multitenant |
| REQ-COM-08 | Where budget follow-up is included, the Comercial module shall expose only bridge metadata and shall not own budget schema or payment logic. | Scope decision |
| REQ-COM-09 | When capture happens concurrently for the same clinic and phone, the Comercial module shall persist only one lead using a DB-enforced dedup key. | E-05-S01 |
| REQ-COM-10 | When a seller creates a follow-up task for a lead, the Comercial module shall store, list, update, and close the task within the lead scope. | Tasks ownership |

---

## 3. Estado atual (reconhecimento)

| Item | Estado | Evidência |
|---|---|---|
| Schema de leads/pipeline | Existe, legado central | `src/lib/db/schema/crm.ts`: `leads`, `leadActivities`, `pipelineStages`, `tasks` |
| Schema de budgets | Existe separado | `src/lib/db/schema/business.ts`: `budgets`, items, installments, payments |
| Services de leads | Existe, fora do template | `src/services/leads/leads.service.ts` |
| Notification service | Existe, com gap dedup | `lead-notification.service.ts` diz `lead_notifications table not in schema` |
| Pipeline service | Existe, compacto/fora do template | `src/services/pipeline/stages.service.ts` |
| Repositories | Existem legados | `src/repositories/leads`, `src/repositories/pipeline` |
| APIs | Existem sem módulo/gate canônico | `/api/leads/*`, `/api/pipeline/*`, `/api/budgets/*` |
| UI | Existe | `/dashboard/leads`, `/dashboard/crm/pipeline`, components pipeline |
| Atendimento → lead | Acoplado a legado | `webhook-processor-service.ts` importa `@/services/leads/leads.service` e `@/repositories/leads` |
| Follow-up → budgets | Bridge legado | `src/modules/followup/services/budget-followup-service.ts` |

---

## 4. Arquitetura do módulo

```
src/modules/comercial/
├── actions/        # lead, pipeline, conversion, evaluation scheduling
├── repositories/   # leads, pipeline, activities
├── services/       # scoring, capture, conversion, notification, pipeline
├── schema/         # leads, pipeline, tasks, index
├── ui/             # route adapter + page seams
├── manifest.ts
├── permissions.ts
└── index.ts
```

Fluxo canônico:

```
route/UI/agent → runAction(comercialAction, input, ctx)
               → service (score, dedup, conversion invariant)
               → repository (Drizzle)
               → schema owned by Comercial
```

Boundary rules:

1. Actions não importam `getDb()`.
2. Routes não chamam service/repository direto; viram adapters sobre Actions.
3. Atendimento captura lead chamando Action `capturarLead`, não service legado.
4. Comercial agenda avaliação via `ensurePacienteParaLead` → Action E-02 `agendarConsulta` → `converterLead`.
5. Comercial notifica lead quente via Action `atendimento.enviarMensagem`; não usa `@/lib/whatsapp/send` direto após migração.
6. Budgets ficam fora de `src/modules/comercial/schema`; Comercial só pode armazenar `hasBudget`/sinais comerciais no lead.

---

## 5. Schema ownership

| Tabela atual | Dono futuro | Ação |
|---|---|---|
| `leads` | Comercial | mover para `src/modules/comercial/schema/leads.ts`; adicionar `phoneNormalized` + unique `(clinicId, phoneNormalized)` |
| `lead_activities` | Comercial | mover junto com leads |
| `pipeline_stages` | Comercial | mover para `schema/pipeline.ts` |
| `tasks` | Comercial | mover neste slice; task com `leadId` pertence ao fluxo comercial |
| `campaigns`, `campaign_recipients`, `campaign_segments` | E-03/E-06 | não mover para Comercial |
| `follow_ups`, `follow_up_configs` | E-03 | já pertence conceitualmente a Follow-up |
| `budgets`, `budget_items`, `payments` | Financeiro futuro | não mover |

**Regra de F1:** mover `leads`, `lead_activities`, `pipeline_stages` e `tasks`. `crm.ts` pode ficar temporariamente com campanhas/follow-ups, com re-export em `src/lib/db/schema/index.ts`.

---

## 6. Actions e permissões

| Action | Permissão | Tipo | Observação |
|---|---|---|---|
| `capturarLead` | `comercial:capture_leads` | escrita/sistema | usada por Atendimento/webhooks |
| `qualificarLead` | `comercial:manage_leads` | escrita | recalcula score + temperatura |
| `listarLeads` | `comercial:view` | leitura | filtros por status/temp/stage |
| `obterLead` | `comercial:view` | leitura | escopo por clínica obrigatório |
| `atualizarLead` | `comercial:manage_leads` | escrita | dados comerciais |
| `moverLeadEtapa` | `comercial:manage_pipeline` | escrita | registra activity |
| `converterLead` | `comercial:convert_leads` | escrita | marca converted + vínculo paciente |
| `agendarAvaliacao` | `comercial:convert_leads` | orquestração | garante paciente, agenda via E-02, converte após sucesso |
| `listarPipeline` | `comercial:view` | leitura | Kanban |
| CRUD pipeline stages | `comercial:manage_pipeline` | escrita | stages da clínica |
| CRUD tasks comerciais | `comercial:manage_leads` | escrita/leitura | follow-up manual por lead |

Manifesto:

```ts
export const comercialManifest = {
  id: 'comercial',
  name: 'Comercial',
  alwaysOn: false,
  menu: [
    { moduleId:'comercial', permission:'comercial:view', label:'Leads', path:'/dashboard/leads', icon:'FlagIcon' },
    { moduleId:'comercial', permission:'comercial:view', label:'Pipeline', path:'/dashboard/crm/pipeline', icon:'Squares2X2Icon' },
  ],
  jobs: ['comercial.hot-leads'] as string[],
};
```

Permissões mínimas:
- `comercial:view`
- `comercial:capture_leads`
- `comercial:manage_leads`
- `comercial:manage_pipeline`
- `comercial:convert_leads`

---

## 7. Fases ordenadas

| Fase | Conteúdo | Gate |
|---|---|---|
| F1 Schema seam | Mover `leads`, `leadActivities`, `pipelineStages`, `tasks`; adicionar dedup key | `typecheck` + `db:generate` sem drift inesperado |
| F2 Services/repositories | Portar leads/pipeline/tasks para template | unit scoring + repository tests |
| F3 Actions | Criar catálogo de Actions + bootstrap, incluindo tasks comerciais | registry test + RBAC tests |
| F4 Route adapters/gates | Migrar `/api/leads/*` e `/api/pipeline/*` para `runAction` + `withModuleRoute` | route integration gated/off |
| F5 Cross-module bridges | Atendimento→Comercial, Comercial→Operacional, Comercial→Atendimento notification | integration focused |
| F6 UI/menu | Manifest controla menu; `/dashboard/crm/pipeline` canônico; `/dashboard/pipeline` vira redirect/legado se tocado | snapshot/route smoke |
| F7 Legacy cleanup | Remover ou adaptar `src/services/leads`, `src/repositories/leads`, `src/services/pipeline` | rg sem imports proibidos |

---

## 8. Scoring e dedup

Scoring preserva regra existente, ajustada às stories:

| Fator | Pontos |
|---|---:|
| Origem WhatsApp | +18 |
| Origem Instagram | +15 |
| Origem referral | +20 |
| Telefone presente | +10 |
| Email presente | +5 |
| Interesse em procedimento | +15 |
| Perguntou preço/orçamento | +15 |
| Urgência/timeline | +15 |
| Respondeu follow-up | +15 |
| Paciente existente | +10 |

Temperatura:

- `hot`: score ≥ 70
- `warm`: score 40–69
- `cold`: score < 40

Dedup:

1. Normalizar telefone em `phoneNormalized` (somente dígitos, com regra BR atual do projeto).
2. Enforçar unique DB `(clinicId, phoneNormalized)` quando `phoneNormalized` não é nulo.
3. Usar upsert/transação para capturas concorrentes; corrida webhook+manual atualiza a mesma linha.
4. Se houver lead convertido/perdido, reabrir/atualizar o lead existente; não criar 2º lead automático.
5. Nunca deduplicar entre clínicas.

---

## 9. Cross-module contracts

| Origem | Destino | Contrato |
|---|---|---|
| Atendimento | Comercial | webhook chama `capturarLead` quando mensagem contém intenção comercial |
| Comercial | Operacional | `agendarAvaliacao` cria/atualiza paciente via E-02, agenda avaliação, converte lead após sucesso |
| Comercial | Atendimento | job `comercial.hot-leads` chama `atendimento.enviarMensagem`; sem `sendWhatsAppMessage` direto |
| Comercial | E-03 | E-03 pode ler leads/budgets para follow-up; Comercial não assume cron de retenção |
| Comercial | E-04 | CRM futuro consome leads via Action/read model; não bloquear E-05 por CRM |
| IA | Comercial | agent tools vêm de Action registry (`capturarLead`, `qualificarLead`, `listarPipeline`, `agendarAvaliacao`) |

---

## 10. Error handling e segurança

- `not_found` quando lead/stage não pertence à clínica.
- `forbidden` sem permissão RBAC.
- `conflict` para stage duplicado, conversão duplicada, ou lead já convertido.
- Logs sem telefone completo quando não necessário; mascarar em auditoria se aplicável.
- Query sempre filtra `clinicId`.
- Webhook/system capture usa contexto system com `clinicId` explícito e módulo habilitado.
- Notification dedup usa `leadActivities.activityType='hot_lead_notified'` em janela 24h; sem nova tabela.
- Notification recipient: `lead.assignedTo.phone` ativo; fallback primeiro Owner/Admin ativo da clínica com telefone; se ausente, criar task e registrar `hot_lead_notification_skipped`.
- Notification mode: assíncrono via job `comercial.hot-leads`, gated por `assertModuleForJob('comercial')`; capture/qualify só enfileira/loga.

---

## 11. Testes

**Tests:**
- Unit (Jest, RED first): scoring, temperature, dedup decision, status/stage transition, notification recipient/dedup, task lifecycle.
- Snapshot (auto if UI render): pipeline board/lead card only if touched.
- Contract (auto if external HTTP): `atendimento.enviarMensagem` and Operacional scheduling Action via mocked/integration `runAction`.
- E2E (opt-in, ask after implementation): lead captured → appears in pipeline → schedule evaluation.
- Mutation (Stryker, ≥70%): `lead-scoring-service.ts`, `lead-capture-service.ts`.
- Coverage ratchet: ≥80% new code.

Integration matrix: concurrent capture creates one lead; cross-clinic isolation; hot qualification enqueues notification; hot-lead job sends to assigned/admin fallback once per 24h; task CRUD stays lead-scoped; stage move logs activity; evaluation scheduling creates/uses patient and converts only after Operacional success; gates return 404 when disabled.

---

## 12. Definition of Done

- [ ] Comercial module scaffold exists under `src/modules/comercial`.
- [ ] Leads/pipeline/tasks ownership moved with `phoneNormalized` DB dedup key.
- [ ] `/api/leads/*` and `/api/pipeline/*` are adapters over Actions and gated by `withModuleRoute('comercial')`.
- [ ] Atendimento no longer imports `@/services/leads` or `@/repositories/leads` directly.
- [ ] Hot lead notification dedup uses `leadActivities` 24h marker, not permanent no-op.
- [ ] `agendarAvaliacao` creates/updates patient via E-02, calls Operacional Action, and updates lead only after success.
- [ ] Comercial task actions cover create/list/update/close within lead scope.
- [ ] Menu entries Leads/Pipeline come from `comercialManifest`, not static sidebar copy.
- [ ] Budget schema remains outside Comercial; bridge documented.
- [ ] `typecheck`, focused unit/integration tests, and boundaries lint pass.
- [ ] Agent registry exposes Comercial Actions without parallel tool definitions.

---

## 13. Non-goals

- Redesenhar CRM/Contatos (E-04).
- Migrar budgets/payments para Comercial.
- Criar Financeiro/cobrança.
- Criar automação de marketing E-06.
- Reescrever UI de pipeline; preservar comportamento atual, apenas conectar ao módulo.
- Criar multi-agent sales orchestration além de expor Actions para IA existente.

---

## 14. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| `crm.ts` mistura campanhas/followups | Mover leads/pipeline/tasks; documentar bridges |
| Notification usa WhatsApp direto | Trocar por Action `atendimento.enviarMensagem` |
| Dedup sem constraint única | Adicionar `phoneNormalized` + unique `(clinic_id, phone_normalized)` + upsert |
| E-04 dependência histórica no DoR | Sequenciamento atual supersede: E-05 vem antes de E-04 |
| Budgets tentarem entrar no escopo | Manter bridge; Financeiro futuro assume |
| UI depende de APIs legadas | Migrar rotas preservando URL e contrato de resposta |

---

## 15. Referências

| Documento/arquivo | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Ordem Onda 2 |
| `docs/planning/stories/e-05-stories.md` | Stories E-05 |
| `docs/planning/product-brief.md` | Pipeline, captação, fechamento assistido |
| `src/lib/db/schema/crm.ts` | Schema legado de leads/pipeline |
| `src/lib/db/schema/business.ts` | Budget bridge fora do escopo |
| `src/services/leads/leads.service.ts` | Lógica legada de scoring/captura |
| `src/services/pipeline/stages.service.ts` | Pipeline legado |
| `src/modules/atendimento/services/webhook-processor-service.ts` | Atual ponto de captura via legado |
