-- FIX-REVIEW-R1 (C.1): idempotency replay fingerprint (expand-only).
-- Additive NULL column on idempotency_keys — no rewrite, no NOT NULL, no index.
ALTER TABLE "idempotency_keys"
  ADD COLUMN IF NOT EXISTS "fingerprint" text;
