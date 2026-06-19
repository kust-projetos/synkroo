-- Migration 0002: Fix schema drift — add columns present in Drizzle schema but missing in DB
-- Added: patients.status, appointments.total_value/cancelled_at/cancellation_reason/rescheduled_at/reschedule_reason
-- These columns exist in src/lib/db/schema/core.ts and src/lib/db/schema/appointments.ts
-- but were never included in the initial migration (0000_lush_firebird.sql)
-- or any subsequent migration.

-- Add status column to patients (needed by Drizzle full-table select)
ALTER TABLE "patients" ADD COLUMN "status" text DEFAULT 'active';

-- Add missing columns to appointments (needed by Drizzle full-table insert)
ALTER TABLE "appointments" ADD COLUMN "total_value" numeric(10, 2) DEFAULT '0';
ALTER TABLE "appointments" ADD COLUMN "cancelled_at" timestamp with time zone;
ALTER TABLE "appointments" ADD COLUMN "cancellation_reason" text;
ALTER TABLE "appointments" ADD COLUMN "rescheduled_at" timestamp with time zone;
ALTER TABLE "appointments" ADD COLUMN "reschedule_reason" text;
