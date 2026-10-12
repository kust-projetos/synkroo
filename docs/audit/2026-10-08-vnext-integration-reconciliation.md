# Synkroo vNext — Reconciliação de integração E0 (read-only)

**Data:** 2026-10-08
**Base:** `origin/main @ d532ff6e0c7a2aae55798f51ca703e0a0e71c4d9`
**PLAN revisado:** `docs/superpowers/plans/2026-10-08-synkroo-vnext-integration-stabilization-plan.md` (branch `docs/vnext-stabilization-plan-2026-10-08`, PR draft #31) — status PROPOSED, sem autorização operacional.
**Checkout principal:** limpo (0 arquivos dirty). Este relatório foi produzido em worktree destacada de `d532ff6e`, sem mutação de código, banco ou Cloudflare.
**Classificação da tarefa:** PERSISTENT_GOAL — E0 read-only com 4 workers paralelos (3 explorer + 1 skeptic) + verificações diretas do Planner via `gh`/git.

## 1. Veredito da revisão do PLAN

O PLAN está **APROVADO COM AJUSTES** como guia E0→E1→E2-readonly. E3/E4/E5 permanecem BLOCKED até CI verde em HEAD integrado. Nenhum gate operacional (cutover, deploy prod, migration prod, canary com cliente real, autonomia) é autorizado.

Ajustes obrigatórios incorporados nesta reconciliação:

1. **Fatiar tranche:** só E0+E1+E2-readonly nesta rodada com DONE = `verify` verde em worktree limpa + ledger congelado. E3/E4/E5 como spec-only até o gate (corte de Policy Engine completo e golden workflows desta rodada — skeptic).
2. **E4 mínimo:** 1 engine WAHA default + semântica única de fallback fail-closed auditável + veredito PR #29 (merge OU close, nunca ambos). Cortar matriz WEBJS/GOWS/NOWEB desta tranche.
3. **Guardrails técnicos, não só processuais:** branch protection em `main`, backup pré-migration obrigatório, teste HMAC com fixture raw-body como gate de qualquer mudança de webhook.
4. **Correção factual .opencode:** `git ls-files .opencode` em `d532ff6e` = 0 arquivos. Houve versionamento histórico no delta (`6c48b706` tocou `opencode-loop/ses_*.json` + goals), seguido de higiene (`.opencode/.gitignore` + `roadmap-143-resume.md` § gitignored). Status atual: **RESOLVIDO** — impedir novos artefatos efêmeros, sem necessidade de limpeza destrutiva no HEAD.
5. **Nuance ActionResult:** `enviarMensagemDireta` retorna `{success,messageId}|{success:false,error}` (transporte) e `runAction` retorna `ActionResult {ok,data}|{ok:false,error}`. Caller `budgets/[id]/send.ts:73` usa `result.ok` do envelope — distinção ok-transporte vs ok-action está preservada no código atual. O risco "ok=true com falha de negócio" continua válido como invariante a endurecer (E3), mas não como bug ativo confirmado neste caller.
6. **Nuance EXPECTED_MIGRATIONS:** `EXPECTED_MIGRATIONS=35` conta registros de ledger (`drizzle.__drizzle_migrations`), não idx max. Journal tem 36 entries idx 0–35 (`0000–0035`, gap herdado `0017`). Ledger 33 observado no target em 2026-10-07 = 2 migrations pendentes (0034/0035), não erro de contagem.

## 2. Estado de entrada — verificado no HEAD exato

| # | Afirmação do PLAN | Estado E0 | Evidência |
|---|---|---|---|
| B0 | CI FAILURE em `typecheck:ia-bridge` `approval.ts:88 TS2554` | **CONFIRMADO** | CI run `37847035463` (head `d532ff6e`): `Build & Test` failure em `src/core/actions/approval.ts(88,42): error TS2554: Expected 0 arguments, but got 1`; `Secret Scan (Gitleaks)` success; `Migrations From Zero` success; `CF Build & Dry Run` skipped |
| B0 | Lint/tsc principal/Gitleaks/migrations-zero PASS | **CONFIRMADO** (ordem: `npm ci` → lint → `tsc --noEmit` verde → bridge vermelho; ia-agent nunca alcançado) | `.github/workflows/ci.yml:60-64`, log `37847035463` |
| B0 | Causa-raiz tipagem `randomBytes(32).toString('hex')` | **CONFIRMADO COM REFINO:** falha é no `.toString('hex')` (coluna 42), não no `randomBytes(32)`. Colisão `Buffer:any` de `@cloudflare/workers-types` + `Buffer` genérico vs não-genérico em `@types/node 22.19.15` + `skipLibCheck:true`; só o programa bridge carrega workers-types | `src/core/actions/approval.ts:1,88`; `src/workers/ia-bridge/tsconfig.json:2-18` vs `tsconfig.json:2-28`; `node_modules/@cloudflare/workers-types/index.d.ts:462,486`; `node_modules/@types/node/buffer.d.ts:51,365` vs `buffer.buffer.d.ts:356,459`; `package-lock.json:9248-51` (@types/node travado), `:20904-07` (TS 5.9.3); `wrangler.ia-bridge.jsonc:5` (nodejs_compat); `src/workers/ia-bridge/index.ts:3 → run.ts:4-6 → approval.ts`; `run.ts:79`; `approval.test.ts` 14 testes |
| B1 | Código espera 35, runtime P2 com 33 | **CONFIRMADO** (código 35 correto; target com 2 pendentes) | `src/services/api-handlers/health/db.ts:12` (`EXPECTED_MIGRATIONS=35`); `src/lib/db/migrations/meta/_journal.json:236-249` (idx34/35); `0034_action_attempt_fields.sql:12-19` (expand-only, 4 cols NULL); `0035_approval_tokens.sql:6-17` (CREATE TABLE IF NOT EXISTS, sem FK, TTL 15min lazy purge); `drizzle.config.ts:15-22`; `scripts/migrate-vps.ts:29-31,66-99` (`--side` obrigatório + `--dry-run`); `docs/audit/migrations-policy.md` (expand→migrate→switch→contract; DOWN só comentário) |
| B1 | Evolution inbound 410, WAHA-first outbound | **CONFIRMADO** | `src/app/api/whatsapp/evolution/route.ts:23` (410 `EVOLUTION_RETIRED`, stub mantido p/ sinal machine-readable); `src/modules/atendimento/services/channel-service.ts` (detectProvider WAHA-first → sidecar → Evolution deprecated commit 3863c4f); `src/modules/atendimento/integrations/waha-adapter.ts` (outbound texto, 1 tentativa, timeout 15s → `delivery:unknown`); `src/app/api/whatsapp/waha/route.ts` (inbound HMAC sha512 raw-body, session→clinic estrito, dedup, freshness) |
| B1 | `writeActionLog` fail-silent; `ok` vs `success` | **CONFIRMADO** (fail-silent real; distinção ok/success preservada, invariante a endurecer em E3) | `src/core/actions/audit-writer.ts:24` (try/catch + dbLogger, sem throw); `src/core/actions/types.ts` (ActionResult); `src/core/actions/run.ts` (gates auth→manifesto→RBAC→approval→tenant-guard→Zod→handler); `src/modules/atendimento/actions/enviar-mensagem-direta.ts` (`deny_non_human`, `{success,messageId}`); `src/services/api-handlers/budgets/[id]/send.ts:73` (`whatsappSent=result.ok`) |
| B1 | `deny_non_human` vira `approval_required` com token | **CONFIRMADO** (semântica atual documentada, decisão DENY absoluto pendente em E3) | `src/core/actions/approval.ts:200-205` (`evaluatePolicy`); `consumeApprovalToken:129-192` (single-use atômico, TTL, fail-closed); `AGENT_SAFE_ACTIONS` 8 nomes `operacional.*` em `src/core/agent-bridge/tool-policy.ts:19`; `enviarMensagemDireta` fora da allowlist |
| B2 | PR #29 OPEN desatualizado | **CONFIRMADO** — OPEN, CONFLICTING (DIRTY), 10 commits, +4889/-1, 21 arquivos, merge-base `bf54b647`, 10 commits à frente | `gh pr view 29`; head `feat/p3-waha-migration` (último `088eb4c1` 2026-10-07); base `main` |
| B2 | `main` sem proteção | **CONFIRMADO** | `gh api branches/main/protection` → 404 Branch not protected; `.github/` só workflows + dependabot + gitleaks-scheduled; sem CODEOWNERS/CONTRIBUTING |
| B2 | `.opencode/opencode-loop` versionado no delta | **RESOLVIDO** — histórico real, HEAD limpo | `git log 79ee2b95..d532ff6e -- .opencode` mostra `6c48b706` (ses_*.json + goals); `git ls-files .opencode` em `d532ff6e` = 0; `.opencode/.gitignore`; `docs/goals/roadmap-143-resume.md:60-62` (loop/ gitignored) |
| B2 | Lote 25 commits/217 arquivos desde `79ee2b95` | **CONFIRMADO** | `git rev-list --count 79ee2b95..d532ff6e` = 25; diff-stat 217 files +15997/-6092 |
| Gov | P0/P1 CLOSED, P2+ NOT STARTED (canônico) vs P2-validation TARGET ACTIVE | **DIVERGÊNCIA DOCUMENTAL MAPEADA** — canônico = master PLAN; validation = evidência operacional não-canônica | Master PLAN `2026-10-05-...-implementation.md:27,29,45` (P0 CLOSED PRs #24/#25; P1 CLOSED PR #26; P2/P3/P4+ NOT STARTED); `docs/inventory/2026-10-07-p2-contabo-validation.md` (TARGET ACTIVE, cutover 2026-10-05, P3 não tocado); ADR-19 `ADR-BASE-19` (exceção PERMANENTE `/budgets/[id]/send`, sem migração sem decisão de produto) |

## 3. Matriz evidência / código / runtime / gap / dono / decisão

| Área | Evidência (histórica) | Código (HEAD `d532ff6e`) | Runtime (não verificado ao vivo) | Gap | Dono | Decisão E0 |
|---|---|---|---|---|---|---|
| CI E1 | Run `37847035463` FAILURE | `approval.ts:88` type-gate; runtime íntegro (nodejs_compat, 14 testes) | CI vermelho bloqueia merges funcionais | 1 linha de tipagem + tsconfig bridge | E1 coder | PR mínimo `fix/vnext-ci-bridge-compat`, sem trocar criptografia |
| Migrations E2 | Ledger 33 no target em 2026-10-07 | EXPECTED 35 + 0034/0035 expand-only IF NOT EXISTS | Versão/migrations efetivas no Contabo, Hyperdrive source/target, backup/restore, readiness | 2 migrations pendentes + prova de compatibilidade | Operador (humano) | E2 read-only + runbook; sem migrate/deploy prod sem autorização; marcar READY FOR OPERATOR, nunca DONE |
| Action/auditoria E3 | Invariantes BASE-06/17 vigentes | `ok` vs `success` distintos; `writeActionLog` fail-silent; DENY→APPROVAL com token | N/A (contrato) | Fail-closed auditoria sem duplicate-send; DENY absoluto vs APPROVAL; token single-use/TTL/bind | E3 + security-reviewer | PR independente após E1; ADR/addendum; testes negativos DB-real; sem expandir allowlist |
| WAHA E4 | PR #29 (10 commits, conflicting) + 410 Evolution | WAHA-first + inbound HMAC/dedup/freshness + outbound 1 tentativa | Instalação WAHA real, secret, webhook ativo, sessão/clinic, tráfego Evolution residual, sidecar | Ruptura inbound? fallback após `unknown`? engine? QR/reconnect? backup sessão? | E4 + humano go/no-go | Reconciliar merge-base, veredito merge/close; sem cutover/QR/envio real sem autorização |
| Control Plane E5 | S1–S6 integrados no lote; ADR-18 (8 entidades) decidido | `runAction` executor; `iaActions=[]`; registry determinístico | Writers/readers/tenant/policy por entidade | Matriz por entidade + policy profiles + kill switch | E5 (spec-only nesta rodada) | PLAN incremental após E3/E4; sem autonomia sem autorização própria |
| Governança | Master PLAN vs P2-validation divergentes; ADR-19 exceção permanente | `.github` sem proteção; `.opencode` limpo no HEAD | Permissões GitHub, acessos Contabo/Cloudflare | Proteção técnica + congelar autoridade (ATUAL > RESOLVIDO > HISTÓRICO > SUBSTITUÍDO) | Planner + owner | Não migrar `/budgets/[id]/send`; adicionar proteção mediante aprovação de política |

Classificação: **confirmado** (tabela §2), **risco provável** (fallback após delivery `unknown` gerar duplicate-send; HMAC raw-bytes bypass se body parsed; approval_tokens sem índice sob carga; `EXPECTED` hardcoded sem bump automation), **indeterminado** (WAHA live, ledger Contabo atual, tráfego Evolution residual, Hyperdrive, backup/restore — todos exigem acesso read-only autorizado), **resolvido** (`.opencode` no HEAD; distinção `ok`/`success` neste caller; contagem EXPECTED 35).

## 4. Blockers e sequência de PRs

- **B0 (trava tudo funcional):** E1 CI vermelho → HOLD E2–E4 para merges funcionais. E2 read-only pode rodar em paralelo.
- **B1:** sem prova de compatibilidade 0034/0035 em staging/rehearsal → travar novas chamadas a Approval além do existente; sem backup off-host/restore drill → NO-GO para migrate prod.
- **B1:** sem confirmação WAHA live → classificar inbound 410 como incidente potencial, não como closure; sem semântica fallback fail-closed → HOLD canary.
- **B2:** PR #29 CONFLICTING → nunca merge por reflexo; veredito merge-base + diff de intenção + close/replace explícito.
- Sequência: E0 (este doc) → E1 (`fix/vnext-ci-bridge-compat`) → E2 runbook READY FOR OPERATOR → E3 (contratos) → E4 tranches (reconciliação → deploy candidate → canary) → E5 spec-only. PRs independentes, CI + review próprios, sem mega-refactor no PR de CI.

## 5. Gates aplicáveis (resumo do PLAN §5, sem alteração)

lint/tsc app+bridge+agent, Jest unit/contract + security-negative, Postgres integração + migrations-zero, E2E produção + CF build/dry-run, Gitleaks + audit HIGH=0, runtime checks/restore/readiness (E2/E4), reviewer segurança/infra, aprovação humana antes de prod/canary/cutover/autonomia. `SKIPPED` só justificado e nunca em gate obrigatório da tranche. CI verde em HEAD anterior não prova HEAD final.

## 6. Próxima etapa autorizada

**E0 → E1.** E2 read-only em paralelo. E3/E4/E5 aguardam gate E1 + decisões. Nenhuma ação mutadora operacional pré-autorizada. Este documento é reconciliação, não autorização de produção.

Relato do executor por fase (formato): `ETAPA | ESTADO | SHA BASE→HEAD | PR | O QUE FOI TESTADO | PROVA | BLOQUEIOS | DECISÃO/PRÓXIMA ETAPA`.
