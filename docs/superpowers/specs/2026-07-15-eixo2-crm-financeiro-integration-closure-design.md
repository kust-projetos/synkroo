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
| REQ-CLOSE-05 | When `POST`, `PUT`, or `PATCH` targets `/api/contacts/**`, the system shall return `405 { error: 'crm_mvp_read_only' }`. |
| REQ-CLOSE-06 | While CRM or Financeiro is disabled, the system shall return `404` for its API and direct dashboard route. |
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
| `GET/POST /api/contacts/:id/notes?type=` | CRM note actions |
| `PUT /api/contacts/:id/tags?type=` | `crm.atualizarTagsContato` |
| `POST /api/contacts`, `PUT/PATCH /api/contacts/:id` | `405 crm_mvp_read_only` |
| Contacts UI | lista/detalhe/timeline/notas/tags/duplicados; sem create/edit/archive |

`/dashboard/contatos` carrega lista, detalhe e fila de duplicados reais; não pode manter `suggestions={[]}`. `/dashboard/contatos` e `/dashboard/financeiro` passam por gate direto, além do menu. Owner bridge actions normalize tags by trim, empty removal and case-insensitive dedup. Converted leads remain available by legacy detail identity, hidden from default list.

## Registry, RBAC e IA

| Área | Decisão |
|---|---|
| CRM registry | registra ações CRM de leitura, notas/tags e review humano de duplicados |
| CRM cron | `reprocessarSugestoesDuplicidade` é exclusivo do cron/system runner; não entra no catálogo IA |
| Owner merge | merges de patient/lead são internos, chamados pelo coordenador CRM; sem rota, registry público ou tool |
| Financeiro registry | registra `financeiroActions` e `financeiroAccessPermissions` |
| Menu | adiciona `crmManifest` e `financeiroManifest` ao menu central |
| Presets | Administrador inclui módulos CRM e Financeiro; Recepcionista recebe apenas `crm:view`; Comercial recebe apenas `crm:view`, `crm:manage_notes`, `crm:manage_tags`; nenhum recebe merge por inclusão de módulo |
| IA | allowlist por action, deny-by-default; CRM review/merge, cron, owner merge, gateway config, pagamentos e cobranças ficam fora; testes exercitam cada exclusão |

## Fluxos de erro

| Caso | Resultado |
|---|---|
| módulo desligado | 404 |
| sessão ausente | 401 |
| permissão ausente | 403 |
| owner/contact fora da clínica | 404 sem vazamento |
| `type` ausente/inválido | 400 |
| mutação CRM fora de escopo | 405 `crm_mvp_read_only` |
| action fora da allowlist IA | ausente do catálogo e `unknown_tool` se forçada |

## Testes

| Tipo | Escopo |
|---|---|
| Unit, RED primeiro | mapeamento/lista CRM, ordenação, tags, política agent-safe |
| Route | gates CRM, contratos `405`, `type`, auth, Financeiro preservado |
| Contract | chamada CRM -> owner action para notas/tags |
| Integration | isolamento por clínica, bootstrap/RBAC reconciliation, dedup humano |
| Snapshot | estados lista/detalhe/duplicados da UI CRM |
| Mutation | mapping/timeline/tag policy e tool policy, mínimo 70% |
| E2E | decisão registrada após gates unit/route/integration |

## Critérios de aceite

- CRM MVP cumpre REQ-CLOSE-01..06 sem imports de serviços legados nas rotas.
- Financeiro cumpre REQ-CLOSE-07, 08 e 11 sem regressão de contratos.
- Presets e catálogo IA cumprem REQ-CLOSE-09 e 10.
- Todas alterações seguem RED -> GREEN -> REFACTOR.
- Plano de hardening não rastreado continua preservado.
