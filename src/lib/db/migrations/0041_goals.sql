CREATE TABLE IF NOT EXISTS "goals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open',
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "goals_clinic_id_idx" ON "goals" ("clinic_id");
CREATE INDEX IF NOT EXISTS "goals_clinic_status_idx" ON "goals" ("clinic_id", "status");
