-- Migration: Add appointments.total_value for real totalSpentMin/Max filtering

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS total_value NUMERIC(10,2) DEFAULT 0;
