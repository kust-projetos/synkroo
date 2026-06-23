# Eixo 2 — Módulo Atendimento (E-01, Onda 1) — Design

> **Tipo:** Spec de módulo (design). Segundo módulo da Onda 1 (após E-02).
> **Data:** 2026-06-23
> **Status:** Aprovado em substância (brainstorming). Pendente revisão do spec escrito antes do plano de implementação.
> **Escopo:** apenas planejamento/documentação. Implementação por outro agente, guiado pelo plano derivado deste.
> **Dependências:** Core (Onda 0) e Operacional (E-02) fechados — template canônico, Action Layer, RBAC, manifesto, gates, route-adapter, constraint anti-overbooking. As Actions do E-02 (`agendar/remarcar/confirmar`) já existem e são consumíveis.

## 0. Contexto e objetivo

O **Atendimento (E-01)** é o trilho conversacional **WhatsApp-first** da Onda 1: recebe a mensagem do paciente, materializa a conversa e a roteia. É o **par** do E-02 (que produz as Actions de agenda) e o **substrato do Agente IA** (passo 4 da Onda 1), que orquestra E-01/E-02/E-03 via Action Layer.

**Situação de entrada (verificada em 2026-06-23):** diferentemente do E-02, o `src/modules/atendimento` **já existe e está ~70% construído** — **20 Actions** reais, várias rotas já como adapters gated (`whatsapp/send`, `messages/send`, `conversations`), schema próprio (`conversations/messages/...`), `manifest`, `permissions`, `route-adapter` e registro no `bootstrapActions`. **Mas com lacunas reais** (§2): backend ainda legado (incl. o próprio repository/services do módulo), **5 rotas ungated** (uma sem auth), e testes rasos. Portanto este spec **não desenha o módulo do zero** — ele **consolida ao template canônico**: migra o backend para dentro do módulo, fecha/gateia as rotas, cobre com testes e retira o legado **de forma coordenada** com os consumidores cross-module.

**Fonte de verdade superior:** roadmap-mestre (`2026-06-17-...-roadmap-design.md`) §5 (Action Layer), §6 (template), §9.1 (modularidade). Sequenciamento: `2026-06-21-eixo2-sequenciamento-design.md` (§4, Onda 1). Referência de padrão: `2026-06-21-eixo2-core-modulo-design.md` e `2026-06-22-eixo2-operacional-modulo-design.md` (incl. lições da revisão: gates totais, sem bypass, adapters preservando contrato).

---

## 1. Princípio organizador — fases ordenadas (backend-first)

Um único spec/plano, fases P1–P5, **backend-first** (mesma lógica de "fundação primeiro" do E-02): portar o backend compartilhado **uma vez, limpo**, e empilhar o resto. **Não há fase de schema** — o módulo já é dono de `conversations/messages/conversationStates/conversationSessions/conversationMemories`.

| Fase | Conteúdo | Razão da posição |
|---|---|---|
| **P0 Inventário + gates** | Matriz completa das rotas do bounded context com status gated/ungated (§3.1); fechar os **5 ungated** + adicionar auth ao `whatsapp/evolution` | Base factual; evita "toda rota gated" sem inventário |
| **P1 Repository** | Portar **de fato** as queries de `repositories/conversations` (446 LOC) para `conversations-repository` do módulo — hoje o repo do módulo é **ele mesmo um adapter** do legado (`conversations-repository.ts:12`); migrar todas as actions para fora de `@/repositories/conversations` | Backend de dados compartilhado por quase todas as actions |
| **P2 Channel services** | Portar `services/whatsapp/*` (Evolution 632 + whatsapp 339 + templates 221 + index 290) → `services/` do módulo; migrar **actions E os próprios services do módulo** (`send-message`/`webhook-processor` ainda importam legado) para fora de `@/services/whatsapp`; eliminar `getDb()` em `status-evolution.ts` | Integração de canal compartilhada |
| **P3 Webhooks + gates seguros** | Os 5 ungated gated com `withModuleRoute` preservando assinatura; **flag/canary/rollback** para os webhooks em produção; `whatsapp/evolution` ganha auth | Precisa das actions/services migrados |
| **P4 Testes** | À paridade do E-02 + **por-rota**: disabled→404, assinatura inválida→403, webhook duplicado→200 ignored (idempotência); inbound→conversa→envio, canal, escala | Sobre o backend e rotas consolidados |
| **P5 Retirada coordenada do legado** | **Não remover `services/whatsapp/*` enquanto Operacional/reminders dependerem** (§3.2): primeiro remapear esses consumidores; depois remover o órfão + `repositories/conversations`; lint/typecheck/gates verdes | Só quando NADA (incl. outros módulos) os referencia |

---

## 2. Estado atual (reconhecimento — verificado em 2026-06-23)

| Item | Estado | Evidência |
|---|---|---|
| Schema do domínio | ✅ já é do módulo | `modules/atendimento/schema/conversations.ts` define `conversations`, `messages`, `conversationStates`, `conversationSessions`, `conversationMemories` |
| Actions (**20** exportadas) | ⚠️ reais, mas 9+ importam **legado** direto | `index.ts` exporta 20 actions; `enviar-mensagem.ts:6`, `receber-mensagem.ts:5`, `agendar-mensagem.ts:6`, `responder-instagram.ts:11`, `obter-modelo-mensagem.ts:4-5`, `obter-qrcode.ts:4`, `status-evolution.ts:4,19` (inclui `getDb()`), `processar-webhook-*` (dynamic import de `@/repositories/conversations`) |
| `conversations-repository` do módulo | ❌ **é ele mesmo um adapter do legado** | `conversations-repository.ts:12` → `import * as repo from '@/repositories/conversations'`. P1 **não está começado** de fato |
| Services do módulo (`send-message`, `webhook-processor`) | ⚠️ ainda importam legado | `send-message-service.ts:11`, `webhook-processor-service.ts:11` |
| Rotas — gated (9) | ✅ adapters gated | conversations, conversations/[id], messages/send, messages/history/[id], messages/whatsapp, whatsapp/send, whatsapp/qrcode, whatsapp/templates |
| Rotas — **ungated (5)** | ❌ sem `withModuleRoute` | `whatsapp/webhook`, `instagram/webhook`, `whatsapp/evolution`, `messages/inbound`, `widget/messages` |
| `whatsapp/evolution` | ❌ **POST público sem auth** | `whatsapp/evolution/route.ts:8` — sem gate, sem WEBHOOK_SECRET, sem assinatura; chama Evolution service direto |
| `messages/inbound`/`widget/messages` | ⚠️ system ctx com `hasModule:()=>true` | `route-adapter.ts:48-66` — bypass de entitlement (sem `withModuleRoute`) |
| `@/services/whatsapp` | ⚠️ **compartilhado** (não só atendimento) | `modules/operacional/services/reminders-service.ts:10` (`sendWhatsAppMessage`), `services/reminders/procedure-reminder-config.service.ts:11` (`fillTemplate`) |
| `repositories/conversations` consumidor externo | ⚠️ 1 (E-08) | `dashboard/stats/route.ts:10,74-75` (`convRepo.countByClinic`) |
| Testes do módulo | ⚠️ **1** arquivo | `modules/atendimento/__tests__/conversations/integration.test.ts` |

> **Descoberta-chave:** o módulo é hoje uma **casca** sobre o backend legado — as actions, **e até o repository/services do próprio módulo**, delegam ao legado (`@/repositories/conversations`, `@/services/whatsapp`). A consolidação é trazer esse backend para dentro e retirar o legado **sem quebrar (a) os contratos HTTP/webhook já funcionando, nem (b) os consumidores cross-module** (`Operacional/reminders`).

---

## 3. Fronteiras do módulo

| Domínio | Dono | Nota |
|---|---|---|
| Conversas, mensagens, canais (WhatsApp/Instagram/web), webhooks, templates, escala | **E-01 (este)** | bounded context inteiro |
| Integração Evolution API (envio, QR, status, instâncias) | **E-01** | migra de `services/whatsapp` para `services/` do módulo |
| NLU de canal (`classificar-intencao`, `extrair-entidades`) | **E-01** | classificação leve de roteamento; o **agente conversacional (passo 4)** consome via Action Layer, não duplica |
| Agendamento (Actions consumidas pelo atendimento/agente) | **E-02** | já pronto; E-01 não reimplementa |
| Retenção/follow-up | **E-03** | fora |
| Orquestração conversacional (router/scheduler/sales) | **Agente IA (passo 4)** | fora; nasce depois, consumindo as Actions de E-01/E-02/E-03 |
| `dashboard/stats` (lê conversas) | **E-08/tooling** | fora; permanece, apontando ao agregador central `@/lib/db/schema` se precisar |

**Princípio §9.1 preservado:** Atendimento funciona sem CRM/E-04. System context (webhooks) resolve clínica por `externalId`/instância, nunca cross-clinic.

### 3.1. Matriz de rotas do bounded context (P0)

| Rota | Gate hoje | Ação |
|---|---|---|
| `conversations`, `conversations/[id]` | ✅ gated | manter |
| `messages/send`, `messages/history/[id]`, `messages/whatsapp` | ✅ gated | manter |
| `whatsapp/send`, `whatsapp/qrcode`, `whatsapp/templates` | ✅ gated | manter |
| `whatsapp/webhook` | ❌ ungated (assinatura OK) | **gatear** (assinatura preservada) |
| `instagram/webhook` | ❌ ungated (HMAC OK) | **gatear** (assinatura preservada) |
| `whatsapp/evolution` | ❌ ungated **+ sem auth** | **gatear + adicionar auth** (WEBHOOK_SECRET ou assinatura Evolution) |
| `messages/inbound` | ❌ ungated (WEBHOOK_SECRET na rota; system ctx `hasModule:()=>true`) | **gatear** (`withModuleRoute`) |
| `widget/messages` | ❌ ungated (system ctx) | **gatear** |

DoD do P0: as 5 ungated passam a gated; nenhuma rota do bounded context sem `withModuleRoute`; `whatsapp/evolution` com auth.

### 3.2. Consumidores cross-module do canal (P5 — bloqueante para remoção do legado)

`@/services/whatsapp` **não é só do Atendimento** — é usado para **envio** por:
- `modules/operacional/services/reminders-service.ts:10` → `sendWhatsAppMessage`
- `services/reminders/procedure-reminder-config.service.ts:11` → `fillTemplate`

**Decisão:** o envio de mensagem é capacidade do **Atendimento**. Esses consumidores devem enviar **via a Action `atendimento.enviarMensagem`** (cross-module pela Action Layer, padrão §5), **não** importando um service de canal. Enquanto não migrados, `services/whatsapp/*` **não pode ser removido** (P5). Sequência segura:
1. Expor o envio como Action consumível (`enviarMensagem` já existe).
2. Migrar `reminders-service`/`procedure-reminder-config` para chamar a Action (ou um service do módulo Atendimento exposto pelo índice público, se Action for inviável no contexto de cron).
3. Só então remover `services/whatsapp/*`.

`dashboard/stats` (E-08) usa `convRepo.countByClinic(clinicId, { status })` (`stats/route.ts:74-75`) — substituição concreta: um `countByClinic` no `conversations-repository` do módulo exposto pelo índice, **ou** uma contagem direta via `@/lib/db/schema` (agregador central). Não basta "reapontar" genérico — o plano lista a query substituta.

---

## 4. Estrutura (já existe; o que muda)

```
src/modules/atendimento/
├── actions/         # 22 actions — PARAM de importar @/repositories/conversations e @/services/whatsapp;
│                    #   passam a delegar a repositories/ e services/ do módulo
├── repositories/
│   └── conversations-repository.ts   # RECEBE as queries portadas de repositories/conversations
├── services/
│   ├── send-message-service.ts       # já existe
│   ├── webhook-processor-service.ts  # já existe
│   ├── evolution-service.ts          # NOVO: portado de services/whatsapp/evolution.service.ts
│   ├── channel-service.ts            # NOVO: portado de whatsapp.service.ts (abstração de canal)
│   └── templates-service.ts          # NOVO: portado de message-templates.service.ts
├── schema/conversations.ts           # já dono — inalterado
├── ui/route-adapter.ts               # runAtendimentoAction / runAtendimentoSystemAction — já existe
├── manifest.ts · permissions.ts · index.ts   # já existem
```

Fluxo canônico (idêntico ao Core/E-02):

```
app (route/webhook) → runAtendimento(System)Action → runAction → service (regra+canal) → repository (Drizzle) → DB
                            │
                            └─ gates: input (Zod) + entitlement (atendimento) + RBAC (requires) + ctx + audit
```

---

## 5. Migração do backend (P1/P2)

### P1 — Repository
- Portar as queries de `repositories/conversations/index.ts` (446 LOC) para `conversations-repository.ts` do módulo: localizar/criar/atualizar conversa (`findById`, `findByIdWithJoins`, `findByExternalId`), append de mensagem, vínculo com paciente, listagem por clínica.
- Cada action troca `import * as legacyRepo from '@/repositories/conversations'` (estático **e** os `await import('@/repositories/conversations')` dinâmicos em `processar-webhook-*`) por `import * as repo from '../repositories/conversations-repository'`.
- **Sem `getDb()` em actions** (regra do template); queries vivem no repository.
- `dashboard/stats` (E-08) permanece — se referenciar tabelas, aponta a `@/lib/db/schema` (agregador central, `lib` allow-by-default), **não** ao repository/seam interno do módulo (lição da revisão do E-02: import cross-module só pelo agregador central).

### P2 — Channel services
- Portar `evolution.service.ts` (632 LOC — envio de mensagem, QR code, status de instância, gestão de instâncias Evolution), `whatsapp.service.ts` (339) e `message-templates.service.ts` (221) para `services/` do módulo (`evolution-service.ts`, `channel-service.ts`, `templates-service.ts`).
- Actions `enviar-mensagem`, `responder-instagram`, `obter-qrcode`, `status-evolution`, `obter-modelo-mensagem` passam a delegar a esses services; **zero `@/services/whatsapp`** nas actions.
- Env da Evolution (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`) preservados via `@/lib/env`; **sem hardcode de segredo**. Fallback Playwright (se existir no legado) preservado ou explicitamente deferido com nota.

---

## 6. Webhooks + gates + segurança (P3)

- `withModuleRoute('atendimento', moduleManifest)` nas **5 rotas ungated** (§3.1): `whatsapp/webhook`, `instagram/webhook`, `whatsapp/evolution`, `messages/inbound`, `widget/messages`. Retorna **404** quando o módulo não está contratado.
- **`whatsapp/evolution` ganha auth** — hoje é POST público sem verificação (`route.ts:8`). Adicionar `WEBHOOK_SECRET`+`timingSafeEqual` ou a assinatura do provedor Evolution antes de processar. **Blocker de segurança** (superfície pública sensível, risco LGPD/spam).
- **Ordem:** gate de módulo **antes** do processamento; a **verificação de assinatura é preservada intacta** — Meta HMAC `x-hub-signature-256` (whatsapp/instagram), `WEBHOOK_SECRET` + `timingSafeEqual` (messages/inbound). Nunca afrouxar.
- **Handshake GET** (`hub.verify_token` → `hub.challenge`) continua funcionando quando o módulo está ativo; com módulo desativado, 404 é o comportamento correto (sem canal, sem webhook).
- **Política de resposta:** webhooks retornam **200 mesmo em no-op** (assinatura válida porém evento ignorável/**duplicado** — ver idempotência §9) para evitar retry-storm do Meta; assinatura **inválida/ausente** retorna 403; payload malformado loga e retorna 200. Erros internos → 500 sem dados.
- **Migração segura (produção):** webhooks são superfície externa viva. A troca de cada rota deve ser reversível — `git revert` por commit isolado por rota, logs de antes/depois do processamento, e validação do handshake GET + de uma mensagem real de teste após cada troca. Se houver feature-flag/instância de staging, fazer canary antes de produção. **Não** trocar as 5 num único commit.
- Cobertura: **toda** rota do bounded context (matriz §3.1) gated por `withModuleRoute`.

---

## 7. Catálogo de Actions (já existe — canônico)

Permissões (`permissions.ts`): `atendimento:view`, `atendimento:manage_messages`, `atendimento:manage_conversations`, `atendimento:manage_webhooks`, `atendimento:manage_templates`, `atendimento:escalate`.

- **Inbound (system):** `receber-mensagem`, `processar-webhook-whatsapp`, `processar-webhook-instagram`, `verificar-webhook(-instagram)` — via `runAtendimentoSystemAction` (sem sessão; autenticadas por assinatura/secret no nível da rota; resolvem clínica por `externalId`/instância).
- **Usuário:** `enviar-mensagem`, `iniciar/obter/listar/arquivar-conversa`, `escalar-conversa`, `agendar-mensagem`, `historico-mensagens`, `obter-modelo-mensagem`, `obter-qrcode`, `status-evolution`, `classificar-intencao`, `extrair-entidades`, `responder-instagram` — via `runAtendimentoAction`.
- Todas `module:'atendimento'` com `requires` apropriado; expostas ao agente via `agentToolsFor` (módulo já registrado no `bootstrapActions`).

---

## 8. Error handling

- `runAction` mapeia `ActionError(code, msg)` → `{ result:'error', errorCode }`. `not_found`/`forbidden`/`conflict`/`validation` padrão.
- Nunca vaza dados de outra clínica: user ctx injeta `clinicId` (queries filtram); system ctx (webhook) resolve clínica por `externalId`/instância e nunca opera cross-clinic.
- Webhooks: assinatura inválida → 403; no-op/duplicado/ malformado → 200 + log (anti-retry-storm); erro interno → 500 sem dados sensíveis.
- Falha de import pós-migração (P1/P2) capturada por `tsc` (gate de build) — verificação obrigatória no plano.

---

## 9. Testing (P4)

- **Por-rota (obrigatório, todas as rotas públicas do bounded context):**
  - **Módulo desabilitado → 404** (entitlement) — para as 5 ex-ungated e as públicas.
  - **Assinatura inválida/ausente → 403.**
  - **Webhook duplicado → 200 ignored, sem nova mensagem** (idempotência/deduplicação — mesma `externalMessageId`/payload não cria segunda `message`).
- **Integração (Postgres real):**
  - Inbound WhatsApp: `receber-mensagem`/`processar-webhook-whatsapp` cria/atualiza conversa, faz append da mensagem e vincula paciente por telefone.
  - Handshake GET retorna challenge com módulo ativo.
  - Envio por canal: `enviar-mensagem` resolve canal pela conversa e delega ao service (Evolution mockado na borda externa).
  - Escala: `escalar-conversa` muda estado e respeita `atendimento:escalate`.
  - Escopo por clínica em todas as reads; system ctx por `externalId`.
- **Unit:** resolução de canal; tradução de erros; NLU (`classificar-intencao`/`extrair-entidades`) com LLM mockado; registro das actions no registry (guard).
- **Gates de build:** `typecheck` 0; `lint` 0 (boundaries `error`); `db:generate` "No schema changes"; `npm run lint` rodado **isolado** (conferir exit code do próprio lint — lição da revisão do E-02).

---

## 10. Definition of Done

- [ ] **P0** matriz §3.1 fechada: as **5 rotas ungated** gated; `whatsapp/evolution` com auth; nenhuma rota do bounded context sem `withModuleRoute`.
- [ ] **P1** `conversations-repository` do módulo contém as queries **reais** (não importa mais `@/repositories/conversations`); **nenhuma action** importa o repo legado (estático ou dinâmico); sem `getDb()` em actions (incl. `status-evolution`).
- [ ] **P2** `evolution/channel/templates` services no módulo; **nenhuma action nem service do módulo** (`send-message`, `webhook-processor`) importa `@/services/whatsapp`; env Evolution via `@/lib/env`, sem hardcode.
- [ ] **P3** `withModuleRoute` nas 5 ungated + assinatura preservada + `whatsapp/evolution` autenticado; handshake GET funciona; política 200-no-op; troca por-rota reversível (commits isolados, logs, validação pós-troca).
- [ ] **P4** testes por-rota (disabled→404, assinatura inválida→403, duplicado→200 ignored) + integração (inbound→conversa→envio, canal, escala) + guard de registry; LLM/Evolution mockados na borda.
- [ ] **P5** consumidores cross-module (`operacional/reminders`, `procedure-reminder-config`) migrados para enviar via Action; `dashboard/stats` com substituição concreta (`countByClinic` ou contagem via `@/lib/db/schema`); **só então** `services/whatsapp/*` e `repositories/conversations` removidos; nenhum import legado restante (incl. fora do módulo).
- [ ] `typecheck` 0; `lint` 0 (isolado); unit + integração verdes; `db:generate` limpo; agente lista as actions de atendimento via `agentToolsFor`.
- [ ] **Sem bypass:** nenhuma rota do bounded context com `getDb()`/`@/repositories/conversations`/`@/services/whatsapp` direto; toda escrita por `runAction`.

---

## 11. Fora de escopo (deferido com razão)

- **Orquestração conversacional do agente** (router/scheduler/sales) — passo 4 da Onda 1.
- **Voz / Call Center** (E-07) — greenfield posterior.
- **`dashboard/stats`** — E-08.
- **Novos canais** além de WhatsApp/Instagram/web já existentes.
- **Reescrita funcional** da lógica Evolution — é **port**, não redesign (preservar comportamento).

---

## 12. Riscos

- **Evolution API frágil (Pitfall 4):** integração externa instável. Mitigação: portar como **port fiel** (sem mudar comportamento), preservar retry/fallback existentes (incl. Playwright se houver), mockar na borda nos testes; não reescrever a lógica durante a migração.
- **Remoção do legado quebra outros módulos (CRÍTICO):** `services/whatsapp/*` é consumido por `operacional/reminders` e `procedure-reminder-config` (§3.2). Remover em P5 **sem** remapear esses consumidores quebra os lembretes do Operacional. Mitigação: P5 coordenado — migrar consumidores via Action primeiro; `rg`/`tsc` confirmam zero importadores antes de deletar.
- **`whatsapp/evolution` público sem auth:** superfície sensível exposta (LGPD/spam). Mitigação: P0/P3 adicionam auth + gate antes de qualquer outra mudança.
- **Webhook gating quebrar handshake do Meta:** `withModuleRoute` → 404 no GET com módulo off é correto; com módulo **on** o challenge deve passar — testar o GET. Troca por-rota reversível (commit isolado + validação pós-troca; canary se houver staging).
- **`rg` via Bash não-confiável neste ambiente (falso-negativo):** o inventário de consumidores legados foi subestimado por um grep que retornou vazio incorretamente. Mitigação: o plano confirma consumidores por leitura direta de arquivo + `tsc`, **não** confia só em `rg`.
- **Boundary lint cross-module:** repetir o erro do E-02 (import do seam interno de outro módulo). Mitigação: consumidores externos usam `@/lib/db/schema` ou a Action Layer; rodar `lint` isolado conferindo exit code.
- **System ctx e isolamento multi-tenant:** webhook resolve clínica por `externalId`/instância — garantir que jamais opere sem clínica resolvida (LGPD/Pitfall 3).

---

## 13. Referências

| Documento | Papel |
|---|---|
| `2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (§5 Action Layer, §6 template, §9.1) |
| `2026-06-21-eixo2-sequenciamento-design.md` | Sequenciamento (§4 Onda 1: E-01 após E-02) |
| `2026-06-22-eixo2-operacional-modulo-design.md` | Padrão de consolidação ao template + lições da revisão (gates totais, sem bypass, adapters, lint isolado) |
| `docs/planning/epics.md` (Epic E-01) | RFs, critérios, KPIs do Atendimento Multicanal |
| `.planning/research/PITFALLS.md` | Pitfalls 3 (LGPD), 4 (WhatsApp/Evolution) — consultar ao escrever o plano |
