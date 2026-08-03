ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "version" varchar(50) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "consents" ADD COLUMN IF NOT EXISTS "actor" text;--> statement-breakpoint
