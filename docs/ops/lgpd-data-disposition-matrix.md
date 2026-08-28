# LGPD Data Disposition Matrix — Synkroo (W4.0)

> **Status:** Aprovado 2026-08-28 — retenção 30 anos (prescrição) autorizada pelo owner, telemetria aceita
> **Owner:** Operacional (pacientes) + CRM (consents/leads) + Financeiro (budgets/payments) + Atendimento (conversas)
> **Data:** 2026-08-28 (atualizado com decisão owner: manter dados acima de 5 anos, prescrição 30 anos)

## Inventário por tabela/campo (owner, ownership, export, anonimização, retenção, legalHold, teste)

| Tabela/Campo | Owner module | Ownership path até patient/lead | Export | Anonimização | Base/Prazo retenção | legalHold | Teste |
|---|---|---|---|---|---:|---|---|
| patients.name, phone, email, cpf, birthDate, gender, address, notes | operacional | patients.id (PK) | yes | clear → `Anonimizado` / pseudonymize phone email | Retenção clínica 30 anos (prescrição) + legalHold | retain + clear PII | `lgpd-anonymize.test` |
| patients.tags, riskScore | operacional | patients.id | yes | retain (não PII) | 30 anos | retain | - |
| patient_observations.content | operacional | patient_observations.patient_id → patients.id | yes | clear | 30 anos | retain | - |
| patient_preferences | operacional | patient_preferences.patient_id → patients | yes | clear | 30 anos | retain | - |
| patient_risk_scores | operacional | patient_risk_scores.patient_id → patients | yes | retain (score only) | 30 anos | retain | - |
| patient_feedback | operacional | patient_feedback.patient_id → patients | yes | pseudonymize comments | 2 anos | retain | - |
| appointments.notes | operacional | appointments.patient_id → patients | yes | clear | 30 anos | retain | - |
| appointment_status_log | operacional | appointment_status_log.appointment_id → appointments → patients | yes | retain (status only) | 30 anos | retain | - |
| appointment_reminders | operacional | appointment_reminders.appointment_id → patients | no | delete pending | 1 ano | delete pending | - |
| waitlist | operacional | waitlist.patient_id → patients | yes | clear notes | 1 ano | retain | - |
| treatment_plans/items | operacional | treatment_plans.patient_id → patients | yes | retain fatos, clear PII | 30 anos | retain | - |
| conversations.metadata, externalId | atendimento | conversations.patient_id → patients (nullable) | yes | pseudonymize externalId | 2 anos | retain | - |
| messages.content, mediaUrl, metadata, intent | atendimento | messages.conversation_id → conversations → patients | yes | clear content, retain direction/type | 2 anos | retain | - |
| conversation_states/sessions/memories | atendimento | conversationId → patients | yes | clear content | 2 anos | retain | - |
| budgets.title, description, notes | financeiro | budgets.patient_id → patients / leadId → leads | yes | clear | 30 anos fiscal | retain | - |
| budget_items | financeiro | budget_items.budget_id → budgets → patients | yes | retain (procedureName, price) | 30 anos | retain | - |
| budget_installments | financeiro | budget_installments.budget_id → budgets → patients | yes | retain (amount, dueDate) | 30 anos | retain | - |
| payments.notes | financeiro | payments.patient_id → patients / budget_id → budgets | yes | clear | 30 anos fiscal | retain | - |
| payment_charges.external_charge_id, paymentUrl, pixQrCode | financeiro | payment_charges.budget_id → patients | no | retain (id) | 30 anos | retain | - |
| gateway_routing_rules | financeiro | gateway_routing_rules.patient/lead/campaign → patients/leads | no | retain | 2 anos | retain | - |
| gateway_events.payload | financeiro | gateway_events.charge_id → budgets → patients | no | retain (eventId) | 30 anos | retain | - |
| collection_attempts | financeiro | collection_attempts.installment → budgets → patients | no | retain | 2 anos | retain | - |
| leads.name, phone, email, notes | comercial | leads.id | yes | clear | 2 anos ou consent revoke | retain | - |
| lead_activities | comercial | lead_activities.lead_id → leads | yes | clear | 2 anos | retain | - |
| tasks (lead) | comercial | tasks.lead_id → leads | yes | clear | 2 anos | retain | - |
| campaign_recipients | followup | campaign_recipients.patient_id → patients | yes | retain status | 2 anos | retain | - |
| follow_ups | followup | follow_ups.patient_id → patients | yes | clear content | 2 anos | retain | - |
| consents (crm) | crm | consents.patient_id / lead_id | yes | retain (grant/revoke) | até revoke + 30 anos audit | retain | - |
| custom_field_values | crm | custom_field_values.contact_id → patients/leads | yes | clear se PII | 30 anos | retain | - |
| pending_actions, decision_logs, smart_trigger_log, agent_logs | ia | patient_id → patients (nullable) | no | delete pending, retain logs pseudonymized | 1 ano | delete pending | - |
| outbox_jobs, idempotency_keys payloads | infra | clinic_id + businessKey → patients/leads (quando contém contato) | no | cancel/redact na mesma tx anonimização | até processed | cancel | `lgpd-outbox.test` |
| audit_logs, action_logs JSONB | infra | audit_logs.patient_id → patients (quando contém) | yes (sem PII) | retain com fingerprint HMAC, nunca valor original | 30 anos | retain | `lgpd-audit.test` |

**Regras gerais:**
- `legalHold = true` em `patients` impede anonimização; falha sem mutação.
- Registros clínicos/financeiros marcados `retain` preservam fatos obrigatórios (ex: `appointments.status`, `payments.amount`) mas removem PII.
- Outbox/jobs pending com contato são cancelados/redigidos na mesma transaction da anonimização.
- Seguro jurídico: prazo e base de retenção acima são placeholders operacionais; produção exige validação do DPO/encarregado antes de purge físico.

## Gate de decisão W4.0
- Teste `src/modules/operacional/__tests__/lgpd/data-inventory.test.ts` falha quando surge nova FK `patientId`/`contactId`, coluna textual sensível ou JSONB relevante sem entrada nesta matriz.
- Sem disposição aprovada para um campo, W4.2/W4.3 ficam bloqueados.

## Referências
- Spec canônica 2026-07-28: REQ-LGPD-01..04
- Plano W4: auditoria, export, anonimização, consentimento
