# Synkroo — Roadmap-Mestre: Produto-Base Modular sobre Cloudflare

> **Tipo:** Documento-mestre de design (alto nível). Não é spec de implementação.
> **Data:** 2026-06-17
> **Status:** Aprovado para detalhamento por fase/módulo.
> **Escopo deste documento:** apenas planejamento e documentação. A implementação será feita por outro agente, guiado pelos documentos derivados deste.

---

## 0. Como ler este documento

Este é o **mapa-mestre**. Ele define a visão-alvo, os princípios arquiteturais, o padrão de módulo e a sequência de trabalho. Ele **não** detalha a implementação de cada fase ou módulo — cada um desses recebe, depois, seu **próprio ciclo `spec → plano de implementação`**, derivado e referenciando este documento.

Regra de ouro para todos os documentos derivados: devem ser **auto-suficientes para um agente implementador** seguir sem contexto adicional de conversa.

---

## 1. Contexto e estado atual (reconhecimento)

O Synkroo é um sistema odontológico (agendamento, CRM/leads, campanhas, analytics, WhatsApp, agente de IA conversacional, LGPD). A ideia de produto é forte, mas a arquitetura atual acumulou dívida e está em migração parcial.

**Escala:** ~80.800 LOC, 559 arquivos `.ts/.tsx`, 51 tabelas no schema, 113 testes unit + 41 specs E2E.

**Achados que motivam este roadmap:**

| Achado | Evidência | Impacto |
|---|---|---|
| Documentação descreve stack errada | `CLAUDE.md`/`AGENTS.md` dizem "Supabase + RLS + Auth SSR"; o código usa **Drizzle + `pg` + NextAuth**. Zero imports de `@supabase/supabase-js`. | Induz humanos e agentes a decisões erradas. |
| Migração Supabase→Drizzle inacabada | `src/lib/supabase.ts` é um **bridge depreciado** que emula a API do Supabase sobre Drizzle. `.env.example` marca "CUTOVER COMPLETE". | Risco de segurança + dívida. |
| Bridge monta SQL por concatenação | `sql.raw()` + escape manual de aspas. `.or()` é **no-op** (retorna dados sem filtro); `.rpc()` e `auth.getUser()` retornam vazio silenciosamente. | **SQL injection** + falhas silenciosas. `complete-profile/page.tsx` já depende do `auth.getUser()` quebrado. |
| Camadas meio-migradas | `app → service` (77×), `app → repository` direto (35×), `service → repository` (28×). Existe Repository Pattern + `domain-boundaries.ts`, mas inacabado. | Sem fronteira clara; páginas client tocam DB. |
| 322 arquivos `graphify-out/` versionados | Cache de ferramenta. Está no `.gitignore`, mas foi commitado antes da regra. | Polui o repositório (~170 pastas). |
| Dívida de tipos/qualidade | 436 usos de `any`, 59 arquivos com `console.*` em produção, 63 erros de `tsc` (todos em testes — setup `jest-dom` quebrado). Código de produção: **0 erros `tsc`**. | Typecheck de teste vermelho. |
| Frontend duplicado | `configuracao/` + `configuracoes/`; `crm/` + `crm/pipeline/` + `pipeline/` (stub); `contatos/` (stub) + `leads/` + `pacientes/`; `atividades/` + `tarefas/`. CRUD repetido por domínio sem componentes compartilhados. | Retrabalho e inconsistência de UX. |
| Agente de IA isolado | ~8k LOC (`agent`, `agents`, `memory`, `rag`, `tools`, `scheduler`, `queue`) + `lib/llm` + `lib/minimax`. Só **2 arquivos de UI** o importam; nenhum service não-IA depende dele. | Remoção/substituição de **baixo risco**. |
| RBAC raso e rígido | Roles via `pgEnum userRole` = `owner/admin/dentist/receptionist`. Hierarquia linear (`lib/auth/permissions.ts`). Sem "comercial/recepção", sem permissões granulares, sem grants por usuário. | Não suporta o painel de acessos desejado. |
| Multi-clínica já existe | `clinic_id` é FK em todas as tabelas de domínio. | Base de tenancy interna pronta. |
| Sem manifesto de módulos | `clinics.settings` (jsonb) e `subscriptionPlan` genéricos. | Modularidade ainda não existe no código. |

---

## 2. Modelo de produto e entrega

**Não é SaaS multi-tenant global.** O modelo é:

- **Lado do fornecedor:** existe um **produto-base completo** com todos os módulos/funções. A partir dele, compõe-se o que cada cliente recebe (módulos + funções + personalização).
- **Lado do cliente:** cada cliente roda em **infra própria/isolada** (deploy + DB dedicados) — *single-tenant por cliente*.
- **Dentro da instância:** pode haver **várias clínicas/polos** (multi-clínica via `clinic_id`) e **multi-usuário com RBAC** (recepção, comercial, admin…), com um **painel de admin** para conceder acessos por função/usuário e por clínica.

**Duas camadas de modularidade:**

1. **Composição por instância** (config-time): quais módulos esse cliente recebe. Como cada cliente tem infra própria, é **configuração de instância** (manifesto de módulos no deploy), não flag multi-tenant.
2. **RBAC em runtime** (dentro da instância): admin habilita acessos por usuário/função, com escopo por clínica.

---

## 3. Visão-alvo (arquitetura final)

**Produto-base** = monorepo Next.js (App Router) organizado em **módulos isolados / bounded contexts**, cada um com sua fatia vertical, expondo uma interface pública e consumindo apenas interfaces públicas de outros módulos.

- **Runtime:** Cloudflare Workers (via OpenNext). **Postgres gerenciado por instância** atrás do **Hyperdrive**. **Vectorize** para RAG. **Agents SDK + Durable Objects** + **Workers AI** para o agente. **KV** para cache/estado leve.
- **Dados:** `app → action → service → repository → Drizzle`. **Zero Supabase.** Tipos inferidos do schema Drizzle.
- **AI-operável (dual-control):** toda operação de negócio existe como uma **Action** única, consumida igualmente pela UI e pelo agente (ver §4).
- **Modularidade:** **manifesto de módulos por instância** controla menu, rotas e APIs. **RBAC granular** (permissões por módulo/ação + roles customizáveis) com **painel admin**. Multi-clínica via `clinic_id`.
- **Entrega:** cada cliente = composição de módulos + config + branding, em infra isolada.

---

## 4. Princípio central: Action Layer (sistema AI-operável)

**Requisito:** tudo que o sistema faz deve ser executável tanto pelo usuário no frontend quanto pelo agente de IA, sem manter duas implementações.

**Padrão:** cada operação de negócio é uma **Action** (caso de uso) definida **uma única vez**. A UI e as tools do agente são **consumidores** da mesma Action.

```ts
// src/modules/operacional/actions/schedule-appointment.ts
export const scheduleAppointment = defineAction({
  name: 'operacional.scheduleAppointment',
  module: 'operacional',              // entitlement: só executa se o módulo está habilitado
  requires: 'appointments:create',   // RBAC granular
  input: z.object({                  // contrato validado (Zod)
    patientId: z.string().uuid(),
    dentistId: z.string().uuid(),
    startsAt: z.string().datetime(),
    procedureId: z.string().uuid(),
  }),
  async handler(input, ctx) {        // ctx = { user, clinicId } injetado
    // regra de negócio (conflito de horário, disponibilidade...)
    return appointmentsService.create({ ...input, clinicId: ctx.clinicId });
  },
});
```

Consumidores:

```ts
// Frontend (Server Action / route handler)
await runAction(scheduleAppointment, formData, ctx);

// Agente (tool derivada da própria Action — wrapper fino)
registerTool(scheduleAppointment);   // name + input(schema) + handler já prontos
```

**Garantias do padrão:**

- Lógica de negócio em **um lugar** → UI e agente nunca divergem.
- **RBAC + entitlement** verificados dentro de `runAction` → valem para os dois caminhos automaticamente.
- Habilitar um módulo **expõe suas Actions ao agente automaticamente** (as tools são derivadas).
- Para o agente implementador: criar um módulo = definir `actions + schema + UI que as chama`. As tools "vêm de graça".

**Contraste com o estado atual:** hoje `services/tools` define tools do agente **separadas** da lógica usada pela UI — fonte de duplicação e divergência. A Action Layer elimina isso e substitui esse subsistema.

**Componentes da Action Layer (a especificar no W3):**

- `defineAction(config)` — registra metadados (nome, módulo, permissão, schema, handler).
- `runAction(action, input, ctx)` — valida input, checa entitlement do módulo, checa RBAC, injeta `ctx`, executa, trata erro de forma uniforme.
- `registerTool(action)` — adapta a Action para o formato de tool do Agents SDK.
- `ActionContext` — `{ user, clinicId, ... }` derivado da sessão.
- Registro central de actions por módulo (alimenta tanto o frontend quanto o agente).

---

## 5. Anatomia de um módulo (template obrigatório)

Todo módulo do produto-base segue a mesma estrutura. O documento de cada módulo só descreve o que é **específico** dele.

```
src/modules/<modulo>/
├── actions/        # casos de uso (Action Layer) — fonte única de operações
├── services/       # regras de negócio / orquestração
├── repositories/   # acesso a dados (Drizzle)
├── schema/         # tabelas Drizzle do módulo
├── ui/             # páginas e componentes do módulo
├── permissions.ts  # permissões granulares que o módulo declara (ex: appointments:create)
├── manifest.ts     # metadados do módulo (id, nome, dependências, rotas, menu)
└── index.ts        # interface pública (o que outros módulos podem importar)
```

**Regras de fronteira:**

- Um módulo só importa a **interface pública** (`index.ts`) de outro módulo — nunca internals. Reforçado por lint de dependência.
- `Core` (clínicas, usuários, auth, RBAC, Action Layer, manifesto) é dependência permitida de todos.
- Cada módulo **declara** suas permissões e suas entradas de menu/rota; o manifesto de instância decide se estão ativas.
- Cada Action carrega `module` + `requires` → entitlement e RBAC são automáticos.

---

## 6. Eixos de trabalho

O trabalho se organiza em dois eixos:

- **Eixo 1 — Transformação da fundação (W0–W6):** arruma o que existe, estabelece a infra Cloudflare e os mecanismos de modularidade/RBAC/Action Layer. É pré-requisito do Eixo 2.
- **Eixo 2 — Catálogo de módulos:** cada módulo (existente refatorado ou greenfield) ganha sua spec, construído sobre a fundação e o padrão de módulo. Detalhados **um a um**.

**Estratégia de sequenciamento escolhida: A) Fundação-primeiro.** Migrar para Cloudflare carregando bridge, camadas confusas e frontend duplicado seria "portar o caos". Estabilizar e fixar as fronteiras modulares antes torna a migração de runtime mecânica e o agente greenfield limpo.

---

## 7. Eixo 1 — Fases da fundação

Cada fase abaixo vira uma `spec → plano` própria. Resumo de objetivo, entregas, dependências e risco.

### W0 — Estabilização *(baixo risco, destrava tudo)*
- **Objetivo:** baseline limpo e confiável antes de qualquer refatoração.
- **Entregas:** `git rm -r --cached` dos 322 `graphify-out`; reescrever `CLAUDE.md`/`AGENTS.md` com a stack real (Drizzle/pg/NextAuth/Cloudflare); corrigir o setup de tipos de teste (`jest-dom`) → `tsc` verde; remover arquivos soltos da raiz (`nul`, `weekprof.txt`, `dayprof_after.txt`, `.log`).
- **Dependências:** nenhuma.
- **Risco:** ~nulo.

### W1 — Morte do Supabase
- **Objetivo:** eliminar todo resíduo do Supabase; Drizzle como única fonte de verdade.
- **Entregas:** migrar os ~9 consumidores do bridge (páginas de pacientes/agendamentos, componentes de calendar, `complete-profile`) para repositories/Drizzle — **atenção ao `auth.getUser()` quebrado**; substituir `database.types.ts` (70KB) por tipos inferidos do schema Drizzle (10 arquivos consomem `Database`); deletar `src/lib/supabase/`, `src/lib/supabase.ts`, pasta `supabase/` (24 migrations legadas), env vars `*SUPABASE*` (`env.ts`, `health`, `dashboard/layout.tsx`).
- **Dependências:** W0.
- **Risco:** médio — bridge tem SQLi e falhas silenciosas; exige teste de regressão por consumidor migrado.

### W2 — Camada de dados
- **Objetivo:** padronizar o fluxo de dados e remover acesso direto a DB das páginas.
- **Entregas:** consolidar `services` (26k LOC) ↔ `repositories` (4k LOC) no padrão `app → action → service → repository`; nenhuma página/componente client toca DB; completar repositories faltantes.
- **Dependências:** W1.
- **Risco:** médio, majoritariamente mecânico.

### W3 — Modularidade + RBAC + Action Layer *(coração do produto — design cedo)*
- **Objetivo:** criar os mecanismos que tornam o sistema modular e AI-operável.
- **Entregas:**
  - **Action Layer** (`defineAction`/`runAction`/`registerTool`/`ActionContext`/registro) — §4.
  - **Manifesto de módulos** por instância (config-time): liga/desliga módulos no menu, rotas e APIs.
  - **RBAC granular:** modelo de permissões por módulo/ação, roles customizáveis, grants por usuário/clínica; substitui o `pgEnum` rígido.
  - **Painel admin** de acessos (gestão de usuários, funções, permissões, escopo por clínica).
  - **Estrutura `src/modules/`** e regras de fronteira (lint de dependência); migrar `domain-boundaries.ts` para o modelo real.
- **Dependências:** W2 (fronteiras de dados).
- **Risco:** alto conceitual — define o produto. Deve ter spec própria detalhada antes de codar.

### W4 — Runtime Cloudflare
- **Objetivo:** rodar o produto-base na topologia-alvo.
- **Entregas:** OpenNext → Cloudflare Workers; Hyperdrive → Postgres gerenciado por instância; Vectorize provisionado; auth edge (`getToken`) validada em Workers; pipeline de deploy por instância de cliente; remover `vercel.json`.
- **Dependências:** W0–W3 (sistema limpo e modular).
- **Risco:** alto — mudança de plataforma. Validar conexões DB, limites de Workers, cold start.

### W5 — Novo agente de IA
- **Objetivo:** substituir o agente atual por um construído sobre as primitivas nativas da Cloudflare.
- **Entregas:** remover os ~8k LOC atuais (`services/agent|agents|memory|rag|tools|scheduler|queue`, `lib/llm`, `lib/minimax`, rotas `/api/agent/*`, `/api/scheduler/*`); construir o agente sobre **Agents SDK + Durable Objects** (orquestração/estado), **Workers AI** (LLM/embeddings), **Vectorize/AutoRAG** (RAG); conectar o agente às **Actions** via `registerTool` (sem tools paralelas); **mapear e preencher gaps** de domínio (tools odontológicas específicas) — *só depois* do SDK no ar.
- **Dependências:** W3 (Action Layer), W4 (Cloudflare).
- **Risco:** médio — greenfield isolado, baixo acoplamento com o resto.

### W6 — Frontend base
- **Objetivo:** eliminar duplicação e aplicar o modelo modular à UI.
- **Entregas:** unificar duplicações (`configuracao`+`configuracoes`; `crm`+`pipeline`+`contatos`; `atividades`+`tarefas`); extrair componentes genéricos (`DataTable`, `FormShell`, `DetailShell`); menu e rotas dirigidos pelo manifesto de módulos + RBAC; redesenhar o eixo CRM/Contatos ↔ Comercial/Leads ↔ Operacional/Pacientes como bounded contexts (ver §8).
- **Dependências:** W3 (modularidade), W2 (dados).
- **Risco:** médio.

---

## 8. Eixo 2 — Catálogo de módulos

Cada módulo segue o template (§5) e o padrão Action Layer (§4). Detalhamento **1 por vez**, cada um com spec própria. O DB é ajustado por módulo (novas tabelas conforme necessário).

| Módulo | Estado no código | Tipo | Notas de domínio |
|---|---|---|---|
| **Core** | parcial | sempre presente | clínicas, usuários, auth, RBAC, Action Layer, manifesto |
| **Operacional** | maduro | refatorar | pacientes, agendamentos, prontuário, dentistas, procedimentos |
| **Comercial** | maduro | refatorar | leads, pipeline — origem comercial |
| **CRM/Contatos** | stub | redesenhar | camada ampla opcional; pode conter pacientes, leads e mais (ver §8.1) |
| **Campanhas** | maduro | refatorar | segmentação, disparos |
| **Financeiro** | base existe (`payments`,`installments`,`budgets`,`treatment-plans`) | expandir | gestão financeira completa |
| **Analytics/Relatórios** | existe | refatorar | métricas, no-show, ROI |
| **IA (agente)** | existe → substituído | greenfield | runtime do agente (W5) |
| **Gestão do agente de IA** | base existe (`agent/decisions`,`pending-actions`) | expandir | config de comportamento, auditoria de decisões, ações pendentes |
| **Gestão de documentos** | ❌ | greenfield | armazenamento/organização de documentos |
| **Social media** | ❌ | greenfield | gestão de redes sociais |
| **Tráfego pago** | ❌ | greenfield | gestão de campanhas de mídia paga |
| **Serviços administrativos** | ❌ | greenfield | a detalhar no spec do módulo |

> A **priorização do Eixo 2** (ordem de detalhamento) será definida antes de iniciar o detalhamento dos módulos.

### 8.1 Eixo CRM/Contatos ↔ Comercial ↔ Operacional (questão de design aberta)

São **bounded contexts diferentes**: Leads nasce no **Comercial**; Pacientes no **Operacional**; **Contatos** é uma camada de CRM mais ampla que pode referenciar ambos (e mais). Como o sistema é modular, um cliente pode **não ter** o módulo CRM. O modelo final (entidade unificada vs. referências entre contextos, transição lead→paciente) será decidido no spec do módulo **CRM/Contatos**, com proposta e mockup. Princípio: Operacional e Comercial devem funcionar **sem** o CRM.

---

## 9. Decisões abertas (com recomendação)

Resolvidas no início da fase/módulo correspondente:

| Decisão | Fase | Recomendação |
|---|---|---|
| Provider de Postgres por instância | W4 | Postgres gerenciado (ex.: Neon, com pgvector) atrás do Hyperdrive como pooler. Confirmar dado "infra própria por cliente". |
| Vector store do RAG | W5 | Migrar `pgvector` → **Vectorize** (alinha com "tudo Cloudflare"); manter pgvector como fallback. |
| Modelo de domínio CRM/Contatos | módulo CRM | Ver §8.1 — decidir no spec do módulo. |
| Escopo de branding/personalização (white-label) | W3/W6 | Definir o que é configurável por instância (logo, cores, nome) vs. fixo. |
| Roles customizáveis vs. roles fixos estendidos | W3 | Permissões granulares por módulo/ação + roles como conjuntos de permissões. |

---

## 10. Processo de trabalho

1. **Este documento** é o mapa-mestre e a fonte de verdade da visão.
2. Cada **fase do Eixo 1** e cada **módulo do Eixo 2** recebe: `spec de design` → `plano de implementação` → implementação (por outro agente).
3. **Apenas planejamento/documentação** nesta etapa. Nenhuma implementação é feita ao escrever os specs/planos.
4. Documentos derivados devem ser **auto-suficientes para o agente implementador** e **referenciar este mestre** (princípios, template de módulo, Action Layer).
5. **Planejar tudo antes** de implementar, para evitar retrabalho — especialmente o W3 (modularidade/RBAC/Action Layer) e o modelo de DB, que são fundacionais.

---

## 11. Riscos e dependências (visão geral)

- **W1 (Supabase)** é pré-requisito de tudo: o bridge inseguro e silenciosamente quebrado precisa morrer antes de construir por cima.
- **W3 (modularidade/Action Layer)** é o maior risco conceitual e guia W2, W5 e W6 — exige a spec mais cuidadosa.
- **W4 (Cloudflare)** é o maior risco de plataforma; deve vir só depois do sistema estar limpo e modular.
- **Action Layer** precisa existir (W3) antes do novo agente (W5) para que as tools sejam derivadas, não duplicadas.
- O **agente atual é isolado** (baixo acoplamento) → sua remoção em W5 é segura.
- O **modelo de DB** evolui continuamente por módulo; mudanças de schema fundacionais (RBAC granular, manifesto de módulos) acontecem em W3.
```
