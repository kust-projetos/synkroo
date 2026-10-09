# Synkroo vNext — E5/P4-P6 plano incremental do Control Plane

**Data:** 2026-10-09  
**Status:** PROPOSED — planejamento/documentação apenas; nenhuma implementação ou autonomia autorizada.  
**Base de código:** E3 mergeado (`d9f4d51a`); candidato E4 `87210fd1` ainda depende da CI/merge do PR #39.  
**Referências canônicas:** SPEC vNext 2026-10-05; master PLAN 2026-10-05; ADR-BASE-18, ADR-VNEXT-01, ADR-BASE-20; auditorias E0/E2 de 2026-10-08.

## 1. Objetivo e limites

Preparar tranches pequenas para reconciliar o Control Plane (P4), estabelecer policy observável e gates de autonomia (P5) e só então provar workflows golden (P6). O inventário abaixo descreve evidência no código, não readiness operacional.

**Não fazer nesta proposta:** ativar autonomia, expandir `AGENT_SAFE_ACTIONS` (permanece em 8 nomes), mudar comportamento de cancelamento sem decisão de produto, enviar mensagens reais, migrar/deletar tabelas legadas, aplicar migrations em produção, habilitar Policy Engine em produção, ou declarar P3/P4/P5/P6 CLOSED.

## 2. Baseline factual das oito entidades

| Entidade ADR-BASE-18 | Persistência / writers e readers atuais | Tenant / policy / idempotência / retenção | Estado observado |
|---|---|---|---|
| **BusinessEvent** | Sem tabela/evento de domínio canônico. `outbox_jobs` (`src/core/schema/infra.ts`, `src/lib/outbox/operations.ts`) é transporte vivo; `logAppointmentStatusTransition` (`src/modules/operacional/services/status-transition-logger.ts`) não tem caller. | Outbox tem `clinicId`, FK e unique `(clinic, operation, businessKey)`; retenção/dead-letter conforme handlers. Nenhum evento `appointment.cancelled` registrado. | **AUSENTE** como entidade de Control Plane. Reutilizar outbox como transporte, sem confundi-lo com catálogo de eventos.
| **Goal** | Nenhuma tabela/writer/reader de runtime. | N/A. | **AUSENTE**.
| **AgentRun** | `agent_logs`/`decision_logs` são estruturas legadas; writers de runtime não confirmados. Leitores incluem LGPD e analytics (`src/services/analytics/attendance-metrics.service.ts`). | `agent_logs.clinicId` sem FK; `decision_logs` com vínculo tenant. Retenção explícita não identificada. | **AUSENTE/PARCIAL legado**; preservar leitores e exportação LGPD.
| **ActionAttempt** | `action_logs`; E3 `beginActionAttempt`/`finalizeActionAttempt` em `src/core/actions/audit-writer.ts`, chamados por `runAction` só para `consequential:true` (hoje `atendimento.enviarMensagemDireta`). | `clinic_id` nullable por eventos pré-auth; E3 grava decision/version e begin antes do efeito; idempotency fingerprint apenas quando declarado; job de retenção não identificado. | **PARCIAL**. E4 adiciona `dispatching`/`unknown` terminal no ledger idempotente; não equivale a Outcome.
| **PolicyDecision** | Sem tabela própria; `action_logs.decision/policy_version` e `evaluatePolicy` (`src/core/actions/approval.ts`). | Tenant vem do contexto; E3 DENY absoluto não elevável; allowlist IA segue em 8. Razão/version por tenant e trilha completa não estão persistidas para todas as Actions. | **PARCIAL**.
| **Outcome** | Sem tabela/writer; `runAction` não verifica pós-condição do negócio. | N/A; retorno do handler não é verificação independente. | **AUSENTE**.
| **Exception** | Sem entidade/writer; `agent_queue`/`agent_dlq` legadas sem writer confirmado. | Legado sem `clinicId`; varredura LGPD atual é global. | **AUSENTE**; qualquer absorção exige tenant + LGPD antes de migração.
| **Approval** | `approval_tokens` (0035); `issueApprovalToken`/`consumeApprovalToken` em `src/core/actions/approval.ts`. `pending_actions` é legado sem writer de runtime. | Binding action/input hash/clinic/actor/source/identidades; TTL 15 min; consumo single-use atômico; lazy purge. A identidade/permission do aprovador humano não está modelada como entidade. | **PARCIAL (S5/E3)**; tokens não elevam DENY.

**Validação necessária antes de executar cada tranche:** confrontar esta matriz novamente com `src/lib/db/schema`, migrations, callers/writers, exportação LGPD e testes no HEAD aprovado. Este snapshot não é autoridade sobre runtime.

## 3. Tranches e gates

### E5-A / P4 foundation — modelo mínimo e writers sem autonomia

**Pré-requisitos:** E4 CI/merge verdes; decisões abertas §5 resolvidas; migração ensaiada em DB isolado; estratégia de retenção/LGPD e recovery aprovada.

1. Comparar estruturas legadas (`pending_actions`, `decision_logs`, `agent_logs`, `agent_queue`, `agent_dlq`, `smart_trigger_log`) com ADR-BASE-18 e consumidores reais. Não remover/renomear dados nem readers nesta tranche.
2. Escolher uma representação canônica para **Goal** (identidade/versão/estado, tenant, criação e leitura) e Run/Attempt/Decision/Outcome/Exception/Approval. Goal deve correlacionar explicitamente `AgentRun` e BusinessEvent; não inferir Goal do texto do LLM. Preferir extensão/reuso apenas se consultas, tenant, retenção e compatibilidade forem demonstráveis; tabelas novas só com decisão documentada e plano de convivência.
3. Implementar writers server-side com tenant derivado do contexto autenticado. Feature flags permanecem **OFF**; nenhum writer deve invocar LLM ou executar workflow automaticamente.
4. Reusar `outbox_jobs` para publicação somente após definir o envelope do evento, chave de idempotência, tenant e política de retry/dead-letter. Eventos não carregam PHI desnecessária.
5. Adicionar verificação de pós-condição tipada no backend antes de registrar Outcome `succeeded`; afirmação do handler/LLM não é prova.

**Aceite E5-A:** migration aditiva testada from-zero e expand/contract; writers/readers listados para cada entidade ativa (incluindo Goal) e vínculo Goal↔Run↔Event definido; negativos cross-tenant; idempotência/replay; sanitização/retention; exportação LGPD preservada; rollback por forward-fix/restore documentado; CI full green no HEAD final. Sem mudança de comportamento de usuário nem autonomia.

### E5-B / P4 golden-flow proof — cancelamento e waitlist sem mensagem

**Bloqueio de produto:** o comportamento atual de `cancelarConsulta` libera/cancela a entrada de waitlist (`scheduling-service.ts`), enquanto o exemplo ADR deseja preencher a vaga. Não trocar essa semântica sem decisão explícita.

Após essa decisão e E5-A:

1. Emitir evento `appointment.cancelled` somente após transição confirmada e tenant-scoped; outbox transacional ou mecanismo equivalente, sem `catch {}` que oculte falha.
2. Executar `preencherWaitlist` por rota autenticada iniciada por humano, ou serviço interno com identidade/service-principal explicitamente autorizada. Um consumidor de evento **não pode forjar `source='user'`**. Preservar RBAC/tenant e idempotência do repositório. Não adicionar a Action à allowlist IA.
3. Verificar independentemente consulta/agendamento + vínculo da entrada waitlist, usando estado persistido (não retorno declarado pelo handler).
4. Registrar Outcome (`succeeded`, `failed`, `unknown`) ligado ao evento/run/attempt; ambiguidades ficam para reconciliação, sem retry cego.
5. O fluxo de prova não envia WhatsApp/SMS/email. Notificações ficam fora do golden-flow inicial.

**Aceite E5-B:** testes DB-real concorrentes/replay; tenant isolation; cancel duplicado; waitlist vazia/conflitante; falha entre evento e fill; timeout/resultado ambíguo; pós-condição verdadeira/falsa; nenhuma comunicação externa; Outcome auditável.

### E5-C / P4 Exception + Approval persistentes

Modelar `Exception` e aprovação humana com tenant obrigatório, ator/aprovador e permission key, escopo do payload, TTL, single-use, resultado e trilha LGPD. Reconciliar `approval_tokens`/`pending_actions` antes de criar novo store. **DENY permanece absoluto**; APPROVAL é classe distinta e não permite elevar DENY. Definir operador/permission autorizado e recuperação de token consumido sem execução.

**Aceite E5-C:** concorrência DB-real (um consumidor), replay, expiração, binding por principal/tenant/ação/input, DB-down fail-closed, autorização do aprovador e sanitização. Nenhuma classe produtiva é reclassificada automaticamente.

### P5 policy profiles — somente OBSERVE até gate humano

Depois de E5-A, E5-B e E5-C — com writers/readers das oito entidades demonstrados — introduzir profiles AUTO/CONFIRM/APPROVAL/DENY como decisão versionada e auditável, inicialmente em modo **OBSERVE** (não altera execução). Comparar decisão observada com gates E3 + allowlist de 8; discrepância é telemetria, não autorização. Definir kill switch global/tenant/domínio, limites e reversibilidade antes de `ASSIST` ou `AUTO_LIMITED`. O trabalho preparatório de desenho/evals offline pode ocorrer antes, mas não adicionar engine/runtime gate nesta fase.

**Aceite P5-OBSERVE:** E5-A/B/C fechadas; avaliação offline + replay de eventos anonimizados; zero aumento de ações alcançáveis; deny-by-default; testes de precedência; kill switch validado em staging; owner aprova separadamente qualquer transição além de OFF/OBSERVE. Não ativar AUTO nesta proposta.

### P6 golden workflows / expansão gradual

Somente após P4/P5 gates e staging aprovado. Cada workflow tem contrato de entrada, policy profile, pré-condição, pós-condição verificada, idempotência, orçamento, kill switch, métricas e rollback. Abrir uma tranche por workflow; autorização específica antes de ações externas ou autonomia. O fluxo waitlist de E5-B é candidato, não promessa de closure.

## 4. Testes e quality gates por tranche

- Typecheck app + IA Bridge + IA Agent; lint; unit/contract; security-negative/tenant; mutation relevante quando a lógica permitir.
- PostgreSQL real isolado + migrations-from-zero; concorrência/replay; restore rehearsal para qualquer dado persistente novo.
- Gitleaks, audit HIGH=0, build, E2E e CF build/dry-run conforme superfície alterada; `SKIPPED` não equivale a PASS.
- Reviewer funcional + Security Reviewer para auth/approval/tenant/PII; sem review apenas baseado em código verde.
- Nenhum teste usa clínica real, envia mensagem ou acessa produção. Evidência associada ao SHA exato.

## 5. Decisões necessárias do owner antes de implementação

1. **Representação canônica:** novas tabelas vs extensão/reuso de `action_logs` e estruturas legadas para Run/Attempt/Decision/Outcome; critérios: queries, integridade tenant, retenção, migração e convivência.
2. **Legado:** destino de `pending_actions`, `decision_logs`, `smart_trigger_log`, `agent_logs`, `agent_queue` e `agent_dlq`. Preservar readers analytics/LGPD até substituição verificada.
3. **Semântica de cancelamento:** cancel atual da waitlist vs preencher vaga automaticamente após `appointment.cancelled`.
4. **Pós-condição:** contrato tipado e owner por domínio para provar resultado; não inferir de `ActionResult.ok`.
5. **Retenção/LGPD:** prazo/anonimização para attempts, events, exceptions, approvals e logs; exclusão/exportação tenant-scoped.
6. **Aprovador:** papéis/permissões autorizados, delegação, revogação, TTL e resolução após token consumido sem efeito.
7. **Policy observability:** campos e retenção para policyVersion/reason/outcome; manter PII mínima.
8. **ADR-BASE-19:** `/api/budgets/[id]/send` permanece exceção congelada; confirmar que nenhum golden workflow depende dele.

Sem as decisões aplicáveis, manter a tranche correspondente **BLOCKED** e entregar evidência/alternativas; não escolher defaults de produto por inferência técnica.

## 6. Riscos, rollback e estados permitidos

- **Tenant/LGPD:** nenhuma estrutura nova sem tenant derivado, exportação e retenção definidas.
- **Duplicate side effects:** `unknown`/`dispatching` requer reconciliação manual; nunca converter em sucesso nem reexecutar por TTL. Crash após armamento pode bloquear chave sem envio confirmado.
- **Migração:** aditiva, rehearsal, backup/restore e plano de forward-fix; migrations produtivas exigem aprovação operacional separada.
- **Policy/autonomia:** rollout começa OFF; modo OBSERVE não executa Actions; qualquer avanço exige go/no-go independente.
- **P3/WAHA:** candidato de deploy não significa instalado, sessão restaurável, canary ou cutover.
- Estados possíveis neste documento: **PROPOSED**, **READY FOR IMPLEMENTATION** quando todas as decisões/precondições da tranche estiverem fechadas, **BLOCKED** para decisão pendente. Nunca `DONE`, `P4/P5/P6 CLOSED` ou `PRODUCTION READY` por associação.

## 7. Próximo passo verificável

1. Aguardar E4 PR/CI no HEAD final; reconciliar os gates e, se verde, fechar PR #29 como incorporado sem merge cego.
2. Solicitar decisões §5 apenas quando o owner iniciar E5-A/B/C; até lá este plano é backlog executável com bloqueios explícitos.
3. Atualizar roadmap/ledger somente com estado comprovado por PR/HEAD e gates do runtime; documentação E0/E2 não altera status operacional P2 ou P3.
