# ADR-VNEXT-01: AI Control Plane — eventos, runs, policy e outcomes

**Status:** ✅ Aceito (direção); implementação em fases (P4+)
**Data:** 2026-10-05
**Spec:** `docs/superpowers/specs/2026-10-05-synkroo-vnext-ai-native-business-os-design.md` (§6, §7, §10)
**Plano:** `docs/superpowers/plans/2026-10-05-synkroo-vnext-ai-native-business-os-implementation.md` (§6, §7)
**Baseline auditada:** P0 — `docs/audit/2026-10-05-vnext-p0-baseline.md`

## Contexto

O agente hoje opera com deny-by-default e allowlist literal de 8 actions (`src/core/agent-bridge/tool-policy.ts`), escala `SecurityLevel` (`livre|confirmacao|verificacao_forte|proibido`) e confirmação em DO storage (`pendingAction`, single-slot por conversa). Não existe: evento de negócio normalizado, objetivo (Goal), run persistido, verificação de pós-condição, outcome de negócio, exceção/aprovação persistentes.

Scaffold relevante já existe e está **morto** (sem writer em runtime):

- `pending_actions` / `decision_logs` (`src/modules/ia/schema/agent.ts`) — colunas ricas (`riskScore`, `undoPayload`, `undoDeadline`, `escalationTriggered`), único leitor é LGPD; único writer é seed.
- `smart_trigger_log` — trigger retirado (`/api/cron/smart-triggers` → 410).
- `agent_queue` / `agent_dlq` — definidas no Drizzle e migrations, sem writer.
- Outbox Postgres (`outbox_jobs`) — vivo, com fingerprint/result_ref e 7 handlers.

## Decisão

1. O AI Control Plane será modelado sobre: **BusinessEvent → Goal → AgentRun → Plan → PolicyDecision → ActionAttempt → ActionResult → verificação de pós-condição → Outcome**, com **Exception** e **Approval** como caminhos de escala humana.
2. **Reutilizar/migrar conscientemente** as estruturas existentes antes de criar tabelas novas: `pending_actions`/`decision_logs` (candidatas a tornar-se `action_attempts`/`policy_decisions` ou a ganhar writers reais), `outbox_jobs` como transporte de BusinessEvent (padrão outbox já validado), `agent_queue`/`agent_dlq` só se o outbox não cobrir. `smart_trigger_log` não será reativado como conceito separado.
3. **Nenhuma ação consequencial é concluída pela afirmação do LLM**: pós-condição verificável no backend é pré-requisito de outcome `succeeded`.
4. Policy Engine (P5) substituirá a allowlist literal por classificação granular **AUTO/CONFIRM/APPROVAL/DENY** por action, tenant, valor, audiência, reversibilidade, risco e policyVersion — **sem reduzir segurança**: deny-by-default permanece; allowlist atual vira fallback conservador durante a transição; `proibido` permanece default para o desconhecido.
5. Os bypasses latentes `agentToolsFor` e `buildToolCatalog` só podem existir expostos com o gate `isAgentSafeAction` aplicado.
6. Rollout de autonomia por domínio: `OFF → OBSERVE → ASSIST → AUTO_LIMITED → AUTO`, com kill switch global/tenant/domínio.
7. Primeiro fluxo de prova (P4): `appointment.cancelled → BusinessEvent → Goal fill_slot → waitlist → Policy → Action → verificar agenda → Outcome`.

## Alternativas consideradas

- **Criar tabelas novas limpas descartando as existentes** — rejeitado: duplicaria conceitos (gate P0: uma fonte canônica por conceito) e desperdiçaria o design já validado de idempotência.
- **Manter confirmação apenas em DO storage** — rejeitado como estado único: DO storage é volátil e single-slot; supervisão humana (exceptions/approvals) exige estado consultável no Postgres. DO storage permanece para o turno quente.
- **Usar Cloudflare Queues como transporte de eventos** — adiado: o outbox Postgres transacional já é robusto e auditável; Queues exige reavaliar DLQ/garantias. Decisão por evidência em P4.

## Consequências

- P4 começa com reconciliação de esquema (migrations aditivas), writers reais e leitura no Control Center (P8).
- Cada Action consequencial ganhará metadata de risco (inventário P0 é a base).
- Evals devem cobrir: ação correta, recusa correta e escalação correta — não apenas "respondeu bem".
- Telemetria de outcome (não só tokens/tools) passa a ser métrica de primeira classe.

## Rollback

Migrations aditivas; feature flags de autonomia por domínio permitem retornar a `OFF` sem remoção de código. A allowlist literal permanece no código como fallback durante toda a transição.
