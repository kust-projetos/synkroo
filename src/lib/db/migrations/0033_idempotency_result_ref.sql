-- FIX-REVIEW-R2 (B.1): idempotency replay result binding (expand-only).
-- Additive NULL column on idempotency_keys — no rewrite, no NOT NULL, no index.
ALTER TABLE "idempotency_keys"
  ADD COLUMN IF NOT EXISTS "result_ref" text;
