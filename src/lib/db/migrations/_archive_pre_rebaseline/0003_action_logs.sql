-- Migration 0003: Create action_logs table for Action Layer audit
-- Part of W3.1 — records every runAction execution for traceability and compliance (LGPD).

CREATE TABLE "action_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinic_id" uuid REFERENCES "clinics"("id") ON DELETE SET NULL,
  "principal_type" text,
  "actor" text NOT NULL,
  "on_behalf_of" uuid,
  "action_name" text NOT NULL,
  "module" text NOT NULL,
  "input_redacted" jsonb DEFAULT '{}',
  "result" text NOT NULL,
  "error_code" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "action_logs_clinic_id_idx" ON "action_logs" ("clinic_id");
CREATE INDEX "action_logs_action_name_idx" ON "action_logs" ("action_name");
CREATE INDEX "action_logs_created_at_idx" ON "action_logs" ("created_at");
