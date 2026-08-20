# Synkroo Roadmap 143 Wave 3 Channels and AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verificar F6–F7 com canais transacionais, IA fail-closed, conhecimento pgvector, sidecar isolado e jobs Queue/DLQ consentidos.

**Architecture:** Mensagens entram por um pipeline único; app chama bridge; bridge aplica tool policy e DB; agent DO mantém conversa versionada. Side effects externos passam por outbox/Queue; sidecar é pacote Node separado, default off e sem fallback automático.

**Tech Stack:** Evolution API, Cloudflare Workers/Hyperdrive/Queues/Durable Objects, LLM factory, pgvector, Playwright sidecar, Jest/Playwright.

**Agent Orchestration:** Hierarchical — contratos e decisões seriais; knowledge, sidecar e campaign consumers paralelos após contratos.

---

## Ownership

| Goal | IDs | Dependências |
|---|---|---|
| O3-G01 message-transaction | F6.01 | Gate 1 |
| O3-G02 evolution-widget | F6.02–F6.03 | O3-G01/O2-G01 |
| O3-G03 agent-smoke-decision | F6.04–F6.05 | O3-G01/O1-G11 |
| O3-G04 llm-embedding | F6.06, F6.09 | O3-G03 |
| O3-G05 risk-safety | F6.07–F6.08 | O3-G03/O3-G04 |
| O3-G06 knowledge-pgvector | F6.10–F6.11 | O3-G04/O1-G07 |
| O3-G07 do-lifecycle | F6.12 | O3-G03/O3-G05 |
| O3-G08 sidecar | F6.13–F6.15 | O3-G02/O3-G05 |
| O3-G09 followup-jobs | F7.01–F7.04 | O1-G09/O3-G02 |
| O3-G10 campaign-dlq-consent | F7.05–F7.08 | O3-G09 |

## Task 1: O3-G01 — Atomic message and conversation persistence

**Files:**
- Modify: `src/modules/atendimento/`
- Modify: `src/services/whatsapp/`
- Modify: message/conversation schema and migrations
- Modify: inbound/send integration tests
- Create: `docs/superpowers/audits/o3-g01-message-transaction.md`

- [ ] **Step 1: RED PostgreSQL matrix**

Test duplicate external message ID, concurrent same event, same provider ID in different registered channel, conversation create/update failure and transaction rollback. Assert one message, one conversation update and tenant derivation from registered channel.

- [ ] **Step 2: Run RED**

```bash
npm run test:integration:run
```

Expected: missing uniqueness/atomic cases fail and name the violated invariant.

- [ ] **Step 3: Implement DB authority**

Add tenant/channel-scoped external-ID constraint. Inbound transaction resolves channel→clinic, inserts idempotently and updates/creates conversation; no public payload chooses clinic.

- [ ] **Step 4: GREEN twice**

```bash
npm run test:integration:run
npm run test:integration:run
```

Expected: deterministic one-effect result.

- [ ] **Step 5: Commit**

```bash
git add src/modules/atendimento src/services/whatsapp src/lib/db docs/superpowers/audits/o3-g01-message-transaction.md
git commit -m "feat(messages): persist inbound events atomically"
```

## Task 2: O3-G02 — Evolution and widget contracts

**Files:**
- Modify: `src/modules/atendimento/services/channel-service.ts`
- Modify: `src/modules/atendimento/services/send-message-service.ts`
- Modify: Evolution adapter/webhook code
- Modify: chat widget API/component
- Modify: webhook gate/integration tests
- Create: `docs/superpowers/audits/o3-g02-evolution-widget.md`

- [ ] **Step 1: RED provider contracts**

Evolution cases: valid inbound/outbound, timeout, 429/5xx, invalid credential, replay inside/outside window, wrong instance/channel and provider unavailable. Widget cases: same persistence pipeline, distributed rate limit and tenant binding.

- [ ] **Step 2: Run RED**

```bash
npm run test:security:integration
npm run test:integration:run
npx jest src/modules/atendimento/services/__tests__/channel.test.ts --runInBand
```

- [ ] **Step 3: Remove duplicate dispatch seam**

Keep one public channel service. Evolution uses adapter with timeout and Zod response contract. Instagram remains outside v1 and fails closed; it does not create successful delivery state.

- [ ] **Step 4: Run GREEN and widget E2E**

```bash
npm run test:security:integration
npm run test:integration:run
npm run test:e2e:production -- e2e/chat-widget.spec.ts e2e/conversations.spec.ts
```

- [ ] **Step 5: Emit gate O3-X01**

Provide sandbox instance, secret names, webhook registration, replay/timeout probes, rollback and expected sanitized request IDs. Real provider evidence is required for F6.02.

- [ ] **Step 6: Commit**

```bash
git add src/modules/atendimento src/services/whatsapp src/app/api src/components e2e/chat-widget.spec.ts e2e/conversations.spec.ts docs/superpowers/audits/o3-g02-evolution-widget.md
git commit -m "feat(channels): unify Evolution and widget pipeline"
```

Stage only channel/widget API and component paths shown by `git diff --name-only`.

## Task 3: O3-G03 — App/bridge/agent smoke and DO decision

**Files:**
- Modify: `src/workers/ia-bridge/`
- Modify: `src/workers/ia-agent/`
- Modify: app agent client/service
- Create: `docs/adr/adr-agent-runtime-do.md`
- Create: `docs/superpowers/audits/o3-g03-agent-smoke.md`
- Modify: `scripts/smoke-staging.mjs`

- [ ] **Step 1: Add local end-to-end smoke**

Start app/bridge/agent locally; send one read-only registered tool request; assert correlation ID across hops, tenant context, DB read and response. Add bridge down, agent down and DB down cases.

- [ ] **Step 2: Run smoke**

```bash
npm run build:cf
node scripts/smoke-staging.mjs --local
```

Expected: raw Durable Object flow either passes all cases or produces a reproducible failure with latency/error evidence.

- [ ] **Step 3: Decide runtime**

If raw DO passes, ADR ratifies it and rejects migration. If it fails for an architectural limitation, run one bounded Agents SDK prototype with the same tool/DB/failure tests and compare complexity, latency, state migration and rollback. Close differences require R5 owner gate.

- [ ] **Step 4: Lock RPC contract**

Document request/response schema, version, timeout, retry ownership, idempotency and error codes. Cross-version unknown RPC fails closed.

- [ ] **Step 5: Commit**

```bash
git add src/workers src/services scripts/smoke-staging.mjs docs/adr/adr-agent-runtime-do.md docs/superpowers/audits/o3-g03-agent-smoke.md
git commit -m "docs(agent): ratify runtime from failure-mode smoke"
```

## Task 4: O3-G04 — LLM and embedding decision plus adapter

**Files:**
- Modify: `src/lib/llm/`
- Modify: bridge/agent LLM integration
- Create: `docs/adr/adr-llm-embedding.md`
- Create: provider contract tests
- Create: `docs/superpowers/audits/o3-g04-llm-adapter.md`

- [ ] **Step 1: Contract-test configured providers**

Tests cover MiniMax/OpenAI/OpenRouter factory selection, missing key, timeout, 429, invalid JSON/tool call, provider down, abort and context preservation. No test uses a real secret.

- [ ] **Step 2: Run RED**

```bash
npm test -- --runInBand src/lib/llm
```

Expected: unsupported failure cases expose current adapter gaps.

- [ ] **Step 3: Decide provider/embedding/dimension**

ADR records primary/fallback provider, exact embedding model and produced dimension verified from documentation/API response. pgvector is the sole v1 vector store; no ingestion starts before dimension is fixed.

- [ ] **Step 4: Implement fail-closed adapter**

Factory returns typed adapter; errors retain conversation context but never fabricate success/tool execution. Retry only safe read/generation requests and respects timeout budget.

- [ ] **Step 5: Run GREEN and sandbox gate**

```bash
npm test -- --runInBand src/lib/llm
npm run typecheck:ia-bridge
npm run typecheck:ia-agent
```

Emit O3-X02 for real provider smoke with model name, request ID, timeout/down probes and cost ceiling.

- [ ] **Step 6: Commit**

```bash
git add src/lib/llm src/workers docs/adr/adr-llm-embedding.md docs/superpowers/audits/o3-g04-llm-adapter.md
git commit -m "feat(llm): enforce provider and embedding contracts"
```

## Task 5: O3-G05 — R0–R3 proof and safety escalation

**Files:**
- Modify: `src/services/agent/`
- Modify: `src/services/agents/`
- Modify: tool registry/policy under `src/core/agent-bridge/`
- Modify: proof/pending-action schema and migrations
- Create: safety eval tests
- Create: `docs/superpowers/audits/o3-g05-agent-safety.md`

- [ ] **Step 1: RED risk matrix**

R0 read; R1 approved communication/note; R2 reversible appointment change with server proof; R3 money/delete/LGPD/access/merge with explicit approver. Test immutable payload hash, actor, conversation, Action, clinic, TTL, single use, replay, mutation after approval and concurrent consume.

- [ ] **Step 2: RED clinical-safety evals**

Messages containing symptom, diagnosis, medication or urgency must identify IA, avoid unapproved clinical advice, offer human takeover and execute configured escalation. Provider/bridge/DB down preserves context and fails closed.

- [ ] **Step 3: Run RED**

```bash
npm test -- --runInBand src/services/agent src/services/agents src/core/agent-bridge
npm run test:integration:run
```

- [ ] **Step 4: Implement proof state machine**

Create proof server-side from trusted context and normalized payload; approval stores immutable decision; transaction consumes proof once before Action. R3 checks approver permission at decision and execution.

- [ ] **Step 5: Run GREEN/adversarial twice**

Expected: replay/concurrent consume yields one effect; safety evals and outage cases pass twice.

- [ ] **Step 6: Commit**

```bash
git add src/services/agent src/services/agents src/core/agent-bridge src/lib/db docs/superpowers/audits/o3-g05-agent-safety.md
git commit -m "feat(agent): enforce risk proof and safety escalation"
```

## Task 6: O3-G06 — Knowledge lifecycle on pgvector

**Files:**
- Modify: `src/services/rag/`
- Modify: knowledge routes/services/repositories
- Modify: embedding schema/migrations
- Remove: v1 Vectorize binding/code after consumer proof
- Create: knowledge integration/eval tests
- Create: `docs/superpowers/audits/o3-g06-knowledge-pgvector.md`

- [ ] **Step 1: RED lifecycle tests**

Tenant-scoped CRUD, ingestion, chunking, fixed dimension, vector retrieval, re-embedding version, purge, foreign clinic rejection and deterministic eval set.

- [ ] **Step 2: RED dual-store absence test**

Architecture test rejects Vectorize binding/import in v1 runtime and requires pgvector repository as sole vector interface.

- [ ] **Step 3: Run RED**

```bash
npm test -- --runInBand src/services/rag
npm run test:integration:run
```

- [ ] **Step 4: Implement lifecycle**

Store model/version/dimension with embeddings; reject dimension mismatch; re-embedding writes new version before switch; purge removes chunks/embeddings tenant-scoped and auditable.

- [ ] **Step 5: GREEN and eval threshold**

Run fixed retrieval queries; record top-k expected document presence and latency. No provider result is hard-coded into tests.

- [ ] **Step 6: Commit**

```bash
git add src/services/rag src/app/api/knowledge src/lib/db wrangler.toml docs/superpowers/audits/o3-g06-knowledge-pgvector.md
git commit -m "feat(knowledge): consolidate lifecycle on pgvector"
```

## Task 7: O3-G07 — Durable Object state lifecycle

**Files:**
- Modify: `src/workers/ia-agent/`
- Create: DO state migration/version tests
- Create: `docs/superpowers/audits/o3-g07-do-lifecycle.md`

- [ ] **Step 1: RED version/recovery tests**

Cover old→new migration, unknown future version, retention expiry, purge, hibernation/restart, RPC version mismatch, duplicate turn and restore after failed provider call.

- [ ] **Step 2: Implement versioned envelope**

Persist schema version, conversation key, bounded context and timestamps. Migration is explicit/idempotent. Unknown version fails closed and preserves recoverable state.

- [ ] **Step 3: Run local workerd tests**

```bash
npm run typecheck:ia-agent
npm run build:cf
```

Run DO tests under local workerd; expected all lifecycle cases pass.

- [ ] **Step 4: Stage version-skew receipt**

Old app/new agent and new app/old agent contract probes become inputs to O5 rollout gate.

- [ ] **Step 5: Commit**

```bash
git add src/workers/ia-agent docs/superpowers/audits/o3-g07-do-lifecycle.md
git commit -m "feat(agent): version durable conversation state"
```

## Task 8: O3-G08 — Isolated Playwright sidecar

**Files:**
- Create: `packages/whatsapp-sidecar/package.json`
- Create: `packages/whatsapp-sidecar/src/`
- Create: `packages/whatsapp-sidecar/tests/`
- Create: sidecar deployment/runbook
- Modify: app channel adapter only at its interface
- Create: `docs/superpowers/audits/o3-g08-sidecar.md`

- [ ] **Step 1: RED security contracts**

Tests require default off, one session owner per clinic, encrypted session at rest, mTLS identity, HMAC body signature, nonce replay rejection, timestamp window, timeout, idempotency and egress allowlist.

- [ ] **Step 2: RED no-fallback contract**

When Evolution fails and sidecar is disabled, result is visible failure/queued retry; no automatic browser fallback starts.

- [ ] **Step 3: Implement minimal package**

Node process exposes only send/health/session lifecycle; browser never bundles into Worker. Secrets load from runtime, logs are redacted and shutdown closes browser/session handles.

- [ ] **Step 4: Run package tests and fault injection**

```bash
npm test --workspace packages/whatsapp-sidecar
```

Expected: auth/replay/idempotency/timeout/egress/default-off tests pass.

- [ ] **Step 5: Emit gate O3-X03**

Gate covers deployment host, certificate issuance, secret injection, egress DNS, encrypted storage, startup owner, outage/rollback and expected receipts.

- [ ] **Step 6: Commit**

```bash
git add packages/whatsapp-sidecar src docs/superpowers/audits/o3-g08-sidecar.md
git commit -m "feat(sidecar): deliver isolated browser channel"
```

Stage only the sidecar adapter paths under `src`.

## Task 9: O3-G09 — Idempotent follow-up job consumers

**Files:**
- Modify: reminder, follow-up, inactive and campaign job modules
- Modify: Queue/outbox consumers
- Modify: recipient resolver and Zod schemas
- Create: job consumer integration tests
- Create: `docs/superpowers/audits/o3-g09-followup-jobs.md`

- [ ] **Step 1: RED job matrix**

Each job: duplicate delivery, missing phone, null-incompatible input, provider timeout, crash after send, tenant mismatch and disabled module. Assert external call never occurs inline with scheduler transaction.

- [ ] **Step 2: Implement recipient-first outbox flow**

Resolve and validate phone before enqueue/dispatch; persist execution/idempotency state; consumers use O1 Queue primitives.

- [ ] **Step 3: Run GREEN**

```bash
npm run test:integration:run
npm test -- --runInBand src/services/reminders
```

- [ ] **Step 4: Commit**

```bash
git add src/services/reminders src/modules src/workers docs/superpowers/audits/o3-g09-followup-jobs.md
git commit -m "feat(followup): queue idempotent job consumers"
```

## Task 10: O3-G10 — Campaign state, DLQ and consent

**Files:**
- Modify: campaign services/repositories/schema
- Modify: Queue retry/DLQ consumer
- Modify: consent/opt-out services
- Modify: campaign integration/E2E specs
- Create: `docs/superpowers/audits/o3-g10-campaign-dlq-consent.md`

- [ ] **Step 1: RED state matrix**

Prove `draft→scheduled→running→partial|failed|completed`, cancellation rules, invalid transitions and 100% recipient failure→`failed`.

- [ ] **Step 2: RED retry/DLQ/consent cases**

Bounded exponential backoff, retry exhaustion→observable DLQ, consent version/base/legal purpose checked immediately before each non-transactional send, opt-out between queue and dispatch suppresses send.

- [ ] **Step 3: Implement minimal state machine**

Persist recipient outcomes; derive final state from totals; check consent in consumer, not only scheduler; expose DLQ correlation IDs without PII.

- [ ] **Step 4: Run GREEN and E2E**

```bash
npm run test:integration:run
npm run test:e2e:production -- e2e/campaigns.spec.ts e2e/campaigns/list.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/campaigns src/services src/modules e2e/campaigns.spec.ts e2e/campaigns docs/superpowers/audits/o3-g10-campaign-dlq-consent.md
git commit -m "feat(campaigns): enforce state dlq and consent"
```

Stage only campaign/consent/Queue paths shown by the diff.

## Task 11: Run Gate 3

**Files:**
- Modify: `docs/superpowers/audits/roadmap-143-ledger.json`
- Modify: `docs/goals/roadmap-143-resume.md`
- Create: `docs/superpowers/audits/o3-channels-ai-gate.md`
- Create: journey/fault E2E specs for J-03, J-05, J-07 and J-10 channel/AI subset

- [ ] **Step 1: Run journeys and fault injection**

J-03 proves one conversation from Evolution/widget and rejects signature/replay. J-05 proves R0–R3, takeover and urgency. J-07 proves consent/opt-out/100% failure. J-10 subset proves Evolution/LLM/DB/sidecar down behavior.

- [ ] **Step 2: Run wave gates**

```bash
npm run roadmap:check
npm run verify
npm run test:integration:run
npm run test:security -- --runInBand
npm run build
npm run test:e2e:production
npm run build:cf
npx wrangler deploy --dry-run --config wrangler.toml
```

Expected: all exit 0 and 23 F6–F7 IDs have nominal evidence, including external receipts.

- [ ] **Step 3: Independent safety/architecture review**

Review tenant derivation, proofs, clinical safety, provider failures, DO state, pgvector, sidecar auth, idempotency, DLQ and consent. Zero blocker/high required.

- [ ] **Step 4: Score and commit gate**

```bash
git add docs/superpowers/audits/roadmap-143-ledger.json docs/goals/roadmap-143-resume.md docs/superpowers/audits/o3-channels-ai-gate.md e2e
git commit -m "docs(program): close channels and ai wave gate"
```

Stage only journey/fault specs added for this gate.
