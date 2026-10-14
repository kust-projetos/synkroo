-- P7 Slice 1 - journey pos-consulta em OBSERVE (expand-only, additive, idempotente).
--
-- UMA tabela nova (`followup_journey_instances`), sem tocar em nenhuma
-- estrutura existente. Reaplicacao segura: `CREATE TABLE IF NOT EXISTS` +
-- FKs sob guarda de `pg_constraint` + indices `IF NOT EXISTS`.
-- Sem DOWN destrutivo (rollback = forward-fix; a tabela nova so tem
-- leitores no consumidor OBSERVE + tick da journey).
--
-- Unicidade logica sempre com o tenant (`clinic_id` em toda UNIQUE): replay
-- do mesmo evento materializa uma unica instancia, e nenhum tenant le
-- objeto de outro por construcao.
CREATE TABLE IF NOT EXISTS "followup_journey_instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"journey_kind" text DEFAULT 'post_visit' NOT NULL,
	"source_event_id" text NOT NULL,
	"definition_version" text DEFAULT 'p7-s1-v1' NOT NULL,
	"state" text DEFAULT 'waiting_due' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"feedback_deadline" timestamp with time zone NOT NULL,
	"run_event_id" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followup_journey_instances_clinic_id_clinics_id_fk') THEN
		ALTER TABLE "followup_journey_instances" ADD CONSTRAINT "followup_journey_instances_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'followup_journey_instances_appointment_id_appointments_id_fk') THEN
		ALTER TABLE "followup_journey_instances" ADD CONSTRAINT "followup_journey_instances_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "followup_journey_clinic_appt_kind_uniq" ON "followup_journey_instances" USING btree ("clinic_id","appointment_id","journey_kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_journey_due_state_idx" ON "followup_journey_instances" USING btree ("clinic_id","state","due_at");
--> statement-breakpoint
-- P7S1-R10 HIGH (fairness, amend aditivo — 0039 NUNCA aplicada em banco):
-- coluna de rotação do tick + índice de seleção fair.
ALTER TABLE "followup_journey_instances" ADD COLUMN IF NOT EXISTS "last_tick_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "followup_journey_tick_fairness_idx" ON "followup_journey_instances" USING btree ("state","last_tick_at","due_at");
