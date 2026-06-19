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
  clinicId: string;                 // clínica ATIVA (seletor na UI / canal no agente) — §3.9
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
  1. **Auth por principal:** `ctx` ausente → `unauthenticated`; `source !== 'system'` e `ctx.user` ausente → `unauthenticated`; `source === 'system'` **não exige user** (exige `clinicId` válido). Sem `clinicId` em qualquer principal → `unauthenticated`.
  2. `ctx.hasModule(action.module)` falso → `module_disabled` (gate manifesto).
  3. `ctx.can(action.requires)` falso → `forbidden` (gate RBAC).
  4. `action.input.safeParse(rawInput)` falha → `invalid_input`.
  5. executa `handler`; erros de domínio mapeados (`not_found`/`conflict`); exceções → `internal` (logadas, sem vazar detalhe).
  6. retorna `ActionResult<O>`.
- **Construtores de contexto** (um por principal — §3.7):
  - `buildUserContext(activeClinicId?)` — humano logado. Lê `getUserProfile()` (cookie session); a **clínica ativa** é a selecionada (ou a home `users.clinicId` por default); resolve `role`/permissões via `userClinicAccess(user, clínica ativa)` + overrides. `audit.actor = user`.
  - `buildDelegatedContext(userId)` — agente agindo a pedido de um staff. Resolve as permissões **do usuário delegante**. `audit.actor = 'agente'`, `onBehalfOf = userId`. **Boundary de segurança:** o `userId` **nunca** vem de input do modelo/mensagem; é estabelecido a partir da **sessão autenticada do staff** que iniciou o chat interno (mapeamento confiável canal→usuário). O agente não pode escolher em nome de quem age — senão um prompt malicioso escalaria privilégio.
  - `buildSystemContext(clinicId)` — agente autônomo (sem humano; ex.: WhatsApp inbound). `clinicId` vem do canal/instância, **não** de uma sessão. Permissões = conjunto próprio do agente (§3.7). `audit.actor = 'agente (sistema)'`.
  - `getServerSession`/cookie é usado **apenas** por `buildUserContext`. Os outros dois nunca dependem de sessão de request.

### 2.3 Registro (bootstrap explícito — não side-effect)

`actionRegistry` é um `Map<string, ActionDefinition>`, mas **não pode depender de side-effect de import** (`defineAction` registrando ao carregar o módulo): em Next/Workers, tree-shaking e carregamento parcial deixariam Actions de fora, quebrando o catálogo de permissões e as tools do agente.

**Padrão:** cada módulo **exporta** suas Actions explicitamente em `index.ts` (`export const actions = [scheduleAppointment, ...]`). Um **registro central** (`src/core/actions/registry.ts`) importa todos os módulos e chama `registerActions(module.actions)` no boot da app, de forma determinística. `defineAction` apenas constrói/tipa a Action; **não** registra por conta própria.

> Alternativa avaliada no plano: codegen de um arquivo de registro a partir dos `index.ts` dos módulos. Decidir no plano; o requisito vinculante é **registro determinístico, não por side-effect**.

O registry é a **fonte única** de:
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

- **`master`** — papel do fornecedor, acima de tudo. Reservado: **não atribuível pelo owner**. Controla `instance_modules` e configs sensíveis. Sempre passa nos gates de RBAC.
- **`owner`** — **dono** da clínica (não confundir com "admin"). Acesso total **dentro da instância** (todas as permissões dos módulos contratados). Gerencia perfis e usuários.
- **Perfis** — incluem **presets de sistema** (`Administrador`, `Recepcionista`, `Comercial`, `Dentista`) e **perfis customizados** criados pelo owner. Substituem o enum atual (`admin`/`dentist`/`receptionist`).

> ⚠️ **Não promover `admin`→`owner`.** O RBAC atual separa `owner` (100) de `admin` (80); mapear o `admin` legado direto para `owner` daria a administradores poderes de dono (escalada de privilégio). O `admin` legado migra para o **preset `Administrador`** (amplo, mas sem o controle de owner sobre perfis/usuários críticos e sem nada reservado a master).

### 3.2 Catálogo de permissões (derivado das Actions)

Não há lista mantida à mão. O catálogo combina **duas fontes**, ambas no código:
- **Permissões de mutação** — cada Action contribui sua `requires` (formato `module:action`, ex.: `appointments:create`). Leituras que precisem de controle (relatórios sensíveis, dados financeiros) também são modeladas como Actions (query actions) e entram aqui.
- **Permissões de acesso/visualização** — cada módulo declara em `permissions.ts` as permissões de **ver/entrar** (ex.: `appointments:view`, `financeiro:view`) usadas por **menu e rotas** (gate 1 e 2 do manifesto). Nem toda listagem vira Action, mas todo módulo declara ao menos uma permissão de acesso.
- Agrupadas por `module`; exibidas com `label` (pt-BR). "Liberar o módulo inteiro" = conceder todas as permissões (acesso + mutação) cujo `module` corresponde.

> Uma tabela espelho `permissions(key, module, label)` (para FK de `role_permissions` e para a UI) é populada por **migração/seed gerados por codegen** a partir do registry — **nunca por escrita em boot** (ruim para Workers/serverless: boot não deve fazer escrita operacional, e múltiplas instâncias competiriam). A fonte de verdade é o código; o seed é determinístico e versionado. Catálogo para a UI pode ser servido direto do registry em memória.

### 3.3 Schema (Drizzle, novas tabelas)

```ts
// roles — perfis (por clínica; presets têm isSystem=true)
roles: { id uuid pk, clinicId uuid fk→clinics, name text, description text,
         isSystem boolean default false, createdAt, updatedAt }

// rolePermissions — permissões que o perfil concede
rolePermissions: { roleId uuid fk→roles, permissionKey text }  // pk (roleId, permissionKey)

// userClinicAccess — acesso do usuário A UMA clínica, com 1 perfil POR clínica.
// O admin concede. 1 clínica → 1 registro (trivial); várias clínicas → vários.
userClinicAccess: { userId uuid fk→users, clinicId uuid fk→clinics,
                    roleId uuid fk→roles, createdAt }   // pk (userId, clinicId)

// userPermissionOverrides — ajuste fino por usuário, POR clínica
userPermissionOverrides: { userId uuid fk→users, clinicId uuid fk→clinics,
                           permissionKey text, granted boolean }
  // pk (userId, clinicId, permissionKey); granted=true adiciona, false remove

// users.clinicId permanece como clínica primária/home (default de UI).
// enum userRole e o antigo users.roleId viram legado (ver §6.2).
```

### 3.4 Resolução

`ctx.can(key)` resolve em função da **clínica ativa** (`ctx.clinicId`):
1. `master` ou `owner` → `true` (gate de manifesto já rodou antes).
2. resolve o acesso do usuário à clínica ativa via `userClinicAccess(userId, ctx.clinicId)` → `roleId`. **Sem registro → `false`** (usuário não atua nesta clínica).
3. override `(userId, ctx.clinicId, key)` existe → usa `granted`.
4. senão → `key ∈ rolePermissions(roleId)`.

### 3.5 Presets de sistema

Seed de perfis `isSystem` por clínica na criação: **Administrador**, **Recepcionista**, **Comercial**, **Dentista**, cada um com um conjunto inicial de permissões. O owner pode **clonar** um preset e editar (presets de sistema não são apagáveis; clones sim). `owner` e `master` são perfis de sistema reservados, **não** selecionáveis no painel.

### 3.6 Painel admin (linguagem leiga)

- **Usuários:** lista; conceder **acesso por clínica** com 1 perfil em cada (com 1 clínica, auto-atribui e o seletor de clínica some; com várias, o admin escolhe a quais polos o funcionário tem acesso e o perfil em cada); ajustes finos (overrides) por função.
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

### 3.8 Schema de auditoria (`action_logs`)

A auditoria é **requisito implementável**, não verbal. `runAction` grava um registro por execução (sucesso e erro):

```ts
actionLogs: {
  id uuid pk,
  clinicId uuid null fk→clinics,   // tenant; NULL em falha pré-auth (sem ctx/clinicId)
  principalType text null,         // 'user' | 'agent_delegated' | 'system' | NULL (pré-auth)
  actor text,                      // userId, 'agente', 'agente (sistema)' ou 'unknown'
  onBehalfOf uuid null,            // userId delegante (apenas agent_delegated)
  actionName text,                 // ex: 'operacional.scheduleAppointment'
  module text,
  inputRedacted jsonb,             // input com campos sensíveis mascarados
  result text,                     // 'ok' | 'error'
  errorCode text null,             // ActionErrorCode quando result='error'
  createdAt timestamp default now()
}
```

- **Redação:** cada Action declara (ou herda default) quais campos do input são sensíveis (CPF, telefone, conteúdo clínico) → mascarados antes de gravar. LGPD: erros e logs sem dados sensíveis (CLAUDE.md).
- **Retenção:** política configurável (default sugerido: 12 meses) com purga por job de manutenção. Definir valor no plano.
- **Falha pré-auth:** quando `runAction` rejeita em `unauthenticated` (sem `ctx`/`clinicId`), grava com `clinicId=NULL`, `principalType=NULL`, `actor='unknown'`, `result='error'`, `errorCode='unauthenticated'`. Assim tentativas não autenticadas ficam rastreáveis sem violar o FK de tenant.
- A escrita do log é parte do `runAction` (não opcional); falha ao logar não derruba a Action, mas é reportada.

### 3.9 Escopo de clínica (multi-clínica)

O W3 suporta **staff multi-clínica** desde já, modelado por `userClinicAccess` (§3.3):

- **Acesso é concedido pelo admin/owner**, por clínica: um funcionário só atua numa clínica se houver um registro `userClinicAccess(userId, clinicId, roleId)`. O perfil (`roleId`) é por clínica — o mesmo usuário pode ser Recepcionista no polo A e Comercial no polo B.
- **Clínica ativa:** `ActionContext.clinicId` é a clínica em que a ação ocorre — vem do **seletor de clínica** na UI (para staff com acesso a >1) ou é **derivada do canal/instância** no agente (ex.: número de WhatsApp → clínica). `can()` resolve sempre em função de `(user, clínica ativa)` (§3.4).
- **`owner`/`master`**: acessam **todas as clínicas da instância** por bypass (não precisam de `userClinicAccess`).
- **Caso de 1 clínica é trivial:** há um único registro `userClinicAccess` por usuário; a UI esconde o conceito de "clínica" (sem seletor). A complexidade de polos só aparece quando há mais de uma clínica.

> `users.clinicId` permanece como clínica primária/home (default ao logar). O antigo `users.roleId` e o enum `userRole` viram legado (§6.2).

---

## 4. Componente C — Manifesto de módulos

**Localização:** `src/modules/core/` (modules).

### 4.1 Schema

```ts
// instance_modules — contratação no nível instância (cliente)
instanceModules: { moduleId text pk, enabled boolean default false,
                   contractedAt timestamp, updatedAt }
```

**`moduleId` como PK é intencional, não descuido.** Cada cliente tem **DB dedicado** (infra própria — ver mestre), então a tabela inteira pertence a uma única instância/cliente; um registro por módulo cobre todas as clínicas daquele cliente. Isso **não** é um toggle global acidental num DB compartilhado — não há compartilhamento entre clientes.

Editável **só pelo `master`**.

> **Caminho de evolução (deferido):** se um cliente precisar de módulos diferentes por clínica/polo, adiciona-se `clinicId` (nullable: `null` = vale para a instância toda; preenchido = override por clínica) e os gates passam a receber `clinicId`. Não implementar agora (YAGNI), mas o schema e os gates devem ser desenhados para aceitar essa extensão sem reescrita.

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

**Regra de migração vinculante (entra no W3, vale daqui em diante):**
> **Toda mutação nova ou tocada — seja UI, REST ou agente — DEVE passar por `runAction`.** É proibido introduzir mutação que escreva no DB fora do pipeline (sem RBAC, manifesto e auditoria). Um teste de regressão (lint/CI) deve sinalizar mutações novas que bypassem `runAction`.

**Legado conhecido que bypassa o pipeline:**
- `src/services/tools/**` (ex.: `scheduler.tools.ts`) grava direto no DB, **sem escopo de clínica nem RBAC**. Faz parte do agente atual, que é **removido inteiro no W5** — portanto **não é migrado no W3**, mas é marcado como legado-inseguro: nenhuma tool nova no padrão antigo; se uma dessas for *tocada* antes do W5, passa por `runAction`.
- Mutações de agente e rotas REST de mutação tocadas durante a transição seguem a regra vinculante acima.

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
1. Criar tabelas `roles`/`rolePermissions`/`userClinicAccess`/`userPermissionOverrides`.
2. Seed de presets por clínica; para cada usuário existente, criar `userClinicAccess(userId, users.clinicId, roleId)` com o perfil equivalente ao role legado: `owner`→`owner` (role de sistema); `admin`→**preset `Administrador`** (NÃO `owner` — evita escalada, §3.1); `dentist`→preset Dentista; `receptionist`→preset Recepcionista.
3. `permissions.ts` legado (`hasMinRole` etc.) é substituído por `ctx.can`. O enum permanece como coluna legada durante a transição e é removido quando nenhum código o consome.

---

## 7. Error handling

- `runAction` nunca lança para o chamador: retorna `ActionResult`. Erros de domínio usam `not_found`/`conflict`; exceções inesperadas viram `internal`, logadas via `dbLogger` sem vazar dados sensíveis (alinha CLAUDE.md: erros sem dados sensíveis).
- Server Actions repassam o `ActionResult` para a UI tratar (toast/inline).
- Tools do agente convertem `error` em mensagem que o orquestrador entende (ex.: `forbidden` → "usuário sem permissão para X").

---

## 8. Testing strategy

- **Action Layer:** `runAction` testado com `ctx` mockado para cada ramo (unauthenticated, module_disabled, forbidden, invalid_input, sucesso). AAA.
- **Principal `system` sem sessão:** `buildSystemContext(clinicId)` produz ctx válido e `runAction` executa **sem** cookie/sessão (caso WhatsApp). Garante que o passo 1 do pipeline não barra `system`.
- **Bootstrap do registry:** todas as Actions exportadas pelos módulos estão no registry após o boot determinístico (nenhuma perdida por tree-shaking).
- **RBAC:** `can()` com perfil + overrides (override tem precedência); presets seedados conferem permissões esperadas; **`owner`/`master` bypass**.
- **Migração `userRole`→`roles`/overrides:** cada role legado mapeia ao perfil correto; **`admin` NÃO vira `owner`** (regressão de escalada de privilégio).
- **Manifesto:** os 4 gates — rota desativada → 403/404; menu filtrado; `agentToolsFor` exclui módulo off; scheduler pula job de módulo off.
- **Auditoria:** `action_logs` grava `principalType`/`actor`/`onBehalfOf`/`result`/`errorCode` por execução; input sensível redigido.
- **Regressão anti-bypass:** mutação que escreva no DB fora de `runAction` falha o lint/CI.
- **Fronteira:** lint de dependência falha em import cross-module ilegal.
- **Core como módulo:** smoke de uma Action real do Core ponta-a-ponta (Server Action → runAction → repo).
- Cobertura mantém o threshold do projeto (70%).

---

## 9. Schema — resumo das tabelas novas

| Tabela | Propósito | Escopo |
|---|---|---|
| `roles` | perfis (presets + customizados) | por clínica |
| `role_permissions` | permissões de cada perfil | por perfil |
| `user_clinic_access` | acesso do usuário a uma clínica + perfil ali | por (usuário, clínica) |
| `user_permission_overrides` | ajuste fino | por (usuário, clínica) |
| `instance_modules` | contratação de módulos | por instância |
| `action_logs` | auditoria de execução (LGPD) | por clínica (NULL pré-auth) |
| `permissions` (espelho) | catálogo p/ FK e UI | seed/codegen do registry (não boot) |

Migrações Drizzle em `src/modules/core/schema/` (ou `src/lib/db/schema/` durante a transição). Enum `userRole` vira legado (§6.2).

---

## 10. Decisões fixadas

- **Três principais** (`user` / `agent_delegated` / `system`) com auditoria distinta (§3.7). O agente nunca usa contexto de sessão humana; o paciente do WhatsApp não é principal.
- **1 perfil por usuário por clínica + overrides** (`user_clinic_access`) — sem múltiplos perfis na mesma clínica.
- **Server Actions** como mecanismo padrão de UI para mutações (route handlers só onde já existem / integrações).
- **Catálogo de permissões derivado das Actions** (não mantido à mão); espelho via **seed/codegen**, nunca escrita em boot.
- **Registro de Actions determinístico** (bootstrap explícito), não por side-effect de import.
- **`admin` legado → preset `Administrador`** (NÃO `owner`) — evita escalada de privilégio.
- **Auditoria obrigatória** com tabela `action_logs` (§3.8) gravada por `runAction`.
- **Regra vinculante:** toda mutação nova/tocada (UI/REST/agente) passa por `runAction`.
- **Manifesto no banco**, editável só por `master`; nível instância (PK `moduleId` intencional; `clinicId` é caminho deferido).
- **Escopo de clínica**: **staff multi-clínica no W3** via `user_clinic_access` (§3.9). O admin concede acesso por clínica, com perfil por clínica; `owner`/`master` multi-clínica por bypass; `ActionContext.clinicId` = clínica ativa (seletor UI / canal do agente). Caso de 1 clínica é trivial (UI esconde o conceito).
- **Strangler**: W3 migra só o Core; `services/tools/**` é removido no W5 (não migrado no W3).

## 11. Decisões deferidas (não bloqueiam o plano)

- Granularidade de manifesto por clínica (hoje: por instância) — só se houver demanda.
- Biblioteca de lint de fronteira (`eslint-plugin-boundaries` vs `dependency-cruiser`) — decidir no plano.
- Registro de Actions: **codegen** de um arquivo de registro vs **registro central manual** (ambos determinísticos) — decidir no plano.
- Política de retenção de `action_logs` (default sugerido: 12 meses) — fixar valor no plano.
- **Provisionamento e login do `master`:** mesma tabela `users` com uma flag reservada (`isMaster`) e perfil de sistema não-atribuível, ou conta/credencial fora do fluxo normal. Recomendação: linha em `users` com `isMaster` + acesso restrito por credencial separada; detalhar no plano. `master` nunca é selecionável no painel do admin.

## 12. Dependências e riscos

- **Depende de** W1 (Drizzle única fonte) e W2 (camada de dados). Conceitualmente independe de W4 (Cloudflare), mas o adaptador de tools (§2.5) é consumido pelo W5.
- **Risco maior:** a migração do RBAC (enum→perfis) toca auth de toda a app; exige seed correto e testes de precedência. Mitigado pela coexistência (enum legado mantido na transição).
- **Risco de fronteira:** sem lint desde o início, módulos voltam a se acoplar. O lint entra junto com o Core.
- O **painel admin** tem peso de UX (dono leigo); o detalhamento visual fica no plano/implementação, mas a regra "zero jargão / rótulos das Actions" é vinculante.
- **Server Actions em OpenNext/Workers (verificar):** Server Actions são o mecanismo padrão de UI (§2.4) e o runtime alvo é Cloudflare Workers (W4). Server Actions rodam sob OpenNext, mas isso deve ser **verificado explicitamente** — adicionar um spike no plano do W4 e não descobrir tardiamente. Se houver limitação, route handlers + `runAction` são o fallback (mesmo pipeline).
- **Auditoria de principal** (§3.7) é requisito LGPD: o log de ações precisa existir desde o W3 (não é opcional), registrando `audit.actor`/`onBehalfOf` por execução.
