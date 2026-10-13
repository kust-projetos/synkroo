-- P4 Slice 1A — ingestão OBSERVE (expand-only, additive, idempotente).
--
-- Três tabelas novas, sem tocar em nenhuma estrutura existente:
-- `business_events` (envelope do fato), `goals` (conjunto lógico em fila) e
-- `agent_runs` (run enfileirada, sem executor neste slice).
--
-- Reaplicação segura: `CREATE TABLE IF NOT EXISTS` + `ADD CONSTRAINT` sob
-- guarda de `pg_constraint` + `CREATE UNIQUE INDEX IF NOT EXISTS`.
-- Sem DOWN destrutivo (rollback = forward-fix; as tabelas novas não têm
-- leitores além do consumidor OBSERVE).
--
-- Unicidade lógica sempre com o tenant (`clinic_id` em toda UNIQUE): replay
-- do mesmo evento materializa um único conjunto lógico e nenhum tenant lê
-- objeto de outro por construção.
CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"mode" text DEFAULT 'observe' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "business_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"payload" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_clinic_id_clinics_id_fk') THEN
		ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_events_clinic_id_clinics_id_fk') THEN
		ALTER TABLE "business_events" ADD CONSTRAINT "business_events_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'goals_clinic_id_clinics_id_fk') THEN
		ALTER TABLE "goals" ADD CONSTRAINT "goals_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;
	END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_runs_clinic_event_uniq" ON "agent_runs" USING btree ("clinic_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "business_events_clinic_event_uniq" ON "business_events" USING btree ("clinic_id","event_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "goals_clinic_event_uniq" ON "goals" USING btree ("clinic_id","event_id");
