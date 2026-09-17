# Inventário de Dados Pessoais (LGPD) — Synkroo

> Documento operacional em pt-BR. Escopo: mapear **quais dados pessoais
> existem, onde moram, para que servem, quem acessa e como são
> exportados/anonimizados**. Nenhum prazo de retenção é afirmado aqui:
> toda retenção está marcada como **A DEFINIR (jurídico)** até decisão do
> responsável humano (ver § Pendências).

## 1. Rotas LGPD existentes (mapa rápido)

| Rota | Action (service layer) | Permissão RBAC | Comportamento |
|---|---|---|---|
| `POST /api/lgpd/export` | `operacional.exportarDadosPaciente` (`src/modules/operacional/actions/exportar-dados-paciente.ts` → `exportPatientData` em `src/modules/operacional/services/lgpd-service.ts:227`) | `lgpd:export` | Exporta o grafo do paciente (titular) |
| `POST /api/lgpd/anonymize` | `operacional.anonimizarPaciente` (`src/modules/operacional/actions/anonimizar-paciente.ts` → `anonymizePatient` em `src/modules/operacional/services/lgpd-service.ts:306`) | `lgpd:anonymize` | Anonimiza em transação; sob `legalHold` falha com `conflict` → HTTP **423** (`src/services/api-handlers/lgpd/anonymize.ts`) |

Apoio: consentimento versionado antes de dispatch não transacional
(`assertConsentVersion` em `src/services/followup/consent-guard.ts` —
falha em `consent missing` / `opted-out` / `stale`); purge da base RAG
por clínica em `purgeKnowledge` (`src/services/rag/rag.service.ts:399`);
contribuições de anonimização de outros módulos via `getLGPDContributions()`
+ redação de `outboxJobs` e filas do agente (`redactOutbox` /
`redactAgentQueues` em `lgpd-service.ts`).

## 2. Inventário por categoria

Colunas: **dado | origem | finalidade | storage | retenção atual | quem acessa**.

| Dado | Origem | Finalidade | Storage (tabela / schema path) | Retenção atual | Quem acessa |
|---|---|---|---|---|---|
| Paciente: nome, telefone, e-mail, CPF, data de nascimento, gênero, endereço, observações | Cadastro (recepção, bot, importação) | Identificação, contato, agendamento, cobrança | `patients` — `src/modules/operacional/schema/patients.ts` | A DEFINIR (jurídico) | Equipe da clínica via RBAC (`operacional:*`); exportação só com `lgpd:export`; anonimização só com `lgpd:anonymize` |
| Dados clínicos do paciente: observações, preferências, risk scores, feedback | Atendimento / triagem / IA | Continuidade do cuidado, personalização | `patient_observations`, `patient_preferences`, `patient_risk_scores`, `patient_feedback` — `src/modules/operacional/schema/clinical.ts` | A DEFINIR (jurídico) | Equipe clínica; anonimizados junto com o paciente (conteúdo zerado) |
| Contatos / leads: nome, telefone, e-mail, origem, atividades | Formulários, WhatsApp, Instagram, importação | Prospecção, CRM, campanhas | `leads`, `lead_activities` — `src/modules/comercial/schema/leads.ts`; `clinic_tags`, `custom_field_definitions/values`, `consents` — `src/modules/crm/schema/contacts.ts` | A DEFINIR (jurídico) | Time comercial; campanhas exigem consentimento vigente (`consent-guard.ts`) |
| Mensagens WhatsApp/Instagram: conteúdo texto, `media_url` (áudio/imagem/documento), direção, tipo | Evolution API / webhooks inbound, envio pela plataforma | Atendimento, histórico, auditoria | `conversations`, `messages` (col. `media_url`, `message_type`), `conversation_memories/sessions/states` — `src/modules/atendimento/schema/conversations.ts`; instalações/canais em `src/modules/atendimento/schema/integrations.ts` (`channel_installations`, `whatsapp_instances`) | A DEFINIR (jurídico) | Equipe da clínica (tenant isolado por `clinicId`); **mídias**: só a URL/referência é persistida no banco — o ciclo de vida do binário no provedor (Evolution) precisa de decisão jurídica (ver Pendências) |
| Agendamentos: paciente, dentista, data, status, motivos (cancelamento/remarcação), notas | Agenda (recepção, bot IA, waitlist) | Operação da clínica, lembretes, no-show | `appointments`, `schedule_blocks`, `appointment_reminders`, `waitlist` — `src/modules/operacional/schema/appointments.ts`; `treatment_plans(+items)`, `appointment_status_log` — `src/modules/operacional/schema/treatments.ts` | A DEFINIR (jurídico) | Equipe operacional; IA só via tools allowlistadas (ver §3); notas/motivos nulificados na anonimização; lembretes `pending` excluídos |
| Orçamentos/pagamentos/cobranças: valores, parcelas, charges, tentativas de cobrança, eventos de gateway (payloads) | Checkout, conciliação, webhooks de gateway | Faturamento, cobrança, conciliação | `budgets(+items/installments)`, `payments`, `payment_charges`, `payment_gateways`, `gateway_routing_rules`, `gateway_events`, `collection_attempts` — `src/modules/financeiro/schema/financeiro.ts` | A DEFINIR (jurídico) | Financeiro da clínica; **nunca expostos à IA** (fora da allowlist por construção); eventos de gateway podem conter dados do pagador — redigir antes de logar (ver Pendências) |
| Usuários/memberships: nome, e-mail, credenciais (hash), acessos por clínica, papéis | Signup, convite, admin | Autenticação, autorização, trilha de ator | `users`, `user_credentials`, `clinics` — `src/lib/db/schema/core.ts`; `roles`, `permissions`, `user_clinic_access` (+overrides) — `src/modules/core/schema/rbac.ts` | A DEFINIR (jurídico) | Próprio usuário + admins; `actorUserId` registrado como ator da anonimização |
| Auditoria: `action_logs` (com `input_redacted`), `audit_logs`, `outbox_jobs`, `idempotency_keys` | Execução de actions / jobs | Trilha LGPD (quem acessou/alterou o quê), idempotência | `action_logs` — `src/lib/db/schema/audit.ts`; `audit_logs`, `outbox_jobs`, `idempotency_keys` — `src/core/schema/infra` | A DEFINIR (jurídico) | Admins/auditoria; `input_redacted` (não o input cru) é o persistido; jobs do outbox ligados ao paciente são cancelados/redigidos na anonimização |
| Telemetria IA: `correlationId`, `clinicId`, códigos de allowlist sintática, contadores de tokens | Orquestrador IA, workers | Observabilidade, SLO, debug | **Sem PII por construção** — `src/core/ia-agent/telemetry.ts` (`normalizeCode`, `CODE_DESCRIPTIONS` estáticas; nunca texto de exceção/payload); filas `agent_queue`/`agent_dlq`/`agent_logs` — `src/modules/ia/schema/agent.ts` (payloads redigidos na anonimização) | A DEFINIR (jurídico) | Engenharia/suporte (só códigos + ids opacos) |
| Base RAG: chunks de conhecimento por clínica (`knowledge_base`) | Upload/ingestão da clínica | Grounding do agente (responder com dado da clínica) | `knowledge_base` — `src/modules/ia/schema/knowledge.ts`; purge por clínica em `rag.service.ts:399` | A DEFINIR (jurídico) | Agente IA (tenant-scoped por `clinicId`); purge executável por clínica/categoria |
| Logs de aplicação | Runtime (API, workers) | Debug, segurança | **Redação na borda**: `redactLogValue` + `SENSITIVE_LOG_KEYS` em `src/lib/logger.ts` (cpf, cnpj, rg, telefone/phone/celular, whatsapp, email, endereco, carteirinha, insurance, + segredos) | A DEFINIR (jurídico) | Engenharia; chaves genéricas (`name`, `patient`, `status`) deliberadamente NÃO redigidas para preservar contexto operacional |

## 3. IA e confirmação (gate existente — só documentação, sem mudança de código)

O fluxo de confirmação **funciona** e está coberto por testes
(`confirmation-binding`, `orchestrator-logic`, + evals offline em
`src/core/ia-agent/__tests__/evals/`):

- O chat (`src/app/api/ia/chat/route.ts:18-40`, `asOptionalToken`) transporta
  tokens de confirmação opacos e server-issued (`randomUUID` por pendingAction);
  `clinicId` vem da sessão autenticada (RBAC `ia:chat`), nunca do body.
- O DO (`src/workers/ia-agent/index.ts:106-121`) injeta a pendingAction do
  próprio storage; o orquestrador valida token (timing-safe, `safeTokenEquals`)
  + `principalId` e consome com reserva atômica condicional
  (`peek` → valida → `consume`, `src/core/ia-agent/orchestrator-logic.ts:212-247`);
  falha pós-reserva **não** re-arma (at-most-once).
- Matriz de decisão (`src/core/agent-bridge/security-matrix.ts`):
  livre executa; confirmação exige `confirmed`; dado pessoal
  (`obterPaciente`, `atualizarPaciente`) exige `identityVerified`; o resto é
  `proibido` → escala humano. Allowlist (`src/core/agent-bridge/tool-policy.ts`)
  é deny-by-default (8 actions operacionais; financeiro/CRM/LGPD fora).
- Budget de turno 20s (`TURN_BUDGET_MS`, `orchestrator-logic.ts:89-97`);
  prompt delimitado (`wrapUserData`/`sanitizeUntrustedData`, `personas.ts`);
  telemetria sem PII (`telemetry.ts`).

## 4. Pendências (decisão humana)

1. **Política de retenção por categoria** — PENDENTE (owner humano, decisão
   jurídica). Nenhum prazo é assumido neste documento; cada linha da tabela
   acima marca A DEFINIR (jurídico).
2. **Anonimização além de paciente** — o pipeline cobre o grafo do paciente +
   contribuições de módulos; falta mapear/implementar anonimização de
   **leads/contatos sem vínculo de paciente** e de **usuários ex-funcionários**
   (conta vs. trilha de auditoria).
3. **Mídias de mensagem e payloads de gateway** — definir ciclo de vida e
   expurgo dos binários no provedor WhatsApp e dos payloads brutos em
   `gateway_events` (minimizar o persistido).
4. **Processo do DPO** — PENDENTE: canal de exercício de direitos (acesso,
   correção, portabilidade, eliminação, oposição), SLA de resposta e
   registro das solicitações; este inventário é o anexo técnico desse processo.
