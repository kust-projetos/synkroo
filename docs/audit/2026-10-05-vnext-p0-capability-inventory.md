# P0 — Inventário de Capacidades (Synkroo vNext)

**Data:** 2026-10-05 · **Issue:** #23 · **Método:** auditoria read-only verificada por leitura direta (3 exploradores independentes; evidência = arquivo:linha).
**Escopo verificado:** 142 `src/app/api/**/route.ts`, 8 módulos (`src/modules/{core,operacional,comercial,atendimento,crm,financeiro,followup,ia}`), 21 repos legados (`src/repositories/*`), 19 serviços legados (`src/services/*`), 68 tabelas Drizzle, 39 páginas de dashboard, 48 specs E2E.

**Correção ao AGENTS.md:** os módulos de API `users`, `roles`, `notifications`, `installments`, `payments`, `gateway`, `agent` **não existem** como diretórios de rota — RBAC é action-layer server-side; `agent/*` foi substituído por `/api/ia/chat`. Tabela do AGENTS.md corrigida nesta tranche.

## 1. Core (auth, clínicas, usuários, RBAC, módulos)

`UI: src/app/login/page.tsx, src/app/signup/page.tsx, src/lib/auth/context.tsx, src/app/dashboard/configuracoes/{page.tsx,acessos/page.tsx,acessos/perfis/page.tsx} | API: src/app/api/auth/{[...nextauth],login,logout,signup,session,refresh,switch-clinic,change-password}/route.ts, src/app/api/clinics/settings/route.ts, src/app/api/admin/{provision,run-migration}/route.ts | Action: src/modules/core/actions/{list-clinic-users,list-clinic-roles,assign-user-access,remove-user-access,deactivate-user,create-role,set-module-contract}.ts + src/services/api-handlers/auth/switch-clinic.ts | Service: src/modules/core/services/{access,roles,modules}-service.ts, src/core/actions/{context,run,bootstrap,agent}.ts, src/core/rbac/resolve.ts | Repo: src/modules/core/repositories/{users,roles,access,modules}-repository.ts, src/core/rbac/repository.ts, src/repositories/{auth,clinics}/index.ts | Schema: clinics, users, userCredentials, permissions, roles, role_permissions, user_clinic_access, user_permission_overrides, instance_modules, idempotency_keys, outbox_jobs, audit_logs | Integration: NextAuth Credentials (src/lib/auth/auth.ts) + src/middleware.ts + Hyperdrive (wrangler.toml:40) | Tests: src/core/rbac/__tests__/*, src/modules/core/{actions,services,repositories}/__tests__/*, src/repositories/auth/__tests__/*, src/lib/auth/__tests__/*, e2e/auth/*`

**IMPLEMENTADO.** Gap: `/api/auth/login` é stub 404 (`src/app/api/auth/login/route.ts:26`); UI de RBAC é read-mostly (`acessos/page.tsx:51` só lista perfis, sem rota API de roles).

## 2. Atendimento (conversas, mensagens, canais)

`UI: src/app/dashboard/conversas/page.tsx, src/components/whatsapp/{message-bubble,message-composer}.tsx, src/components/contacts/contact-detail-panel.tsx | API: src/app/api/conversations{,/[id]}/route.ts, src/app/api/messages/{send,inbound,whatsapp,history/[conversationId]}/route.ts, src/app/api/widget/{session,messages}/route.ts | Action: src/modules/atendimento/actions/{iniciar-conversa,listar-conversas,obter-conversa,arquivar-conversa,escalar-conversa,receber-mensagem,classificar-intencao,extrair-entidades,historico-mensagens,enviar-mensagem,enviar-mensagem-direta,agendar-mensagem,obter-modelo-mensagem,receber-widget-mensagem}.ts | Service: src/modules/atendimento/services/{channel,evolution,send-message,dispatch-inbound-message,dispatch-outbound-message,webhook-processor,templates}-service.ts | Repo: src/modules/atendimento/repositories/conversations-repository.ts | Schema: conversations, messages, conversation_states, conversation_sessions, conversation_memories, whatsapp_instances, channel_installations, message_templates | Integration: Evolution API (evolution-service.ts), Meta webhook, widget token (src/lib/auth/widget-token.ts) | Tests: src/modules/atendimento/**/__tests__/*, e2e/conversations.spec.ts, e2e/conversations/list.spec.ts, e2e/api/conversations-api.spec.ts, e2e/chat-widget.spec.ts`

**IMPLEMENTADO.** Gap: `components/whatsapp/{template-editor,reminder-config-card,message-status-badge}.tsx` órfãos (nenhum import).

## 3. CRM (contatos, timeline, notas, dedup/merge)

`UI: src/app/dashboard/contatos/{page,contacts-client}.tsx, src/components/contacts/* (split-view, list-panel, detail-panel, timeline-tab, notes-tab, custom-fields-tab, duplicate-tab, duplicate-queue-panel, consent-section, appointments-tab, create-dialog) | API: src/app/api/contacts{,/[id],[id]/timeline,[id]/notes,[id]/tags,[id]/appointments,duplicates,[id]/approve,[id]/dismiss,[id]/merge}/route.ts, src/app/api/consents/route.ts, src/app/api/custom-fields/**, src/app/api/activities/route.ts, src/app/api/crm/stats/route.ts | Action: src/modules/crm/actions/{listar-contatos,obter-contato,listar-timeline-contato,listar-notas-contato,adicionar-nota-contato,atualizar-tags-contato,listar-sugestoes-duplicidade,aprovar-sugestao-duplicidade,dispensar-sugestao-duplicidade,executar-merge-patient,executar-merge-lead,conceder-consentimento,revogar-consentimento,reprocessar-sugestoes-duplicidade}.ts | Service: src/modules/crm/services/{contact-list,contact-detail,contact-timeline,contact-notes,contact-tags,duplicate-detection,duplicate-scoring,duplicate-review,duplicate-execution,dispatch-contact-changed-job,lgpd-crm}.ts | Repo: src/modules/crm/repositories/{contact-read,duplicate-suggestions,merge-execution}-repository.ts | Schema: clinic_tags, consents, custom_field_definitions, custom_field_values, crm_duplicate_suggestions, lead_activities | Integration: outbox CRM_CONTACT_CHANGED (src/lib/outbox/worker.ts:23) | Tests: src/modules/crm/__tests__/* (18), src/services/contacts/__tests__/*, e2e/crm/* (6)`

**PARCIAL.** Gap crítico: escrita de contato é **read-only por contrato** — `POST /api/contacts` e `PUT/PATCH /api/contacts/[id]` retornam 405 `crm_mvp_read_only` (`src/app/api/contacts/route.ts:26`), mas `contact-create-dialog.tsx:31` faz POST e falha; `contact-detail-panel.tsx:30` esconde o botão Editar por isso.

## 4. Comercial (leads, pipeline, tarefas, conversão)

`UI: src/app/dashboard/leads/{page,[id]/page,novo/page}.tsx, src/app/dashboard/{crm/page,crm/pipeline/page,pipeline/page,tarefas/page}.tsx, src/app/dashboard/atividades/page.tsx, src/components/pipeline/{kanban-board,lead-card}.tsx, src/hooks/use-kanban.ts | API: src/app/api/leads{,/[id],[id]/stage,[id]/convert,kanban,stats,hot,notifications,notifications/[id]/acknowledge}/route.ts, src/app/api/pipeline/{analytics,stages,stages/[id],stages/reorder}/route.ts, src/app/api/tasks/route.ts | Action: src/modules/comercial/actions/* (28: capturar-lead … obter-estatisticas-leads) | Service: src/modules/comercial/services/{lead-capture,lead-conversion,lead-scoring,lead-owner,pipeline,tasks,hot-lead-notification,merge-state,lgpd-comercial}-service.ts, src/services/api-handlers/tasks.ts | Repo: src/modules/comercial/repositories/{leads,pipeline,tasks,activities}-repository.ts | Schema: leads, lead_activities, pipeline_stages, tasks | Integration: inbound auto-captura (webhook-processor-service.ts:19) | Tests: src/modules/comercial/**, e2e/leads.spec.ts, e2e/leads/list.spec.ts, e2e/api/leads-api.spec.ts, e2e/tasks/*`

**IMPLEMENTADO.** Gap menor: `crm/pipeline/page.tsx:54` faz POST `/api/leads` próprio; notificações só têm UI dentro de `/dashboard/leads`.

## 5. Agenda/Operacional

`UI: src/app/dashboard/agendamentos/**, lista-espera, dentistas/**, procedimentos/**, pacientes/**, src/components/calendar/{AppointmentDialog,RescheduleDialog}.tsx | API: src/app/api/appointments/** (cancel, confirm, confirm-response, noshow, reactivate/reativate, remind, reminder-template, reschedule, availability, incomplete-treatments), src/app/api/waitlist{,/fill}, src/app/api/{dentists,procedures}/**, src/app/api/patients/**, src/app/api/treatment-plans/**, src/app/api/reminders/config | Action: src/modules/operacional/actions/*.ts (32) + followup/listar-tratamentos-incompletos | Service: src/modules/operacional/services/{scheduling,availability,confirmation,reminders,procedure-reminder-config,catalog,patients,incomplete-treatment,lgpd}-service.ts, src/services/treatment-plans/** | Repo: src/modules/operacional/repositories/{appointments,catalog,patients,waitlist,reminders}-repository.ts, src/repositories/{patients,appointments,dentists,procedures,treatment-plans}/index.ts | Schema: appointments, schedule_blocks, appointment_reminders, waitlist, appointment_reminder_configs, procedure_types, dentists, procedures, procedure_guidelines, patients, patient_observations, patient_preferences, patient_risk_scores, patient_feedback, treatment_plans, treatment_plan_items, appointment_status_log | Integration: Evolution para lembretes | Tests: src/modules/operacional/**/__tests__/* (25), src/services/{waitlist,treatment-plans,appointments,patients}/__tests__/*, e2e/{calendar,appointments,patients,waitlist,dentists,procedures}/*`

**PARCIAL.** Gap: **treatment-plans tem zero UI** (`useTreatmentPlans` só importado por testes; `contact-detail-panel.tsx:11-14` não inclui TreatmentPlans). `/api/reminders/config`, `/api/appointments/incomplete-treatments`, `/api/patients/[id]/preferences` sem consumidor de UI.

## 6. Follow-up/Reativação

`UI: src/app/dashboard/followup/page.tsx (STUB), src/app/dashboard/pacientes/inativos/page.tsx | API: src/app/api/patients/inactive, src/app/api/budgets/followup, src/app/api/cron/followups | Action: src/modules/followup/actions/{detectar-inativos,listar-inativos,reativar-paciente,executar-followup,executar-followup-orcamentos,listar-orcamentos-pendentes,executar-campanhas,registrar-followup,listar-pendentes,listar-segmentos,listar-tratamentos-incompletos}.ts | Service: src/modules/followup/services/{followup,inactive,campaign,budget-followup,dispatch-campaign-recipient,phone-resolver,consent-guard,lgpd-followup}.ts | Repo: src/modules/followup/repositories/{followup,campaigns}-repository.ts, src/repositories/followup/index.ts | Schema: follow_ups, follow_up_configs, campaigns, campaign_recipients, campaign_segments | Integration: outbox FOLLOWUP_CAMPAIGN_RECIPIENT → dispatch-campaign-recipient (Evolution) + consent-guard | Tests: src/modules/followup/**, src/services/followup/__tests__/* (9), e2e/campaigns*`

**PARCIAL.** Gap: `/dashboard/followup` é página stub (`page.tsx:9-16`); `/api/budgets/followup` sem consumidor de UI.

## 7. Campanhas

`UI: src/app/dashboard/campanhas/**, src/components/campaigns/{campaign-wizard,audience-preview}.tsx | API: src/app/api/campaigns{,/[id],[id]/start,[id]/recipients,segments,segments/preview} | Action: src/modules/followup/actions/executar-campanhas.ts | Service: src/services/followup/campaign.service.ts (legado) + src/modules/followup/services/{campaign,dispatch-campaign-recipient}.ts | Repo: src/repositories/campaigns/index.ts, src/modules/followup/repositories/campaigns-repository.ts | Schema: campaigns, campaign_recipients, campaign_segments | Integration: Evolution + outbox | Tests: src/services/followup/__tests__/campaign*.test.ts, src/modules/followup/services/__tests__/campaign-service.test.ts, e2e/campaigns*`

**PARCIAL.** Gap: camada dupla — rotas legadas chamam `src/services/followup/campaign.service.ts` direto enquanto action+service do módulo existem em paralelo; nenhuma action de campanha no registry (agente não alcança — correto por enquanto).

## 8. Financeiro

`UI: src/app/dashboard/financeiro/**, src/components/financeiro/{FinanceDashboard,BudgetTab,PaymentTab,CollectionTab,GatewayConfigTab}.tsx, src/components/contacts/{contact-financial-tab,budget-detail-panel,payment-recorder-dialog}.tsx | API: src/app/api/financeiro/** (budgets, charges, payments/manual, collections, gateways, gateway-rules, dashboard, webhooks/[provider]) + STRANGLER src/app/api/budgets/** | Action: src/modules/financeiro/actions/*.ts (22) | Service: src/modules/financeiro/services/* + gateways/{registry,contracts}.ts + providers/asaas/{client,mapper,webhook}.ts, src/services/{budgets,payments,installments}/** (legado) | Repo: src/modules/financeiro/repositories/*, src/repositories/budgets/index.ts | Schema: budgets, budget_items, budget_installments, payments, payment_gateways, payment_charges, gateway_routing_rules, gateway_events, collection_attempts | Integration: Asaas, outbox FINANCE_CHARGE_CREATE/CANCEL, crypto AES | Tests: ~30 arquivos, e2e/finance*.spec.ts`

**IMPLEMENTADO** (com dívida de strangler). Gap: `/api/budgets/*` (9 rotas legadas) 100% sem consumidor de UI — duplica `/api/financeiro/budgets/*`.

## 9. IA

`UI: — (nenhuma página chama /api/ia/chat) | API: src/app/api/ia/chat + triggers (messages/inbound, whatsapp/webhook, whatsapp/evolution, instagram/webhook) | Action: src/modules/ia/index.ts → iaActions = [] (tools vêm do tool-catalog via bridge) | Service: src/core/ia-agent/{orchestrator-logic,provider-zen,clinical-safety,personas,telemetry}.ts, src/core/ia-channel/**, src/core/agent-bridge/** | Repo: DO storage ('history'+'pendingAction', src/workers/ia-agent/index.ts:70) | Schema: pending_actions, decision_logs, smart_trigger_log, agent_queue, agent_dlq, agent_logs (src/modules/ia/schema/agent.ts) | Integration: Cloudflare DO AgentOrchestrator, service binding APP↔ia-bridge, provider zen deepseek (wrangler.jsonc:25) | Tests: 12 + 11 + 5 arquivos + workers`

**PARCIAL.** Gaps: (a) sem UI; (b) **telemetria persistida morta** — `pending_actions`, `decision_logs`, `smart_trigger_log`, `agent_queue`, `agent_dlq`, `agent_logs` lidos apenas por LGPD; nenhum insert em runtime; (c) `src/lib/llm/*` (factory 4 providers) é código morto — LLM vivo é `provider-zen.ts`.

## 10. Knowledge/RAG

`UI: — | API: src/app/api/knowledge{,/[id],search,ingest,categories} | Action: — (fora do registry) | Service: src/services/rag/rag.service.ts | Repo: src/repositories/knowledge/index.ts | Schema: knowledge_base (vector(1536)) | Integration: pgvector via src/lib/embeddings (sem Vectorize binding) | Tests: rag.service.test.ts, embeddings, e2e/api/knowledge-api.spec.ts`

**PARCIAL.** Gap: sem UI e **o agente não consulta a RAG** — `orchestrator-logic.ts` não importa `rag.service`; `decision_logs.rag_sources` nunca preenchido.

## 11. Analytics/Relatórios

`UI: src/app/dashboard/analytics/page.tsx, src/lib/ui/analytics-charts.tsx, dashboard/crm/page.tsx | API: src/app/api/analytics/{insights,roi,noshow-prediction,metrics}, src/app/api/reports/{financial,patients,export}, src/app/api/dashboard/{stats,alerts}, src/app/api/crm/stats, src/app/api/leads/stats | Action: obter-analytics-pipeline, obter-estatisticas-leads | Service: src/services/analytics/{analytics,roi,noshow-prediction,attendance-metrics}.service.ts, src/services/reports/**, src/services/api-handlers/** | Repo: SQL inline | Schema: appointments, patients, leads, budgets, payments | Tests: 4+ arquivos, e2e/analytics/charts.spec.ts`

**PARCIAL.** Gap: `components/reports/*` órfãos; `/api/analytics/metrics` e `/api/reports/patients` sem UI; `/api/dashboard/alerts` sem UI (só teste). **Fake data** — ver debt register §8.

## 12. LGPD

`UI: src/components/lgpd/{lgpd-export-dialog,lgpd-anonymize-dialog}.tsx — ÓRFÃOS; consent-section.tsx (único consumidor vivo) | API: src/app/api/lgpd/{export,anonymize}, src/app/api/consents | Action: crm/{conceder,revogar,listar}-consentimento(s), operacional/{exportar-dados-paciente,anonimizar-paciente} | Service: src/modules/operacional/services/{lgpd-service,lgpd-registry}.ts + contribuições lgpd-* em 6 módulos | Schema: consents, audit_logs, outbox_jobs, action_logs, idempotency_keys | Integration: registry fail-closed | Tests: lgpd-service (3 níveis), data-inventory, e2e/crm/lgpd-consent.spec.ts`

**PARCIAL.** Gap: export/anonymize são API-only; diálogos órfãos.

## 13. WhatsApp (Evolution)

`UI: configuracoes/page.tsx (QR real :216), conversas (composer), pacientes/inativos (envio :164) | API: src/app/api/whatsapp/{webhook,evolution,send,qrcode,templates} | Action: atendimento/{verificar-webhook,processar-webhook-whatsapp,status-evolution,obter-qrcode,enviar-mensagem,enviar-mensagem-direta,obter-modelo-mensagem} | Service: {evolution,channel}-service.ts + integrations/{resolve-channel-installation,webhook-freshness} | Schema: whatsapp_instances, channel_installations, message_templates | Integration: Evolution API v2.3.7 + outbox ATENDIMENTO_OUTBOUND_MESSAGE | Tests: 6 arquivos evolution/channel/webhook, e2e/conversations*`

**IMPLEMENTADO.** Gap: duas trilhas de webhook (Meta Cloud API vs Evolution) sem fonte canônica documentada; wire-format Evolution parseado na rota, fora do módulo.

## 14. Instagram

`UI: conversas (filtro leitura :292), configuracoes/page.tsx:575 botão disabled | API: src/app/api/instagram/webhook (GET verify + POST HMAC) | Action: atendimento/{verificar-webhook-instagram,processar-webhook-instagram,responder-instagram} | Service: channel-service (Meta Graph) | Schema: channel_installations, conversations, messages | Tests: instagram-channel.test.ts, meta-message.schema.test.ts, resolve-channel-installation.test.ts`

**PARCIAL.** Gap: onboarding self-service ausente; instalação só via seed/SQL.

## 15. Jobs/cron

`UI: — | API: src/app/api/cron/{reminders,cleanup,hot-leads,followups,financeiro-collections,crm-duplicates,outbox,smart-triggers} | Service: reminders-service, api-handlers/cron/*, src/lib/outbox/worker.ts | Integration: Cloudflare Cron */5 (wrangler.toml:5) → worker-entry.mjs → cron-schedule.mjs + CRON_SECRET timingSafeEqual | Tests: 6 route tests + cron-schedule test + outbox tests`

**IMPLEMENTADO** (7/8). Gap: `smart-triggers` → 410 e fora de `CRON_JOBS` — capacidade morta apesar do schema.

## 16. Queues

`UI: — | API: cron/outbox (POST lote, GET health) | Service: src/lib/outbox/worker.ts (7 handlers, SKIP LOCKED) | Repo: outbox-repository (enqueue onConflictDoNothing + claim) | Schema: outbox_jobs (UNIQUE clinic_id+operation+business_key), idempotency_keys; agent_queue/agent_dlq defined-only | Tests: outbox.integration, worker.hardening, campaign-outbox.integration, dispatch-charge-job.integration`

**PARCIAL.** Gap: **Cloudflare Queues ausente** (nenhum `[[queues.*]]` nos wranglers); `agent_queue`/`agent_dlq` sem writer. Outbox em si robusto (fingerprint + result_ref).

## 17. Workers auxiliares

`API: (WorkerEntrypoint RPC) | Service: src/workers/ia-agent/index.ts (AgentOrchestrator DO, runTurn, alarm 30d, STATE_VERSION 2), src/workers/ia-bridge/index.ts (AppService: listTools/executeAction/dbHealth/issueHandle/ping + HandleIssuerService) | Integration: service bindings bidirecionais, KV IA_SEEN (replay jti), HYPERDRIVE | Tests: workers + agent-bridge (11)`

**IMPLEMENTADO.** Gap: Agents SDK não usado (DO cru por limitação cross-worker documentada, `ia-agent/index.ts:35-38`).

## 18. Dashboard

`UI: dashboard/page.tsx (StatsGrid + atalhos), dashboard/crm/page.tsx | API: dashboard/stats (única consumida), dashboard/alerts (SEM consumidor) | Service: api-handlers/dashboard/{stats,alerts}.ts | Tests: alerts route.test.ts, e2e/dashboard/*`

**PARCIAL.** Gap: painel de alertas API-only; dashboard passivo (7 KPIs, sem drill-down).

## Resumo

| Capability | Estado | Maior gap |
|---|---|---|
| Core | IMPLEMENTADO | Sem API de roles; login stub 404 |
| Atendimento | IMPLEMENTADO | 3 componentes órfãos |
| CRM | **PARCIAL** | Contato read-only (405) vs dialog quebrado |
| Comercial | IMPLEMENTADO | POST ad-hoc em crm/pipeline |
| Agenda/Operacional | **PARCIAL** | treatment-plans sem UI |
| Follow-up | **PARCIAL** | página stub |
| Campanhas | **PARCIAL** | camada dupla legado/módulo |
| Financeiro | IMPLEMENTADO | strangler /api/budgets sem consumidor |
| IA | **PARCIAL** | sem UI; telemetria sem writer; lib/llm morto |
| Knowledge/RAG | **PARCIAL** | agente não consulta RAG |
| Analytics | **PARCIAL** | dashboards órfãos; fake data |
| LGPD | **PARCIAL** | diálogos órfãos (API-only) |
| WhatsApp | IMPLEMENTADO | 2 trilhas de webhook sem canônica |
| Instagram | **PARCIAL** | onboarding ausente |
| Jobs/cron | IMPLEMENTADO | smart-triggers 410 (morto) |
| Queues | **PARCIAL** | CF Queues ausente; agent_queue sem writer |
| Workers | IMPLEMENTADO | Agents SDK não usado (documentado) |
| Dashboard | **PARCIAL** | alerts sem UI; passivo |

**Padrão dominante (12/18):** a cadeia está íntegra mas rompe no elo **UI→API** — ~9 conjuntos de componentes/hooks órfãos com rotas e services prontos. Nenhum gate detecta UI órfã.

**Recomendação:** baseline é *backend-complete / UI-incompleto*. Antes de ampliar superfície: (1) conectar ou remover UI órfã (decisão de produto por capability); (2) fechar gaps de runtime sem UI: writers de telemetria IA, wiring RAG no orchestrator, decisão outbox vs CF Queues; (3) drenar strangler `/api/budgets/*` e a dupla camada de campaigns para eliminar ambiguidade de contrato.
