CREATE UNIQUE INDEX IF NOT EXISTS "payments_charge_id_uniq" ON "payments" ("charge_id") WHERE "payments"."charge_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "gateway_events_provider_external_event_uniq" ON "gateway_events" ("provider", "external_event_id");
