# Eixo 2 — Módulo Atendimento Multicanal (E-01) Implementation Plan

> **Status: SUPERSEDED / HISTÓRICO.** Este plano foi substituído pelo plano canônico em `docs/superpowers/plans/2026-06-23-eixo2-atendimento-modulo-implementation.md`. Mantido apenas como registro histórico da abordagem multicanal; não usar para execução.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refatorar o sistema de canais/conversas maduro para o template canônico do Core (`app → action → service → repository → Drizzle`), cobrindo o bounded context Atendimento Multicanal (Mensagens + Conversas + Canais WhatsApp/Instagram/Widget) com Action Layer, gates reais, e seams de escalation/histórico prontos para o agente W5 consumir.

**Architecture:** Toda operação passa pela Action Layer (`runAction`): rotas REST viram adapters finos sobre Actions; queries no repository; `withModuleRoute` em todas as rotas do módulo; ações de canal separadas por responsabilidade (inbound/send/mídia/fluxo de confirmação).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript 5.6, Drizzle ORM, PostgreSQL, Evolution API v2.3.7, Instagram Graph API, Jest unit/integration, ESLint boundaries.

**Spec:** `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` (Onda 1 — E-01 antes de E-03, depois de E-02); `docs/planning/epics.md` (E-01); `docs/planning/stories/e-01-stories.md` (34 SP, 12 stories).

**Parent roadmap:** `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`

**Agent Orchestration:** Single-Agent Looped — tarefas sequenciais e acopladas; cada tarefa fecha teste→implementação→verificação antes da próxima.

---

## Scope Table

| Fase | Escopo | Tasks | Aprova | Tipo |
|---|---|---|---|---|
| **F1** | Schema extraído para `src/modules/atendimento/schema/` | F1a–F1d | Plan + Review | Refactor |
| **F2** | Module scaffold (manifest, permissions, barrel, bootstrap) | F2a–F2c | Plan + Review | Refactor |
| **F3** | Actions de conversa (iniciar, listar, obter, arquivar) | F3a–F3c | Review | Refactor |
| **F4** | Actions de mensagem inbound (receber, classificar intent, extrair entidades) | F4a–F4c | Review | Refactor |
| **F5** | Actions de mensagem outbound (enviar, agendar, template) | F5a–F5c | Review | Refactor |
| **F6** | Actions de canal WhatsApp (webhook verify, process inbound, evolution status) | F6a–F6b | Review | Refactor |
| **F7** | Actions de canal Instagram (webhook verify, process DM) | F7a–F7b | Review | Refactor |
| **F8** | Actions de widget web (message POST + CORS) | F8a | Review | Refactor |
| **F9** | Gates + route migration + bootstrap registration | F9a–F9c | Plan + Review | Refactor |
| **F10** | Integration tests + idempotent RBAC backfill | F10a–F10c | Review | Test |

---

## Non‑goals (explícito — não implementar nesta Onda)

- **Agente IA W5 completo:** orquestrador 4+1, memória L1–L5, tool calling, rag. E-01 só cria os **seams** (actions de canais + historico + escalation) que o agente W5 vai consumir. O agente entra no fim da Onda 1 (sequenciamento §4).
- **Telegram / SMS / voice channels:** não existem no código atual; não criar agora.
- **Rate limit avançado por canal:** o rate limit atual (`@/lib/rate-limit`) já existe e funciona. Criar limitação por canal específico é P2.
- **Dashboard de métricas de atendimento (E-01-S12):** é um agregador que depende de vários módulos maduros; deferir para Onda 2+.
- **Templates Meta fora da janela 24h:** o sistema já tem `@/services/whatsapp/message-templates.service.ts`. Manter como serviço legado; não refatorar para action a menos que TDD force.
- **Mudar comportamento de webhook existente:** preservar contratos HTTP atuais (GET challenge, POST message). Só mudar de `validateApiAuth` → `buildUserContext` + `withModuleRoute` + `runActionRoute`.

---

## F1 — Schema Extraction (`src/modules/atendimento/schema/`)

**Goal:** Extrair tabelas de mensagens, conversas e canais para o bounded context Atendimento. Seguir o padrão do E-02 F1.

### F1a — Create `src/modules/atendimento/schema/conversations.ts`

Extrair/importar as tabelas de `src/lib/db/schema/conversations.ts`:

```typescript
// Tabelas a incluir (consultar schema Drizzle real):
// - conversations (id, clinicId, patientId, channel, status, lastMessageAt, ...)
// - messages (id, conversationId, role, content, channel, metadata, ...)
// - conversation_sessions (id, conversationId, context, expiresAt, ...)
```

- Manter FK references para Clinics e Patients do schema Core/Operacional.
- NÃO duplicar tabelas — se a tabela já existe no schema global, fazer re‑export.
- Incluir índices: `conversations(clinicId, channel)`, `messages(conversationId, createdAt)`.
- NÃO mover `clinics` ou `patients` — são de outros módulos.
- Barrel `src/modules/atendimento/schema/index.ts` re‑exportando todas.

**Acceptance:** `npm run db:generate` não gera migration (schema é idêntico). `npm run typecheck` OK.

### F1b — Types barrel

Criar `src/modules/atendimento/schema/types.ts` (inferidos Drizzle ou manual). Seguir o padrão de `src/modules/operacional/schema/types.ts`.

### F1c — DB schema audit

Verificar se existe `conversation_sessions` ou `messages.metadata` no DB real. Se faltar, criar migration incremental com Drizzle Kit (não excluir colunas existentes).

**Commit checkpoint:** F1 completo.

---

## F2 — Module Scaffold

### F2a — `src/modules/atendimento/manifest.ts`

```typescript
export const atendimentoManifest: ModuleManifestEntry = {
  id: 'atendimento',
  alwaysOn: false,
  label: 'Atendimento Multicanal',
  menu: [
    { label: 'Conversas', href: '/dashboard/conversations', key: 'atendimento:view' },
  ],
  jobs: [],
};
```

### F2b — `src/modules/atendimento/permissions.ts`

Seguir `src/modules/operacional/permissions.ts`:

```typescript
export const atendimentoAccessPermissions: PermissionEntry[] = [
  { key: 'atendimento:view', module: 'atendimento', label: 'Visualizar atendimento' },
  { key: 'atendimento:manage_messages', module: 'atendimento', label: 'Gerenciar mensagens' },
  { key: 'atendimento:manage_conversations', module: 'atendimento', label: 'Gerenciar conversas' },
  { key: 'atendimento:manage_webhooks', module: 'atendimento', label: 'Gerenciar webhooks' },
  { key: 'atendimento:manage_templates', module: 'atendimento', label: 'Gerenciar templates' },
  { key: 'atendimento:escalate', module: 'atendimento', label: 'Escalar para humano' },
];
```

### F2c — Registro no bootstrap

- Adicionar `atendimentoAccessPermissions` ao `bootstrapActions()` em `src/core/actions/bootstrap.ts`.
- `operacionalActions` já está registrado; `atendimentoActions` segue mesmo padrão.
- Atualizar `src/lib/ui/menu-actions.ts` para incluir `atendimentoManifest`.
- Atualizar `src/core/actions/__tests__/bootstrap.test.ts` para testar permissões do atendimento.

**Commit checkpoint:** F2 completo.

---

## F3 — Actions de Conversa

**Diretório:** `src/modules/atendimento/actions/`

### F3a — `conversations-repository.ts` (se necessário)

Se o repo existente `src/repositories/conversations/index.ts` não tiver os métodos necessários, criar um adaptador no módulo ou estender com funções específicas.

### F3b — Actions de conversa

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.iniciarConversa` | POST | `{ patientId, channel }` | `{ id }` | `atendimento:manage_conversations` |
| `atendimento.listarConversas` | GET | `{ status?, channel?, patientId?, page?, limit? }` | `{ conversations, pagination }` | `atendimento:view` |
| `atendimento.obterConversa` | GET | `{ id }` | `{ conversation, messages }` | `atendimento:view` |
| `atendimento.arquivarConversa` | POST | `{ id }` | `{ success }` | `atendimento:manage_conversations` |
| `atendimento.escalarConversa` | POST | `{ id, reason }` | `{ id }` | `atendimento:escalate` |

### F3c — Barrel `index.ts`

Importar, exportar e registrar todas as actions no barrel `src/modules/atendimento/actions/index.ts`.

**Commit checkpoint:** F3 completo.

---

## F4 — Actions de Mensagem Inbound

**Dependência:** F3 (conversa precisa existir para receber mensagens).

### F4a — `messages-repository.ts`

Métodos: `insertMessage`, `listMessages(conversationId, limit, offset)`, `findMessageById`. Reutilizar `@/repositories/conversations` ou criar adaptador.

### F4b — Actions inbound

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.receberMensagem` | POST (webhook) | `{ clinicId, from, message, channel, metadata? }` | `{ messageId, conversationId }` | `atendimento:manage_webhooks` |
| `atendimento.classificarIntencao` | POST | `{ message }` | `{ intent, confidence, entities }` | `atendimento:manage_messages` |
| `atendimento.extrairEntidades` | POST | `{ message }` | `{ entities }` | `atendimento:manage_messages` |
| `atendimento.historicoMensagens` | GET | `{ conversationId, page?, limit? }` | `{ messages, pagination }` | `atendimento:view` |

**Nota:** `classificarIntencao` e `extrairEntidades` são **stubs** — devem existir como actions para que o agente W5 possa chamá-las, mas a implementação real (LLM call) é de responsabilidade do W5. Implementar como regras heurísticas simples (match de keywords) para não quebrar o pipeline.

### F4c — Seam de escalation

Criar action `atendimento.escalarConversa` (já na F3b) que marca a conversa como `escalated` e retorna dados para notificação. O agente W5 usa essa action quando detecta insatisfação/emergência.

**Commit checkpoint:** F4 completo.

---

## F5 — Actions de Mensagem Outbound

### F5a — `send-message-service.ts`

Mover lógica de envio de `src/services/whatsapp/whatsapp.service.ts` para o módulo, com dispatcher por canal:

- `channel === 'whatsapp'` → `evolutionService.sendMessage()`
- `channel === 'instagram'` → Graph API call
- `channel === 'web'` → retorna erro (widget é recebimento apenas)

### F5b — Actions outbound

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.enviarMensagem` | POST | `{ conversationId, message, channel? }` | `{ messageId }` | `atendimento:manage_messages` |
| `atendimento.agendarMensagem` | POST | `{ conversationId, message, scheduledAt, channel? }` | `{ id }` | `atendimento:manage_messages` |
| `atendimento.obterModeloMensagem` | GET | `{ id }` | `{ template }` | `atendimento:manage_templates` |

### F5c — Template service bridge

A action `obterModeloMensagem` delega para `@/services/whatsapp/message-templates.service.ts` (legado, não refatorar). A rota fica limpa; a dependência fica na action.

**Commit checkpoint:** F5 completo.

---

## F6 — Actions de Canal WhatsApp

**Dependências:** F4 (inbound), F5 (outbound).

### F6a — WhatsApp webhook actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.verificarWebhook` | GET | `{ mode, token, challenge }` | `challenge (string)` | pública (sem auth) |
| `atendimento.processarWebhookWhatsApp` | POST | `{ entries: [...] }` | `{ status }` | pública (valida HMAC) |

**Detalhe:** `verificarWebhook` é o GET de desafio da Meta — **não usa auth**, só valida token. `processarWebhookWhatsApp` valida HMAC com `WEBHOOK_VERIFY_TOKEN` mas **não usa sessão de usuário** (é chamado pela Meta, não pelo dashboard). Ambas devem usar `buildDelegatedContext` system ou ctx mínima.

### F6b — Evolution API bridge

Manter `src/services/whatsapp/evolution.service.ts` como está. Criar action `atendimento.statusEvolution` que consulta status da instância Evolution (conexão, QR code). Não mover o serviço Evolution — é cliente externo.

**Commit checkpoint:** F6 completo.

---

## F7 — Actions de Canal Instagram

**Dependências:** F4 (inbound), F5 (outbound).

### F7a — Instagram webhook actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.verificarWebhookInstagram` | GET | `{ mode, token, challenge }` | `challenge (string)` | pública |
| `atendimento.processarWebhookInstagram` | POST | `{ entry: [...] }` | `{ status }` | pública (valida HMAC) |

### F7b — Instagram Graph API bridge

Manter o cliente existente (se houver em `src/services/`). Criar action `atendimento.responderInstagram` que delega para o cliente, com checagem da janela 24h.

**Commit checkpoint:** F7 completo.

---

## F8 — Actions de Widget Web

### F8a — Widget actions

| Action | Método | Input | Retorno | Permissão |
|---|---|---|---|---|
| `atendimento.receberWidgetMensagem` | POST | `{ clinicId, name, phone?, message }` | `{ messageId, conversationId }` | pública (rate-limited) |

**Detalhe:** Widget web é canal público (sem auth). Usa rate limit e valida `WEBHOOK_SECRET` (como o inbound atual). Cria conversa se não existir para o `phone + clinicId`. Após receber, fica como seam para o agente W5 responder.

**Commit checkpoint:** F8 completo.

---

## F9 — Gates + Route Migration + Bootstrap

### F9a — Migrar rotas de conversas

Wrap com `withModuleRoute('atendimento', moduleManifest)` + `runActionRoute`:

| Rota atual | Action |
|---|---|
| `GET /api/conversations` → `@/repositories/conversations` | `atendimento.listarConversas` |
| `GET /api/conversations/[id]` → `@/repositories/conversations` | `atendimento.obterConversa` |
| `GET /api/messages/history/[id]` → `@/repositories/conversations` | `atendimento.historicoMensagens` |
| `POST /api/messages/send` → `@/services/whatsapp` + `@/repositories/conversations` | `atendimento.enviarMensagem` |
| `POST /api/messages/inbound` → `@/repositories/conversations` | `atendimento.receberMensagem` |

### F9b — Migrar rotas de webhook WhatsApp/Instagram

| Rota atual | Action |
|---|---|
| `GET /api/whatsapp/webhook` → valida `mode` + `token` | `atendimento.verificarWebhook` |
| `POST /api/whatsapp/webhook` → `getDb()` + `@/services/appointments/confirmation-handler` | `atendimento.processarWebhookWhatsApp` |
| `GET /api/instagram/webhook` → valida `mode` + `token` | `atendimento.verificarWebhookInstagram` |
| `POST /api/instagram/webhook` → processa mensagem DM | `atendimento.processarWebhookInstagram` |

### F9c — Migrar rotas de widget

| Rota atual | Action |
|---|---|
| `POST /api/widget/messages` → `@/repositories/conversations` + rate limit | `atendimento.receberWidgetMensagem` |

**Regras para migração de webhooks públicos:**
- Usar `buildDelegatedContext` com `source: 'system'` para ações de webhook (Meta/Instagram chamam sem sessão de usuário).
- Manter validação HMAC/secret antes de chamar a action.
- `runActionRoute` não deve ser usada em rotas públicas (ela chama `buildUserContext` que exige sessão). Essas rotas públicas devem construir ctx manualmente: `{ source: 'system', clinicId, can: () => true, hasModule: () => true, audit: { actor: 'webhook' } }`.

### F9d — Bootstrap registration

- Adicionar `atendimentoActions` ao `bootstrapActions()` em `src/core/actions/bootstrap.ts`
- Adicionar `atendimentoAccessPermissions` ao `registerAccessPermissions()` no mesmo bootstrap
- Atualizar `src/lib/ui/menu-actions.ts` para incluir `atendimentoManifest`
- Atualizar `src/core/actions/__tests__/bootstrap.test.ts` com testes de permissões do atendimento

**Commit checkpoint:** F9 completo.

---

## F10 — Integration Tests + RBAC Backfill

### F10a — Integration test scaffold

Para cada grupo de actions, criar `src/modules/atendimento/__tests__/<grupo>/integration.test.ts`:

```
src/modules/atendimento/__tests__/
├── conversations/integration.test.ts   → F3 (listar, obter, arquivar, escalar)
├── messages/integration.test.ts        → F4–F5 (inbound, send, history)
├── whatsapp/integration.test.ts        → F6 (webhook verify, process)
├── instagram/integration.test.ts       → F7 (webhook verify, process DM)
└── widget/integration.test.ts          → F8 (receive message)
```

- Seguir padrão de guarda `SKIP` + `describeOrSkip` + auto-seed clinic/dentist/patient.
- Usar UUIDs isolados por suite.
- Cleanup only owned rows.

### F10b — Permission guard tests

Adicionar ao `bootstrap.test.ts`:

```typescript
expect(keys).toContain('atendimento:view');
expect(keys).toContain('atendimento:manage_messages');
expect(keys).toContain('atendimento:manage_conversations');
```

### F10c — RBAC backfill

Após deploy do módulo Atendimento, executar:

```bash
node scripts/backfill-rbac-permissions.mjs
```

Isso adiciona as permissões `atendimento:*` a todos os roles de sistema existentes (Owner já tem por bypass; Recepcionista, Administrador etc. ganham as novas permissões automaticamente pelo preset `modules: ['atendimento']` se o preset for atualizado).

Para adicionar `atendimento` aos presets existentes:
- `src/core/rbac/presets.ts`: Adicionar `'atendimento'` ao array `modules` de `'Administrador'`, `'Recepcionista'`, e `'Dentista'`.

**Commit checkpoint:** F10 completo.

---

## File Structure (alvo final)

```
src/modules/atendimento/
├── schema/
│   ├── conversations.ts    ← tabelas extraídas
│   ├── types.ts            ← tipos inferidos
│   └── index.ts            ← barrel
├── actions/
│   ├── iniciar-conversa.ts
│   ├── listar-conversas.ts
│   ├── obter-conversa.ts
│   ├── arquivar-conversa.ts
│   ├── escalar-conversa.ts
│   ├── receber-mensagem.ts
│   ├── classificar-intencao.ts
│   ├── extrair-entidades.ts
│   ├── historico-mensagens.ts
│   ├── enviar-mensagem.ts
│   ├── agendar-mensagem.ts
│   ├── obter-modelo-mensagem.ts
│   ├── verificar-webhook.ts
│   ├── processar-webhook-whatsapp.ts
│   ├── processar-webhook-instagram.ts
│   ├── receber-widget-mensagem.ts
│   └── index.ts            ← barrel + registro
├── services/
│   ├── send-message-service.ts
│   └── (opcional: bridges para legados)
├── repositories/
│   ├── conversations-repository.ts
│   └── messages-repository.ts
├── manifest.ts
├── permissions.ts
├── index.ts                ← surface público
└── __tests__/
    ├── conversations/integration.test.ts
    ├── messages/integration.test.ts
    ├── whatsapp/integration.test.ts
    ├── instagram/integration.test.ts
    └── widget/integration.test.ts
```

---

## Routes to Migrate (Final State)

| Rota | Método | Status Pós-F9 | Action |
|---|---|---|---|
| `/api/conversations` | GET | `withModuleRoute` + `runActionRoute` | `atendimento.listarConversas` |
| `/api/conversations/[id]` | GET | `withModuleRoute` + `runActionRoute` | `atendimento.obterConversa` |
| `/api/messages/inbound` | POST | `withModuleRoute` + `runActionRoute` | `atendimento.receberMensagem` |
| `/api/messages/send` | POST | `withModuleRoute` + `runActionRoute` | `atendimento.enviarMensagem` |
| `/api/messages/history/[id]` | GET | `withModuleRoute` + `runActionRoute` | `atendimento.historicoMensagens` |
| `/api/messages/whatsapp` | POST | `withModuleRoute` + `runActionRoute` | `atendimento.enviarMensagem` (channel=whatsapp) |
| `/api/whatsapp/webhook` | GET | Pública (sem auth) | `atendimento.verificarWebhook` |
| `/api/whatsapp/webhook` | POST | Pública (HMAC) | `atendimento.processarWebhookWhatsApp` |
| `/api/whatsapp/qrcode` | GET | `withModuleRoute` | `atendimento.statusEvolution` |
| `/api/whatsapp/send` | POST | `withModuleRoute` + `runActionRoute` | `atendimento.enviarMensagem` |
| `/api/whatsapp/templates` | GET | `withModuleRoute` + `runActionRoute` | `atendimento.obterModeloMensagem` |
| `/api/whatsapp/evolution` | GET | `withModuleRoute` | bridge (Evolution API) |
| `/api/instagram/webhook` | GET | Pública (sem auth) | `atendimento.verificarWebhookInstagram` |
| `/api/instagram/webhook` | POST | Pública (HMAC) | `atendimento.processarWebhookInstagram` |
| `/api/widget/messages` | POST | Pública (rate limit) | `atendimento.receberWidgetMensagem` |

---

## Acceptance Criteria (Definition of Done)

- [ ] F1: Schema extraído; `npm run db:generate` sem migrations; `npm run typecheck` OK.
- [ ] F2: Manifesto + permissões registrados; bootstrap test cobre `atendimento:*`.
- [ ] F3–F8: 17 actions criadas, importadas, exportadas, registradas.
- [ ] F9: Todas as 15 rotas migradas para `withModuleRoute` + action adapter.
  - Rotas públicas (webhooks) usam ctx `system` em vez de `runActionRoute`.
  - Nenhuma rota tem `getDb()`, `@/repositories/conversations`, ou `@/services/whatsapp` no arquivo de rota.
- [ ] `npm run typecheck` → 0 errors.
- [ ] `npm test` → 0 failures.
- [ ] `RUN_INTEGRATION_TESTS=1 npm run test:integration` → todas as integrações passam.
- [ ] RBAC backfill script executável (`node scripts/backfill-rbac-permissions.mjs`).
- [ ] Nenhum comportamento de webhook existente foi alterado (GET challenge, POST message).

---

## Pitfalls

- **Rotas públicas ≠ `runActionRoute`:** `runActionRoute` chama `buildUserContext()` que exige sessão. Webhooks da Meta/Instagram não têm sessão. Usar `buildDelegatedContext` ou ctx manual `{ source: 'system', ... }`.
- **`getDb()` permitido em actions/services/repos, proibido em rotas.** Ações de webhook podem chamar `getDb()` via repositório, mas a rota não.
- **`conversation_sessions` pode não existir no DB:** Verificar antes de referenciar. Se não existir, criar migration incremental com Drizzle Kit.
- **Instagram `INSTAGRAM_VERIFY_TOKEN`**: Já existe em `jest.setup.ts` mas pode não estar em produção. Verificar env vars antes.
- **Widget web CORS:** A rota atual de widget tem tratamento CORS. Preservar na migração.
- **Evolution API não usa webhook Meta:** Evolution é cliente separado (`src/services/whatsapp/evolution.service.ts`). Não envolver com a Action Layer — é chamada por dentro dos services.

---

## Verification Commands (Cheat Sheet)

| Comando | Verifica |
|---|---|
| `npm run typecheck` | 0 TS errors |
| `npm test` | 0 failures |
| `RUN_INTEGRATION_TESTS=1 npm run test:integration` | Integration tests pass |
| `npm run db:generate` | No schema changes |
| `rg -n "getDb\(" src/app/api/conversations src/app/api/messages src/app/api/whatsapp src/app/api/instagram src/app/api/widget` | 0 matches |
| `rg -n "@/repositories/conversations" src/app/api/` | 0 matches (only in action files) |
| `rg -n "@/services/whatsapp\|@/services/appointments" src/app/api/` | 0 matches (only in action files) |

---

## Ordering Rationale (Why This Task Order)

1. **F1 (Schema)**: Pré-requisito de tudo — sem schema não há queries.
2. **F2 (Scaffold)**: Módulo precisa existir antes de criar actions.
3. **F3 (Conversas)**: Base das conversas — inbound/send dependem de conversa existir.
4. **F4 (Inbound)**: O fluxo mais usado (receber mensagem) — puxa conversa e mensagem.
5. **F5 (Outbound)**: Enviar mensagem — depende do repositório de mensagens de F4.
6. **F6–F7 (Canais)**: Webhooks específicos de canal — dependem de F4 para armazenar mensagem.
7. **F8 (Widget)**: Independente — público, sem auth. Pode vir antes ou depois.
8. **F9 (Gates + Migration)**: Só depois de todas as actions existirem — migra as rotas uma a uma.
9. **F10 (Tests)**: Final — fecha a qualidade.

---

## Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-21-eixo2-sequenciamento-design.md` | Ordem da Onda 1 |
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (fonte de verdade superior) |
| `docs/planning/epics.md` | Vocabulário canônico E-01 |
| `docs/planning/stories/e-01-stories.md` | 34 SP, 12 stories detalhadas |
| `docs/superpowers/plans/2026-06-22-eixo2-operacional-modulo-implementation.md` | Template de plano (E-02) |
| `src/modules/operacional/` | Template canônico do módulo (referência de implementação) |
