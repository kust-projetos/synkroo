-- S5: ActionAttempt evolution (expand-only, additive + reversible).
-- Adds NULL columns on action_logs — no rewrite, no NOT NULL, no index.
-- duration_ms: handler wall-time for performance/deadline analysis.
-- policy_version: approval policy that gated the call (e.g. 's5-approval-v1').
-- decision: PolicyDecision ('allow' | 'deny' | 'approval_required').
-- approval_id: fingerprint (16 hex) of the consumed approval token — NEVER the token.
-- Rollback (down): ALTER TABLE "action_logs"
--   DROP COLUMN IF EXISTS "approval_id",
--   DROP COLUMN IF EXISTS "decision",
--   DROP COLUMN IF EXISTS "policy_version",
--   DROP COLUMN IF EXISTS "duration_ms";
ALTER TABLE "action_logs"
  ADD COLUMN IF NOT EXISTS "duration_ms" integer;
ALTER TABLE "action_logs"
  ADD COLUMN IF NOT EXISTS "policy_version" text;
ALTER TABLE "action_logs"
  ADD COLUMN IF NOT EXISTS "decision" text;
ALTER TABLE "action_logs"
  ADD COLUMN IF NOT EXISTS "approval_id" text;
