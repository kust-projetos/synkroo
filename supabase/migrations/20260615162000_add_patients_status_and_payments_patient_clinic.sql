-- Migration: Add patients.status + payments.patient_id + payments.clinic_id
-- Schema Unblock Batch 2

ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinic_id UUID REFERENCES clinics(id) ON DELETE CASCADE;
