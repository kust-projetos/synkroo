-- G4: query-driven indexes with EXPLAIN evidence (docs/spikes/2026-09-14-sql-profiling.md).
-- messages: Seq Scan on conversation_id filter (no index existed) — findMessagesByConversation,
-- countMessagesByConversation, getLastMessage, getConversationContext.
CREATE INDEX IF NOT EXISTS "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
-- leads: Seq Scan on clinic_id filter (partial unique on phone_normalized does not serve it) —
-- listLeadsByClinic, listAllLeadsWithStage.
CREATE INDEX IF NOT EXISTS "leads_clinic_idx" ON "leads" USING btree ("clinic_id");
