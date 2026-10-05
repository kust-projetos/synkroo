# Catálogo de Actions — vNext P0

**Data:** 2026-10-05 · **Base:** commit `bf82bb19`
**Escopo:** todas as 145 Actions definidas (`defineAction(`, fora de testes), das quais **144** registradas em `src/core/actions/bootstrap.ts` e **1** system-only. Classificação AUTO/CONFIRM/APPROVAL/DENY conforme spec vNext §7 — é **sugestão fundamentada**, ainda não enforcement (ver §6).

## 1. Mecanismo atual (fatos)

- **Registro:** `bootstrapActions()` (`src/core/actions/bootstrap.ts:24`) importa os 8 módulos, valida nome único (L59-64) e `replaceRegistry` (L86). Handler uniforme `(input, ctx) => Promise<O>` (`src/core/actions/types.ts:31-41`). **`ActionDefinition` não tem campo de risco/autonomia** — a classificação abaixo não existe no código.
- **Execução:** `runAction` (`src/core/actions/run.ts:10-63`): auth → `ctx.hasModule` → `ctx.can(requires)` → tenant-selector guard → Zod → handler. **Binário (allow/deny), sem noção de risco.**
- **Audit log:** `writeActionLog` (`src/core/actions/audit-writer.ts:17-27`) → `action_logs`; input redigido por allowlist `auditFields` — **declarado em só 9 de 145 Actions** (§5); falha de log é engolida.
- **IA:** allowlist literal de 8 nomes (`src/core/agent-bridge/tool-policy.ts:19-28`, deny-by-default) ∩ security-matrix de 4 níveis só para `source='system'` (`src/core/agent-bridge/security-matrix.ts`). Chat delegado (`agent_delegated`) passa só pelo RBAC do usuário.

### Critério de classificação (spec vNext §7)

| Classe | Critério | Exemplos |
|---|---|---|
| **AUTO** | leitura ou efeito anotativo reversível (nota/tag/score) | listar*, obter*, registrar observação |
| **CONFIRM** | efeito externo ao paciente ou mudança de compromisso/estado operacional; exige confirmação explícita | enviar mensagem, agendar, remarcar |
| **APPROVAL** | mutação financeira, destrutiva, de privilégio ou em massa; exige aprovador humano com a permission | registrar pagamento, merge, criar role, executar campanhas |
| **DENY** | fora do escopo do agente por desenho (LGPD, credenciais, consentimento legal) | exportar/anonimizar, QR, gateway, consentimento |

## 2. core (7)

| Action | Propósito | Arquivo | Gate atual | Classe |
|---|---|---|---|---|
| `core.assignUserAccess` | Conceder acesso de usuário à clínica | `src/modules/core/actions/assign-user-access.ts` | RBAC `core:manage_users` | **APPROVAL** |
| `core.removeUserAccess` | Remover acesso | `.../remove-user-access.ts` | idem | **APPROVAL** |
| `core.deactivateUser` | Desativar usuário | `.../deactivate-user.ts` | idem | **APPROVAL** |
| `core.createRole` | Criar perfil de acesso | `.../create-role.ts` | idem | **APPROVAL** |
| `core.listClinicUsers` | Listar usuários | `.../list-clinic-users.ts` | idem | AUTO |
| `core.listClinicRoles` | Listar perfis | `.../list-clinic-roles.ts` | idem | AUTO |
| `master.setModuleContract` | Contratar/desativar módulo (fornecedor)¹ | `.../set-module-contract.ts` (`master:manage_modules`) | idem | **DENY** |

¹ `module: 'core'` mas nome `master.*` — classificação por prefixo de nome erra aqui; registrar no Policy Engine pelo campo `module`.

## 3. operacional (38)

**Leitura (AUTO):** `consultarDisponibilidade`², `listarConsultas`, `listarPacientes`, `listarDentistas`, `obterDentista`, `listarProcedimentos`², `obterProcedimento`², `listarWaitlist`, `obterWaitlist`, `obterConsulta`, `obterModeloLembrete`, `listarConfigsLembrete`, `listarTratamentosIncompletos` — arquivos `src/modules/operacional/actions/<kebab>.ts`, RBAC `*:view` (obterConsulta: `manage_appointments`; modelos: `manage_reminders`).

**AUTO anotativo:** `registrarObservacaoPaciente`, `atualizarTagsPaciente` (RBAC `manage_patients`).

**CONFIRM:** `agendarConsulta`²³, `confirmarConsulta`², `entrarWaitlist`², `obterPaciente`² (leitura de dado pessoal com identidade verificada — `verificacao_forte`), `remarcarConsulta`³, `cancelarConsulta`³, `reativarConsulta`, `processarConfirmacaoResposta`, `gatilhoLembrete`, `criarPaciente`, `atualizarPaciente`², `cancelarWaitlist`, `atualizarWaitlist` (RBAC conforme domínio: `manage_appointments` / `manage_waitlist` / `manage_patients`).

**APPROVAL:** `atualizarConsulta` (PATCH amplo), `registrarNoShow`, `criarDentista`, `atualizarDentista`, `criarProcedimento`, `atualizarProcedimento`, `preencherWaitlist`, `salvarConfigLembrete` (RBAC `manage_appointments`/`manage_catalog`/`manage_waitlist`/`manage_reminders`).

**DENY:** `exportarDadosPaciente` (`lgpd:export`), `anonimizarPaciente` (`lgpd:anonymize`) — fora da allowlist IA por construção; evals negam (`src/core/ia-agent/__tests__/evals/eval-cases.ts:299-332`).

² na allowlist IA · ³ com `auditFields`

## 4. crm (16; 15 registradas)

**AUTO:** `listarContatos`, `obterContato`, `listarTimelineContato`, `listarNotasContato`, `adicionarNotaContato`³, `atualizarTagsContato`, `listarSugestoesDuplicidade`, `obterSugestaoDuplicidade`, `dispensarSugestaoDuplicidade`, `listarConsentimentos` (RBAC `crm:*` / `lgpd:view_consents`).

**APPROVAL:** `aprovarSugestaoDuplicidade` (`crm:review_duplicates`), `executarMergePatient` (`crm:merge_patients`), `executarMergeLead` (`crm:merge_leads`) — merge/aprovação precedem apagão de registro.

**DENY:** `concederConsentimento`, `revogarConsentimento` (`lgpd:manage_consents`) — declaração legal não pode ser feita pelo agente; `reprocessarSugestoesDuplicidade` — **não registrada**, system-only (`requires: 'system'`, sentinel sem permission real), invocada só por `src/app/api/cron/crm-duplicates/route.ts:58`.

## 5. comercial (28)

**AUTO:** `capturarLead`, `listarLeads`, `obterLead`, `listarLeadsQuentes`, `listarLeadsKanban`, `obterEstatisticasLeads`, `obterAnalyticsPipeline`, `listarPipeline`, `listarTasksComerciais`, `listarNotificacoes`, `registrarNotaLead`³, `atualizarTagsLead`, `reconhecerNotificacao`, `qualificarLead`, `criarTaskComercial`, `atualizarTaskComercial`, `fecharTaskComercial`, `reordenarEtapasPipeline`, `processarNotificacoesLeadsQuentes`.

**CONFIRM:** `atualizarLead`, `moverLeadEtapa`, `arquivarLead`, `agendarAvaliacao` (`comercial:edit_leads`/`manage_pipeline`).

**APPROVAL:** `converterLead`, `converterLeadSemAgendar` (cria paciente/agendamento), `criarEtapaPipeline`, `atualizarEtapaPipeline`, `removerEtapaPipeline` (`comercial:edit_leads`/`manage_pipeline`).

## 6. financeiro (24) — módulo inteiro fora da allowlist IA

**AUTO (leitura):** `listarOrcamentos`, `obterOrcamento`, `listarParcelas`, `listarPagamentos`, `obterCobranca`, `listarCobrancasAtrasadas`, `obterDashboard`, `listarGateways`, `listarRegrasRoteamento`.

**CONFIRM:** `rejeitarOrcamento`, `enviarOrcamento`, `enviarLembreteCobranca`.

**APPROVAL:** `criarOrcamento`, `atualizarOrcamento`³, `aceitarOrcamento`, `arquivarOrcamento`, `registrarPagamento`³⁴, `salvarParcelas`, `atualizarParcela`, `deletarParcela`, `gerarCobranca`, `cancelarCobranca`.

**DENY:** `salvarGateway`, `salvarRegraRoteamento` (`financeiro:manage_gateways`) — credencial/roteamento de dinheiro.

⁴ única Action com `idempotencyKey` próprio (`auditFields` inclui a chave).

## 7. atendimento (21) — módulo inteiro fora da allowlist IA

**AUTO (leitura/infra):** `listarConversas`, `obterConversa`, `historicoMensagens`, `statusEvolution`, `obterModeloMensagem`, `iniciarConversa`, `arquivarConversa`, `escalarConversa`, `classificarIntencao`, `extrairEntidades`, ingestão webhooks (`receberMensagem`, `receberWidgetMensagem`, `processarWebhookWhatsApp`, `processarWebhookInstagram`, `verificarWebhook`, `verificarWebhookInstagram`).

**CONFIRM (envio externo):** `enviarMensagem`, `enviarMensagemDireta`, `responderInstagram`, `agendarMensagem` (`atendimento:manage_messages`).

**DENY:** `obterQRCode` — expõe credencial de pareamento de sessão.

## 8. followup (11)

**AUTO:** `listarPendentes`, `listarInativos`, `listarSegmentos`, `listarOrcamentosPendentes`, `listarTratamentosIncompletos`, `detectarInativos`, `registrarFollowup`.

**CONFIRM:** `reativarPaciente`, `executarFollowup`, `executarFollowupOrcamentos` (`followup:manage_followups`).

**APPROVAL:** `executarCampanhas` (`followup:manage_campaigns`) — disparo em massa.

## 9. ia (0)

`src/modules/ia/index.ts:6` — `iaActions = []`; capacidades do agente são as Actions dos outros módulos via tool-catalog.

## 10. Cobertura IA atual (fato, não sugestão)

Allowlist IA = 8/144 (5,6%), 100% `operacional`: `consultarDisponibilidade`, `listarProcedimentos`, `obterProcedimento` (matrix `livre`), `agendarConsulta`, `confirmarConsulta`, `entrarWaitlist` (`confirmacao`), `obterPaciente`, `atualizarPaciente` (`verificacao_forte`). Default da matrix = `proibido` → `escalate_human` (`security-matrix.ts:27,60`). **Não existe nível APPROVAL** — ou executa ou escala.

## 11. Gaps para o Policy Engine (P5) — entrada direta do ADR-BASE-18

1. `ActionDefinition` sem metadata de risco/autonomia (`types.ts:31-41`).
2. Classificação fragmentada em 2 taxonomias desalinhadas (`tool-policy` × `security-matrix`).
3. 4 níveis atuais ≠ 4 classes da spec (sem APPROVAL com aprovador + permission).
4. Matrix não cobre 136/144 Actions; sem equivalente para usuário/cron (só RBAC binário).
5. Chat `agent_delegated` não passa por matrix nenhuma (`bridge-service.ts:102` condiciona a `source==='system'`).
6. Sem approval token server-side com payload imutável + TTL (`pending_actions` DO tem token mas sem TTL/hash; `orchestrator-logic.ts:211-227`).
7. `action_logs` não registra decisão/level/policyVersion/hash (`schema/audit.ts:4-16`).
8. Sem kill switch, rollout stage ou limite de gasto.
9. Sem validação de pós-condição/outcome em `runAction`.
10. `auditFields` ausente em 136/145 → `inputRedacted` = `{}` na maioria dos logs.
11. Idempotência só na bridge IA (exceto `registrarPagamento`); `runAction` é re-executável.
12. Rate limiting é por rota, não acompanha o catálogo.

**Actions com `auditFields` (9):** `comercial.registrarNotaLead`, `crm.adicionarNotaContato`, `operacional.cancelarConsulta`, `operacional.atualizarConsulta`, `operacional.agendarConsulta`, `operacional.remarcarConsulta`, `financeiro.atualizarOrcamento`, `financeiro.registrarPagamento`, `operacional.registrarObservacaoPaciente`.

## 12. Estruturas legadas que colidem com o Control Plane

Definições em `src/modules/ia/schema/agent.ts` (re-export deprecated em `src/lib/db/schema/agent.ts`); migração `0000_jazzy_strong_guy.sql:565-640`.

| Tabela | Sobreposição com Control Plane | Estado |
|---|---|---|
| `pending_actions` | ≈ Approval + ActionAttempt + Outcome (`riskLevel/riskScore`, `undoPayload/undoDeadline`, `confirmationCount`) | sem writer de runtime; só LGPD (`lgpd-ia.ts`) |
| `decision_logs` | ≈ PolicyDecision + parte de AgentRun (`reasoning`, `humanOverride`, `tokensUsed`, `llmModel`) | sem writer de runtime |
| `smart_trigger_log` | ≈ BusinessEvent + Outcome parcial (`patientResponded/responseAt`) | endpoint `/api/cron/smart-triggers` **retired (410)** |
| `agent_queue` | ≈ fila de ActionAttempt/Exception (`retryCount`, `error`, `processAfter`) | **sem `clinicId`/FK**; SQL cru em `lgpd-service.ts:286-290` |
| `agent_dlq` | ≈ Exception (`manualActionRequired`) | idem, `lgpd-service.ts:291-295` |
| `agent_logs` | ≈ AgentRun mínimo; **subconjunto duplicado de `decision_logs`** | único com reader de produção (`attendance-metrics.service.ts:94-130`) |
| `action_logs` | ≈ ActionAttempt (o mais próximo; único com `actionName` canônico) | escrito por todo `runAction`; sem durationMs/decision/approvalId |

Migração (P4) deve reabsorver conscientemente essas estruturas — preservar reader de `agent_logs` e o varredor LGPD de `agent_queue`/`agent_dlq` (`lgpd-service.ts:286-295`) antes de qualquer drop.
