-- Migration 0004: Create RBAC tables + users.isMaster column
-- Part of W3.2 — roles, permissoes, acesso multi-clinica, overrides por usuario.
-- Enables granular RBAC for the Action Layer (W3.1) and future W3.3-W3.5.
-- Migrates away from the legacy user_role enum (owner/admin/dentist/receptionist).

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permission_key" text NOT NULL,
  PRIMARY KEY ("role_id", "permission_key")
);

CREATE TABLE "user_clinic_access" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "clinic_id")
);

CREATE TABLE "user_permission_overrides" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "clinic_id" uuid NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
  "permission_key" text NOT NULL,
  "granted" boolean NOT NULL,
  PRIMARY KEY ("user_id", "clinic_id", "permission_key")
);

CREATE TABLE "permissions" (
  "key" text PRIMARY KEY,
  "module" text NOT NULL,
  "label" text NOT NULL
);

-- Add isMaster column to users (default false, non-nullable)
ALTER TABLE "users" ADD COLUMN "is_master" boolean DEFAULT false NOT NULL;

-- Indexes for common query patterns
CREATE INDEX "roles_clinic_id_idx" ON "roles" ("clinic_id");
CREATE INDEX "user_clinic_access_user_id_idx" ON "user_clinic_access" ("user_id");
CREATE INDEX "user_clinic_access_clinic_id_idx" ON "user_clinic_access" ("clinic_id");
CREATE INDEX "permissions_module_idx" ON "permissions" ("module");
