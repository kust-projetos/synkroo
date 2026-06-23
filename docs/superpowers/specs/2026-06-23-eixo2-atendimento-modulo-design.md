# Eixo 2 — Módulo Atendimento (E-01, Onda 1) — Design

> **Tipo:** Spec de módulo (design). Segundo módulo da Onda 1 (após E-02).
> **Data:** 2026-06-23
> **Status:** Aprovado em substância (brainstorming). Pendente revisão do spec escrito antes do plano de implementação.
> **Escopo:** apenas planejamento/documentação. Implementação por outro agente, guiado pelo plano derivado deste.
> **Dependências:** Core (Onda 0) e Operacional (E-02) fechados — template canônico, Action Layer, RBAC, manifesto, gates, route-adapter, constraint anti-overbooking. As Actions do E-02 (`agendar/remarcar/confirmar`) já existem e são consumíveis.

## 0. Contexto e objetivo

O **Atendimento (E-01)** é o trilho conversacional **WhatsApp-first** da Onda 1: recebe a mensagem do paciente, materializa a conversa e a roteia. É o **par** do E-02 (que produz as Actions de agenda) e o **substrato do Agente IA** (passo 4 da Onda 1), que orquestra E-01/E-02/E-03 via Action Layer.

**Situação de entrada (verificada em 2026-06-23):** diferentemente do E-02, o `src/modules/atendimento` **já existe e está ~70% construído** — ~22 Actions reais, rotas principais já como adapters gated (`whatsapp/send`, `messages/send`, `messages/inbound`, `conversations`), schema próprio (`conversations/messages/...`), `manifest`, `permissions`, `route-adapter` e registro no `bootstrapActions`. Portanto este spec **não desenha o módulo do zero** — ele **consolida ao template canônico**: migra o backend legado para dentro do módulo, gateia os webhooks, cobre com testes e retira o legado.

**Fonte de verdade superior:** roadmap-mestre (`2026-06-17-...-roadmap-design.md`) §5 (Action Layer), §6 (template), §9.1 (modularidade). Sequenciamento: `2026-06-21-eixo2-sequenciamento-design.md` (§4, Onda 1). Referência de padrão: `2026-06-21-eixo2-core-modulo-design.md` e `2026-06-22-eixo2-operacional-modulo-design.md` (incl. lições da revisão: gates totais, sem bypass, adapters preservando contrato).

---

## 1. Princípio organizador — fases ordenadas (backend-first)

Um único spec/plano, fases P1–P5, **backend-first** (mesma lógica de "fundação primeiro" do E-02): portar o backend compartilhado **uma vez, limpo**, e empilhar o resto. **Não há fase de schema** — o módulo já é dono de `conversations/messages/conversationStates/conversationSessions/conversationMemories`.

| Fase | Conteúdo | Razão da posição |
|---|---|---|
| **P1 Repository** | Portar `repositories/conversations` (446 LOC) → `conversations-repository` do módulo; migrar todas as actions para fora de `@/repositories/conversations` | Backend de dados compartilhado por quase todas as actions |
| **P2 Channel services** | Portar `services/whatsapp/*` (Evolution 632 + whatsapp 339 + templates 221 + index 290) → `services/` do módulo; migrar actions para fora de `@/services/whatsapp` | Integração de canal compartilhada (envio/QR/status/templates) |
| **P3 Webhooks + gates** | `withModuleRoute` nos 3 webhooks ungated, preservando verificação de assinatura; garantir todas as rotas do bounded context gated | Precisa das actions/services já migrados |
| **P4 Testes** | À paridade do E-02: inbound→conversa→envio, processamento de webhook, resolução de canal, escala | Sobre o backend e rotas já consolidados |
| **P5 Retirada do legado** | Remover `services/whatsapp/*` e `repositories/conversations` órfãos; lint/typecheck/gates verdes | Só quando nada mais os referencia |

---

## 2. Estado atual (reconhecimento — verificado em 2026-06-23)

| Item | Estado | Evidência |
|---|---|---|
| Schema do domínio | ✅ já é do módulo | `modules/atendimento/schema/conversations.ts` define `conversations`, `messages`, `conversationStates`, `conversationSessions`, `conversationMemories` |
| Actions (~22) | ⚠️ reais, mas 9+ importam **legado** direto | `enviar-mensagem.ts:6`, `receber-mensagem.ts:5`, `agendar-mensagem.ts:6`, `responder-instagram.ts:11`, `obter-modelo-mensagem.ts:4-5`, `obter-qrcode.ts:4`, `status-evolution.ts:4`, `processar-webhook-*` (dynamic import de `@/repositories/conversations`) |
| Rotas send/inbound/conversations | ✅ adapters gated | `whatsapp/send`, `messages/send`, `messages/inbound`, `conversations` usam `runAtendimento(System)Action` + `withModuleRoute` |
| Webhooks | ⚠️ assinatura OK, **sem `withModuleRoute`** | `whatsapp/webhook` (hub.verify_token + `x-hub-signature-256`), `instagram/webhook` (HMAC `APP_SECRET`), `whatsapp/evolution` |
| Backend Evolution/conversations | ⚠️ legado (~1971 LOC), só consumido pelo atendimento | `services/whatsapp/*`, `repositories/conversations/index.ts` |
| `repositories/conversations` consumidor externo | ⚠️ 1 (E-08) | `app/api/dashboard/stats/route.ts` |
| Testes do módulo | ⚠️ **1** arquivo | `modules/atendimento/__tests__/conversations/integration.test.ts` |

> **Descoberta-chave:** o módulo é hoje uma **casca** sobre o backend legado — as actions delegam parcialmente, mas o backend real (Evolution + conversations) ainda mora fora do módulo. A consolidação é trazer esse backend para dentro e retirar o legado, sem quebrar os contratos HTTP/webhook já funcionando.

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

- `withModuleRoute('atendimento', moduleManifest)` nos 3 webhooks ungated: `whatsapp/webhook`, `instagram/webhook`, `whatsapp/evolution`. Retorna **404** quando o módulo não está contratado.
- **Ordem:** gate de módulo **antes** do processamento; a **verificação de assinatura é preservada intacta** — Meta HMAC `x-hub-signature-256` (whatsapp/instagram), `WEBHOOK_SECRET` + `timingSafeEqual` (messages/inbound). Nunca afrouxar.
- **Handshake GET** (`hub.verify_token` → `hub.challenge`) continua funcionando quando o módulo está ativo; com módulo desativado, 404 é o comportamento correto (sem canal, sem webhook).
- **Política de resposta:** webhooks retornam **200 mesmo em no-op** (assinatura válida porém evento ignorável/duplicado) para evitar retry-storm do Meta; assinatura **inválida** retorna 403; payload malformado loga e retorna 200. Erros internos não vazam dados.
- Garantir cobertura: toda rota do bounded context (`whatsapp/*`, `messages/*`, `conversations/*`, `instagram/*`) gated por `withModuleRoute`.

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

- **Integração (Postgres real):**
  - Inbound WhatsApp: `receber-mensagem`/`processar-webhook-whatsapp` cria/atualiza conversa, faz append da mensagem e vincula paciente por telefone.
  - Webhook: assinatura válida processa; **inválida → 403**; handshake GET retorna challenge.
  - Envio por canal: `enviar-mensagem` resolve canal pela conversa e delega ao service (Evolution mockado na borda externa).
  - Escala: `escalar-conversa` muda estado e respeita `atendimento:escalate`.
  - Escopo por clínica em todas as reads; system ctx por `externalId`.
- **Unit:** resolução de canal; tradução de erros; NLU (`classificar-intencao`/`extrair-entidades`) com LLM mockado; registro das actions no registry (guard).
- **Gates de build:** `typecheck` 0; `lint` 0 (boundaries `error`); `db:generate` "No schema changes"; `npm run lint` rodado **isolado** (conferir exit code do próprio lint — lição da revisão do E-02).

---

## 10. Definition of Done

- [ ] **P1** `conversations-repository` do módulo recebe as queries portadas; **nenhuma action** importa `@/repositories/conversations` (estático ou dinâmico); sem `getDb()` em actions.
- [ ] **P2** `evolution/channel/templates` services no módulo; **nenhuma action** importa `@/services/whatsapp`; env Evolution via `@/lib/env`, sem hardcode.
- [ ] **P3** `withModuleRoute` nos 3 webhooks + verificação de assinatura preservada; handshake GET funciona; toda rota do bounded context gated; política 200-no-op aplicada.
- [ ] **P4** testes à paridade (inbound→conversa→envio, webhook válido/inválido, canal, escala); guard de registry; LLM/Evolution mockados na borda.
- [ ] **P5** `services/whatsapp/*` e `repositories/conversations` removidos (órfãos); `dashboard/stats` reapontado ao agregador central; nenhum import legado restante.
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
- **Webhook gating quebrar handshake do Meta:** `withModuleRoute` retornando 404 no GET de verificação se o módulo estiver off é correto, mas com módulo **on** o challenge deve passar — testar o GET explicitamente.
- **Retirada do legado (P5):** consumidor esquecido (ex.: teste, `dashboard/stats`). Mitigação: `tsc` + `rg` antes de deletar; remover testes órfãos junto.
- **Boundary lint cross-module:** repetir o erro do E-02 (import do seam interno de outro módulo). Mitigação: consumidores externos usam `@/lib/db/schema`; rodar `lint` isolado conferindo exit code.
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
