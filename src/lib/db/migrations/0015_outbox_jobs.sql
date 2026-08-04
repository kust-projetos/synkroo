CREATE TABLE IF NOT EXISTS "outbox_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "operation" text NOT NULL,
  "business_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "next_attempt_at" timestamptz DEFAULT now(),
  "last_error_code" text,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now(),
  CONSTRAINT "outbox_jobs_clinic_operation_business_uniq" UNIQUE ("clinic_id", "operation", "business_key")
);
