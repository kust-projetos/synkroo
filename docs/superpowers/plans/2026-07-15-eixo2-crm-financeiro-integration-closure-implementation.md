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
| 2 | Owner note/tag actions, owner repositories, module export arrays, CRM bridge tests |
| 3 | `src/modules/crm/{repositories,services,actions}/**`, tests |
| 4 | `src/modules/crm/{index,manifest,actions/index}.ts`, cron route, taxonomy tests |
| 5 | `src/app/api/contacts/**`, CRM adapter, route tests |
| 6 | CRM dashboard wrapper/client view, contacts hooks/components, delete create dialog, snapshots |
| 7 | Financeiro manifest/page gate, live dashboard queries, tests |
| 8 | `bootstrap.ts`, RBAC presets/backfill policy, manifests/menu, integration tests |
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

**Files:** Modify `src/modules/operacional/{repositories/patients-repository.ts,actions/index.ts,index.ts}` and `src/modules/comercial/{repositories/activities-repository.ts,repositories/leads-repository.ts,actions/index.ts,index.ts}`; create `operacional/actions/{registrar-observacao-paciente,atualizar-tags-paciente}.ts`, `comercial/actions/{registrar-nota-lead,atualizar-tags-lead}.ts`, `src/modules/crm/__tests__/owner-bridge-actions.test.ts`.

- [ ] **RED:** Assert four actions are registered and clinic-scoped. Assert tags `[' VIP ', 'vip', '', 'Lead']` become `['VIP', 'Lead']`; foreign patient/lead returns `not_found`. Run: `npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts --runInBand`. Expected: FAIL with missing owner action exports.
- [ ] **GREEN:** Add repository functions for patient observation/tags and lead note/tags. Each write predicates owner id plus `clinicId`; lead note resolves the lead before activity insert.
- [ ] **GREEN:** Define actions with existing permissions: Operacional `operacional:manage_patients`, Comercial `comercial:edit_leads`. Keep action input owner id only; derive clinic from context. Import all four in owner module `index.ts`, add them to `operacionalActions`/`comercialActions`, and export them for CRM coordinator use.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/owner-bridge-actions.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/modules/operacional src/modules/comercial src/modules/crm/__tests__/owner-bridge-actions.test.ts && git commit -m "feat(crm): add owner note tag bridges"`.

## Task 3 — CRM unified read model and public actions

**Files:** Create `src/modules/crm/repositories/contact-read-repository.ts`, `src/modules/crm/services/{contact-list-service,contact-detail-service,contact-timeline-service,contact-notes-service,contact-tags-service}.ts`, public actions for list/detail/timeline/notes/tags; modify `src/modules/crm/actions/index.ts`, `src/modules/crm/index.ts`, `.eslintrc.json`; create focused CRM tests.

- [ ] **RED:** Test global patient+unconverted-lead ordering `updatedAt DESC, type ASC, id ASC`, page/total after union, owner-clinic isolation, and `{type,id}` detail `not_found`. Run: `npx jest src/modules/crm/__tests__/contact-read-model.test.ts --runInBand`. Expected: FAIL, module `contact-read-repository` missing.
- [ ] **RED:** Test timeline descending; notes only normalized note records; CRM note/tag actions select owner bridge by `type` and propagate `not_found`.
- [ ] **GREEN:** Implement parameterized `UNION ALL` and count in `contact-read-repository.ts`. This is CRM's only owner-schema import exception; it performs only `SELECT`/`COUNT`.
- [ ] **GREEN:** Define `crm.listarContatos`, `crm.obterContato`, `crm.listarTimelineContato`, `crm.listarNotasContato`, `crm.adicionarNotaContato`, `crm.atualizarTagsContato`; register them in the CRM public array.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/contact-read-model.test.ts src/modules/crm/__tests__/contact-actions.test.ts --runInBand` → PASS; `npm run lint -- --file src/modules/crm/repositories/contact-read-repository.ts` → PASS.
- [ ] **COMMIT:** `git add src/modules/crm .eslintrc.json && git commit -m "feat(crm): add unified contact read model"`.

## Task 4 — CRM action taxonomy and system cron

**Files:** Modify `src/modules/crm/{actions/index.ts,index.ts,manifest.ts}`, `src/modules/{operacional,comercial}/{index.ts,actions/index.ts}`; delete owner merge action files; create internal merge dispatchers; modify `src/app/api/cron/crm-duplicates/route.ts`; create `src/modules/crm/__tests__/{action-taxonomy,crm-duplicates-cron}.test.ts`.

- [ ] **RED:** In `src/modules/crm/__tests__/action-taxonomy.test.ts`, assert `crmActions` contains only read/note/tag and human duplicate review/merge actions; excludes `crm.reprocessarSugestoesDuplicidade`. Import `operacionalActions` and `comercialActions`; assert merge names are absent but direct imports of `mesclarPacientes`/`mesclarLeads` exist for internal dispatcher use. Run: `npx jest src/modules/crm/__tests__/action-taxonomy.test.ts --runInBand`. Expected: FAIL because `crmActions` is empty.
- [ ] **RED:** Create `src/app/api/cron/crm-duplicates/route.test.ts`: mock `listClinicIdsWithPendingSuggestions`, `buildSystemContext`, `runAction`; expect one `{ clinicId }` call per clinic, 401 for invalid secret, and `{ skipped:true }` when gate rejects. Run: `npx jest src/app/api/cron/crm-duplicates/route.test.ts --runInBand`. Expected: FAIL because route queries/reprocesses directly.
- [ ] **GREEN:** Export `crmActions` as public actions plus human duplicate actions. Delete `actions/mesclar-pacientes.ts` and `actions/mesclar-leads.ts`; create `services/{patient,lead}-merge-dispatcher.ts` containing only `registerOwnerMerge('patient'|'lead', async (...) => merge...)`, importing `@/modules/crm/services/owner-merge-registry` directly. Owner indexes import dispatchers for side effects but export no merge symbol; no internal merge remains a `defineAction`.
- [ ] **GREEN:** Add `listClinicIdsWithPendingSuggestions()` to `duplicate-suggestions-repository.ts`; update cron to verify secret, catch `ModuleDisabledError` and return `{ skipped:true }`, enumerate ids, build one system context and `runAction(reprocessarSugestoesDuplicidade, { clinicId }, ctx)` per clinic. Return `{ processed: clinicIds.length, results }`; zero ids returns `{ processed:0, results:[] }`; one failed action records `{ clinicId, ok:false, error }` and continues. Set `crmManifest.jobs = ['crm-duplicates']`.
- [ ] **VERIFY:** Extend taxonomy test: `expect('mesclarPacientes' in operacionalModule).toBe(false)`, same for lead; registry names, `/api/**` routes and bridge catalog contain no merge alias. Run: `npx jest src/modules/crm/__tests__/action-taxonomy.test.ts src/app/api/cron/crm-duplicates/route.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/modules/crm src/modules/operacional src/modules/comercial src/app/api/cron/crm-duplicates && git commit -m "refactor(crm): separate public and system actions"`.

## Task 5 — CRM route cutover and selective read-only contract

**Files:** Modify `src/app/api/contacts/{route.ts,[id]/route.ts,[id]/timeline/route.ts,[id]/notes/route.ts,[id]/appointments/route.ts,duplicates/**/route.ts}`, create `[id]/tags/route.ts`; modify `src/modules/crm/ui/route-adapter.ts`; create `src/modules/crm/__tests__/routes.test.ts`.

- [ ] **RED:** Disabled CRM returns 404 for every contacts handler. Test `GET` list/detail/timeline/notes, `POST notes`, `PUT tags`, duplicate approve/dismiss/merge use actions. Run: `npx jest src/modules/crm/__tests__/routes.test.ts --runInBand`. Expected: FAIL because legacy handlers bypass module gate/actions.
- [ ] **RED:** Assert only `POST /api/contacts` and `PUT/PATCH /api/contacts/:id` return exactly `{ error:'crm_mvp_read_only' }`, 405. Notes/tags/duplicates must not return 405. Missing/invalid `type` returns 400. Mock Operacional disabled for appointments and expect CRM 404.
- [ ] **GREEN:** Wrap handlers with `withModuleRoute('crm', moduleManifest)` and call `runCrmAction`; add `crmReadOnlyResponse() => NextResponse.json({ error:'crm_mvp_read_only' }, { status:405 })`; remove `validateApiAuth`, `getDb`, legacy contact/timeline service imports from routes.
- [ ] **GREEN:** Preserve `GET /api/contacts/:id/appointments` as CRM-gated, read-only adapter: validate `type === 'patient'`, call `runCrmAction(listarConsultas, { patientId:id, page:1, limit:50 })`, and map its `{ appointments }` contract. Lead identity and a disabled Operacional module both map to CRM `not_found` so appointment existence never leaks.
- [ ] **VERIFY:** `npx jest src/modules/crm/__tests__/routes.test.ts src/__tests__/api/contacts/appointments/route.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/app/api/contacts src/modules/crm/ui src/modules/crm/__tests__ src/__tests__/api/contacts && git commit -m "feat(crm): cut contacts routes to actions"`.

## Task 6 — CRM server gate and real UI data

**Files:** Replace `src/app/dashboard/contatos/page.tsx`; create `src/app/dashboard/contatos/contacts-client.tsx`; modify `src/components/contacts/{contact-list-panel,contact-detail-panel}.tsx`, `src/lib/hooks/use-queries.ts`; delete `src/components/contacts/contact-create-dialog.tsx`; create UI tests.

- [ ] **RED:** Server page test mocks manifest disabled and expects `notFound()`. Client tests assert list/detail fetch CRM data, duplicate queue receives fetched suggestions, and no create/edit/archive CTA exists. Run: `npx jest src/app/dashboard/contatos/page.test.tsx src/components/contacts/__tests__/contact-list-panel.test.tsx --runInBand`. Expected: FAIL because page is client-only and queue is literal empty data.
- [ ] **GREEN:** Make page a server wrapper: check `moduleManifest.isEnabled('crm')`, call `notFound()` when false, render `ContactsClient` when true. Keep hooks/components client-side beneath it.
- [ ] **GREEN:** Add CRM query keys/hooks for contacts, notes, tags and duplicate queue. Render `ContactSplitView` plus queue using query result, never literal `suggestions={[]}`. Delete `src/components/contacts/contact-create-dialog.tsx`; remove its imports, create button and edit/archive entity mutation UI.
- [ ] **VERIFY:** `npx jest src/app/dashboard/contatos src/components/contacts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/app/dashboard/contatos src/components/contacts src/lib/hooks/use-queries.ts && git commit -m "feat(crm): gate and wire contacts dashboard"`.

## Task 7 — Financeiro bootstrap, menu, page gate and job manifest

**Files:** Modify `src/modules/financeiro/manifest.ts`, `src/app/dashboard/financeiro/page.tsx`, `src/components/financeiro/{FinanceDashboard,BudgetTab,PaymentTab,CollectionTab,GatewayConfigTab}.tsx`, `src/lib/hooks/use-queries.ts`; create `src/app/dashboard/financeiro/financeiro-client.tsx`, `src/app/dashboard/financeiro/page.test.tsx`, `src/app/api/financeiro/webhooks/[provider]/route.test.ts`.

- [ ] **RED:** In `page.test.tsx`, mock manifest disabled and expect `notFound()`. Add `src/components/financeiro/__tests__/financeiro-client.test.tsx`: mock `GET /api/financeiro/dashboard`, `GET /api/financeiro/budgets`, `GET /api/financeiro/charges`, `GET /api/financeiro/gateways`, and legacy-compatible budget payments endpoint; expect metric/rows, not null metrics or placeholder text. In webhook test, seed/mock a known charge and expect reconciliation; unknown provider/charge returns 404. Run: `npx jest src/app/dashboard/financeiro/page.test.tsx src/components/financeiro/__tests__/financeiro-client.test.tsx src/app/api/financeiro/webhooks/[provider]/route.test.ts --runInBand`. Expected: FAIL because page is client-only, dashboard props are empty, and tabs contain placeholders.
- [ ] **GREEN:** Set `financeiroManifest.jobs = ['financeiro-collections']`. Move existing page JSX to `financeiro-client.tsx`; server page checks `moduleManifest.isEnabled('financeiro')`, calls `notFound()` when false, else renders client. Add types: `FinanceMetrics={budgetConversion:number|null;collectionRecovery:number|null;received:string;pending:string;overdue:string}`, `FinanceBudget={id:string;status:string;total:string;patientId:string|null;leadId:string|null}`, `FinancePayment={id:string;amount:string;paidAt:string|null;status:string}`, `FinanceCharge={id:string;status:string;amount:string;dueDate:string|null}`, `FinanceGateway={id:string;provider:string;isEnabled:boolean;maskedLabel:string}`. Add hooks mapping `data.metrics`, `data.budgets`, `data.payments`, `data.charges`, `data.gateways` from their endpoints; pass exact arrays/metrics to matching tabs with loading/error/empty states. Do not gate provider webhook with `withModuleRoute`.
- [ ] **VERIFY:** `npx jest src/app/dashboard/financeiro/page.test.tsx src/app/api/financeiro/webhooks/[provider]/route.test.ts --runInBand` → PASS.
- [ ] **COMMIT:** `git add src/modules/financeiro/manifest.ts src/app/dashboard/financeiro src/app/api/financeiro/webhooks/[provider]/route.test.ts src/components/financeiro src/lib/hooks/use-queries.ts && git commit -m "feat(financeiro): gate dashboard and wire data"`.

## Task 8 — Bootstrap CRM, exact RBAC presets and backfill

**Files:** Modify `src/core/actions/bootstrap.ts`, `src/lib/ui/menu-actions.ts`, `src/core/rbac/presets.ts`, `scripts/backfill-rbac-permissions.mjs`; create `src/core/rbac/preset-policy.json`, `scripts/__tests__/backfill-rbac-permissions.test.mjs`; modify `src/core/actions/__tests__/bootstrap.test.ts`, `src/core/rbac/__tests__/seed.test.ts`, `src/lib/ui/__tests__/build-menu.test.ts`.

- [ ] **RED:** In bootstrap test expect CRM public/human and all Financeiro names/permissions, never reprocess. In seed test expect Administrador modules include CRM+Financeiro; Recepcionista extras equal `['crm:view']`; Comercial extras contain only CRM view/notes/tags and no merge key. In menu test enable each module independently and assert its item exists only with matching permission.
- [ ] **RED:** In `backfill-rbac-permissions.test.mjs`, load `preset-policy.json`, inject fake query client with Owner, Administrador, Recepcionista and Comercial across two clinics; assert Owner receives every non-master catalog key, staff receives only policy-derived keys, and rerun inserts zero. In `seed.test.ts`, assert `SYSTEM_PRESETS` is derived from same JSON CRM/Financeiro policy. Run: `node --test scripts/__tests__/backfill-rbac-permissions.test.mjs`. Expected: FAIL because current script grants every catalog permission to every system role.
- [ ] **GREEN:** Add dynamic imports and idempotent registry/catalog registration for both CRM and Financeiro in `bootstrap.ts`; include both manifests in menu. Create `preset-policy.json` as canonical source with `modulePermissions.crm`, `modulePermissions.financeiro`, and role module/extra-key policies. Make `presets.ts` import JSON and build `SYSTEM_PRESETS`. In `backfill(client)`, read JSON with `readFile(new URL('../src/core/rbac/preset-policy.json', import.meta.url), 'utf8')` and `JSON.parse`; first insert CRM/Financeiro permission rows from `modulePermissions`, then expand staff module keys from DB catalog, and grant Owner every non-master catalog key. Export `backfill(client)`, retain CLI `main()`, and use parameterized `ON CONFLICT DO NOTHING` inserts.
- [ ] **GREEN:** Add deployment runbook step: deploy registry/catalog, execute `DATABASE_URL=... node scripts/backfill-rbac-permissions.mjs`, rerun safely.
- [ ] **VERIFY:** `npx jest src/core/actions/__tests__/bootstrap.test.ts src/core/rbac/__tests__/seed.test.ts src/lib/ui/__tests__/build-menu.test.ts --runInBand && node --test scripts/__tests__/backfill-rbac-permissions.test.mjs` → PASS.
- [ ] **COMMIT:** `git add src/core/actions/bootstrap.ts src/core/actions/__tests__/bootstrap.test.ts src/lib/ui/menu-actions.ts src/lib/ui/__tests__/build-menu.test.ts src/core/rbac/presets.ts src/core/rbac/preset-policy.json src/core/rbac/__tests__/seed.test.ts scripts/backfill-rbac-permissions.mjs scripts/__tests__/backfill-rbac-permissions.test.mjs && git commit -m "feat(rbac): register CRM Financeiro access"`.

## Implementation snippets

```ts
// tool-policy.ts + bridge-service.ts
const safe = deps.getActions().filter((action) => isAgentSafeAction(action.name));
if (!isAgentSafeAction(action.name)) return { ok: false, error: 'unknown_tool' };
```

```ts
// bootstrap.ts
const [{ crmActions, crmAccessPermissions }, { financeiroActions, financeiroAccessPermissions }] = await Promise.all([
  import('@/modules/crm'), import('@/modules/financeiro'),
]);
registerActions(crmActions.filter((action) => !getAction(action.name)));
registerActions(financeiroActions.filter((action) => !getAction(action.name)));
registerAccessPermissions(crmAccessPermissions);
registerAccessPermissions(financeiroAccessPermissions);
```

```tsx
// dashboard page server wrapper
if (!(await moduleManifest.isEnabled('crm'))) notFound();
return <ContactsClient />;
```

```ts
// selective entity mutation block
export function crmReadOnlyResponse() {
  return NextResponse.json({ error: 'crm_mvp_read_only' }, { status: 405 });
}
export async function POST() { return crmReadOnlyResponse(); }
```

```js
// backfill-rbac-permissions.mjs
export async function backfill(client) {
  for (const role of await systemRoles(client)) {
    for (const key of PRESET_KEYS[role.name] ?? []) {
      await client.query(INSERT_MISSING_PERMISSION, [role.id, key]);
    }
  }
}
```

## Task 9 — Quality gates and acceptance verification

**Files:** Modify only focused test/config/doc files required by gates.

- [ ] **RED:** Modify `stryker.services.config.json` to add `src/core/agent-bridge/tool-policy.ts`, CRM mapping/timeline/tag services. Run `npx stryker run --config stryker.services.config.json`; expected FAIL/score below 70 until targeted tests exist. Ensure no integration test rewrites `DATABASE_URL`.
- [ ] **GREEN:** Modify only `stryker.services.config.json`. Any coverage or mutation failure changes its owning Task's tests, then reruns Task 9.
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
- [ ] **COMMIT:** If Task 9 changes `stryker.services.config.json`, commit only it: `git add stryker.services.config.json && git commit -m "test(crm): add closure mutation targets"`; otherwise no Task 9 commit.

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
