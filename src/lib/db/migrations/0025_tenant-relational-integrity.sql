-- W2.1 tenant-relational-integrity: add tenant columns (nullable first), backfill from budgets, prepare for composite FKs
ALTER TABLE "budget_installments" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_items" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;--> statement-breakpoint
-- Add FK to clinics (nullable, cascade)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_installments_clinic_id_clinics_id_fk') THEN
    ALTER TABLE "budget_installments" ADD CONSTRAINT "budget_installments_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_items_clinic_id_clinics_id_fk') THEN
    ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
-- Backfill clinic_id from budgets (idempotent, only where null)
UPDATE "budget_installments" SET "clinic_id" = "budgets"."clinic_id" FROM "budgets" WHERE "budget_installments"."budget_id" = "budgets"."id" AND "budget_installments"."clinic_id" IS NULL;--> statement-breakpoint
UPDATE "budget_items" SET "clinic_id" = "budgets"."clinic_id" FROM "budgets" WHERE "budget_items"."budget_id" = "budgets"."id" AND "budget_items"."clinic_id" IS NULL;--> statement-breakpoint
-- Support unique (clinic_id, id) for composite FK targets (concurrently safe, idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "patients_clinic_id_id_uniq" ON "patients" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dentists_clinic_id_id_uniq" ON "dentists" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "procedures_clinic_id_id_uniq" ON "procedures" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_clinic_id_id_uniq" ON "appointments" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "budgets_clinic_id_id_uniq" ON "budgets" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_gateways_clinic_id_id_uniq" ON "payment_gateways" ("clinic_id", "id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_charges_clinic_id_id_uniq" ON "payment_charges" ("clinic_id", "id");--> statement-breakpoint
-- Audit block: abort if any orphan or divergent clinic relation exists (fail-closed, no silent fix)
DO $$
DECLARE orphan_count int;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM "budget_installments" WHERE "clinic_id" IS NULL;
  IF orphan_count > 0 THEN RAISE EXCEPTION 'W2 audit failed: % budget_installments rows with null clinic_id', orphan_count; END IF;
  SELECT COUNT(*) INTO orphan_count FROM "budget_items" WHERE "clinic_id" IS NULL;
  IF orphan_count > 0 THEN RAISE EXCEPTION 'W2 audit failed: % budget_items rows with null clinic_id', orphan_count; END IF;
  -- Cross-tenant check: installments where budgets clinic differs from installments clinic (should be zero after backfill)
  SELECT COUNT(*) INTO orphan_count FROM "budget_installments" bi JOIN "budgets" b ON bi."budget_id"=b."id" WHERE bi."clinic_id" IS DISTINCT FROM b."clinic_id";
  IF orphan_count > 0 THEN RAISE EXCEPTION 'W2 audit failed: % budget_installments with divergent clinic_id vs budgets', orphan_count; END IF;
  SELECT COUNT(*) INTO orphan_count FROM "budget_items" bi JOIN "budgets" b ON bi."budget_id"=b."id" WHERE bi."clinic_id" IS DISTINCT FROM b."clinic_id";
  IF orphan_count > 0 THEN RAISE EXCEPTION 'W2 audit failed: % budget_items with divergent clinic_id', orphan_count; END IF;
END $$;--> statement-breakpoint