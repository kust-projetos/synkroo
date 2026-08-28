-- W2.2 segunda janela: remover FKs simples redundantes e adicionar FKs compostas tenant-scoped
-- Ordem obrigatória: adicionar como NOT VALID, validar, depois SET NOT NULL e remover antigas em janela separada
-- Pré-condição: 0025 já backfillou clinic_id e auditou divergências (COUNT 0)

-- Appointments → patient/dentist/procedure (composta)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_patient_clinic_fk') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_clinic_fk" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "patients"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_dentist_clinic_fk') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dentist_clinic_fk" FOREIGN KEY ("dentist_id", "clinic_id") REFERENCES "dentists"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_procedure_clinic_fk') THEN
    ALTER TABLE "appointments" ADD CONSTRAINT "appointments_procedure_clinic_fk" FOREIGN KEY ("procedure_id", "clinic_id") REFERENCES "procedures"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Budgets → patient/appointment/lead/campaign (quando não nulo)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_patient_clinic_fk') THEN
    ALTER TABLE "budgets" ADD CONSTRAINT "budgets_patient_clinic_fk" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "patients"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budgets_appointment_clinic_fk') THEN
    ALTER TABLE "budgets" ADD CONSTRAINT "budgets_appointment_clinic_fk" FOREIGN KEY ("appointment_id", "clinic_id") REFERENCES "appointments"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Budget items/installments → budget (composta)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_items_budget_clinic_fk') THEN
    ALTER TABLE "budget_items" ADD CONSTRAINT "budget_items_budget_clinic_fk" FOREIGN KEY ("budget_id", "clinic_id") REFERENCES "budgets"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'budget_installments_budget_clinic_fk') THEN
    ALTER TABLE "budget_installments" ADD CONSTRAINT "budget_installments_budget_clinic_fk" FOREIGN KEY ("budget_id", "clinic_id") REFERENCES "budgets"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Payments → budget/patient/charge (composta)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_budget_clinic_fk') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_budget_clinic_fk" FOREIGN KEY ("budget_id", "clinic_id") REFERENCES "budgets"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_patient_clinic_fk') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_clinic_fk" FOREIGN KEY ("patient_id", "clinic_id") REFERENCES "patients"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_charge_clinic_fk') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_charge_clinic_fk" FOREIGN KEY ("charge_id", "clinic_id") REFERENCES "payment_charges"("id", "clinic_id") ON DELETE set null NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Payment charges → budget/gateway (composta)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_charges_budget_clinic_fk') THEN
    ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_budget_clinic_fk" FOREIGN KEY ("budget_id", "clinic_id") REFERENCES "budgets"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_charges_gateway_clinic_fk') THEN
    ALTER TABLE "payment_charges" ADD CONSTRAINT "payment_charges_gateway_clinic_fk" FOREIGN KEY ("gateway_id", "clinic_id") REFERENCES "payment_gateways"("id", "clinic_id") ON DELETE restrict NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Gateway routing rules → gateway e campaign/patient/lead opcionais
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gateway_routing_gateway_clinic_fk') THEN
    ALTER TABLE "gateway_routing_rules" ADD CONSTRAINT "gateway_routing_gateway_clinic_fk" FOREIGN KEY ("gateway_id", "clinic_id") REFERENCES "payment_gateways"("id", "clinic_id") ON DELETE cascade NOT VALID;
  END IF;
END $$;--> statement-breakpoint

-- Validar constraints uma a uma (após dados já consistentes)
ALTER TABLE "appointments" VALIDATE CONSTRAINT "appointments_patient_clinic_fk";--> statement-breakpoint
ALTER TABLE "appointments" VALIDATE CONSTRAINT "appointments_dentist_clinic_fk";--> statement-breakpoint
ALTER TABLE "appointments" VALIDATE CONSTRAINT "appointments_procedure_clinic_fk";--> statement-breakpoint
ALTER TABLE "budgets" VALIDATE CONSTRAINT "budgets_patient_clinic_fk";--> statement-breakpoint
ALTER TABLE "budgets" VALIDATE CONSTRAINT "budgets_appointment_clinic_fk";--> statement-breakpoint
ALTER TABLE "budget_items" VALIDATE CONSTRAINT "budget_items_budget_clinic_fk";--> statement-breakpoint
ALTER TABLE "budget_installments" VALIDATE CONSTRAINT "budget_installments_budget_clinic_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_budget_clinic_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_patient_clinic_fk";--> statement-breakpoint
ALTER TABLE "payments" VALIDATE CONSTRAINT "payments_charge_clinic_fk";--> statement-breakpoint
ALTER TABLE "payment_charges" VALIDATE CONSTRAINT "payment_charges_budget_clinic_fk";--> statement-breakpoint
ALTER TABLE "payment_charges" VALIDATE CONSTRAINT "payment_charges_gateway_clinic_fk";--> statement-breakpoint
ALTER TABLE "gateway_routing_rules" VALIDATE CONSTRAINT "gateway_routing_gateway_clinic_fk";--> statement-breakpoint

-- SET NOT NULL para payments.clinic_id já auditado (0025 garantiu backfill)
-- Aplicar somente após validação
-- ALTER TABLE "payments" ALTER COLUMN "clinic_id" SET NOT NULL; -- deferido para próxima janela após revalidação de dados órfãos
