# P0 — Inventário de Actions (Synkroo vNext)

**Data:** 2026-10-05 · **Issue:** #23 · **Método:** leitura direta dos arrays de registro dos módulos (não grep solto). Read-only.
**Totais:** 145 definições; **144 registradas** no registry (`1` definida e não registrada: `crm.reprocessarSugestoesDuplicidade`, `requires: 'system'`, cron-only — `src/modules/crm/__tests__/action-taxonomy.test.ts:32`). **8 acessíveis ao agente** hoje.

## 1. Fluxo de política hoje

```text
runTurn (src/core/ia-agent/orchestrator-logic.ts:97, TURN_BUDGET_MS=20s)
  0. recusa de safety clínica → escalate (orchestrator-logic.ts:11,175)
  1. listTools → bridge (orchestrator-logic.ts:318)
  2. listToolsLogic: verifyHandle → getActions().filter(isAgentSafeAction && hasModule && can) (bridge-service.ts:38-57)
  3. executeActionLogic: verifyHandle → dedup(conversationId:idempotencyKey) → alias→action.name
     → [PRIMÁRIO] isAgentSafeAction, senão 'unknown_tool' — ANTES de consumir idem key e ANTES de runAction (bridge-service.ts:94)
     → markSeen(idempotencyKey) (bridge-service.ts:103)
     → [SECUNDÁRIO, source='system' apenas] assertSystemAllowed via security-matrix (bridge-service.ts:108)
     → runAction: hasModule → can(requires) → rejeita clinicId/clinic_id no input → zod safeParse → handler (run.ts:36-55)
  4. needs_confirmation|needs_identity → DO storage 'pendingAction' (workers/ia-agent/index.ts:147)
  5. turno seguinte: confirmedToken → peek/consumePendingAction (at-most-once) → re-executa com {confirmed:true, identityVerified} (orchestrator-logic.ts:250-314)
```

**Não existe matriz R0–R3.** A escala real é `SecurityLevel = 'livre' | 'confirmacao' | 'verificacao_forte' | 'proibido'` (`src/core/agent-bridge/types.ts:1`), deny-by-default em `classifyActionLevel` (`security-matrix.ts:23`). **Não existe tier de APPROVAL nem sign-off humano persistido.**

Confirmação viva: DO storage `pendingAction` `{alias, args, token, principalId}` — single-slot por conversa, at-most-once, purgada por alarm de retenção. Confirmação morta: `pending_actions` + `decision_logs` (schema rico: `riskScore`, `undoPayload`, `undoDeadline`…) — **nenhum writer em runtime** (única importação: `lgpd-ia.ts:2`; único insert: seed `scripts/seed-local-scale-data.ts:1322,1340`).

## 2. Allowlist atual do agente (verbatim)

`src/core/agent-bridge/tool-policy.ts:19-28` — `AGENT_SAFE_ACTIONS` (tamanho 8, assegurado em `tool-policy.test.ts:47`):

```text
operacional.consultarDisponibilidade
operacional.listarProcedimentos
operacional.obterProcedimento
operacional.agendarConsulta
operacional.confirmarConsulta
operacional.entrarWaitlist
operacional.obterPaciente
operacional.atualizarPaciente
```

Docblock: lista literal e auditável; CRM, Financeiro, merges e ações destrutivas ficam fora **por construção**.

## 3. Actions priorizadas (agente-facing + dinheiro/LGPD/merge/bulk/identidade)

Schema = Zod inline (`z.object`); sem classes nomeadas. Idempotências reais: bridge `${conversationId}:${idempotencyKey}` (`bridge-service.ts:80`); fingerprint outbound `channel|to|text` TTL 10min (`enviar-mensagem.ts:21,73`); dinheiro via idempotencyKey + fingerprint mig.0032-0033 (`registrar-pagamento.ts:21,35`); agendamento chave opcional (`agendar-consulta.ts:20`).

| Action | Módulo | Side effect | Idempotência | Reversível | Agente hoje? | Classe proposta |
|---|---|---|---|---|---|---|
| `consultarDisponibilidade` | operacional | read | n/a | n/a | ✅ livre | **AUTO** |
| `listarProcedimentos` | operacional | read | n/a | n/a | ✅ livre | **AUTO** |
| `obterProcedimento` | operacional | read | n/a | n/a | ✅ livre | **AUTO** |
| `obterPaciente` | operacional | read (PII) | n/a | n/a | ✅ verificacao_forte | **AUTO** (com `operacional:view`; PII já exige identidade no path system) |
| `agendarConsulta` | operacional | write agenda | chave opcional | parcial (cancelar) | ✅ confirmacao | **CONFIRM** |
| `confirmarConsulta` | operacional | write status | natural key | não (sem un-confirm) | ✅ confirmacao | **CONFIRM** |
| `atualizarPaciente` | operacional | write PII (sem auditFields) | nenhuma | não | ✅ verificacao_forte | **CONFIRM** |
| `entrarWaitlist` | operacional | write | natural key sem upsert | sim | ✅ confirmacao | **CONFIRM** |
| `registrarPagamento` | financeiro | **write monetário** | idempotencyKey + fingerprint | não | ❌ | **DENY** |
| `gerarCobranca` | financeiro | write + external-send gateway | nenhuma | sim | ❌ | **DENY** |
| `cancelarCobranca` | financeiro | write monetário | nenhuma | não | ❌ | **DENY** |
| `criar/atualizar/aceitar/rejeitar/arquivarOrcamento` | financeiro | write monetário | nenhuma | não | ❌ | **DENY** |
| `salvarParcelas` / `atualizarParcela` | financeiro | write monetário bulk | nenhuma | não | ❌ | **DENY** |
| `deletarParcela` | financeiro | **DELETE físico** (comentário promete tombstone — `deletar-parcela.ts:26-28`) | natural key | **irreversível** | ❌ | **DENY** |
| `enviarOrcamento` / `enviarLembreteCobranca` | financeiro | external-send | natural key / nenhuma | não | ❌ | **DENY** |
| `salvarGateway` / `salvarRegraRoteamento` | financeiro | **write credenciais/config de pagamento** | natural key | não | ❌ | **DENY** |
| reads financeiro (orçamentos, parcelas, pagamentos, cobranças, dashboard) | financeiro | read (PII + valores) | n/a | n/a | ❌ | **DENY** (fora do escopo do agente por desenho) |
| `exportarDadosPaciente` | operacional | read massivo PII cross-módulo (lgpd:export) | natural key | n/a | ❌ | **DENY** |
| `anonimizarPaciente` | operacional | **destrutivo irreversível** em 6 módulos | natural key | **não** | ❌ | **DENY** |
| `conceder/revogar/listarConsentimentos` | crm | write/read base legal | natural key | sim | ❌ | **DENY** |
| `executarMergePatient` / `executarMergeLead` | crm | **merge destrutivo cross-owner** | natural key | **não** | ❌ | **DENY** |
| `aprovar/dispensarSugestaoDuplicidade` | crm | write (pré-merge) | natural key | parcial | ❌ | **DENY** |
| `reprocessarSugestoesDuplicidade` | crm | write bulk (`system`) | n/a | não | ❌ (nem registrado) | **DENY** (system-only) |
| `enviarMensagem` | atendimento | **external-send Evolution** + timeline | dupla (chave ou fingerprint TTL) | não | ❌ | **DENY** (send externo) |
| `enviarMensagemDireta` | atendimento | **external-send sem tenant-scoping no input e sem idempotência** (`enviar-mensagem-direta.ts:13-27`) | nenhuma | não | ❌ | **DENY** |
| `responderInstagram` / `agendarMensagem` | atendimento | external-send / write | nenhuma / natural key | não / sim | ❌ | **DENY** |
| `receberMensagem` / `processarWebhookWhatsApp` / `processarWebhookInstagram` / `receberWidgetMensagem` | atendimento | write ingress (trust boundary) | natural key externalId | n/a | ❌ | **DENY** |
| `executarCampanhas` | followup | **BULK external-send — input `z.object({})`, sem dry-run/limite/escopo** (`executar-campanhas.ts:11`) | nenhuma | não | ❌ | **DENY** |
| `executarFollowup` / `executarFollowupOrcamentos` / `registrarFollowup` / `reativarPaciente` | followup | write + external-send | natural key | parcial | ❌ | **DENY** |
| `capturarLead` / `converterLead(SemAgendar)` / `atualizarLead` / `agendarAvaliacao` / `qualificarLead` / `arquivarLead` | comercial | write (+ agenda cross-módulo) | parcial | parcial | ❌ | **DENY** (fora do escopo; expansão só via P5/P6) |
| `criar/atualizar/remover/reordenarEtapaPipeline` / `moverLeadEtapa` | comercial | write bulk funil | nenhuma | não | ❌ | **DENY** |
| `processarNotificacoesLeadsQuentes` | comercial | write bulk + notifica | nenhuma | não | ❌ | **DENY** |
| `assignUserAccess` / `removeUserAccess` / `deactivateUser` / `createRole` | core | **escalada de privilégio / identidade** | natural key | parcial | ❌ | **DENY** |
| `master.setModuleContract` | core (nome≠módulo) | **contrata/desativa módulo** — handler ignora `ctx` (`set-module-contract.ts:11`) | natural key | sim (toggle) | ❌ | **DENY** |
| `cancelarConsulta` | operacional | write destrutivo — explicitamente fora do allowlist (`tool-policy.test.ts:91`) | natural key | não | ❌ | **DENY** |
| `remarcarConsulta` / `registrarNoShow` / `reativarConsulta` / `atualizarConsulta` / `processarConfirmacaoResposta` | operacional | write | natural key | parcial | ❌ | **DENY** (CONFIRM/APPROVAL no P5, por política — não antes) |
| `gatilhoLembrete` | operacional | external-send | natural key | não | ❌ | **DENY** |
| `criarPaciente` / `criar/atualizarDentista` / `criar/atualizarProcedimento` / `atualizarTagsPaciente` / `registrarObservacaoPaciente` | operacional | write | natural key | parcial | ❌ | **DENY** (P5 pode promover leituras/tags/observações a AUTO com audit) |
| `cancelar/atualizar/preencherWaitlist` | operacional | write | natural key | sim | ❌ | **DENY** (P5) |
| `salvarConfigLembrete` | operacional | write config (upsert natural key) | natural key | sim | ❌ | **DENY** |
| reads operacional (consultas, pacientes, dentistas, waitlist, configs) | operacional | read | n/a | n/a | ❌ | **DENY** (P5 pode promover a AUTO) |

## 4. Restante (76 actions — todas ❌ agente, todas DENY hoje)

- **atendimento (14):** `iniciarConversa`, `listar/obter/arquivar/escalarConversa`, `classificarIntencao` (LLM), `extrairEntidades` (LLM), `historicoMensagens`, `obterModeloMensagem`, `verificarWebhook`, `verificarWebhookInstagram`, `statusEvolution` (external-send/status), `obterQRCode`.
- **comercial (16):** reads (`obterEstatisticasLeads`, `listarLeads`, `listarLeadsQuentes`, `listarLeadsKanban`, `obterLead`, `listarPipeline`, `listarNotificacoes`, `reconhecerNotificacao`, `listarTasksComerciais`); writes (`atualizarTagsLead`, `registrarNotaLead`, `criar/atualizar/fecharTaskComercial`).
- **crm (8):** reads (`listarContatos`, `obterContato`, `listarTimelineContato`, `listarNotasContato`, `listarSugestoesDuplicidade`, `obterSugestaoDuplicidade`); writes (`adicionarNotaContato`, `atualizarTagsContato`).
- **core (2 reads):** `listClinicUsers`, `listClinicRoles`.
- **followup (6 reads):** `listarPendentes`, `listarInativos`, `listarSegmentos`, `listarOrcamentosPendentes`, `listarTratamentosIncompletos`, `detectarInativos` (scan).

Candidatas naturais a **AUTO** no P5 (com audit e rate/cost limits): reads operacionais, `atualizarTagsPaciente`, `registrarObservacaoPaciente`, `adicionarNotaContato`, `atualizarTagsContato`, `registrarNotaLead`, `atualizarTagsLead`, tasks comerciais, lembretes elegíveis. **Nada é promovido nesta tranche.**

## 5. Riscos registrados

1. **`agentToolsFor` (`src/core/actions/agent.ts:25`) e `buildToolCatalog` (`tool-catalog.ts:60`) são bypasses latentes do allowlist** — filtram só por `hasModule`+`can`, sem `isAgentSafeAction`; exportados via `src/core/actions/index.ts:3`. Sem consumidor em produção hoje; qualquer novo import expõe as 144 actions.
2. `followup.executarCampanhas` aceita `z.object({})` — bulk-send sem escopo/dry-run/limite.
3. `atendimento.enviarMensagemDireta` não é tenant-scoped no input e não tem idempotência.
4. `financeiro.deletarParcela` faz DELETE físico apesar do comentário prometer tombstone.
5. Schema de risco/undo/approval morto (`pending_actions`) — ligar sem o gate primário criaria falso senso de controle.
6. `master.setModuleContract` ignora `ctx` no handler — sem rastro de ator.
7. Single-slot `pendingAction` por conversa: confirmações concorrentes se sobrescrevem (fail-closed, mas a revisar em P4).

## 6. Diretriz

**Congelar a autonomia atual** (8 actions, allowlist literal). Antes de qualquer expansão: (a) fechar os bypasses `agentToolsFor`/`buildToolCatalog` exigindo `isAgentSafeAction`; (b) formalizar AUTO/CONFIRM/APPROVAL/DENY como substituta tipada de `SecurityLevel`, mantendo deny-by-default e o gate primário em `bridge-service.ts:94`; (c) tratar `pending_actions`/`decision_logs` como não-existentes até haver writer+reader+gate (ver ADR-VNEXT-01); (d) tickets separados para escopar `executarCampanhas`, tenant-scopar+idempotar `enviarMensagemDireta` e tornar `deletarParcela` tombstone.
