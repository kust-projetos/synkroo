-- Migration: add clinics.timezone (per-clinic timezone for agenda)
-- F5.03: agenda disponibilidade must respect clinic.timezone
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL;
--> statement-breakpoint
-- Backfill nulls to default for pre-existing rows (idempotent)
UPDATE "clinics" SET "timezone" = 'America/Sao_Paulo' WHERE "timezone" IS NULL;
--> statement-breakpoint
-- Also normalize any legacy settings.timezone into column where column still default
-- (do not overwrite explicit column values; only where column is default and settings has timezone)
UPDATE "clinics"
SET "timezone" = (settings->>'timezone')
WHERE settings ? 'timezone'
  AND (settings->>'timezone') ~ '^[A-Za-z_]+/[A-Za-z_]+'
  AND "timezone" = 'America/Sao_Paulo';
