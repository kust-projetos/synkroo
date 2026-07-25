# Synkroo — Roadmap-Mestre: Produto-Base Modular sobre Cloudflare

> **Tipo:** Documento-mestre de design (alto nível). Não é spec de implementação.
> **Data:** 2026-06-17
> **Status:** Aprovado para detalhamento por fase/módulo.
> **Escopo:** apenas planejamento e documentação. A implementação será feita por outro agente, guiado pelos documentos derivados deste.

---

## 0. Como ler este documento

Este é o **mapa-mestre** da transformação técnica do Synkroo. Ele define a visão-alvo de arquitetura, os princípios, o padrão de módulo e a sequência de trabalho.

Ele **referencia**, não duplica, a visão de produto que já existe em disco (§1). Detalhes de feature, requisitos e domínio vivem nos documentos canônicos; aqui ficam apenas as **decisões de arquitetura e a ordem de execução**.

Cada fase (Eixo 1) e cada módulo (Eixo 2) recebe depois seu próprio ciclo `spec → plano de implementação`, derivado e referenciando este mestre. Regra de ouro dos documentos derivados: **auto-suficientes para um agente implementador**.

---

## 1. Documentos-fonte canônicos (não duplicar)

A visão de produto, mercado e domínio já está documentada. Este mestre é a camada de transformação por cima dela. Ao detalhar fases/módulos, **puxar o detalhe destes documentos** em vez de recriá-lo:

| Documento | Conteúdo | Usar em |
|---|---|---|
| `docs/planning/product-brief.md` | Visão, 8 módulos, modelo de negócio (serviço personalizado modular, infra própria por cliente), moat, personas, pricing | Visão geral, catálogo |
| `docs/planning/epics.md` | **Épicos E-01..E-08** (vocabulário canônico de módulos) | Catálogo (§9) |
| `docs/planning/prd.md` (+ v3.1/v3.2) | Requisitos funcionais, jornadas, modelo de dados, arquitetura de agentes | Spec de cada módulo |
| `docs/planning/improvements-proposal.md` | Capacidades expandidas: preditiva, BI, financeiro/cobrança, voz, integrações, agente "vê e faz" | Catálogo, specs |
| `docs/planning/technical-research.md` | **Arquitetura de agentes 4+1**, MCP servers, RAG, multi-tenancy, custos | W5, módulo IA |
| `docs/planning/domain-research.md` | Regulamentação BR (LGPD, CFO/CRO), processos clínicos, diálogos agente-paciente | Compliance nos specs |
| `docs/planning/market-research.md` | Mercado, competição, pricing, GTM | Posicionamento |
| `archive/planning-v0.3` | Histórico de armadilhas e decisões legadas; não guia implementação atual | Resumo arquivado |
| `archive/planning-v0.3` | Histórico de padrões e build order; direção atual está no roadmap canônico | Resumo arquivado |

> ⚠️ Os documentos-fonte foram escritos sobre a stack antiga (**Claude Agent SDK + Supabase**). A **visão de produto permanece válida**, mas a **stack mudou**: o **Cloudflare Agents SDK substitui o Claude Agent SDK** (recursos nativos melhores para este sistema) e o **Supabase deu lugar ao Postgres**. O moat técnico migra de "Claude SDK + MCPs" para **primitivas nativas Cloudflare** (Agents SDK, Durable Objects, Workflows, Vectorize, edge) + ecossistema completo + Action Layer. O **modelo LLM é desacoplado/configurável** (definido na implementação/testes), não mais fixado em Claude.

---

## 2. Estado atual (reconhecimento técnico)

Escala: ~80.800 LOC, 559 arquivos `.ts/.tsx`, 51 tabelas, 113 testes unit + 41 E2E. Muito da visão já foi implementado (v0.1 calendário+WhatsApp; v0.2 CRM/pipeline/financeiro/LGPD), mas a arquitetura acumulou dívida e está em migração parcial.

| Achado | Evidência | Impacto |
|---|---|---|
| Docs de código descrevem stack errada | `CLAUDE.md`/`AGENTS.md` dizem "Supabase"; o código usa **Drizzle + `pg` + NextAuth**. Zero `@supabase/supabase-js`. | Induz a decisões erradas. |
| Bridge Supabase depreciado e inseguro | `src/lib/supabase.ts` emula Supabase sobre Drizzle via `sql.raw()` + escape manual. `.or()` é **no-op** (dados sem filtro); `.rpc()`/`auth.getUser()` retornam vazio. `complete-profile` já depende do `getUser()` quebrado. | **SQLi** + falhas silenciosas. |
| Camadas meio-migradas | `app→service` (77×), `app→repository` direto (35×), `service→repository` (28×). Repository Pattern + `domain-boundaries.ts` inacabados. | Páginas client tocam DB. |
| 322 arquivos `graphify-out/` versionados | No `.gitignore`, mas commitados antes da regra. | Poluição do repo. |
| Dívida de tipos/qualidade | 436 `any`, 59 arquivos com `console.*`, 63 erros `tsc` (todos em testes — `jest-dom`). Produção: **0 erros `tsc`**. | Typecheck de teste vermelho. |
| Frontend duplicado | `configuracao`+`configuracoes`; `crm`+`pipeline`+`contatos`(stub); `atividades`+`tarefas`. CRUD repetido sem componentes compartilhados. | Retrabalho, UX inconsistente. |
| Agente de IA isolado | ~8k LOC (`agent`,`agents`,`memory`,`rag`,`tools`,`scheduler`,`queue`). Só 2 arquivos de UI o importam. | Substituição de **baixo risco**. |
| RBAC raso/rígido | `pgEnum` `owner/admin/dentist/receptionist`, hierarquia linear. Sem "comercial/recepção", sem permissões granulares/grants. | Não suporta o painel de acessos desejado. |
| Multi-clínica existe | `clinic_id` é FK em todas as tabelas. | Base de tenancy interna pronta. |
| Sem manifesto de módulos | `clinics.settings`/`subscriptionPlan` genéricos. | Modularidade não existe no código. |

---

## 3. Modelo de produto, entrega e princípios

**Modelo de negócio (de `product-brief.md`):** não é SaaS genérico. É **serviço personalizado modular** — um **produto-base completo** do qual se compõe, por cliente, apenas os módulos/funções/personalização que ele precisa. Cada cliente roda em **infra própria/isolada** (deploy + DB dedicados). Dentro da instância há **multi-clínica** (`clinic_id`) e **multi-usuário com RBAC** + painel admin.

**Duas camadas de modularidade:**
1. **Composição por instância** (config-time): quais módulos esse cliente recebe — manifesto de módulos no deploy, não flag multi-tenant.
2. **RBAC em runtime** (dentro da instância): admin habilita acessos por usuário/função, escopo por clínica.

**Princípios arquiteturais transversais:**

- **P1 — AI-operável (dual-control):** toda operação existe como uma **Action** única, consumida igualmente pela UI e pelo agente (§5).
- **P2 — Omnichannel, WhatsApp-first:** o **Atendimento conversacional é o serviço principal**. WhatsApp é o canal primário; Instagram, Telegram, e-mail, SMS e voz são canais adicionais. Canais são infra; atendimento é o que roda sobre eles.
- **P3 — Nativo + Integração:** cada capacidade tem provider **nativo**, mas pode ser servida por **adapter de terceiro** quando melhor para o cliente (ex.: financeiro nativo ↔ ASAAS; agenda nativa ↔ Google Calendar/Doctoralia). Integrações são uma camada transversal.
- **P4 — Multi-agente 4+1:** um **orquestrador central** + **agentes especialistas** acionados por complexidade (ver `technical-research.md`). O código já tem a semente em `services/agents`.
- **P5 — Modularidade por bounded context:** cada módulo isolado, com fronteiras rígidas (lint de dependência), ativável por instância.
- **P6 — LLM-agnóstico (pluggable):** o agente roda sobre o **Cloudflare Agents SDK** (orquestração/runtime), com o **modelo LLM atrás de uma abstração** (via AI Gateway/Workers AI). O modelo concreto é configuração, definido na implementação/testes — o sistema não acopla a um provider específico.

---

## 4. Visão-alvo (arquitetura final)

**Produto-base** = monorepo Next.js (App Router) em **módulos isolados** (§6), cada um com fatia vertical e interface pública.

- **Runtime:** Cloudflare Workers (via OpenNext). **Postgres gerenciado por instância** atrás do **Hyperdrive**. **Vectorize** para RAG. **Cloudflare Agents SDK + Durable Objects** para orquestração do agente; **LLM configurável** via AI Gateway/Workers AI (modelo definido na implementação). **KV** para cache/estado leve. (Nota: webhooks na edge Cloudflare já estavam previstos em `improvements-proposal.md §3.1`.)
- **Dados:** `app → action → service → repository → Drizzle`. **Zero Supabase.** Tipos inferidos do schema Drizzle.
- **Agente:** orquestrador 4+1, AI-operável via Action Layer, multimodal (texto/voz/visão), capaz de operar sistemas externos via MCP.
- **Modularidade:** manifesto por instância + RBAC granular + painel admin. Multi-clínica via `clinic_id`.

---

## 5. Princípio central: Action Layer (sistema AI-operável)

**Requisito:** tudo que o sistema faz deve ser executável pela UI **e** pelo agente, sem manter duas implementações.

Cada operação é uma **Action** (caso de uso) definida **uma vez**. A UI e as tools do agente são consumidores.

```ts
// src/modules/operacional/actions/schedule-appointment.ts
export const scheduleAppointment = defineAction({
  name: 'operacional.scheduleAppointment',
  module: 'operacional',              // entitlement: só executa se o módulo está habilitado
  requires: 'appointments:create',   // RBAC granular
  input: z.object({
    patientId: z.string().uuid(),
    dentistId: z.string().uuid(),
    startsAt: z.string().datetime(),
    procedureId: z.string().uuid(),
  }),
  async handler(input, ctx) {        // ctx = { user, clinicId } injetado
    return appointmentsService.create({ ...input, clinicId: ctx.clinicId });
  },
});
```

```ts
await runAction(scheduleAppointment, formData, ctx);  // Frontend
registerTool(scheduleAppointment);                    // Agente (tool derivada)
```

**Garantias:** lógica em um lugar (UI e agente nunca divergem); RBAC + entitlement no `runAction` valem para os dois caminhos; habilitar um módulo expõe suas Actions ao agente automaticamente; criar módulo = `actions + schema + UI`, tools "de graça".

**Escopo amplo (a especificar no W3):** a Action Layer cobre **dois tipos de capacidade**, porque a visão exige que o agente opere também o mundo externo (`improvements-proposal.md §4.1`):
1. **Actions internas** — casos de uso de negócio sobre o próprio sistema.
2. **Tools externas** — MCP servers (operar software legado, integrações), e capacidades **multimodais/computer-use** (ler câmera, preencher formulários, gerar odontograma por voz). Sujeitas às mesmas checagens de RBAC/entitlement.

**Componentes:** `defineAction`, `runAction` (valida input, checa entitlement+RBAC, injeta ctx, trata erro), `registerTool`, `ActionContext`, registro central por módulo, e o adaptador para MCP/tools externas.

> Substitui o `services/tools` atual, onde as tools do agente são definidas **separadas** da lógica da UI — fonte de duplicação.

---

## 6. Anatomia de um módulo (template obrigatório)

```
src/modules/<modulo>/
├── actions/        # casos de uso (Action Layer) — fonte única de operações
├── services/       # regras de negócio / orquestração
├── repositories/   # acesso a dados (Drizzle)
├── schema/         # tabelas Drizzle do módulo
├── ui/             # páginas e componentes
├── integrations/   # adapters de terceiros (provider nativo ↔ externo) — P3
├── permissions.ts  # permissões granulares declaradas pelo módulo
├── manifest.ts     # metadados (id, nome, dependências, rotas, menu, canais)
└── index.ts        # interface pública
```

**Regras de fronteira:** módulo só importa o `index.ts` de outro (lint de dependência); `Core` é dependência permitida de todos; cada módulo declara permissões + entradas de menu/rota; cada Action carrega `module` + `requires`.

---

## 7. Eixos de trabalho

- **Eixo 1 — Transformação da fundação (W0–W6):** arruma o existente, estabelece infra Cloudflare e os mecanismos de modularidade/RBAC/Action Layer. Pré-requisito do Eixo 2.
- **Eixo 2 — Catálogo de módulos (E-01..E-08 + transversais):** cada módulo ganha sua spec, sobre a fundação e o template. Detalhados **um a um**.

**Estratégia: A) Fundação-primeiro.** Migrar para Cloudflare carregando bridge/camadas confusas/frontend duplicado é "portar o caos". Estabilizar e fixar fronteiras modulares antes torna a migração mecânica e o agente greenfield limpo. O **design** da modularidade (W3) é decidido cedo, pois guia W2/W5/W6.

---

## 8. Eixo 1 — Fases da fundação

Cada fase vira uma `spec → plano` própria.

**W0 — Estabilização** *(risco ~nulo)* — `git rm -r --cached` dos 322 `graphify-out`; reescrever `CLAUDE.md`/`AGENTS.md` com a stack real; corrigir tipos de teste (`jest-dom`) → `tsc` verde; remover arquivos soltos da raiz. **Saída:** baseline verde, doc fiel.

**W1 — Morte do Supabase** *(risco médio)* — migrar os ~9 consumidores do bridge para repositories/Drizzle (atenção ao `auth.getUser()` quebrado em `complete-profile`); substituir `database.types.ts` (70KB) por tipos inferidos do schema (10 arquivos consomem `Database`); deletar `src/lib/supabase/`, `supabase.ts`, pasta `supabase/`, env `*SUPABASE*`. Regressão por consumidor. **Dep:** W0.

**W2 — Camada de dados** — ⚠️ **ABSORVIDO (decisão 2026-06-17).** O reconhecimento pós-W0/W1 mostrou que a meta dura ("nenhuma página client toca DB") **já está cumprida** (0 componentes `'use client'` tocam DB após a remoção do bridge). Os `app→repositories` (35×) são todos route handlers (`api/*`) — padrão controller correto, não violação. A consolidação interna restante (`services`/route handlers com `getDb()` direto, ~83 arquivos) **se sobrepõe ao Eixo 2** (cada módulo migra ao template) e inclui código **removido no W5** (agente). Refatorá-la agora seria retrabalho. **Resolução:** (1) regra de **lint anti-DB-em-client** absorvida no W3.4; (2) consolidação por domínio acontece no Eixo 2; (3) o Core (W3.4) é o exemplo canônico de `app→action→service→repository`. Sem fase/plano próprio.

**W3 — Modularidade + RBAC + Action Layer** *(coração; risco alto conceitual)* — Action Layer (interna + MCP/multimodal, §5); manifesto de módulos por instância; RBAC granular (permissões por módulo/ação, roles customizáveis, grants) substituindo o `pgEnum`; painel admin de acessos; estrutura `src/modules/` + lint de fronteira; migrar `domain-boundaries.ts`. Spec própria detalhada antes de codar. **Dep:** W2.

**W4 — Runtime Cloudflare** *(risco alto)* — OpenNext→Workers; Hyperdrive→Postgres gerenciado por instância; Vectorize provisionado; auth edge validada; pipeline de deploy por instância; remover `vercel.json`. **Dep:** W0–W3.

**W5 — Novo agente de IA** *(risco médio, isolado)* — remover os ~8k LOC atuais; construir o **orquestrador 4+1** (ver `technical-research.md`) sobre **Cloudflare Agents SDK** + Durable Objects + Vectorize/AutoRAG, com **LLM pluggable** (modelo definido depois, em config/testes); conectar via Action Layer (sem tools paralelas); MCP + multimodal; **mapear e preencher gaps** de domínio depois do SDK no ar. **Dep:** W3 (Action Layer), W4 (Cloudflare).

**W6 — Frontend base** *(risco médio)* — unificar duplicações; extrair `DataTable`/`FormShell`/`DetailShell`; menu/rotas dirigidos pelo manifesto + RBAC; redesenhar o eixo CRM/Contatos ↔ Comercial ↔ Operacional (§9.1). **Dep:** W2, W3.

---

## 9. Eixo 2 — Catálogo de módulos (ancorado em E-01..E-08)

Vocabulário canônico de `epics.md`. Cada módulo segue o template (§6) e a Action Layer (§5); DB ajustado por módulo; detalhamento **1 por vez**, puxando feature-detail dos docs-fonte (§1).

**🔵 Plataforma (sempre presente)**

| Módulo | Estado | Tipo |
|---|---|---|
| **Core** — clínicas, usuários, auth, RBAC granular, manifesto, Action Layer | parcial | refatorar/expandir |
| **Agente IA (4+1)** — orquestrador + especialistas; consome Actions | existe → substituído | greenfield (W5) |
| **Canais** — WhatsApp (principal), Instagram, Telegram, e-mail, SMS, voz | parcial (WhatsApp/Evolution) | expandir |

**🟢 Épicos canônicos (E-01..E-08)**

| Épico | Módulo | Estado | Tipo |
|---|---|---|---|
| **E-01** | Atendimento Multicanal 24/7 ⭐ *serviço principal* | maduro (WhatsApp) | refatorar/expandir |
| **E-02** | Gestão de Agendamentos (Operacional/clínico) | maduro | refatorar |
| **E-03** | Follow-up e Retenção | maduro | refatorar |
| **E-04** | CRM Inteligente (Contatos) | parcial/stub | redesenhar (§9.1) |
| **E-05** | Vendas e Conversão (Comercial/Leads/Pipeline) | maduro | refatorar |
| **E-06** | Marketing e Redes Sociais (tráfego pago, orgânico, conteúdo, social, e-mail) | ❌ | greenfield |
| **E-07** | Call Center com IA (voz) | ❌ | greenfield |
| **E-08** | Dashboard e Gestão (BI/Analytics) | existe | refatorar |

**🟡 Capacidades transversais (de `improvements-proposal.md`)**

| Capacidade | Estado | Tipo |
|---|---|---|
| **Financeiro & Cobrança** (orçamentos, parcelas, pagamentos, PIX, inadimplência) | base (`payments`,`installments`,`budgets`) | expandir |
| **Inteligência Preditiva** (no-show ML, churn, upsell, sazonalidade) | base (`analytics/noshow-prediction`) | expandir |
| **Business Intelligence** (dashboards executivos por área) | parcial | expandir → parte de E-08 |
| **Escritório / Documentos** (criação de docs, arquivos, contratos, e-mails) | ❌ | greenfield |
| **Operações Especiais Odonto** (odontograma, proposta visual, orientações) | parcial | expandir |
| **Gestão do Agente de IA** (config, auditoria de decisões, ações pendentes) | base (`agent/decisions`) | expandir |
| **Integrações de terceiros** (saúde, financeiro, marketing, operacional) — P3 | ❌ | greenfield (camada) |

> Priorização do Eixo 2 (ordem de detalhamento) a definir antes de iniciar os módulos. Sugestão inicial alinhada à visão WhatsApp-first: **Core → Atendimento (E-01) → Operacional (E-02) → Follow-up (E-03) → Agente IA**.

### 9.1 Eixo CRM/Contatos ↔ Comercial ↔ Operacional (design aberto)

Bounded contexts distintos: **Leads** (comercial, E-05), **Pacientes** (operacional, E-02), **Contatos/CRM** (E-04) como camada ampla que pode referenciar ambos (e mais). Como o sistema é modular, um cliente pode **não ter** o módulo CRM. Modelo final (entidade unificada vs. referências entre contextos; transição lead→paciente) decidido no spec do módulo **E-04**, com proposta e mockup. Princípio: Operacional e Comercial funcionam **sem** o CRM.

---

## 10. Decisões abertas (com recomendação)

| Decisão | Fase | Status / Recomendação |
|---|---|---|
| Runtime do agente e modelo LLM | W5 | ✅ **RESOLVIDA:** **Cloudflare Agents SDK substitui o Claude** (não usar Claude). **Modelo LLM configurável (pluggable)**, definido pelo usuário na implementação/testes via AI Gateway/Workers AI. |
| Provider de Postgres por instância | W4 | Postgres gerenciado (ex.: Neon, pgvector) atrás do Hyperdrive. |
| Vector store do RAG | W5 | `pgvector` → **Vectorize**; pgvector como fallback. |
| Modelo de domínio CRM/Contatos | E-04 | Ver §9.1. |
| Branding/personalização (white-label) | W3/W6 | Definir o que é configurável por instância. |

---

## 11. Processo de trabalho

1. Este documento é o mapa-mestre; a **visão de produto** vive nos docs-fonte (§1).
2. Cada fase do Eixo 1 e cada módulo do Eixo 2 recebe `spec → plano → implementação` (por outro agente).
3. **Apenas planejamento/documentação** nesta etapa.
4. Documentos derivados são **auto-suficientes para o agente implementador** e referenciam este mestre + os docs-fonte relevantes (não duplicam).
5. **Planejar tudo antes** de implementar — especialmente W3 (modularidade/RBAC/Action Layer) e o modelo de DB.

---

## 12. Riscos e dependências

- **W1 (Supabase)** é pré-requisito: o bridge inseguro precisa morrer antes de construir por cima.
- **W3 (modularidade/Action Layer)** é o maior risco conceitual; guia W2/W5/W6.
- **W4 (Cloudflare)** é o maior risco de plataforma; só depois do sistema limpo e modular.
- **Action Layer** (W3) precisa existir antes do novo agente (W5) para tools derivadas, não duplicadas.
- O **agente atual é isolado** → remoção em W5 é segura.
- O **modelo de DB** evolui por módulo; mudanças fundacionais (RBAC granular, manifesto) acontecem em W3.
- **`PITFALLS.md`** deve ser consultado ao escrever cada plano de implementação.
