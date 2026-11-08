-- P0 exact WhatsApp confirmation: consumable pending-request table.
--
-- UMA tabela nova (`appointment_confirmation_requests`), sem tocar em
-- nenhuma estrutura existente. A pendência é o ÚNICO objeto consumível
-- pelo caminho de confirmação exata: liga tenant + consulta + conversa
-- confiável + remetente normalizado, com expiração. Cada pendência captura
-- o snapshot do horário exibido (`appointment_scheduled_at`, mesma semântica
-- timestamptz de `appointments.scheduled_at`, persistido via INSERT ... SELECT
-- direto da linha travada — nunca via parâmetro JS Date, que arredonda
-- microssegundos de timestamptz para milissegundos) mais o paciente
-- (`patient_id`) e o timezone resolvido da
-- clínica (`clinic_timezone`): o consumo exige igualdade exata com a linha
-- atual (tempo via comparação SQL coluna-a-coluna, paciente + telefone
-- contra o remetente confiável; `appointment_changed`/`sender_mismatch`
-- sem mutação em divergência) e todo replay formata a partir DESSE snapshot
-- — nunca do horário
-- corrente. Nenhum texto de resposta é persistido (snapshot + outcome
-- bastam; evita cópia extra de PII). Consumo é atômico
-- (transação + row lock + update condicional + registro do evento
-- inbound); replay do mesmo evento encontra o registro sem remutar. O
-- índice de evento é UNIQUE parcial (uma âncora por evento inbound).
--
-- Waitlist scheduling is DISABLED (preferences are not a concrete offer):
-- this migration creates NO waitlist columns or indexes. Notified waitlist
-- rows still participate in confirmation ambiguity/revalidation via the
-- pre-existing `notified_at`/`status` lock, but no `accepted_*` anchor
-- exists.
--
-- Unicidade lógica sempre com o tenant (`clinic_id` em toda UNIQUE):
-- no máximo UMA pendência ativa por (clínica, remetente), independente de
-- consulta/conversa; resposta sem contexto único (0, >1 ou conversa
-- divergente) nunca muta. O índice de evento é UNIQUE parcial: cada
-- evento inbound ancora no máximo um consumo (quando ambos
-- os campos de âncora são não-nulos).
CREATE TABLE "appointment_confirmation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clinic_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_normalized" text NOT NULL,
	"appointment_scheduled_at" timestamp with time zone NOT NULL,
	"clinic_timezone" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_provider" text,
	"consumed_by_event" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "appointment_confirmation_requests" ADD CONSTRAINT "appointment_confirmation_requests_clinic_id_clinics_id_fk" FOREIGN KEY ("clinic_id") REFERENCES "public"."clinics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_confirmation_requests" ADD CONSTRAINT "appointment_confirmation_requests_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_confirmation_requests" ADD CONSTRAINT "appointment_confirmation_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "appt_confirm_pending_sender_uniq" ON "appointment_confirmation_requests" USING btree ("clinic_id","sender_normalized") WHERE "appointment_confirmation_requests"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "appt_confirm_lookup_idx" ON "appointment_confirmation_requests" USING btree ("clinic_id","sender_normalized","status");--> statement-breakpoint
CREATE UNIQUE INDEX "appt_confirm_event_idx" ON "appointment_confirmation_requests" USING btree ("clinic_id","consumed_by_provider","consumed_by_event") WHERE "appointment_confirmation_requests"."consumed_by_provider" IS NOT NULL AND "appointment_confirmation_requests"."consumed_by_event" IS NOT NULL;
