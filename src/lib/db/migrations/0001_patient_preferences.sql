-- Migration: add patient_preferences table
-- Used by: src/lib/db/schema/core.ts (patientPreferences)

CREATE TABLE "patient_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
	"clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "patient_preferences_patient_key_uniq" UNIQUE("patient_id", "key")
);
--> statement-breakpoint
CREATE INDEX "patient_preferences_patient_id_idx" ON "patient_preferences"("patient_id");
--> statement-breakpoint
CREATE INDEX "patient_preferences_clinic_id_idx" ON "patient_preferences"("clinic_id");
--> statement-breakpoint
CREATE INDEX "patient_preferences_category_idx" ON "patient_preferences"("category");