# CRM + Financeiro Integration Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Track steps with checkboxes.

**Goal:** Close CRM MVP and Financeiro integration contracts without exposing internal or sensitive actions to IA tools.

**Architecture:** CRM becomes a read coordinator over Patient/Lead owners. Financeiro joins bootstrap/menu/RBAC unchanged. Action registry serves HTTP; an explicit IA allowlist serves bridge tools.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.6, Drizzle, PostgreSQL, Zod, Jest, Stryker.

**Agent Orchestration:** Supervisor-Workers. Tasks 1, 2, 7 can be isolated after Task 1; Tasks 3→6 are sequential.

## File map

| Task | Files |
|---:|---|
| 1 | `src/core/agent-bridge/{tool-policy,bridge-service}.ts`, tests |
| 2 | Owner note/tag actions, owner repositories, CRM bridge tests |
| 3 | `src/modules/crm/{repositories,services,actions}/**`, tests |
| 4 | `src/modules/crm/{index,manifest,actions/index}.ts`, cron route, taxonomy tests |
| 5 | `src/app/api/contacts/**`, CRM adapter, route tests |
| 6 | CRM dashboard wrapper/client view, contacts hooks/components, snapshots |
| 7 | Financeiro manifest/bootstrap/menu/page gate, tests |
| 8 | `bootstrap.ts`, RBAC presets/backfill, manifests/menu, integration tests |
| 9 | Mutation configs/tests, static gates, verification docs only |

## Task 1 — IA tool allowlist, deny by default

**Files:** Create `src/core/agent-bridge/tool-policy.ts`, `src/core/agent-bridge/__tests__/tool-policy.test.ts`; modify `bridge-service.ts`, `bridge-service.test.ts`, `bridge-failures.test.ts`.

- [ ] **RED:** Test `isAgentSafeAction('operacional.consultarDisponibilidade') === true`; test all `crm.*`, `financeiro.*`, `operacional.mesclarPacientes`, `comercial.mesclarLeads` return false.
- [ ] **RED:** With a globally registered blocked action, `listToolsLogic()` omits its alias and `executeActionLogic()` returns `{ ok:false, error:'unknown_tool' }` without marking idempotency key or calling `runAction`.
- [ ] **GREEN:** Add literal `AGENT_SAFE_ACTIONS = new Set(['operacional.consultarDisponibilidade', 'operacional.listarProcedimentos', 'operacional.obterProcedimento', 'operacional.agendarConsulta', 'operacional.confirmarConsulta', 'operacional.entrarWaitlist', 'operacional.obterPaciente', 'operacional.atualizarPaciente'])` and `isAgentSafeAction(name)` in `tool-policy.ts`. Do not infer policy from module, permission or security matrix.
- [ ] **GREEN:** Filter allowed actions in `listToolsLogic()` with `isAgentSafeAction`; after alias resolution, reject non-safe action in `executeActionLogic()` before replay marking and `runAction`. Keep `assertSystemAllowed()` as second barrier.
- [ ] **VERIFY:** `npx jest src/core/agent-bridge/__tests__/tool-policy.test.ts src/core/agent-bridge/__tests__/bridge-service.test.ts src/core/agent-bridge/__tests__/bridge-failures.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/core/agent-bridge && git commit -m "fix(ia): allowlist bridge tools"`.

## Task 2 — Owner bridges for CRM notes and tags

**Files:** Modify `src/modules/operacional/{repositories/patients-repository.ts,actions/index.ts}` and `src/modules/comercial/{repositories/activities-repository.ts,repositories/leads-repository.ts,actions/index.ts}`; create `operacional/actions/{registrar-observacao-paciente,atualizar-tags-paciente}.ts`, `comercial/actions/{registrar-nota-lead,atualizar-tags-lead}.ts`, `src/modules/crm/__tests__/owner-bridge-actions.test.ts`.

- [ ] **RED:** Assert four actions are registered and clinic-scoped. Assert tags `[' VIP ', 'vip', '', 'Lead']` become `['VIP', 'Lead']`; foreign patient/lead returns `not_found`.
- [ ] **GREEN:** Add repository functions for patient observation/tags and lead note/tags. Each write predicates owner id plus `clinicId`; lead note resolves the lead before activity insert.
- [ ] **GREEN:** Define actions with existing permissions: Operacional `operacional:manage_patients`, Comercial `comercial:edit_leads`. Keep action input owner id only; derive clinic from context.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/modules/operacional src/modules/comercial src/modules/crm/__tests__/owner-bridge-actions.test.ts && git commit -m "feat(crm): add owner note tag bridges"`.

## Task 3 — CRM unified read model and public actions

**Files:** Create `src/modules/crm/repositories/contact-read-repository.ts`, `src/modules/crm/services/{contact-list-service,contact-detail-service,contact-timeline-service,contact-notes-service,contact-tags-service}.ts`, public actions for list/detail/timeline/notes/tags; modify `src/modules/crm/actions/index.ts`, `src/modules/crm/index.ts`, `.eslintrc.json`; create focused CRM tests.

- [ ] **RED:** Test global patient+unconverted-lead ordering `updatedAt DESC, type ASC, id ASC`, page/total after union, owner-clinic isolation, and `{type,id}` detail `not_found`.
- [ ] **RED:** Test timeline descending; notes only normalized note records; CRM note/tag actions select owner bridge by `type` and propagate `not_found`.
- [ ] **GREEN:** Implement parameterized `UNION ALL` and count in `contact-read-repository.ts`. This is CRM's only owner-schema import exception; it performs only `SELECT`/`COUNT`.
- [ ] **GREEN:** Define `crm.listarContatos`, `crm.obterContato`, `crm.listarTimelineContato`, `crm.listarNotasContato`, `crm.adicionarNotaContato`, `crm.atualizarTagsContato`; register them in the CRM public array.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/contact-read-model.test.ts src/modules/crm/__tests__/contact-actions.test.ts --runInBand` → PASS; `npm run lint -- --file src/modules/crm/repositories/contact-read-repository.ts` → PASS.
- [ ] **COMMIT:** `git add src/modules/crm .eslintrc.json && git commit -m "feat(crm): add unified contact read model"`.

## Task 4 — CRM action taxonomy and system cron

**Files:** Modify `src/modules/crm/{actions/index.ts,index.ts,manifest.ts}`, `src/app/api/cron/crm-duplicates/route.ts`; create `src/modules/crm/__tests__/{action-taxonomy,crm-duplicates-cron}.test.ts`.

- [ ] **RED:** Assert `crmActions` contains only read/note/tag and human duplicate review/merge actions; excludes `crm.reprocessarSugestoesDuplicidade`. Assert `operacionalActions` and `comercialActions` exclude merge actions.
- [ ] **RED:** Cron test expects `crmManifest.jobs` contains `'crm-duplicates'`, verifies `CRON_SECRET`, module job gate, and invokes system-only reprocess action rather than repository logic.
- [ ] **GREEN:** Export `crmActions` as public actions plus human duplicate actions. Keep `reprocessarSugestoesDuplicidade` importable only by cron. Preserve `mesclarPacientes`/`mesclarLeads` out of `registerActions` arrays and route exports.
- [ ] **GREEN:** Replace cron's direct repository loop with `assertModuleForJob('crm', moduleManifest)`, system context and `runAction(reprocessarSugestoesDuplicidade, { clinicId }, ctx)`. Preserve timing-safe secret check.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/action-taxonomy.test.ts src/modules/crm/__tests__/crm-duplicates-cron.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/modules/crm src/app/api/cron/crm-duplicates && git commit -m "refactor(crm): separate public and system actions"`.

## Task 5 — CRM route cutover and selective read-only contract

**Files:** Modify `src/app/api/contacts/{route.ts,[id]/route.ts,[id]/timeline/route.ts,[id]/notes/route.ts,[id]/appointments/route.ts,duplicates/**/route.ts}`, create `[id]/tags/route.ts`; modify `src/modules/crm/ui/route-adapter.ts`; create `src/modules/crm/__tests__/routes.test.ts`.

- [ ] **RED:** Disabled CRM returns 404 for every contacts handler. Test `GET` list/detail/timeline/notes, `POST notes`, `PUT tags`, duplicate approve/dismiss/merge use actions.
- [ ] **RED:** Assert only `POST /api/contacts` and `PUT/PATCH /api/contacts/:id` return exactly `{ error:'crm_mvp_read_only' }`, 405. Notes/tags/duplicates must not return 405. Missing/invalid `type` returns 400.
- [ ] **GREEN:** Wrap handlers with `withModuleRoute('crm', moduleManifest)` and call `runCrmAction`; remove `validateApiAuth`, `getDb`, legacy contact/timeline service imports from routes.
- [ ] **GREEN:** Preserve `GET /api/contacts/:id/appointments` as CRM-gated, read-only adapter over an Operacional read action, scoped by clinic and patient identity. Lead identity returns CRM `not_found`.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/routes.test.ts src/__tests__/api/contacts/appointments/route.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/app/api/contacts src/modules/crm/ui src/modules/crm/__tests__ src/__tests__/api/contacts && git commit -m "feat(crm): cut contacts routes to actions"`.

## Task 6 — CRM server gate and real UI data

**Files:** Replace `src/app/dashboard/contatos/page.tsx`; create `src/app/dashboard/contatos/contacts-client.tsx`; modify `src/components/contacts/{contact-list-panel,contact-detail-panel,contact-create-dialog}.tsx`, `src/lib/hooks/use-queries.ts`; create UI tests.

- [ ] **RED:** Server page test mocks manifest disabled and expects `notFound()`. Client tests assert list/detail fetch CRM data, duplicate queue receives fetched suggestions, and no create/edit/archive CTA exists.
- [ ] **GREEN:** Make page a server wrapper: check `moduleManifest.isEnabled('crm')`, call `notFound()` when false, render `ContactsClient` when true. Keep hooks/components client-side beneath it.
- [ ] **GREEN:** Add CRM query keys/hooks for contacts, notes, tags and duplicate queue. Render `ContactSplitView` plus queue using query result, never literal `suggestions={[]}`. Remove `ContactCreateDialog` and entity mutation UI.
- [ ] **VERIFY:** `npx jest src/app/dashboard/contatos src/components/contacts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/app/dashboard/contatos src/components/contacts src/lib/hooks/use-queries.ts && git commit -m "feat(crm): gate and wire contacts dashboard"`.

## Task 7 — Financeiro bootstrap, menu, page gate and job manifest

**Files:** Modify `src/core/actions/bootstrap.ts`, `src/lib/ui/menu-actions.ts`, `src/modules/financeiro/manifest.ts`, `src/app/dashboard/financeiro/page.tsx`; create `src/app/dashboard/financeiro/financeiro-client.tsx`; modify Financeiro page tests and `src/core/actions/__tests__/bootstrap.test.ts`.

- [ ] **RED:** Bootstrap test expects all `financeiroActions` and permission keys. Menu test shows Financeiro only for enabled manifest plus `financeiro:view`. Page test expects disabled module `notFound()`.
- [ ] **GREEN:** Dynamic-import Financeiro in bootstrap, register missing actions idempotently and register its permission catalog. Add its manifest to `getVisibleMenu`.
- [ ] **GREEN:** Set `financeiroManifest.jobs` to `['financeiro-collections']`. Convert dashboard page to server gate then render client dashboard below it. Do not change provider webhook's disabled-module reconciliation behavior.
- [ ] **VERIFY:** `npx jest src/core/actions/__tests__/bootstrap.test.ts src/lib/ui/__tests__/build-menu.test.ts src/app/dashboard/financeiro --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/core/actions src/lib/ui src/modules/financeiro src/app/dashboard/financeiro && git commit -m "feat(financeiro): register menu and page gate"`.

## Task 8 — Bootstrap CRM, exact RBAC presets and backfill

**Files:** Modify `src/core/actions/bootstrap.ts`, `src/lib/ui/menu-actions.ts`, `src/core/rbac/presets.ts`, `scripts/backfill-rbac-permissions.mjs`; create/modify bootstrap, preset and backfill tests.

- [ ] **RED:** Bootstrap test expects CRM public/human actions and permissions, excludes system-only reprocess. Preset test expects: Administrador CRM+Financeiro modules; Recepcionista only CRM view extra key; Comercial CRM view/notes/tags extra keys, no merge permissions.
- [ ] **RED:** Backfill test uses two clinics/roles and proves it grants only each role's configured preset keys, not every catalog permission; second run inserts zero rows.
- [ ] **GREEN:** Add CRM dynamic import/registration and manifest. Update presets exactly as specified. Replace current all-catalog backfill algorithm with preset-name→permission mapping, parameterized inserts, `ON CONFLICT DO NOTHING`, and stdout counts.
- [ ] **GREEN:** Add deployment runbook step: deploy registry/catalog first, then `DATABASE_URL=... node scripts/backfill-rbac-permissions.mjs`; rerun is safe.
- [ ] **VERIFY:** `npx jest src/core/actions/__tests__/bootstrap.test.ts src/core/rbac/__tests__/seed.test.ts scripts/__tests__/backfill-rbac-permissions.test.mjs --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/core/actions src/lib/ui src/core/rbac scripts && git commit -m "feat(rbac): register CRM Financeiro access"`.

## Task 9 — Quality gates and acceptance verification

**Files:** Modify only focused test/config/doc files required by gates.

- [ ] **RED:** Add mutation targets for CRM mapping/timeline/tag service and IA tool policy. Ensure no integration test rewrites `DATABASE_URL`.
- [ ] **GREEN:** Add only tests required for 80% changed-file coverage and ≥70% mutation score.
- [ ] **VERIFY:**
```bash
npx jest src/core/agent-bridge src/modules/crm src/modules/financeiro src/components/contacts --runInBand
npm run test:integration:run -- src/modules/crm/__tests__/duplicate-execution.integration.test.ts
npm run typecheck
npm run lint
npm run build
npx stryker run --config stryker.services.config.json
```
Expected: every command exits 0. Run `npm audit --omit=dev --audit-level=high`.
- [ ] **E2E DECISION:** After all prior gates pass, ask user: Playwright contacts read/note/tag/duplicate smoke, no because contract+integration cover it, or deferred ADR.
- [ ] **COMMIT:** `git add stryker.services.config.json src/core/agent-bridge src/modules/crm src/modules/financeiro src/components/contacts && git commit -m "test(crm): close integration acceptance"`. 

## Requirement coverage

| Requirement | Tasks |
|---|---|
| REQ-CLOSE-01..04 | 2, 3, 5, 6 |
| REQ-CLOSE-05 | 5 |
| REQ-CLOSE-06 | 5, 6, 7 |
| REQ-CLOSE-07..09 | 7, 8 |
| REQ-CLOSE-10 | 1, 4 |
| REQ-CLOSE-11 | 7, 9 |

## Guardrails

- Do not stage `docs/superpowers/plans/2026-07-15-eixo2-security-integrity-hardening-implementation.md`.
- Never register `mesclarPacientes`, `mesclarLeads`, or CRM reprocess as public/IA actions.
- Financeiro webhook remains able to reconcile an existing known charge when Financeiro is disabled.
- Every production edit follows RED → GREEN → REFACTOR.
