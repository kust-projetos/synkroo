# Pre-consolidation Inventory

## git remote -v

```
origin  https://github.com/kust-projetos/synkroo.git (fetch)
origin  https://github.com/kust-projetos/synkroo.git (push)
```

## git branch -vv

```
  backup/pre-cleanup-20260612              16c6f85b feat(domain-boundaries): add patients/contacts/relationship boundary module
  calendar-foundation                      9b4e6b6b feat(calendar): add DayHeader component
  calendar-integration                     dbcc579c feat(calendar): wire up CalendarLayout with custom calendar
  calendar-views                           56b656cb feat(calendar): add ProfessionalsView with dentist columns
* chore/atendimento-eixo2-implementation   73e67bf0 docs: plan Synkroo consolidation
  chore/cleanup-typecheck-postgres-cutover 8c3c4adf [origin/chore/cleanup-typecheck-postgres-cutover] chore: ignore local planner runtime files
  chore/consolidate-drizzle-migrations     a3834d53 [origin/chore/consolidate-drizzle-migrations] feat(dev): add static mock data system to populate dashboard during dev
  feat/admindemo-seed-and-inactive-fix     367816af docs: plano de implementacao W6 (frontend base)
+ feat/eixo2-crm-dedup-schema              76ab0223 (D:/projetos/synkroo/.worktrees/eixo2-crm-dedup-schema) test(contacts,hooks): fix two slice-introduced lint regressions
+ feat/eixo2-financeiro-task1              957a649e (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task1) feat(financeiro): add finance schema foundation
+ feat/eixo2-financeiro-task2              181ddb7a (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task2) feat(comercial): convert lead without scheduling
+ feat/eixo2-financeiro-task3              83fba9d1 (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task3) feat(financeiro): scaffold module and gateways
+ feat/eixo2-financeiro-task4              71d9e313 (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task4) feat(financeiro): implement finance actions with real execution
+ feat/eixo2-financeiro-task5              70f8ce58 (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task5) feat(financeiro): adapt all legacy budget routes to financeiro
+ feat/eixo2-financeiro-task6              458167d2 (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task6) feat(financeiro): process charges and collections
+ feat/eixo2-financeiro-task7              ba943d41 (D:/projetos/synkroo/.worktrees/eixo2-financeiro-task7) feat(financeiro): add finance dashboard
+ feat/eixo2-task1-allowlist               162ba69b (D:/projetos/synkroo/.worktrees/eixo2-task1-allowlist) fix(ia): allowlist bridge tools
+ feat/financeiro-db-repos                 71bd4215 (D:/projetos/synkroo/.worktrees/financeiro-db-repos) feat(financeiro): migrate from in-memory store to Drizzle/PostgreSQL repositories
+ feat/financeiro-internal-integrations    c106f30d (D:/projetos/synkroo/.worktrees/financeiro-internal-integrations) feat(financeiro): integrate internal WhatsApp via Atendimento for reminders and budget send
+ feat/fundacao-rbac                       ab850358 (D:/projetos/synkroo/.worktrees/feat-fundacao-rbac) Merge branch 'feat/w4-smoke-staging'
+ feat/seed-local-scale                    009f11e1 (D:/projetos/synkroo/.worktrees/seed-local-scale) fix: migrate seed-local-scale from Supabase to Drizzle
  feat/w3-action-layer                     54908df5 chore(actions): baseline verde da Action Layer core (W3.1)
  feat/w3-manifest-context                 3e78fd70 feat(modules): gates de rota, menu e jobs (gate de tools ja em agentToolsFor)
  feat/w3-modules-core                     f519e20d chore(lint): regra de fronteira entre modulos (boundaries)
  feat/w3-painel-admin                     b22bdd3d feat(core): paginas do painel de acessos (usuarios e perfis)
  feat/w3-rbac                             bf36b033 feat(rbac): script de migracao userRole->user_clinic_access (admin->Administrador)
+ feat/w4-8-driver-edge                    ab850358 (D:/projetos/synkroo/.worktrees/feat-w4-8-driver-edge) Merge branch 'feat/w4-smoke-staging'
+ feat/w4-8-driver-edge-v2                 ab850358 (D:/projetos/synkroo/.worktrees/feat-w4-8-driver-edge-v2) Merge branch 'feat/w4-smoke-staging'
+ feat/w4-8-driver-edge-v3                 ab850358 (D:/projetos/synkroo/.worktrees/feat-w4-8-v3) Merge branch 'feat/w4-smoke-staging'
+ feat/w4-8-driver-edge-v4                 ab850358 (D:/projetos/synkroo/.worktrees/feat-w4-8-v4) Merge branch 'feat/w4-smoke-staging'
  feat/w4-bootstrap-auth                   7085576a feat(cf): bootstrap de Actions no boot + auth edge validada
  feat/w4-deploy-vercel-remove             d40abb59 docs(cf): runbook de deploy por instancia (provisionamento + secrets + smoke + rollback)
  feat/w4-hyperdrive                       c0965a30 feat(cf): acesso a Postgres via Hyperdrive (pg + nodejs_compat)
  feat/w4-opennext-wrangler                c528c48b feat(cf): config OpenNext + Wrangler + scripts de build/deploy
  feat/w4-smoke-staging                    c4a93738 chore(runtime): finalize pre-eixo2 foundation closure
  feat/w4-vectorize-kv                     067e4376 fix(tsconfig): exclude worker-configuration.d.ts from Next.js build scope
+ financeiro-review-verify                 6ddd6ecf (D:/projetos/synkroo/.worktrees/financeiro-review-verify) Merge branch 'fix/financeiro-reminder-send-cancel' into chore/atendimento-eixo2-implementation
+ financeiro-verify-clean                  8e08022a (D:/projetos/synkroo/.worktrees/financeiro-verify-clean) fix(financeiro): satisfy module boundary lint rule
+ financeiro-verify-clean-2                7646c778 (D:/projetos/synkroo/.worktrees/financeiro-verify-clean-2) chore(financeiro): remove runtime any casts and lint issues
+ financeiro-verify-clean-3                323ec865 (D:/projetos/synkroo/.worktrees/financeiro-verify-clean-3) fix(financeiro): align legacy budget route date patch typing
  fix/agent-decisions-drizzle              2c629c98 fix: migrate fix-agent-decisions-drizzle from Supabase to Drizzle
+ fix/agent-messages-route-drizzle         9b278fce (D:/projetos/synkroo/.worktrees/fix-agent-messages-route-drizzle) fix: remove Supabase type import from agent/messages route
+ fix/agent-queue-repo-drizzle             620a5803 (D:/projetos/synkroo/.worktrees/fix-agent-queue-repo-drizzle) fix: migrate fix-agent-queue-repo-drizzle from Supabase to Drizzle
+ fix/analytics-service-drizzle            a5bd4d33 (D:/projetos/synkroo/.worktrees/fix-analytics-service-drizzle) fix: migrate analytics.service from Supabase to Drizzle
+ fix/appointment-serializer               7f20fb39 (D:/projetos/synkroo/.worktrees/fix-appointment-serializer) fix(api): extract appointmentToApi serializer to satisfy Next.js route-type
+ fix/asaas-client-webhook-encryption      389eceb1 (D:/projetos/synkroo/.worktrees/fix-asaas-client) fix(financeiro): real Asaas HTTP client, AES-256-GCM encryption, webhook processing
+ fix/attendance-metrics-drizzle           bfc40a59 (D:/projetos/synkroo/.worktrees/fix-attendance-metrics-drizzle) feat(attendance-metrics): migrate from Supabase to Drizzle ORM
  fix/budget-followup-drizzle              c91fc51c fix: migrate fix-budget-followup-drizzle from Supabase to Drizzle
  fix/budget-send-drizzle                  ef0eaf13 fix: migrate fix-budget-send-drizzle from Supabase to Drizzle
+ fix/budgets-accept-reject-drizzle        9d09abc7 (D:/projetos/synkroo/.worktrees/fix-budgets-accept-reject-drizzle) fix: migrate budgets accept+reject routes from Supabase to Drizzle/Auth.js
+ fix/budgets-id-route-drizzle             b1a9b668 (D:/projetos/synkroo/.worktrees/fix-budgets-id-route-drizzle) fix: migrate budgets/[id] route from Supabase to Drizzle/Auth.js
+ fix/budgets-root-route-drizzle           4f05a1e5 (D:/projetos/synkroo/.worktrees/fix-budgets-root-route-drizzle) fix: remove Supabase type import from budgets/route
+ fix/campaign-segments-preview-drizzle    3966f75c (D:/projetos/synkroo/.worktrees/fix-campaign-segments-preview-drizzle) feat(campaigns): migrate segments/preview route to Drizzle + integrate segmentation v2
  fix/campaigns-id-route-drizzle           0ef34f32 fix: migrate campaigns/[id] route auth from Supabase to Auth.js
+ fix/campaigns-recipients-route-drizzle   6840d393 (D:/projetos/synkroo/.worktrees/fix-campaigns-recipients-route-drizzle) fix: migrate campaigns/[id]/recipients route auth from Supabase to Auth.js
+ fix/campaigns-start-route-drizzle        5422b217 (D:/projetos/synkroo/.worktrees/fix-campaigns-start-route-drizzle) fix: migrate campaigns/[id]/start route auth from Supabase to Auth.js
  fix/clinic-settings-drizzle              ce21ac97 fix: migrate fix-clinic-settings-drizzle from Supabase to Drizzle
+ fix/consents-service-drizzle             364d1857 (D:/projetos/synkroo/.worktrees/fix-consents-service-drizzle) fix: migrate fix-consents-service-drizzle from Supabase to Drizzle
+ fix/contacts-appointments-route-drizzle  b20319fc (D:/projetos/synkroo/.worktrees/fix-contacts-appointments-route-drizzle) fix: migrate contacts/[id]/appointments route from Supabase to Drizzle/Auth.js
+ fix/contacts-service-drizzle             e4958a78 (D:/projetos/synkroo/.worktrees/fix-contacts-service-drizzle) fix: migrate fix-contacts-service-drizzle from Supabase to Drizzle
+ fix/contacts-timeline-drizzle            38497ce1 (D:/projetos/synkroo/.worktrees/fix-contacts-timeline-drizzle) fix: migrate fix-contacts-timeline-drizzle from Supabase to Drizzle
+ fix/custom-fields-drizzle                f279c2b6 (D:/projetos/synkroo/.worktrees/fix-custom-fields-drizzle) fix: migrate custom-fields definitions+values from Supabase to Drizzle
+ fix/dashboard-alerts-drizzle             d2d26c27 (D:/projetos/synkroo/.worktrees/fix-dashboard-alerts-drizzle) fix: migrate fix-dashboard-alerts-drizzle from Supabase to Drizzle
+ fix/dashboard-stats-drizzle              6457f4e5 (D:/projetos/synkroo/.worktrees/fix-dashboard-stats-drizzle) fix: migrate fix-dashboard-stats-drizzle from Supabase to Drizzle
+ fix/decision-log-service-drizzle         ddd2ca8c (D:/projetos/synkroo/.worktrees/fix-decision-log-service-drizzle) fix: migrate fix-decision-log-service-drizzle from Supabase to Drizzle
+ fix/drizzle-schema-unblock-batch1        c02f16cc (D:/projetos/synkroo/.worktrees/fix-drizzle-schema-unblock-batch1) feat(schema): add agentLogs, smartTriggerLog, appointmentReminderConfigs, procedureTypes, campaignSegments to Drizzle
+ fix/financeiro-installments              11458cf9 (D:/projetos/synkroo/.worktrees/fix-installments) fix(financeiro): real installment CRUD with Drizzle persistence
+ fix/financeiro-rbac-read-routes          44eba6a5 (D:/projetos/synkroo/.worktrees/fix-rbac-read-routes) fix(financeiro): add action-gated read routes for gateways and routing rules
+ fix/financeiro-reminder-send-cancel      a9689f2c (D:/projetos/synkroo/.worktrees/fix-reminder-send-cancel) fix(financeiro): honest sendReminder, wired cancel button, WhatsApp integration path
+ fix/financial-reports-drizzle            10dbae8b (D:/projetos/synkroo/.worktrees/fix-financial-reports-drizzle) fix: migrate fix-financial-reports-drizzle from Supabase to Drizzle
  fix/followup-segmentation-drizzle        29c1086b fix: migrate leads/kanban route from Supabase to Drizzle/Auth.js
+ fix/followup-service-drizzle             fd57f052 (D:/projetos/synkroo/.worktrees/fix-followup-service-drizzle) feat(followup): migrate from Supabase to Drizzle ORM
+ fix/health-routes-drizzle                93ed452f (D:/projetos/synkroo/.worktrees/fix-health-routes-drizzle) fix: migrate health routes from Supabase to Drizzle
+ fix/inactive-patients-drizzle            70f65b88 (D:/projetos/synkroo/.worktrees/fix-inactive-patients-drizzle) fix: migrate fix-inactive-patients-drizzle from Supabase to Drizzle
+ fix/instagram-webhook-raw-bytes          7618366e (D:/projetos/synkroo-instagram-sec) fix(instagram): verify webhook HMAC over raw bytes
+ fix/installments-service-drizzle         59121726 (D:/projetos/synkroo/.worktrees/fix-installments-service-drizzle) fix: migrate installment.service from Supabase to Drizzle
+ fix/knowledge-categories-route-drizzle   78435ca8 (D:/projetos/synkroo/.worktrees/fix-knowledge-categories-route-drizzle) fix: migrate knowledge/categories route from Supabase to Drizzle/Auth.js
+ fix/knowledge-id-route-drizzle           1eb1efc2 (D:/projetos/synkroo/.worktrees/fix-knowledge-id-route-drizzle) fix: migrate knowledge/[id] route from Supabase to Drizzle/Auth.js
+ fix/knowledge-root-route-drizzle         6697cdea (D:/projetos/synkroo/.worktrees/fix-knowledge-root-route-drizzle) fix: migrate knowledge/route from Supabase to Drizzle/Auth.js
+ fix/knowledge-search-route-drizzle       cd23da92 (D:/projetos/synkroo/.worktrees/fix-knowledge-search-route-drizzle) fix: migrate knowledge/search route auth from Supabase to Drizzle/Auth.js
+ fix/l4-conversation-drizzle              0295b6d3 (D:/projetos/synkroo/.worktrees/fix-l4-conversation-drizzle) fix: remove Supabase type import from L4-conversation.service
+ fix/leads-convert-route-drizzle          56ed3eb2 (D:/projetos/synkroo/.worktrees/fix-leads-convert-route-drizzle) fix: migrate leads/[id]/convert route auth from Supabase to Auth.js
+ fix/leads-id-route-drizzle               42363acc (D:/projetos/synkroo/.worktrees/fix-leads-id-route-drizzle) fix: migrate leads/[id] route auth from Supabase to Auth.js
+ fix/leads-kanban-route-drizzle           29c1086b (D:/projetos/synkroo/.worktrees/fix-leads-kanban-route-drizzle) fix: migrate leads/kanban route from Supabase to Drizzle/Auth.js
+ fix/leads-stage-route-drizzle            8d5102e6 (D:/projetos/synkroo/.worktrees/fix-leads-stage-route-drizzle) fix: migrate leads/[id]/stage route from Supabase to Drizzle/Auth.js
  fix/lgpd-anonymize-route-drizzle         0ef34f32 fix: migrate campaigns/[id] route auth from Supabase to Auth.js
+ fix/lgpd-export-route-drizzle            0ef34f32 (D:/projetos/synkroo/.worktrees/fix-lgpd-export-route-drizzle) fix: migrate campaigns/[id] route auth from Supabase to Auth.js
+ fix/lgpd-routes-drizzle                  b2620899 (D:/projetos/synkroo/.worktrees/fix-lgpd-routes-drizzle) feat(lgpd): Schema Batch 2 + migrate LGPD export/anonymize routes to Drizzle
+ fix/lgpd-routes-final                    3d4e0c22 (D:/projetos/synkroo/.worktrees/fix-lgpd-routes-final) feat(lgpd): finalize export/anonymize with consents + audit_logs from Drizzle schema
+ fix/noshow-prediction-drizzle            c10247cd (D:/projetos/synkroo/.worktrees/fix-noshow-prediction-drizzle) fix: migrate fix-noshow-prediction-drizzle from Supabase to Drizzle
+ fix/noshow-prediction-test               c6df88dd (D:/projetos/synkroo/.worktrees/fix-noshow-prediction-test) fix(noshow-prediction): stabilize flaky test — pin future date to neutral time
+ fix/noshow-service                       01297cf3 (D:/projetos/synkroo/.worktrees/fix-noshow-service) fix(noshow-prediction): return medium risk when patient not found
+ fix/patient-registration-drizzle         fe31c646 (D:/projetos/synkroo/.worktrees/fix-patient-registration-drizzle) fix: migrate fix-patient-registration-drizzle from Supabase to Drizzle
  fix/payment-service-drizzle              9e9c108d fix: migrate fix-payment-service-drizzle from Supabase to Drizzle
+ fix/pending-actions-drizzle              a0521262 (D:/projetos/synkroo/.worktrees/fix-pending-actions-drizzle) fix: migrate fix-pending-actions-drizzle from Supabase to Drizzle
+ fix/pipeline-analytics-drizzle           dbad6b99 (D:/projetos/synkroo/.worktrees/fix-pipeline-analytics-drizzle) fix: migrate pipeline-analytics.service from Supabase to Drizzle
+ fix/pipeline-analytics-route-auth        d6a034a6 (D:/projetos/synkroo/.worktrees/fix-pipeline-analytics-route-auth) fix: migrate pipeline/analytics route auth from Supabase to Auth.js
+ fix/pipeline-stages-drizzle              bf407522 (D:/projetos/synkroo/.worktrees/fix-pipeline-stages-drizzle) fix: migrate fix-pipeline-stages-drizzle from Supabase to Drizzle
+ fix/pipeline-stages-routes-auth          5a8b1bd3 (D:/projetos/synkroo/.worktrees/fix-pipeline-stages-routes-auth) fix: migrate pipeline/stages routes auth from Supabase to Auth.js
+ fix/procedure-reminder-config-drizzle    7e4388bf (D:/projetos/synkroo/.worktrees/fix-procedure-reminder-config-drizzle) feat(procedure-reminder-config): migrate from Supabase to Drizzle ORM
  fix/reminder-service-drizzle             2489863d fix: migrate fix-reminder-service-drizzle from Supabase to Drizzle
  fix/reports-export-drizzle               bdad7d2a fix: migrate fix-reports-export-drizzle from Supabase to Drizzle
+ fix/reports-patients-drizzle             0f125d34 (D:/projetos/synkroo/.worktrees/fix-reports-patients-drizzle) fix: migrate fix-reports-patients-drizzle from Supabase to Drizzle
  fix/roi-service-drizzle                  5ed2e51f fix: migrate fix-roi-service-drizzle from Supabase to Drizzle
+ fix/router-tools-drizzle                 0b6c3b37 (D:/projetos/synkroo/.worktrees/fix-router-tools-drizzle) fix: remove unused Supabase import from router.tools
+ fix/sales-tools-drizzle                  429e4577 (D:/projetos/synkroo/.worktrees/fix-sales-tools-drizzle) fix: migrate getLeadInfoTool from Supabase to Drizzle
+ fix/scheduler-tools-drizzle              3eea5cd6 (D:/projetos/synkroo/.worktrees/fix-scheduler-tools-drizzle) feat(scheduler-tools): add cancellation/rescheduling fields + migrate from Supabase to Drizzle
+ fix/schema-drift-recovery                a3834d53 (D:/projetos/synkroo/.worktrees/schema-drift-recovery) feat(dev): add static mock data system to populate dashboard during dev
+ fix/security-integrity-hardening         551427db (D:/projetos/synkroo/.worktrees/security-integrity-hardening) [origin/fix/security-integrity-hardening] fix-ci-branch-filter
+ fix/segmentation-service-drizzle         c02f16cc (D:/projetos/synkroo/.worktrees/fix-segmentation-service-drizzle) feat(schema): add agentLogs, smartTriggerLog, appointmentReminderConfigs, procedureTypes, campaignSegments to Drizzle
+ fix/segmentation-service-drizzle-v2      50018256 (D:/projetos/synkroo/.worktrees/fix-segmentation-service-drizzle-v2) feat(segmentation): migrate from Supabase to Drizzle with patients.status (Batch 2)
  fix/smart-triggers-drizzle               0295b6d3 fix: remove Supabase type import from L4-conversation.service
+ fix/smart-triggers-service-drizzle       e8614554 (D:/projetos/synkroo/.worktrees/fix-smart-triggers-service-drizzle) feat(smart-triggers): migrate from Supabase to Drizzle ORM
+ fix/t2-rebaseline-migrations             74608523 (D:/projetos/synkroo/.worktrees/t2-rebaseline-migrations) chore(db): rebaseline Drizzle migrations (Opção A) + fix integration test
+ fix/total-value-segmentation             3a197125 (D:/projetos/synkroo/.worktrees/fix-total-value-segmentation) feat(segmentation): add appointments.totalValue + real totalSpentMin/Max filter
+ fix/treatment-plan-sessions-drizzle      87146a1d (D:/projetos/synkroo/.worktrees/fix-treatment-plan-sessions-drizzle) fix: migrate fix-treatment-plan-sessions-drizzle from Supabase to Drizzle
+ fix/typecheck-errors                     86a9c305 (D:/projetos/synkroo/.worktrees/fix-typecheck-errors) fix(typecheck): align BudgetRow with nullable schema fields, fix UnconvertedBudget patient_id type
+ fix/waitlist-drizzle                     2b575fad (D:/projetos/synkroo/.worktrees/fix-waitlist-drizzle) fix: migrate fix-waitlist-drizzle from Supabase to Drizzle
+ main                                     bad1d6e9 (D:/projetos/synkroo/.worktrees/eixo2-task0-runner) [origin/main: ahead 27, behind 1] docs(eixo2): plano de implementacao do modulo Atendimento (E-01)
+ migrate-scheduler                        16c6f85b (D:/projetos/synkroo/.worktrees/migrate-scheduler) feat(domain-boundaries): add patients/contacts/relationship boundary module
+ restore-patient-history-tests            16c6f85b (D:/projetos/synkroo/.worktrees/restore-patient-history-tests) feat(domain-boundaries): add patients/contacts/relationship boundary module
+ spike/cf-runtime                         1550e758 (D:/projetos/synkroo-spike-cf) spike(cf): valida Server Actions e App Router em Workers (OpenNext)
+ spike/ia-agente-referencia               c9b51788 (D:/projetos/synkroo/.worktrees/spike-ia-agente-referencia) [origin/spike/ia-agente-referencia] chore(spike): add ia agente reference artifacts
+ spike/ia-agente-viabilidade              fcb260fc (D:/projetos/synkroo/.worktrees/spike-ia-agente-viabilidade) docs(eixo2): matriz de seguranca do agente validada pelo usuario
  spike/ia-opennext-binding                0d02edf6 spike(ia): opennext->workers binding de-risk (descartavel; nao merge)
```

## git worktree list --porcelain

```
worktree D:/projetos/synkroo
HEAD 73e67bf038154777eb15b1bcf17982a58c9b8af8
branch refs/heads/chore/atendimento-eixo2-implementation

worktree D:/projetos/synkroo/.worktrees/e03-cron-actions-closure
HEAD b0981700aff8264e9452d666e3e3226465ab8b54
detached

worktree D:/projetos/synkroo/.worktrees/eixo2-crm-dedup-schema
HEAD 76ab022381219a025f885192ed3e80c2c5efc84c
branch refs/heads/feat/eixo2-crm-dedup-schema

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task1
HEAD 957a649e61793ad42eb07422bbcbdb1ad43ad938
branch refs/heads/feat/eixo2-financeiro-task1

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task2
HEAD 181ddb7a9f5ffba11c93846c8eb4ad76a88750da
branch refs/heads/feat/eixo2-financeiro-task2

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task3
HEAD 83fba9d1421c9bca8f281e04cffa0210dc5c8ede
branch refs/heads/feat/eixo2-financeiro-task3

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task4
HEAD 71d9e313f067cd49f11332520b52bffc23b832bc
branch refs/heads/feat/eixo2-financeiro-task4

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task5
HEAD 70f8ce58ac1458c8098966755819bae713858631
branch refs/heads/feat/eixo2-financeiro-task5

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task6
HEAD 458167d24e9a24777c9fb0066035b503860bdfc4
branch refs/heads/feat/eixo2-financeiro-task6

worktree D:/projetos/synkroo/.worktrees/eixo2-financeiro-task7
HEAD ba943d410f79b6d3f117eae9b67d08201385272f
branch refs/heads/feat/eixo2-financeiro-task7

worktree D:/projetos/synkroo/.worktrees/eixo2-task0-runner
HEAD bad1d6e9f2a056e014d8582bf049a21755906733
branch refs/heads/main

worktree D:/projetos/synkroo/.worktrees/eixo2-task1-allowlist
HEAD 162ba69b94ee43340e05cd601661429d60f2c9db
branch refs/heads/feat/eixo2-task1-allowlist

worktree D:/projetos/synkroo/.worktrees/feat-fundacao-rbac
HEAD ab8503581809041d87983f055e6120cdbaf4ba6a
branch refs/heads/feat/fundacao-rbac

worktree D:/projetos/synkroo/.worktrees/feat-w4-8-driver-edge
HEAD ab8503581809041d87983f055e6120cdbaf4ba6a
branch refs/heads/feat/w4-8-driver-edge

worktree D:/projetos/synkroo/.worktrees/feat-w4-8-driver-edge-v2
HEAD ab8503581809041d87983f055e6120cdbaf4ba6a
branch refs/heads/feat/w4-8-driver-edge-v2

worktree D:/projetos/synkroo/.worktrees/feat-w4-8-v3
HEAD ab8503581809041d87983f055e6120cdbaf4ba6a
branch refs/heads/feat/w4-8-driver-edge-v3

worktree D:/projetos/synkroo/.worktrees/feat-w4-8-v4
HEAD ab8503581809041d87983f055e6120cdbaf4ba6a
branch refs/heads/feat/w4-8-driver-edge-v4

worktree D:/projetos/synkroo/.worktrees/financeiro-db-repos
HEAD 71bd421500f079623fab62be13712d1b1fdbc988
branch refs/heads/feat/financeiro-db-repos

worktree D:/projetos/synkroo/.worktrees/financeiro-internal-integrations
HEAD c106f30d5fcaf8c908eb96ebf9daf3f581b8c708
branch refs/heads/feat/financeiro-internal-integrations

worktree D:/projetos/synkroo/.worktrees/financeiro-review-verify
HEAD 6ddd6ecfb174a934186636a8b33727f215aaa8aa
branch refs/heads/financeiro-review-verify

worktree D:/projetos/synkroo/.worktrees/financeiro-verify-clean
HEAD 8e08022a636cf92e775a7b317df9cfc5510fa1c7
branch refs/heads/financeiro-verify-clean

worktree D:/projetos/synkroo/.worktrees/financeiro-verify-clean-2
HEAD 7646c778a75eec8db9726b08f880146a39b85c17
branch refs/heads/financeiro-verify-clean-2

worktree D:/projetos/synkroo/.worktrees/financeiro-verify-clean-3
HEAD 323ec865b833233c71e988fc31a9b11d17305cee
branch refs/heads/financeiro-verify-clean-3

worktree D:/projetos/synkroo/.worktrees/fix-agent-messages-route-drizzle
HEAD 9b278fce8c59c9b8c331440d867a53bdb8013895
branch refs/heads/fix/agent-messages-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-agent-queue-repo-drizzle
HEAD 620a58031273165c3e9a85c16f78518f1664a92d
branch refs/heads/fix/agent-queue-repo-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-analytics-service-drizzle
HEAD a5bd4d334abf6859d2cd46acfe634b11d24bc145
branch refs/heads/fix/analytics-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-appointment-serializer
HEAD 7f20fb393ed9f236d7ddd8f5fcfea7e87862ed72
branch refs/heads/fix/appointment-serializer

worktree D:/projetos/synkroo/.worktrees/fix-asaas-client
HEAD 389eceb12d64dfd75bf346adb5815a68aaf094ea
branch refs/heads/fix/asaas-client-webhook-encryption

worktree D:/projetos/synkroo/.worktrees/fix-attendance-metrics-drizzle
HEAD bfc40a592e7c124cf3982accda9027042bcc07e4
branch refs/heads/fix/attendance-metrics-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-budgets-accept-reject-drizzle
HEAD 9d09abc7a2d770c2da094c0dc991d9ca234fc25a
branch refs/heads/fix/budgets-accept-reject-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-budgets-id-route-drizzle
HEAD b1a9b668cfd7ce248fa1ec7d3b5ae973946c6396
branch refs/heads/fix/budgets-id-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-budgets-root-route-drizzle
HEAD 4f05a1e5511874038f52981242a2eb3a5040a0dd
branch refs/heads/fix/budgets-root-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-campaign-segments-preview-drizzle
HEAD 3966f75c016c0e881b34534486fc8720667d55a7
branch refs/heads/fix/campaign-segments-preview-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-campaigns-recipients-route-drizzle
HEAD 6840d393a21a1e787f8fe5ff682c8bae435cf500
branch refs/heads/fix/campaigns-recipients-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-campaigns-start-route-drizzle
HEAD 5422b217631b1ff7a52169749aa19178a311092f
branch refs/heads/fix/campaigns-start-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-consents-service-drizzle
HEAD 364d1857a3ccc94b93aef6017dddd2bbdae2464d
branch refs/heads/fix/consents-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-contacts-appointments-route-drizzle
HEAD b20319fc20be3e85630a472dffcfdd92d57ad9ea
branch refs/heads/fix/contacts-appointments-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-contacts-service-drizzle
HEAD e4958a78f117b73a0987280f79989ac57055bc61
branch refs/heads/fix/contacts-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-contacts-timeline-drizzle
HEAD 38497ce108e50d11138f83234d42a284b43a0c42
branch refs/heads/fix/contacts-timeline-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-custom-fields-drizzle
HEAD f279c2b61ce511d10a02599644ee4a316c513098
branch refs/heads/fix/custom-fields-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-dashboard-alerts-drizzle
HEAD d2d26c27a25202fc9f50506289743e5bedeee695
branch refs/heads/fix/dashboard-alerts-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-dashboard-stats-drizzle
HEAD 6457f4e5aa4cdaf37eef229ca4aa959c643a639d
branch refs/heads/fix/dashboard-stats-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-decision-log-service-drizzle
HEAD ddd2ca8c718f0b456854ec6be95d4afdb926ea25
branch refs/heads/fix/decision-log-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-drizzle-schema-unblock-batch1
HEAD c02f16cc3a7ff1e5c2dadd69038051b533e94524
branch refs/heads/fix/drizzle-schema-unblock-batch1

worktree D:/projetos/synkroo/.worktrees/fix-financial-reports-drizzle
HEAD 10dbae8bdf38a64cb2d199e9bc4618200dc25cd1
branch refs/heads/fix/financial-reports-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-followup-service-drizzle
HEAD fd57f052ad19938e1ac281f9b6cf17f54cf68a4e
branch refs/heads/fix/followup-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-health-routes-drizzle
HEAD 93ed452fad0c609f08e2df328cacc4cc6984afb5
branch refs/heads/fix/health-routes-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-inactive-patients-drizzle
HEAD 70f65b8872154e478844690a8ece9cc693fc3062
branch refs/heads/fix/inactive-patients-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-installments
HEAD 11458cf9824515fffc0d103ddd3cbdb70bd31946
branch refs/heads/fix/financeiro-installments

worktree D:/projetos/synkroo/.worktrees/fix-installments-service-drizzle
HEAD 5912172627019f1d59866650fa5afa95fc7cadc6
branch refs/heads/fix/installments-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-knowledge-categories-route-drizzle
HEAD 78435ca817a5a1efb40c0644f5b8bf9e72d7e5e0
branch refs/heads/fix/knowledge-categories-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-knowledge-id-route-drizzle
HEAD 1eb1efc283bb1aea83b86ada3c738cda73587f7e
branch refs/heads/fix/knowledge-id-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-knowledge-root-route-drizzle
HEAD 6697cdeab9f1b0814e59750d5500494141e1f0db
branch refs/heads/fix/knowledge-root-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-knowledge-search-route-drizzle
HEAD cd23da927cf2d53a58e3f97a6d27fb7adbdd8e4e
branch refs/heads/fix/knowledge-search-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-l4-conversation-drizzle
HEAD 0295b6d30a5d4a1d772a236000b05dd4d0d415f8
branch refs/heads/fix/l4-conversation-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-leads-convert-route-drizzle
HEAD 56ed3eb29703d5aa9c84d5a59e2378261b6d22e3
branch refs/heads/fix/leads-convert-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-leads-id-route-drizzle
HEAD 42363acc933844eb1dcb4bd2b36870a572895114
branch refs/heads/fix/leads-id-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-leads-kanban-route-drizzle
HEAD 29c1086b38729f339c5d83eb9850458938743795
branch refs/heads/fix/leads-kanban-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-leads-stage-route-drizzle
HEAD 8d5102e69a7278273f5422c4815390d6d1cfabd9
branch refs/heads/fix/leads-stage-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-lgpd-export-route-drizzle
HEAD 0ef34f32fc869caff4943712552c90f2316fddc1
branch refs/heads/fix/lgpd-export-route-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-lgpd-routes-drizzle
HEAD b2620899300a97f3c1388dc8c33a68696bf52c98
branch refs/heads/fix/lgpd-routes-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-lgpd-routes-final
HEAD 3d4e0c22ca9d71d2f650a05ce566c82354619aa5
branch refs/heads/fix/lgpd-routes-final

worktree D:/projetos/synkroo/.worktrees/fix-noshow-prediction-drizzle
HEAD c10247cd2c150d9a579540d85b6d715a7cd776c3
branch refs/heads/fix/noshow-prediction-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-noshow-prediction-test
HEAD c6df88ddc3e5a99004567224adf36c3b2f6c6271
branch refs/heads/fix/noshow-prediction-test

worktree D:/projetos/synkroo/.worktrees/fix-noshow-service
HEAD 01297cf3c7c0d01a6258792bbb623a45f402d231
branch refs/heads/fix/noshow-service

worktree D:/projetos/synkroo/.worktrees/fix-patient-registration-drizzle
HEAD fe31c6464ac4848bb0ed999831ce26f36fefd605
branch refs/heads/fix/patient-registration-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-pending-actions-drizzle
HEAD a0521262970284aa35dbdc3ce622327f9ff4af96
branch refs/heads/fix/pending-actions-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-pipeline-analytics-drizzle
HEAD dbad6b995b425e14a7df6f0a4ef971d98e19b09b
branch refs/heads/fix/pipeline-analytics-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-pipeline-analytics-route-auth
HEAD d6a034a68e91b2d00f85a236eca3afe07ee50a75
branch refs/heads/fix/pipeline-analytics-route-auth

worktree D:/projetos/synkroo/.worktrees/fix-pipeline-stages-drizzle
HEAD bf407522b0b6ff18ff05e310d986e095469098ae
branch refs/heads/fix/pipeline-stages-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-pipeline-stages-routes-auth
HEAD 5a8b1bd3745d1c3d8ecdaedb5d02056d578cd703
branch refs/heads/fix/pipeline-stages-routes-auth

worktree D:/projetos/synkroo/.worktrees/fix-procedure-reminder-config-drizzle
HEAD 7e4388bfdd953f65ca275d7b2a0df9c2c1f27cb9
branch refs/heads/fix/procedure-reminder-config-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-rbac-read-routes
HEAD 44eba6a5752aade0d3c12b48ec5926b8eb506a6a
branch refs/heads/fix/financeiro-rbac-read-routes

worktree D:/projetos/synkroo/.worktrees/fix-reminder-send-cancel
HEAD a9689f2c7c9b483b8ba79f1b53ee0f7c2a7680d7
branch refs/heads/fix/financeiro-reminder-send-cancel

worktree D:/projetos/synkroo/.worktrees/fix-reports-patients-drizzle
HEAD 0f125d34c8017ea7ac3ac9389bf8a4373574c123
branch refs/heads/fix/reports-patients-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-router-tools-drizzle
HEAD 0b6c3b37e1aa070d287bb40b69371e9fce2f34f4
branch refs/heads/fix/router-tools-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-sales-tools-drizzle
HEAD 429e457777e46461237003b50c711f2e38ffd145
branch refs/heads/fix/sales-tools-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-scheduler-tools-drizzle
HEAD 3eea5cd647a9fefcf4afded15621b7035d1e7150
branch refs/heads/fix/scheduler-tools-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-segmentation-service-drizzle
HEAD c02f16cc3a7ff1e5c2dadd69038051b533e94524
branch refs/heads/fix/segmentation-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-segmentation-service-drizzle-v2
HEAD 5001825686ea218ef216dab057a74edf074a9138
branch refs/heads/fix/segmentation-service-drizzle-v2

worktree D:/projetos/synkroo/.worktrees/fix-smart-triggers-service-drizzle
HEAD e86145549a4b97db6d9a67ecdab71003ff24246a
branch refs/heads/fix/smart-triggers-service-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-total-value-segmentation
HEAD 3a197125dda4fb96a54ae6341ced350257ae8890
branch refs/heads/fix/total-value-segmentation

worktree D:/projetos/synkroo/.worktrees/fix-treatment-plan-sessions-drizzle
HEAD 87146a1dbe9da1b8dc7d4989e8d5f6b5fadd25dd
branch refs/heads/fix/treatment-plan-sessions-drizzle

worktree D:/projetos/synkroo/.worktrees/fix-typecheck-errors
HEAD 86a9c305ae89caa95ffcccfdca1b102cc6fcd964
branch refs/heads/fix/typecheck-errors

worktree D:/projetos/synkroo/.worktrees/fix-waitlist-drizzle
HEAD 2b575fad791d44650f96c8a73cbfda36815ff653
branch refs/heads/fix/waitlist-drizzle

worktree D:/projetos/synkroo/.worktrees/migrate-scheduler
HEAD 16c6f85b59b69dc8c0790b8e713cc49e7d6cf07d
branch refs/heads/migrate-scheduler

worktree D:/projetos/synkroo/.worktrees/restore-patient-history-tests
HEAD 16c6f85b59b69dc8c0790b8e713cc49e7d6cf07d
branch refs/heads/restore-patient-history-tests

worktree D:/projetos/synkroo/.worktrees/schema-drift-recovery
HEAD a3834d53ec8f31764c25e8c58e5cadb50b9fdc76
branch refs/heads/fix/schema-drift-recovery

worktree D:/projetos/synkroo/.worktrees/security-integrity-hardening
HEAD 551427dbb28785764bd0bea6b1ee0a0d5fb6dc4f
branch refs/heads/fix/security-integrity-hardening

worktree D:/projetos/synkroo/.worktrees/seed-local-scale
HEAD 009f11e1ea6aaa1eae17dc6982cbee75c388b2ee
branch refs/heads/feat/seed-local-scale

worktree D:/projetos/synkroo/.worktrees/spike-ia-agente-referencia
HEAD c9b517880b46bbbbdfc7d91b9c3ab5ce88a88e32
branch refs/heads/spike/ia-agente-referencia

worktree D:/projetos/synkroo/.worktrees/spike-ia-agente-viabilidade
HEAD fcb260fcf5f2070d1e0941d5cd2e563e40794450
branch refs/heads/spike/ia-agente-viabilidade

worktree D:/projetos/synkroo/.worktrees/t2-rebaseline-migrations
HEAD 746085233d76c3c869460592431d5b637a6a4aac
branch refs/heads/fix/t2-rebaseline-migrations

worktree D:/projetos/synkroo-instagram-sec
HEAD 7618366e1d8abfdd6561f54120a187862a6c7ffd
branch refs/heads/fix/instagram-webhook-raw-bytes

worktree D:/projetos/synkroo-spike-cf
HEAD 1550e758645c151e93d258e163ef32944c9f0e8c
branch refs/heads/spike/cf-runtime
```

## Metadata

- **Timestamp**: 2026-07-23 (pre-consolidation snapshot)
- **Worktree count**: 95
- **Active branch**: chore/atendimento-eixo2-implementation (root checkout)
- **Remote**: origin → https://github.com/kust-projetos/synkroo.git
- **Dirty worktrees (root)**: 6 modified + 2 untracked
- **No secrets captured**: only public refs, commit hashes, and paths
