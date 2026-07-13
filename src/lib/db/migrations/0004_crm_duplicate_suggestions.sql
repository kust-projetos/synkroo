-- CRM duplicate suggestions: review lifecycle owned by CRM.
-- Owner records remain in Operacional/Comercial; this table stores only candidates and audit state.

CREATE TABLE "crm_duplicate_suggestions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "clinic_id" uuid NOT NULL,
  "owner_type" text NOT NULL,
  "left_id" uuid NOT NULL,
  "right_id" uuid NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "confidence" text NOT NULL,
  "duplicate_score" integer NOT NULL,
  "winner_suggested_id" uuid,
  "winner_confirmed_id" uuid,
  "signals" jsonb NOT NULL,
  "left_snapshot" jsonb NOT NULL,
  "right_snapshot" jsonb NOT NULL,
  "dismiss_reason" text,
  "merge_operation_key" text,
  "failure_reason" text,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "refreshed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "reviewed_by" uuid,
  "reviewed_at" timestamp with time zone,
  "executed_by" uuid,
  "executed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "crm_duplicate_suggestions_owner_type_check"
    CHECK (owner_type IN ('patient', 'lead')),
  CONSTRAINT "crm_duplicate_suggestions_status_check"
    CHECK (status IN ('pending', 'approved', 'executing', 'merged', 'failed', 'dismissed')),
  CONSTRAINT "crm_duplicate_suggestions_confidence_check"
    CHECK (confidence IN ('medium', 'high')),
  CONSTRAINT "crm_duplicate_suggestions_score_check"
    CHECK (duplicate_score BETWEEN 0 AND 100),
  CONSTRAINT "crm_duplicate_suggestions_left_right_check"
    CHECK (left_id <> right_id),
  CONSTRAINT "crm_duplicate_suggestions_winner_check"
    CHECK (status NOT IN ('executing', 'merged') OR winner_confirmed_id IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "crm_duplicate_suggestions"
  ADD CONSTRAINT "crm_duplicate_suggestions_clinic_id_clinics_id_fk"
  FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_duplicate_suggestions"
  ADD CONSTRAINT "crm_duplicate_suggestions_reviewed_by_users_id_fk"
  FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "crm_duplicate_suggestions"
  ADD CONSTRAINT "crm_duplicate_suggestions_executed_by_users_id_fk"
  FOREIGN KEY ("executed_by") REFERENCES "public"."users"("id")
  ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_duplicate_suggestions_pair_canonical_uniq"
  ON "crm_duplicate_suggestions" (
    "clinic_id",
    "owner_type",
    LEAST(left_id, right_id),
    GREATEST(left_id, right_id)
  );
--> statement-breakpoint
CREATE UNIQUE INDEX "crm_duplicate_suggestions_merge_operation_key_uniq"
  ON "crm_duplicate_suggestions" ("merge_operation_key")
  WHERE "merge_operation_key" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "crm_duplicate_suggestions_queue_idx"
  ON "crm_duplicate_suggestions" ("clinic_id", "status", "owner_type", "detected_at");
--> statement-breakpoint
CREATE INDEX "crm_duplicate_suggestions_left_lookup_idx"
  ON "crm_duplicate_suggestions" ("clinic_id", "owner_type", "left_id");
--> statement-breakpoint
CREATE INDEX "crm_duplicate_suggestions_right_lookup_idx"
  ON "crm_duplicate_suggestions" ("clinic_id", "owner_type", "right_id");

-- Rollback:
--   DROP TABLE IF EXISTS crm_duplicate_suggestions;
