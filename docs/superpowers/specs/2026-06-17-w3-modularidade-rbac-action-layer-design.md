# W3 — Modularidade + RBAC + Action Layer — Design

> **Tipo:** Spec de design (fase W3 do roadmap-mestre). Não é plano de implementação.
> **Data:** 2026-06-17
> **Mestre:** `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`
> **Status:** Aprovado para escrita do plano de implementação.

---

## 1. Contexto e escopo

O W3 é o **coração do produto-base modular**. Ele entrega os quatro mecanismos acoplados que tornam o sistema modular e AI-operável, e que todos os módulos do Eixo 2 vão seguir:

1. **Action Layer** — toda operação como caso de uso único (UI + agente).
2. **RBAC granular** — permissões por módulo/função, perfis customizáveis, painel para dono leigo.
3. **Manifesto de módulos** — contratação por instância, controlada por um papel `master`, com gates que garantem custo ≈ zero para módulo desativado.
4. **Estrutura física `src/modules/`** — bounded contexts isolados, com o módulo **Core** migrado como referência (estratégia strangler; demais módulos migram no Eixo 2).

**Pré-requisitos:** W0 (baseline limpo), W1 (Supabase removido), W2 (camada `app→service→repository` padronizada). O W3 assume Drizzle como fonte de verdade e a base de auth atual (`src/lib/auth/session.ts`: `getUserProfile()` → `{ id, role, clinic_id, clinics }`).

**Princípios herdados do mestre:** P1 (AI-operável), P3 (nativo+integração), P5 (bounded context), P6 (LLM-agnóstico). Runtime alvo: Cloudflare Workers.

---

## 2. Componente A — Action Layer

**Localização:** `src/core/actions/`.

### 2.1 Contrato

```ts
// src/core/actions/types.ts
import type { z } from 'zod';

// Quem está executando a Action. Resolve clinicId, can() e auditoria de forma diferente.
export type ContextSource = 'user' | 'agent_delegated' | 'system';

export interface ActionContext {
  source: ContextSource;
  clinicId: string;
  user?: { id: string; email: string; name: string };  // presente em 'user' e 'agent_delegated'
  role?: string;
  can: (permissionKey: string) => boolean;   // resolve RBAC conforme o principal (§3.7)
  hasModule: (moduleId: string) => boolean;   // resolve manifesto
  audit: { actor: string; onBehalfOf?: string }; // 'agente (sistema)' | 'agente em nome de X' | 'X'
}

export interface ActionDefinition<I extends z.ZodTypeAny, O> {
  name: string;            // único, ex: 'operacional.scheduleAppointment'
  module: string;          // id do módulo (gate de manifesto)
  requires: string;        // permission key, ex: 'appointments:create' (gate de RBAC)
  label: string;           // rótulo pt-BR amigável (painel + descrição da tool)
  description?: string;    // descrição para o agente
  input: I;                // schema Zod
  handler: (input: z.infer<I>, ctx: ActionContext) => Promise<O>;
}

export type ActionResult<O> =
  | { ok: true; data: O }
  | { ok: false; error: { code: ActionErrorCode; message: string } };

export type ActionErrorCode =
  | 'unauthenticated' | 'module_disabled' | 'forbidden'
  | 'invalid_input' | 'not_found' | 'conflict' | 'internal';
```

### 2.2 Funções centrais

- `defineAction(def)` — registra a Action no `actionRegistry` e a retorna tipada.
- `runAction(action, rawInput, ctx)` — pipeline único:
  1. `ctx` ausente/sem user → `unauthenticated`.
  2. `ctx.hasModule(action.module)` falso → `module_disabled` (gate manifesto).
  3. `ctx.can(action.requires)` falso → `forbidden` (gate RBAC).
  4. `action.input.safeParse(rawInput)` falha → `invalid_input`.
  5. executa `handler`; erros de domínio mapeados (`not_found`/`conflict`); exceções → `internal` (logadas, sem vazar detalhe).
  6. retorna `ActionResult<O>`.
- **Construtores de contexto** (um por principal — §3.7):
  - `buildUserContext()` — humano logado. Lê `getUserProfile()` (cookie session) → `clinicId`, `role`, permissões do perfil+overrides. `audit.actor = user`.
  - `buildDelegatedContext(userId)` — agente agindo a pedido de um staff. Resolve as permissões **do usuário delegante**. `audit.actor = 'agente'`, `onBehalfOf = userId`.
  - `buildSystemContext(clinicId)` — agente autônomo (sem humano; ex.: WhatsApp inbound). `clinicId` vem do canal/instância, **não** de uma sessão. Permissões = conjunto próprio do agente (§3.7). `audit.actor = 'agente (sistema)'`.
  - `getServerSession`/cookie é usado **apenas** por `buildUserContext`. Os outros dois nunca dependem de sessão de request.

### 2.3 Registro

`actionRegistry` é um `Map<string, ActionDefinition>` populado por `defineAction`. É a **fonte única** de:
- **Catálogo de permissões** (§3.2) — agrupado por `module`, rotulado por `label`.
- **Tools do agente** (§2.5) — filtradas por manifesto + permissão.

### 2.4 Consumo pela UI (Server Actions)

Padrão novo: mutações via **Next.js Server Actions** (`'use server'`) que chamam `runAction`.

```ts
// src/modules/operacional/ui/actions.ts
'use server';
import { runAction, buildUserContext } from '@/core/actions';
import { scheduleAppointment } from '../actions/schedule-appointment';

export async function scheduleAppointmentAction(input: unknown) {
  const ctx = await buildUserContext();   // principal 'user'
  return runAction(scheduleAppointment, input, ctx);
}
```

Route handlers REST permanecem onde já existem (webhooks, integrações externas), mas **novas** operações de UI usam Server Actions. Onde um handler REST precisar executar uma operação, ele também chama `runAction` (mesmo pipeline).

### 2.5 Consumo pelo agente

```ts
// src/core/actions/agent.ts
export function toAgentTool(action: ActionDefinition): AgentTool;       // adapta p/ Cloudflare Agents SDK
export function agentToolsFor(ctx: ActionContext): AgentTool[];          // filtra registry por hasModule + can
```

O `ctx` do agente é **`agent_delegated`** (chat interno de um staff) ou **`system`** (autônomo, ex.: WhatsApp inbound) — nunca `user`. `agentToolsFor(ctx)` filtra o registry por `hasModule` **e** pelo `can()` do principal: tools de módulos desativados ou fora do conjunto de permissões do principal não são expostas → custo de token ≈ zero. Cada tool usa `name`, `label`/`description` e `input` da Action; o `handler` chama `runAction` (mesmas checagens + auditoria do principal). Construção concreta do agente é do W5; o W3 entrega o adaptador e o contrato.

---

## 3. Componente B — RBAC granular

**Localização:** `src/modules/core/` (auth/rbac).

### 3.1 Hierarquia

- **`master`** — papel do fornecedor, acima de tudo. Reservado: **não atribuível pelo admin**. Controla `instance_modules` e configs sensíveis. Sempre passa nos gates de RBAC.
- **`owner`** — dono/admin da clínica. Acesso total **dentro da instância** (todas as permissões dos módulos contratados). Gerencia perfis e usuários.
- **Perfis customizados** — criados pelo admin (substituem `dentist`/`receptionist`). Conjunto de permissões.

### 3.2 Catálogo de permissões (derivado das Actions)

Não há lista mantida à mão. O catálogo é **computado do `actionRegistry`**:
- Cada Action contribui uma permissão `requires` (formato `module:action`, ex.: `appointments:create`).
- Agrupada por `module`; exibida com `label` (pt-BR).
- "Liberar o módulo inteiro" = conceder todas as permissões cujo `module` corresponde.

> Uma tabela espelho `permissions(key, module, label)` pode ser **sincronizada** do registry em build/boot para integridade referencial e para a UI — mas a fonte de verdade é o código. Sincronização é idempotente.

### 3.3 Schema (Drizzle, novas tabelas)

```ts
// roles — perfis (por clínica; presets têm isSystem=true)
roles: { id uuid pk, clinicId uuid fk→clinics, name text, description text,
         isSystem boolean default false, createdAt, updatedAt }

// rolePermissions — quais permissões o perfil concede
rolePermissions: { roleId uuid fk→roles, permissionKey text }  // pk (roleId, permissionKey)

// users — passa a referenciar um perfil
users.roleId: uuid fk→roles  // adicionado; enum userRole vira legado (ver §6.2)

// userPermissionOverrides — ajuste fino por usuário (1 perfil + overrides)
userPermissionOverrides: { userId uuid fk→users, permissionKey text, granted boolean }
  // pk (userId, permissionKey); granted=true adiciona, granted=false remove
```

### 3.4 Resolução

`ctx.can(key)`:
1. `master` ou `owner` → `true` (owner limitado aos módulos contratados via gate de manifesto, que roda antes).
2. override do usuário existe → usa `granted`.
3. senão → `key ∈ permissões do perfil (rolePermissions)`.

### 3.5 Presets de sistema

Seed de perfis `isSystem` por clínica na criação: **Recepcionista**, **Comercial**, **Dentista**, cada um com um conjunto inicial de permissões. O admin pode **clonar** um preset e editar (presets de sistema não são apagáveis; clones sim).

### 3.6 Painel admin (linguagem leiga)

- **Usuários:** lista; atribuir 1 perfil; ajustes finos (overrides) com toggles por função.
- **Perfis:** criar/editar/clonar; tela com módulos → funções (toggles), rotulados por `label`. "Ligar módulo inteiro" = liga todas as funções do módulo.
- Zero jargão técnico; nada de `module:action` visível. Detalhe visual de UI fica no plano/implementação.

### 3.7 Resolução de RBAC por principal

`ctx.can(key)` resolve conforme o `source`:

| `source` | `clinicId` | `can(key)` | Auditoria (`audit`) |
|---|---|---|---|
| `user` | sessão | perfil + overrides (§3.4) | `actor = user` |
| `agent_delegated` | usuário delegante | permissões **do usuário delegante** | `actor = 'agente'`, `onBehalfOf = userId` |
| `system` | canal/instância | **conjunto de permissões do agente** (perfil de sistema) | `actor = 'agente (sistema)'` |

- O **paciente do WhatsApp não é um principal** — é o sujeito/contato da conversa, não o ator. Quem executa é o agente (`system`).
- O **conjunto de permissões do agente autônomo** (`system`) é um **perfil de sistema próprio** (`roles.isSystem`, reservado), editável na futura **Gestão do Agente de IA** (Eixo 2): define quais Actions o agente pode executar sem humano (ex.: agendar, confirmar, responder dúvida — mas talvez **não** cancelar tratamento ou alterar financeiro sem confirmação). Default conservador.
- Toda execução grava o `audit` no log de ações (LGPD/rastreabilidade), distinguindo humano, agente-em-nome-de e agente-autônomo.

---

## 4. Componente C — Manifesto de módulos

**Localização:** `src/modules/core/` (modules).

### 4.1 Schema

```ts
// instance_modules — contratação no nível instância (cliente)
instanceModules: { moduleId text pk, enabled boolean default false,
                   contractedAt timestamp, updatedAt }
```
Editável **só pelo `master`**. Nível instância (todas as clínicas do cliente compartilham; granularidade por clínica é YAGNI até haver demanda).

### 4.2 Serviço

- `moduleManifest.isEnabled(moduleId): boolean` — lê `instance_modules` (com cache por request).
- `ctx.hasModule(moduleId)` delega a isso.
- Cada módulo declara seu `id` em `manifest.ts` (`{ id, name, dependsOn?, routes, menu, jobs? }`).

### 4.3 Os 4 gates

1. **Rotas/API:** wrapper/middleware verifica `isEnabled(module)`; desativado → 404 (rota) / 403 (API). Server Actions já passam pelo gate via `runAction` (passo 2).
2. **Menu/navegação:** a navegação é montada a partir dos `manifest.menu` filtrados por `isEnabled` **e** por permissão do usuário.
3. **Tools do agente:** `agentToolsFor(ctx)` filtra por `hasModule` (§2.5).
4. **Jobs em background:** cron/workflows/Durable Objects checam `isEnabled` antes de agendar/executar. Registro de jobs declarado em `manifest.jobs`; o scheduler central pula módulos desativados.

> Garantia: módulo desativado é inerte — sem rota, sem menu, sem tool, sem job. Custo de execução/token ≈ zero. Único custo residual: bundle (desprezível em Workers).

---

## 5. Componente D — Estrutura física e strangler

### 5.1 Layout do módulo (do mestre §6)

```
src/modules/<modulo>/
├── actions/        # Action Layer — operações
├── services/       # regras de negócio
├── repositories/   # Drizzle
├── schema/         # tabelas do módulo
├── ui/             # páginas/componentes + Server Actions
├── integrations/   # adapters de terceiros (P3)
├── permissions.ts  # (opcional) labels/descrições das permissões do módulo
├── manifest.ts     # { id, name, dependsOn?, routes, menu, jobs? }
└── index.ts        # interface pública
```

### 5.2 Migração strangler

- O W3 cria a infra (`src/core/actions/`, RBAC, manifesto) e migra **apenas o Core** para `src/modules/core/` como módulo de referência: clínicas, usuários, auth, **RBAC**, **manifesto**, **Action Layer base**.
- Domínios restantes (`app/`, `services/`, `repositories/` atuais) **coexistem** e migram um a um no Eixo 2.
- Durante a transição, código legado continua funcionando; o que for tocado/criado adota a Action Layer.

### 5.3 Lint de fronteira

`eslint-plugin-boundaries` (ou `dependency-cruiser`): um módulo só importa o `index.ts` de outro; nunca internals. `core` é dependência permitida de todos. Regra falha o CI em violação.

---

## 6. Data flow e migração de auth

### 6.1 Fluxo

```
UI (form) ─→ Server Action ─┐
                            ├─→ runAction(action, input, ctx)
Agente ─→ tool (filtrada) ──┘     ├─ unauthenticated?
                                  ├─ gate manifesto: hasModule(action.module)
                                  ├─ gate RBAC: can(action.requires)
                                  ├─ input zod
                                  └─ handler → service → repository → Drizzle
```

### 6.2 Transição do RBAC atual

O enum `userRole` (`owner/admin/dentist/receptionist`) é migrado:
1. Criar tabelas `roles`/`rolePermissions`/`userPermissionOverrides` e `users.roleId`.
2. Seed de presets por clínica; mapear cada usuário existente ao perfil equivalente (`owner`→owner; `dentist`→preset Dentista; `receptionist`→preset Recepcionista; `admin`→owner).
3. `permissions.ts` legado (`hasMinRole` etc.) é substituído por `ctx.can`. O enum permanece como coluna legada durante a transição e é removido quando nenhum código o consome.

---

## 7. Error handling

- `runAction` nunca lança para o chamador: retorna `ActionResult`. Erros de domínio usam `not_found`/`conflict`; exceções inesperadas viram `internal`, logadas via `dbLogger` sem vazar dados sensíveis (alinha CLAUDE.md: erros sem dados sensíveis).
- Server Actions repassam o `ActionResult` para a UI tratar (toast/inline).
- Tools do agente convertem `error` em mensagem que o orquestrador entende (ex.: `forbidden` → "usuário sem permissão para X").

---

## 8. Testing strategy

- **Action Layer:** `runAction` testado com `ctx` mockado para cada ramo do pipeline (unauthenticated, module_disabled, forbidden, invalid_input, sucesso). AAA.
- **RBAC:** `can()` com perfil + overrides (precedência de override sobre perfil); presets seedados conferem permissões esperadas.
- **Manifesto:** os 4 gates testados — rota desativada → 403/404; menu filtrado; `agentToolsFor` exclui módulo off; scheduler pula job de módulo off.
- **Fronteira:** teste/CI de lint de dependência falha em import cross-module ilegal.
- **Core como módulo:** smoke de uma Action real do Core ponta-a-ponta (Server Action → runAction → repo).
- Cobertura mantém o threshold do projeto (70%).

---

## 9. Schema — resumo das tabelas novas

| Tabela | Propósito | Escopo |
|---|---|---|
| `roles` | perfis (presets + customizados) | por clínica |
| `role_permissions` | permissões de cada perfil | por perfil |
| `user_permission_overrides` | ajuste fino por usuário | por usuário |
| `instance_modules` | contratação de módulos | por instância |
| `permissions` (espelho, opcional) | catálogo p/ FK e UI | sincronizado do registry |
| `users.roleId` (coluna) | perfil do usuário | — |

Migrações Drizzle em `src/modules/core/schema/` (ou `src/lib/db/schema/` durante a transição). Enum `userRole` vira legado (§6.2).

---

## 10. Decisões fixadas

- **Três principais** (`user` / `agent_delegated` / `system`) com auditoria distinta (§3.7). O agente nunca usa contexto de sessão humana; o paciente do WhatsApp não é principal.
- **1 perfil por usuário + overrides** (não múltiplos perfis) — mais simples para o dono leigo.
- **Server Actions** como mecanismo padrão de UI para mutações (route handlers só onde já existem / integrações).
- **Catálogo de permissões derivado das Actions** (não mantido à mão).
- **Manifesto no banco**, editável só por `master`; nível instância.
- **Strangler**: W3 migra só o Core; demais módulos no Eixo 2.

## 11. Decisões deferidas (não bloqueiam o plano)

- Granularidade de manifesto por clínica (hoje: por instância) — só se houver demanda.
- Biblioteca de lint de fronteira (`eslint-plugin-boundaries` vs `dependency-cruiser`) — decidir no plano.
- Tabela espelho `permissions` materializada vs catálogo puramente em memória — decidir no plano conforme necessidade de FK.
- **Provisionamento e login do `master`:** mesma tabela `users` com uma flag reservada (`isMaster`) e perfil de sistema não-atribuível, ou conta/credencial fora do fluxo normal. Recomendação: linha em `users` com `isMaster` + acesso restrito por credencial separada; detalhar no plano. `master` nunca é selecionável no painel do admin.

## 12. Dependências e riscos

- **Depende de** W1 (Drizzle única fonte) e W2 (camada de dados). Conceitualmente independe de W4 (Cloudflare), mas o adaptador de tools (§2.5) é consumido pelo W5.
- **Risco maior:** a migração do RBAC (enum→perfis) toca auth de toda a app; exige seed correto e testes de precedência. Mitigado pela coexistência (enum legado mantido na transição).
- **Risco de fronteira:** sem lint desde o início, módulos voltam a se acoplar. O lint entra junto com o Core.
- O **painel admin** tem peso de UX (dono leigo); o detalhamento visual fica no plano/implementação, mas a regra "zero jargão / rótulos das Actions" é vinculante.
- **Server Actions em OpenNext/Workers (verificar):** Server Actions são o mecanismo padrão de UI (§2.4) e o runtime alvo é Cloudflare Workers (W4). Server Actions rodam sob OpenNext, mas isso deve ser **verificado explicitamente** — adicionar um spike no plano do W4 e não descobrir tardiamente. Se houver limitação, route handlers + `runAction` são o fallback (mesmo pipeline).
- **Auditoria de principal** (§3.7) é requisito LGPD: o log de ações precisa existir desde o W3 (não é opcional), registrando `audit.actor`/`onBehalfOf` por execução.
