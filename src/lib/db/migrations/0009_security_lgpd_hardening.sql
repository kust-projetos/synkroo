ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "legal_hold_reason" text;--> statement-breakpoint
