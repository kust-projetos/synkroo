# Eixo 2 — Módulo Atendimento (E-01) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidar o módulo `atendimento` (já ~70% construído) ao template canônico: fechar gates de rota, migrar o backend legado (conversations + Evolution/WhatsApp) para dentro do módulo, cobrir com testes por-rota, e retirar o legado de forma coordenada com os consumidores cross-module.

**Architecture:** Toda rota do bounded context é adapter gated (`withModuleRoute` + `runAtendimento(System)Action`); queries no repository do módulo; integração de canal em services do módulo; webhooks preservam verificação de assinatura e respondem 200-no-op idempotente. Sem `getDb()` em actions; services delegam ao repository.

**Tech Stack:** Next.js 15 App Router, TypeScript 5.6, Drizzle ORM, PostgreSQL, Evolution API v2, Jest unit/integration, ESLint boundaries.

**Spec:** `docs/superpowers/specs/2026-06-23-eixo2-atendimento-modulo-design.md` (fases P0–P5).

**Agent Orchestration:** Single-Agent Looped — sequencial; cada tarefa fecha teste→implementação→verificação→commit.

---

## Convenções verificadas (não reinventar)

- Adapters: `runAtendimentoAction(action, input, opts?)` (user; 401 em `unauthenticated`) e `runAtendimentoSystemAction(action, input, clinicId, opts?)` (system/webhook) — `@/modules/atendimento/ui/route-adapter`.
- Gate: `withModuleRoute('atendimento', moduleManifest)(handler)` — `@/core/modules/gates` + `@/core/modules/manifest`.
- `defineAction({ name, module:'atendimento', requires, label, input: z.object({...}), handler: async (input, ctx) => data })`.
- Repository do módulo: `@/modules/atendimento/repositories/conversations-repository` — superfície já existe (`findByClinic`, `findByIdWithJoins`, `countByClinic`, `findMessagesByConversation`, `createConversation`, …); **hoje delega ao legado** `@/repositories/conversations` (P1 porta as implementações).
- Webhook secret (padrão a reusar): `verifyWebhookSecret` com `crypto.timingSafeEqual` (ver `messages/inbound/route.ts:6-19`).
- `messages` schema **não tem** coluna de id externo → dedup por `metadata.externalMessageId`.
- **Lição E-02:** rodar `npm run lint` **isolado** (exit code do próprio lint); import cross-module só via `@/lib/db/schema` ou Action Layer.

---

## File Structure

| Path | Role |
|---|---|
| `src/app/api/{whatsapp/webhook,instagram/webhook,whatsapp/evolution,messages/inbound,widget/messages}/route.ts` | Gatear com `withModuleRoute` (P0); `whatsapp/evolution` ganha auth |
| `src/modules/atendimento/repositories/conversations-repository.ts` | Receber as queries portadas; parar de importar `@/repositories/conversations` (P1) |
| `src/modules/atendimento/services/{evolution-service,channel-service,templates-service}.ts` | Portados de `services/whatsapp/*` (P2) |
| `src/modules/atendimento/services/{send-message-service,webhook-processor-service}.ts` | Parar de importar legado; webhook-processor sai de `getDb()` (P1/P2) |
| `src/modules/atendimento/actions/*.ts` | Migrar para repo/services do módulo; `status-evolution` sai de `getDb()` |
| `src/modules/operacional/services/reminders-service.ts` | Enviar via Action `enviarMensagem` (P5) |
| `src/services/reminders/procedure-reminder-config.service.ts` | Usar `templates-service` helper (P5) |
| `src/app/api/dashboard/stats/route.ts` | Contagem via `@/lib/db/schema` (P5) |
| `src/services/whatsapp/*`, `src/repositories/conversations/*` | Remover ao final (P5) |

---

## Task 0 — P0: Gatear as 5 rotas ungated + auth no evolution

**Files:**
- Modify: `src/app/api/whatsapp/webhook/route.ts`, `src/app/api/instagram/webhook/route.ts`, `src/app/api/whatsapp/evolution/route.ts`, `src/app/api/messages/inbound/route.ts`, `src/app/api/widget/messages/route.ts`
- Test: `src/modules/atendimento/__tests__/gates/integration.test.ts`

- [ ] **Step 1: Gatear `messages/inbound` (preservar WEBHOOK_SECRET + rate limit)**

Envolver o `POST` existente com `withModuleRoute`, sem tocar em `verifyWebhookSecret`/rate-limit:

```ts
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';
// ...handler existente renomeado para handlePOST...
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
```

- [ ] **Step 2: Gatear `widget/messages`** — mesmo padrão (`withModuleRoute` em volta do POST existente).

- [ ] **Step 3: Gatear webhooks Meta preservando assinatura e handshake GET**

Em `whatsapp/webhook` e `instagram/webhook`: o `POST` (assinatura `x-hub-signature-256`) e o `GET` (handshake `hub.verify_token`→`hub.challenge`, **retorno texto cru**) ficam intactos; só envolver com `withModuleRoute`:

```ts
async function handleGET(request: NextRequest) { /* existente: verifica token e retorna challenge como text */ }
async function handlePOST(request: NextRequest) { /* existente: verifySignature + processa */ }
export const GET = withModuleRoute('atendimento', moduleManifest)(handleGET);
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
```

> O GET **não** passa por `runAtendimentoSystemAction` (que devolveria JSON) — devolve o challenge como texto, embrulhado só pelo gate.

- [ ] **Step 4: Gatear + autenticar `whatsapp/evolution` (blocker de segurança)**

Hoje é POST público sem auth (`whatsapp/evolution/route.ts:8`). Adicionar verificação de segredo (mesmo padrão do inbound) **e** gate:

```ts
import crypto from 'crypto';
import { withModuleRoute } from '@/core/modules/gates';
import { moduleManifest } from '@/core/modules/manifest';

function verifyEvolutionSecret(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const provided = request.headers.get('X-Webhook-Secret') || '';
  return provided.length === secret.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

async function handlePOST(request: NextRequest) {
  if (!verifyEvolutionSecret(request)) return NextResponse.json({ error: 'Invalid secret' }, { status: 403 });
  // ...processamento existente...
}
export const POST = withModuleRoute('atendimento', moduleManifest)(handlePOST);
```

- [ ] **Step 5: Teste por-rota — módulo desabilitado → 404**

Em `src/modules/atendimento/__tests__/gates/integration.test.ts`, com `operacional`/`atendimento` controlados via `instanceModules` (ou `makeManifest` com repo stub `isEnabled:false`), chamar os handlers das 5 rotas e esperar **404** quando `atendimento` está desabilitado; **passa** quando habilitado. Mockar assinatura/secret válidos.

Run: `RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/__tests__/gates/integration.test.ts` → PASS.

- [ ] **Step 6: typecheck + commits isolados por rota (reversível)**

```bash
npm run typecheck
# Commit SEPARADO por rota (rollback granular — superfície externa viva):
git add src/app/api/messages/inbound/route.ts && git commit -m "feat(atendimento): gate messages/inbound route"
git add src/app/api/widget/messages/route.ts && git commit -m "feat(atendimento): gate widget/messages route"
git add src/app/api/whatsapp/webhook/route.ts && git commit -m "feat(atendimento): gate whatsapp webhook"
git add src/app/api/instagram/webhook/route.ts && git commit -m "feat(atendimento): gate instagram webhook"
git add src/app/api/whatsapp/evolution/route.ts && git commit -m "feat(atendimento): gate + auth evolution webhook"
git add src/modules/atendimento/__tests__/gates && git commit -m "test(atendimento): per-route disabled->404"
```

---

## Task 1 — P1: Portar o repository + tirar legado das actions + getDb do webhook-processor

**Files:**
- Modify: `src/modules/atendimento/repositories/conversations-repository.ts`
- Modify: actions que importam `@/repositories/conversations` (estático e dinâmico)
- Modify: `src/modules/atendimento/services/webhook-processor-service.ts`
- Test: `src/modules/atendimento/__tests__/conversations/integration.test.ts` (estender)

- [ ] **Step 1: Portar as implementações para o repository do módulo**

Em `conversations-repository.ts`, substituir cada `return repo.X(...)` (delegação a `@/repositories/conversations`) pela **query Drizzle real**, portada fielmente de `src/repositories/conversations/index.ts` (mesma assinatura de cada função: `findByClinic`, `findByIdWithJoins`, `countByClinic`, `findMessagesByConversation`, `createConversation`, `findByExternalId`, `appendMessage`, etc.). Usar `getDb()` + tabelas de `../schema/conversations`. **Remover** `import * as repo from '@/repositories/conversations'` ao final.

Exemplo (countByClinic — usado também por dashboard/stats):

```ts
import { getDb } from '@/lib/db/client';
import { conversations, messages } from '../schema/conversations';
import { and, eq, count } from 'drizzle-orm';

export async function countByClinic(clinicId: string, opts?: { status?: string; channel?: string }) {
  const conds = [eq(conversations.clinicId, clinicId)];
  if (opts?.status) conds.push(eq(conversations.status, opts.status));
  if (opts?.channel) conds.push(eq(conversations.channel, opts.channel));
  const [row] = await getDb().select({ n: count() }).from(conversations).where(and(...conds));
  return row?.n ?? 0;
}
```

(Portar as demais funções no mesmo padrão, preservando o shape de retorno que as actions já consomem — conferir cada uma em `@/repositories/conversations/index.ts`.)

- [ ] **Step 2: Migrar actions para fora de `@/repositories/conversations`**

Em cada action que importa o legado (estático: `enviar-mensagem.ts`, `receber-mensagem.ts`, `agendar-mensagem.ts`, `responder-instagram.ts`, `obter-modelo-mensagem.ts`; dinâmico: `processar-webhook-whatsapp.ts`, `processar-webhook-instagram.ts`), trocar:

```ts
import * as legacyRepo from '@/repositories/conversations';
// e: const { findById } = await import('@/repositories/conversations');
```

por:

```ts
import * as repo from '../repositories/conversations-repository';
```

Se faltar alguma função no repo do módulo, adicioná-la (portada do legado). **Nenhuma action acessa `getDb()`.**

- [ ] **Step 3: Extrair `getDb()` do `webhook-processor-service` para o repository**

`webhook-processor-service.ts` usa `getDb()` em `:18,44,273`. Mover essas queries para funções do `conversations-repository` (ex.: `findOrCreateConversationByExternalId`, `appendInboundMessage`, `updateConversationState`) e fazer o service delegar. Service não acessa `getDb()` direto (padrão E-02).

- [ ] **Step 4: Verificar ausência de legado/getDb**

```bash
rg -n "@/repositories/conversations" src/modules/atendimento
rg -n "getDb\(" src/modules/atendimento/actions
rg -n "getDb\(" src/modules/atendimento/services/webhook-processor-service.ts
```

Expected: 1º só o repository **não** deve mais aparecer importando o legado (zero); 2º vazio; 3º vazio.

- [ ] **Step 5: Testes**

```bash
npm run typecheck
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento
```

Expected: PASS (o teste de conversations existente + novos do repo). Estender o teste para cobrir `createConversation`/`appendMessage`/`countByClinic` reais.

- [ ] **Step 6: Commit**

```bash
git add src/modules/atendimento/repositories src/modules/atendimento/actions src/modules/atendimento/services/webhook-processor-service.ts
git commit -m "refactor(atendimento): own conversations repository (drop legacy)"
```

---

## Task 2 — P2: Portar channel services (Evolution/WhatsApp/templates)

**Files:**
- Create: `src/modules/atendimento/services/evolution-service.ts`, `channel-service.ts`, `templates-service.ts`
- Modify: actions `enviar-mensagem`, `responder-instagram`, `obter-qrcode`, `status-evolution`, `obter-modelo-mensagem`; services `send-message-service`, `webhook-processor-service`
- Test: `src/modules/atendimento/services/__tests__/channel.test.ts`

- [ ] **Step 1: Portar os services de canal**

Portar fielmente (port, não redesign):
- `services/whatsapp/evolution.service.ts` (632 LOC — sendMessage, QR, status de instância, gestão de instâncias) → `evolution-service.ts`.
- `services/whatsapp/whatsapp.service.ts` (339) → `channel-service.ts` (abstração de canal: `sendByChannel`).
- `services/whatsapp/message-templates.service.ts` (221) → `templates-service.ts`, **expondo `fillTemplate` como helper puro** (sem efeito de envio) + `getApprovedTemplates`.

Env via `@/lib/env` (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`); **sem hardcode**. Preservar retry/fallback (incl. Playwright se existir).

- [ ] **Step 2: Migrar actions e services do módulo para fora de `@/services/whatsapp`**

- `enviar-mensagem.ts`, `responder-instagram.ts` → `channel-service`/`evolution-service` do módulo.
- `obter-qrcode.ts`, `status-evolution.ts` → `evolution-service` do módulo. **`status-evolution.ts` perde o `getDb()`** (`:6,19`): se precisar de dado de conversa/instância, via repository.
- `obter-modelo-mensagem.ts` → `templates-service` do módulo.
- `send-message-service.ts` (`:11`), `webhook-processor-service.ts` (`:11`) → services do módulo.

- [ ] **Step 3: Verificar**

```bash
rg -n "@/services/whatsapp" src/modules/atendimento
rg -n "getDb\(" src/modules/atendimento/actions
```

Expected: vazio nos dois.

- [ ] **Step 4: Unit test de canal (Evolution mockado na borda)**

`channel.test.ts`: `sendByChannel('whatsapp', ...)` chama o `evolution-service` (mock do fetch/SDK); resolução de canal; `fillTemplate` é puro (entra template+values, sai string, sem efeito).

```bash
npm test -- src/modules/atendimento/services/__tests__/channel.test.ts
npm run typecheck
```

Expected: PASS; 0 erros.

- [ ] **Step 5: Commit**

```bash
git add src/modules/atendimento/services src/modules/atendimento/actions
git commit -m "refactor(atendimento): own channel services (evolution/templates)"
```

---

## Task 3 — P3: Política de webhook (assinatura preservada + 200-no-op + idempotência)

**Files:**
- Modify: `src/modules/atendimento/services/webhook-processor-service.ts`
- Modify: `src/modules/atendimento/repositories/conversations-repository.ts` (dedup)
- Test: `src/modules/atendimento/__tests__/gates/integration.test.ts` (estender)

- [ ] **Step 1: Implementar idempotência/dedup no append de mensagem inbound**

`messages` não tem coluna de id externo → dedup por `metadata.externalMessageId`. No repository, antes do append:

```ts
import { sql } from 'drizzle-orm';

export async function messageExistsByExternalId(conversationId: string, externalId: string): Promise<boolean> {
  const [row] = await getDb().select({ id: messages.id }).from(messages)
    .where(and(
      eq(messages.conversationId, conversationId),
      sql`${messages.metadata}->>'externalMessageId' = ${externalId}`,
    )).limit(1);
  return !!row;
}

export async function appendInboundMessage(input: { conversationId: string; content: string; externalId?: string; metadata?: Record<string, unknown> }) {
  if (input.externalId && await messageExistsByExternalId(input.conversationId, input.externalId)) {
    return { deduped: true as const };
  }
  const meta = { ...(input.metadata ?? {}), ...(input.externalId ? { externalMessageId: input.externalId } : {}) };
  const [row] = await getDb().insert(messages)
    .values({ conversationId: input.conversationId, direction: 'inbound', content: input.content, metadata: meta })
    .returning({ id: messages.id });
  return { deduped: false as const, id: row.id };
}
```

> **Limitação registrada:** dedup por leitura-então-escrita (não atômico). Para garantia forte sob concorrência, uma coluna `external_message_id` + índice único seria o reforço (migration) — **deferido** desta consolidação; o retry do Meta é majoritariamente sequencial, e o check cobre o caso comum.

- [ ] **Step 2: `webhook-processor` usa o dedup e a política 200-no-op**

O processador extrai `externalMessageId` do payload (Meta/Evolution) e chama `appendInboundMessage`. Se `deduped`, retorna no-op (a rota responde **200**). Assinatura inválida já é 403 na rota (Task 0). Payload malformado → log + 200.

- [ ] **Step 3: Testes de política por-rota**

Estender `gates/integration.test.ts`:
- **assinatura inválida → 403** (whatsapp/instagram/evolution).
- **webhook duplicado** (mesmo `externalMessageId`) → **200 ignored, sem segunda `message`** (assert count de mensagens = 1).
- handshake GET retorna challenge (texto) com módulo ativo.

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/__tests__/gates/integration.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/modules/atendimento/services/webhook-processor-service.ts src/modules/atendimento/repositories src/modules/atendimento/__tests__/gates
git commit -m "feat(atendimento): idempotent webhook processing + policy tests"
```

---

## Task 4 — P4: Testes à paridade (inbound→conversa→envio, canal, escala)

**Files:**
- Test: `src/modules/atendimento/actions/__tests__/inbound-flow/integration.test.ts`, `send/integration.test.ts`

- [ ] **Step 1: Fluxo inbound (integração, DB real)**

`inbound-flow/integration.test.ts`: via `runAction(receberMensagem, { clinicId, from, message, channel:'whatsapp' }, systemCtx)` → cria/atualiza conversa, faz append da mensagem, vincula paciente por telefone (usar `randomUUID()` para fixtures; seed paciente). Assert conversa criada + mensagem inbound persistida + escopo por `clinicId`.

- [ ] **Step 2: Envio + escala (integração)**

`send/integration.test.ts`: `enviarMensagem` resolve canal pela conversa e delega ao `channel-service` (Evolution mockado na borda); `escalarConversa` muda estado e exige `atendimento:escalate` (ctx sem a permissão → `forbidden`).

- [ ] **Step 3: Guard de registry**

Estender `bootstrap.test.ts` (ou criar guard no módulo) afirmando que as 20 actions de atendimento são descobríveis via `getActions()` após `bootstrapActions()` (ex.: `atendimento.enviarMensagem`, `atendimento.receberMensagem`, `atendimento.listarConversas`).

- [ ] **Step 4: Rodar**

```bash
RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento
npm test -- src/core/actions/__tests__/bootstrap.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/atendimento/actions/__tests__ src/core/actions/__tests__/bootstrap.test.ts
git commit -m "test(atendimento): inbound flow, send, escalate, registry guard"
```

---

## Task 5 — P5: Retirada coordenada do legado

**Files:**
- Modify: `src/modules/operacional/services/reminders-service.ts`
- Modify: `src/services/reminders/procedure-reminder-config.service.ts`
- Modify: `src/app/api/dashboard/stats/route.ts`
- Delete: `src/services/whatsapp/*`, `src/repositories/conversations/*` (e testes órfãos)

- [ ] **Step 1: `operacional/reminders` envia via Action `enviarMensagem`**

Trocar `import { sendWhatsAppMessage } from '@/services/whatsapp'` por uma chamada à Action de atendimento via `runAction`/contexto de sistema (cross-module pela Action Layer). Se o contexto de cron não tiver sessão, usar `buildSystemContext`/`runAtendimentoSystemAction` equivalente com `clinicId` resolvido. **Nenhum import de `@/services/whatsapp`** em `reminders-service`.

- [ ] **Step 2: `procedure-reminder-config` usa `templates-service` helper**

Trocar `import { fillTemplate } from '@/services/whatsapp/message-templates.service'` por o `fillTemplate` puro exposto pelo `templates-service` do módulo (via índice público do atendimento) **ou**, se for de fato genérico e sem dependência de canal, por um util em `lib`. Preservar o comportamento de `:202-203`.

- [ ] **Step 3: `dashboard/stats` conta via `@/lib/db/schema`**

Substituir os dois `convRepo.countByClinic(clinicId, { status })` (`stats/route.ts:74-75`) por contagem direta:

```ts
import { getDb } from '@/lib/db/client';
import { conversations } from '@/lib/db/schema';
import { and, eq, count } from 'drizzle-orm';

async function countConversations(clinicId: string, status: string) {
  const [r] = await getDb().select({ n: count() }).from(conversations)
    .where(and(eq(conversations.clinicId, clinicId), eq(conversations.status, status)));
  return r?.n ?? 0;
}
```

Remover `import * as convRepo from '@/repositories/conversations'`.

- [ ] **Step 4: Confirmar zero importadores do legado, então deletar**

```bash
rg -n "@/services/whatsapp|@/repositories/conversations" src --glob '!**/__tests__/**'
```

Expected: **vazio**. Só então:

```bash
git rm -r src/services/whatsapp src/repositories/conversations
# remover também testes órfãos que importam esses paths
```

`tsc` é o gate de que nada quebrou.

- [ ] **Step 5: Gate completo final**

```bash
npm run typecheck
npm run lint        # ISOLADO — conferir exit code do próprio lint
npm test
RUN_INTEGRATION_TESTS=1 npm run test:integration
npm run db:generate # "No schema changes"
```

Expected: todos verdes; lint sem violações de boundaries.

- [ ] **Step 6: Verificação anti-bypass final**

```bash
rg -n "getDb\(|@/repositories/conversations|@/services/whatsapp" src/app/api/whatsapp src/app/api/messages src/app/api/conversations src/app/api/instagram src/app/api/widget
rg -n "getDb\(" src/modules/atendimento/actions
```

Expected: **vazio** nos dois.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(atendimento): retire legacy whatsapp/conversations backend"
```

---

## Self-Review Checklist

- **P0** (Task 0): 5 rotas gated + `whatsapp/evolution` autenticado; GET handshake na rota; commits isolados; teste disabled→404.
- **P1** (Task 1): repository do módulo com queries reais (sem `@/repositories/conversations`); actions sem legado/`getDb()`; `webhook-processor` sem `getDb()`.
- **P2** (Task 2): channel services do módulo; actions/services sem `@/services/whatsapp`; `status-evolution` sem `getDb()`; `fillTemplate` puro.
- **P3** (Task 3): idempotência por `externalMessageId`; 200-no-op; testes 403/200-ignored/handshake.
- **P4** (Task 4): inbound→conversa→envio, escala, guard de registry.
- **P5** (Task 5): consumidores cross-module migrados (envio→Action, template→helper, stats→`@/lib/db/schema`); legado deletado **após** zero importadores; gates verdes.
- **Sem bypass:** verificação `rg` nas Tasks 0/1/2/5.

> **Atenção do executor:**
> - **Port fiel** (não redesign) das queries de `@/repositories/conversations` e do `evolution.service` — é código maduro; preservar shape de retorno e retry/fallback.
> - **Rotas vivas:** Task 0 com commits isolados por rota; validar handshake GET + 1 mensagem real após cada troca; canary se houver staging.
> - **`rg` não-confiável neste ambiente:** confirmar consumidores legados por leitura direta + `tsc`, não só `rg`, antes de deletar (P5).
> - **Ordem P5 é dura:** nunca deletar `services/whatsapp` antes de migrar `operacional/reminders` + `procedure-reminder-config` (quebra os lembretes do Operacional).
> - `lint` sempre **isolado** (exit code do próprio lint).
