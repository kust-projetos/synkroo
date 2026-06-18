-- Migration 0005: Create instance_modules table for module contracting
-- Part of W3.3 — per-instance module enable/disable (manifesto).
-- moduleId PK = singleton per instance; enabled = false by default.

CREATE TABLE "instance_modules" (
  "module_id" text PRIMARY KEY,
  "enabled" boolean DEFAULT false NOT NULL,
  "contracted_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
