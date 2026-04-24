---
phase: 1
reviewers: [claude-internal, qwen]
reviewed_at: 2026-04-24T00:00:00Z
plans_reviewed: [01-01-PLAN.md, 01-02-PLAN.md, 01-03-PLAN.md, 01-04-PLAN.md, 01-05-PLAN.md, 01-06-PLAN.md]
---

# Cross-AI Plan Review — Phase 1

## Claude Internal Review

### Summary

Phase 1 plans are well-structured with clear wave dependencies, comprehensive migration safety (expand-contract pattern), and strong alignment with existing codebase patterns. The 6 plans cover the full scope from database foundation to UI tabs with proper dependency ordering. However, there are several gaps: missing patient_observations table handling in timeline, incomplete notes implementation for patients, potential performance concerns with EAV search at scale, and the sidebar navigation update from old pages to unified Contatos is not explicitly planned.

### Strengths

- **Migration safety**: Expand-contract pattern for leads.status -> stage_id keeps old column for rollback. Validation queries check for orphaned data.
- **RLS-first design**: Every new table has clinic_id denormalized and RLS policy using `(SELECT get_user_clinic_id())` wrapping for initPlan caching.
- **EAV with typed columns validated**: Pattern cross-referenced against 2 open-source implementations (open-mercato, breeze). Partial indexes per typed column.
- **Consistent codebase patterns**: Plans reference existing components and follow existing service/hook/API route patterns. No new paradigms.
- **Threat modeling per plan**: Each plan includes STRIDE analysis with mitigations. Consent audit via DB trigger is tamper-proof.
- **Deep linking via URL params**: Plan 05 uses `?contact=id&type=patient|lead` for split-view state.
- **Sound wave dependency ordering**: Wave 1 (DB) -> Wave 2 (API) -> Wave 3 (UI shell) -> Wave 4 (UI tabs).

### Concerns

- **MEDIUM — Patient notes are a workaround**: No `patient_observations` table exists. Notes stored as text concatenation in `patients.notes` — no individual entries, no pagination, no attribution.
- **MEDIUM — Sidebar navigation update not planned**: No task to redirect /dashboard/pacientes and /dashboard/leads to /dashboard/contatos or update sidebar menu.
- **MEDIUM — No error boundary for split-view**: No handling for API unreachable, contact deleted by another user, or panel layout failures.
- **LOW — ILIKE search scalability**: No migration path to pg_trgm defined if clinics grow beyond 10K contacts.
- **LOW — Custom field import lacks conflict resolution**: importDefinitions silently skips existing definitions even if field_type changed.
- **LOW — Timeline cursor encoding**: Exact encoding/decoding logic not specified in any plan.

### Suggestions

1. Add `patient_observations` table to Migration 01 or document workaround as Phase 2 scope.
2. Add sidebar navigation update task to Plan 05 (redirect old routes, update menu).
3. Add error boundary component to split-view.
4. Specify cursor encoding format in Plan 04 (e.g., `btoa(\`${timestamp}::${source_id}\`)`).
5. Add configurable debounce constant for search.
6. Plan 06 should add CTA linking to settings page for custom field management.

### Risk Assessment

**Overall Risk: MEDIUM** — Database foundation well-designed, API layer low-risk. Main risks: patient notes workaround, missing sidebar update, timeline performance edge cases.

---

## Qwen Review

### Summary

The migration plan lays a solid foundation for the unified contacts feature. It addresses the critical RLS helper consolidation, introduces the EAV custom fields structure, adds consents with audit logging, and sets up clinic_tags. The approach follows Supabase best practices (RLS on every table, use of SECURITY DEFINER for triggers, expand-contract pattern for status migration) and includes seed data for pipeline stages. Overall, the plan is comprehensive and aligns with the phase goals, though some edge cases and validation steps could be strengthened.

### Strengths

- Consolidates conflicting RLS helper functions into a single `get_user_clinic_id()` and updates all policies, eliminating recursion risks.
- Uses expand-contract pattern for migrating `leads.status` to FK, preserving existing data while enabling future flexibility.
- EAV design with typed columns supports efficient querying and type safety.
- Consents table includes proper audit trigger writing to existing `audit_logs` with `SECURITY DEFINER`.
- All new tables include `clinic_id` and RLS policies, critical for multi-tenancy.
- Seed data for default pipeline stages provides immediate usability.
- Validation queries are planned post-push to catch misconfigurations early.

### Concerns

- **HIGH**: The migration does not explicitly show how existing `patients.notes` and `lead_activities` will be merged into the interaction timeline; reliance on application-layer merging may lead to duplicated effort or inconsistency.
- **MEDIUM**: The EAV schema lacks a `deleted_at` soft-delete column for custom field values, complicating auditing and recovery.
- **MEDIUM**: No explicit composite index on `(clinic_id, contact_id)` in custom field tables, which could slow per-clinic lookups.
- **LOW**: The consents trigger uses `SECURITY DEFINER` but does not restrict the definer to a least-privileged role.
- **LOW**: Migration scripts do not include explicit rollback (`DROP`) statements, making manual rollback more error-prone.

### Suggestions

1. Add a composite index on `(clinic_id, contact_id, definition_id)` in `custom_field_values` to accelerate filtering.
2. Consider adding `value_updated_at` timestamp to `custom_field_values` for change-tracking and conflict resolution.
3. Add `deleted_at` column in `custom_field_definitions` and `custom_field_values` for soft-delete semantics.
4. Document timeline data sources in migration comments for future developers.
5. Add a post-migration validation script that tests RLS policies with wrong `clinic_id`.
6. For `leads.status` migration, add a data-validation step verifying all status values map to valid `pipeline_stages.id`.

### Risk Assessment

**Overall Risk: MEDIUM** — Technically sound with core multi-tenant and extensibility requirements addressed. Primary risks: EAV indexing performance gaps, application-level timeline merging.

---

## Consensus Summary

### Agreed Strengths (2/2 reviewers)

1. **Migration safety** — expand-contract pattern with rollback capability
2. **RLS-first design** — clinic_id denormalized on every table, get_user_clinic_id() consolidation
3. **EAV typed columns validated** — cross-referenced with open-source implementations
4. **Consent audit via DB trigger** — tamper-proof by design
5. **Seed data for pipeline stages** — immediate usability

### Agreed Concerns (2/2 reviewers)

1. **Timeline data source merging is fragile** — no patient_observations table, application-layer merge of patients.notes + lead_activities may cause inconsistency (Claude: MEDIUM, Qwen: HIGH)
2. **EAV indexing could be improved** — missing composite index on (clinic_id, contact_id) for custom_field_values (Qwen raised, Claude implicitly covered via partial indexes)
3. **Migration rollback not explicit** — no DROP statements or rollback scripts (Qwen raised, Claude noted expand-contract keeps safety)

### Divergent Views

- **Qwen only**: Wants `deleted_at` soft-delete columns on custom_field tables. Claude's plans use `is_active` flag on definitions and rely on upsert pattern for values — different approach to the same problem.
- **Claude only**: Flags missing sidebar navigation update, error boundary for split-view, and ILIKE scalability as concerns. Qwen did not review UI plans in detail.

---

## Action Items for Planner

Before executing Phase 1, incorporate via `/gsd-plan-phase 1 --reviews`:

1. [ ] Add `patient_observations` table to Plan 01 migrations, OR document the notes workaround as known limitation
2. [ ] Add sidebar navigation update task to Plan 05 (redirect old routes, update menu)
3. [ ] Add composite index `(clinic_id, contact_id)` to custom_field_values in Migration 04
4. [ ] Add error boundary handling to Plan 05 split-view
5. [ ] Specify cursor encoding format in Plan 04 timeline service
6. [ ] Add post-migration RLS validation script to Plan 01 Task 2
7. [ ] Document timeline data sources in migration comments

---

*Review completed: 2026-04-24*
*Reviewers: Claude (internal), Qwen (external)*
*To incorporate feedback: `/gsd-plan-phase 1 --reviews`*
