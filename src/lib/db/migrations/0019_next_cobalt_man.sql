ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "external_provider" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "external_message_id" text;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "messages"
    WHERE "external_provider" IS NOT NULL
      AND "external_message_id" IS NOT NULL
    GROUP BY "external_provider", "external_message_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot create messages_external_provider_event_unique: duplicate external provider events exist; reconcile duplicates first';
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "messages_external_provider_event_unique" ON "messages" USING btree ("external_provider","external_message_id");