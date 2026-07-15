# Eixo 2 — Fechamento de Integração CRM e Financeiro

**Status:** Aguardando revisão do usuário.

## Contexto

- Financeiro implementa actions, rotas, UI e persistência, mas está fora de bootstrap/menu.
- CRM atual contém dedup/merge; `/api/contacts/**` e UI ainda usam serviços legados mutáveis.
- `crmActions = []`; catálogo IA expõe qualquer action registrada e autorizada.
- Plano de hardening não rastreado permanece intocado.

## Objetivo

Fechar contratos aprovados de CRM MVP e Financeiro sem expor mutações internas ao agente IA.

## Escopo

| Inclui | Exclui |
|---|---|
| CRM lista, detalhe, timeline, notas, tags | criação/edição/arquivamento via CRM |
| Cutover atômico de `/api/contacts/**` | tabela `contacts`, auto-merge, undo |
| Registro CRM/Financeiro, menu, RBAC | novo gateway ou expansão financeira |
| Política explícita de tools IA | reprocessamento/merge owner por IA |

## Decisões

| Decisão | Motivo | Rejeitado |
|---|---|---|
| Cutover atômico CRM | Contrato MVP já define CRM read-only | compatibilidade que prolonga bypass |
| CRM lê owners; owners escrevem | Preserva autoridade Patient/Lead | CRM escrever tabelas alheias |
| Registry HTTP separado de catálogo IA | Actions internas não viram tools por acidente | inferir segurança pelo nome |
| Registrar Financeiro integralmente | Ações e permissões já existem | rotas funcionarem sem Action registry |

## Arquitetura

```text
UI/API contacts -> crm action -> CRM read service -> contact-read repository (SELECT/COUNT)
                                    |-> owner action (notes/tags)

UI/API financeiro -> financeiro action -> service -> repository/gateway

bootstrap -> action registry -> HTTP adapters
                         -> tool-policy allowlist -> IA bridge catalog
```

### Regras de fronteira

1. `contact-read-repository.ts` é única exceção CRM para `SELECT`/`COUNT` cross-schema.
2. CRM não executa `INSERT`, `UPDATE` ou `DELETE` em tabelas owner.
3. Notas/tags chamam actions de Operacional ou Comercial, com `clinicId` do contexto.
4. Rotas não importam `src/services/contacts/**`, repository ou DB diretamente.
5. Catálogo IA usa allowlist explícita por nome de action agent-safe; registry global não implica exposição e ausência significa bloqueio.

## Requisitos

| ID | EARS requirement |
|---|---|
| REQ-CLOSE-01 | When CRM is enabled, the system shall list patients and unconverted leads in one globally ordered, paginated result. |
| REQ-CLOSE-02 | When a CRM user opens a contact, the system shall resolve `{ type, id }` inside caller clinic or return `not_found`. |
| REQ-CLOSE-03 | When a CRM user reads timeline or notes, the system shall normalize owner events without exposing another clinic. |
| REQ-CLOSE-04 | When a CRM user adds a note or changes tags, the system shall call owner actions and shall not mutate owner tables directly. |
| REQ-CLOSE-05 | When `POST /api/contacts` or `PUT`/`PATCH /api/contacts/:id` targets CRM entity mutation, the system shall return `405 { error: 'crm_mvp_read_only' }` while notes, tags and duplicate review remain available. |
| REQ-CLOSE-06 | While CRM or Financeiro is disabled, the system shall return `404` for its API and direct dashboard route; Financeiro provider webhooks shall still reconcile known existing charges. |
| REQ-CLOSE-07 | When bootstrap runs, the system shall register CRM public actions, Financeiro actions, and both permission catalogs exactly once. |
| REQ-CLOSE-08 | When a permitted user loads navigation, the system shall show CRM and Financeiro only when their modules are enabled. |
| REQ-CLOSE-09 | When role presets seed or reconcile, the system shall grant CRM only to approved roles and preserve Financeiro grants for Administrador. |
| REQ-CLOSE-10 | When the IA bridge builds tools, the system shall exclude owner merges, duplicate reprocessing, gateway configuration, payment settlement, and all non-agent-safe actions. |
| REQ-CLOSE-11 | When a Financeiro action runs through bootstrap, the system shall preserve existing route contracts and tenant controls. |

## CRM cutover

| Surface | Estado final |
|---|---|
| `GET /api/contacts` | `crm.listarContatos` |
| `GET /api/contacts/:id?type=` | `crm.obterContato` |
| `GET /api/contacts/:id/timeline?type=` | `crm.listarTimelineContato` |
| `GET/POST /api/contacts/:id/notes?type=` | CRM note actions; continua mutável |
| `PUT /api/contacts/:id/tags?type=` | `crm.atualizarTagsContato`; continua mutável |
| `GET/POST /api/contacts/duplicates/**` | review/merge humano CRM; continua mutável |
| `GET /api/contacts/:id/appointments` | adapter CRM gated, read-only; preserva aba de agendamentos |
| `POST /api/contacts`, `PUT/PATCH /api/contacts/:id` | somente estes retornam `405 crm_mvp_read_only` |
| Contacts UI | lista/detalhe/timeline/notas/tags/duplicados; sem create/edit/archive |

`/dashboard/contatos` carrega split view, lista/detalhe e fila de duplicados reais; não pode manter `suggestions={[]}`. `/dashboard/contatos` e `/dashboard/financeiro` ganham wrapper server-side que consulta manifesto e chama `notFound()` quando o módulo está desligado; componentes client ficam abaixo do wrapper. Menu oculto não é proteção. Owner bridge actions normalize tags by trim, empty removal and case-insensitive dedup. Converted leads remain available by legacy detail identity, hidden from default list.

## Registry, RBAC e IA

| Área | Decisão |
|---|---|
| CRM públicas/humanas | lista, detalhe, timeline, notas, tags, review e execução humana de duplicidade entram no registry HTTP |
| CRM system-only | `reprocessarSugestoesDuplicidade` roda somente por cron/system runner; não integra array público ou catálogo IA |
| Owner merge internas | `operacional.mesclarPacientes` e `comercial.mesclarLeads` ficam fora dos arrays públicos, rotas e catálogo IA; coordenador CRM as chama internamente |
| Financeiro registry | registra `financeiroActions` e `financeiroAccessPermissions`; `financeiroManifest.jobs` declara `financeiro-collections` |
| CRM manifest | `crmManifest.jobs` declara `crm-duplicates` |
| Menu | adiciona `crmManifest` e `financeiroManifest` ao menu central |
| Presets | Administrador inclui módulos CRM e Financeiro; Recepcionista recebe `crm:view`; Comercial recebe `crm:view`, `crm:manage_notes`, `crm:manage_tags`; permissões existentes são reconciliadas idempotentemente por backfill após registrar catálogos |
| IA | allowlist literal de actions aplicada em `listToolsLogic` e `executeActionLogic`; deny-by-default. Nesta entrega nenhuma action CRM ou Financeiro é allowlisted. Matriz de segurança permanece segunda barreira. |

## Fluxos de erro

| Caso | Resultado |
|---|---|
| módulo desligado | 404 |
| sessão ausente | 401 |
| permissão ausente | 403 |
| owner/contact fora da clínica | 404 sem vazamento |
| `type` ausente/inválido | 400 |
| criação/edição/arquivamento da entidade CRM | 405 `crm_mvp_read_only` |
| nota, tag ou duplicidade humana válida | executa ação autorizada, nunca 405 por read-only |
| action fora da allowlist IA | ausente do catálogo e `unknown_tool` se forçada, mesmo registrada globalmente |

## Testes e rastreabilidade

| REQ | Teste RED obrigatório | Prova GREEN |
|---|---|---|
| 01-04 | listagem global, detalhe/timeline/notes cross-clinic, bridges owner | unit + integration CRM |
| 05 | entity `POST/PUT/PATCH` retorna 405; `POST notes`, `PUT tags` e duplicate actions continuam mutáveis | route contracts |
| 06 | API e wrappers server-side de ambas páginas retornam 404; webhook Financeiro reconcilia known charge com módulo off | route + page + webhook |
| 07 | bootstrap registra CRM/Financeiro uma vez e registry preserva idempotência | bootstrap test |
| 08 | menus CRM/Financeiro dependem de manifesto e permission | build-menu test |
| 09 | seed/backfill idempotente adiciona grants CRM sem merge implícito | preset + reconciliation integration |
| 10 | listagem e execução forçada rejeitam action fora da allowlist IA | bridge unit tests |
| 11 | rotas Financeiro existentes mantêm shape e tenant scope após bootstrap | route + integration |

| Tipo | Escopo |
|---|---|
| Unit, RED primeiro | mapping/lista CRM, tags, allowlist literal IA |
| Route | gates CRM, `405` seletivo, `type`, auth, Financeiro preservado |
| Contract | chamada CRM -> owner action para notas/tags |
| Integration | isolamento clínica, bootstrap/RBAC/backfill, dedup humano |
| Snapshot | split view, lista/detalhe/duplicados CRM |
| Mutation | mapping/timeline/tag policy e allowlist, mínimo 70% |
| E2E | decisão registrada após gates unit/route/integration |

## Critérios de aceite

- CRM MVP cumpre REQ-CLOSE-01..06 sem imports de serviços legados nas rotas.
- Financeiro cumpre REQ-CLOSE-07, 08 e 11 sem regressão de contratos.
- Presets e catálogo IA cumprem REQ-CLOSE-09 e 10.
- Todas alterações seguem RED -> GREEN -> REFACTOR.
- Plano de hardening não rastreado continua preservado.
