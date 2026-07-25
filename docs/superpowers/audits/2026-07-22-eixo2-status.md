# Eixo 2 — Audit Status

**Date:** 2026-07-22<br>
**Method:** current-checkout code/plan inspection; a checked plan box is not completion evidence.

## Status matrix

| Plan | Implementation | Validation | Evidence / remaining work |
|---|---|---|---|
| Core module + refinements | **Concluído** | Focused evidence recorded | Repositories/services/actions, RBAC seam, gates and configuration UI exist. |
| Operacional module | **Concluído** | Focused evidence recorded | Schema seam, EXCLUDE no-overlap migration, actions/adapters, availability and module gates exist. Sidebar is manifest-driven through `getVisibleCoreMenu` (a backward-compatible alias of `getVisibleMenu`), which assembles every module manifest. |
| Atendimento module | **Parcial** | Targeted tests/typechecks passed; full validation blocked | Gates, repository, dedup, services and actions exist. Full Jest has one Instagram webhook failure; integration DB and Workers smoke are unproven. |
| E01 multichannel (historical) | **Parcial** | No current acceptance | Superseded by the canonical Atendimento plan; scaffold/actions/routes exist, but current gates are not proven. |
| E03 follow-up | **Concluído** | **Parcial** | Cron now invokes tenant-scoped Follow-up actions per active clinic with an explicit allowlisted cron context; manual feedback validates patient/appointment ownership. 42 focused tests, typecheck and diff check pass. Integration is blocked because Docker Desktop/PostgreSQL is unavailable. |
| IA app boundary | **Parcial** | Targeted tests/typechecks passed | Bridge/catalog/matrix/worker shell exist; worker integration and real `wrangler dev`/RPC evidence are absent. |
| IA worker agent | **Parcial** | Targeted tests/typechecks passed | Provider, personas, loop and persistent storage exist. Worker uses raw `DurableObject`, not the planned Agents SDK `Agent`/`@callable`; formal decision and RPC smoke are required. |
| IA channels OpenNext | **Parcial** | Smoke/build blocked | Bindings/invoker/chat and Meta/Evolution wiring exist. Evolution reports `ai_enabled:false`, Instagram retains a stale marker, and smoke/build did not complete. |
| Hardening final | **Parcial** | Documented | All listed production hardening is documented done; DBC-1 is deferred. |
| Comercial module | **Concluído** | Fresh full suite not run | Schema/actions/routes/cross-module bridges exist. `hot-leads` does include `assertModuleForJob('comercial', moduleManifest)`. `getVisibleMenu` includes Comercial manifest. Legacy lead/pipeline paths have no production imports (only test commentary/mocks found). |
| CRM module | **Concluído** | Closure evidence recorded | CRM read model/actions/routes exist; `/api/contacts` is CRM-gated and its POST returns `405 crm_mvp_read_only`. |
| Financeiro & cobrança | **Concluído** | Closure evidence recorded | Financeiro module, route surface, dashboard, manifest and webhook coverage exist. |
| CRM dedup/merge | **Concluído** | Security follow-up recorded | Duplicate schema/actions/queue exist; later hardening covers CAS/tenant invariants. |
| Security & integrity hardening | **Parcial** | **Parcial** | `git diff 659b3507..HEAD -- src/app/api/instagram/webhook/route.ts` is empty; Security Task 5 never landed. The route still HMACs decoded text and uses a prefix-only signature check. Task 8 also requires a green remote GitHub Actions run. |
| CRM + Financeiro closure | **Concluído** | **Parcial** | `695dfa9d feat: close CRM and financeiro integration contracts` changes 102 files. Fresh full gates were not runnable in this session because local wrappers intermittently failed to start commands. Browser E2E is explicitly deferred in `docs/adr/e2e-deferral.md`. |

## Verified closure evidence

- `src/core/agent-bridge/tool-policy.ts`: explicit IA allowlist and deny-by-default policy.
- `src/app/api/contacts/route.ts`: CRM gate and selective read-only entity contract.
- `src/core/actions/bootstrap.ts`: idempotent CRM and Financeiro action/permission registration.
- `src/modules/financeiro/manifest.ts`: Financeiro menu and `financeiro-collections` job.
- `src/app/api/cron/hot-leads/route.ts`: authenticated Comercial job gate.
- `src/lib/ui/menu-actions.ts`: `getVisibleMenu` assembles Core, Operacional, Atendimento, Followup, IA, Comercial, CRM and Financeiro manifests; `getVisibleCoreMenu` is only a compatibility alias.

## Recommended next work

1. Restore the unrelated tracked `.open-next/**` build-output deletions, then correct the failing Instagram webhook test/contract.
2. Start the local PostgreSQL test DB and re-run integration plus Cloudflare smoke gates.
3. Migrate E03 cron execution to registered Follow-up actions; resolve or formally accept the Agents SDK vs raw Durable Object architectural deviation.
4. Re-run CRM/Financeiro closure and Security focused gates; push Security hardening only when authorized and require remote GitHub Actions green for Task 8.
5. Keep Cloudflare runtime/credentials validation separate from module-contract cleanup.

## Limitations

- The Atendimento/IA reviewer completed: targeted suites (112 tests), typechecks and lint passed; `npm test` has one Instagram webhook failure, integration cannot seed the unavailable DB, and `build:cf` hits DB `ECONNREFUSED`.
- The failed build deleted tracked `.open-next/**` artifacts. This audit did not restore or stage those unrelated deletions.
- A coder independently ran `npm run typecheck` successfully. No fresh full suite is claimed here.
