ALTER TABLE "messages" ADD COLUMN "external_provider" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "external_message_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_external_provider_event_unique" ON "messages" USING btree ("external_provider","external_message_id");