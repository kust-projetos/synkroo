-- W3: active membership metadata and tenant-scoped RBAC foreign keys.
-- Preconditions checked before authoring: no role/clinic mismatches and no
-- orphan permission overrides in the current database.

ALTER TABLE "user_clinic_access"
  ADD COLUMN IF NOT EXISTS "expires_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "user_clinic_access"
  ADD COLUMN IF NOT EXISTS "revoked_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "user_clinic_access"
  ADD COLUMN IF NOT EXISTS "grant_reason" text;
--> statement-breakpoint
ALTER TABLE "user_clinic_access"
  ADD COLUMN IF NOT EXISTS "granted_by" uuid;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_clinic_access_granted_by_users_id_fk'
  ) THEN
    ALTER TABLE "user_clinic_access"
      ADD CONSTRAINT "user_clinic_access_granted_by_users_id_fk"
      FOREIGN KEY ("granted_by") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "roles_id_clinic_id_uniq"
  ON "roles" ("id", "clinic_id");
--> statement-breakpoint

-- Older seeds may have granted a permission before its catalog row existed.
-- Preserve those grants with a deterministic technical catalog entry so the
-- FK can be added; the versioned reconcile later replaces its metadata.
INSERT INTO "permissions" ("key", "module", "label")
SELECT DISTINCT rp."permission_key",
       split_part(rp."permission_key", ':', 1),
       rp."permission_key"
  FROM "role_permissions" rp
  LEFT JOIN "permissions" p ON p."key" = rp."permission_key"
 WHERE p."key" IS NULL
ON CONFLICT ("key") DO NOTHING;
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'role_permissions_permission_key_fk'
  ) THEN
    ALTER TABLE "role_permissions"
      ADD CONSTRAINT "role_permissions_permission_key_fk"
      FOREIGN KEY ("permission_key") REFERENCES "permissions"("key")
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "role_permissions"
  VALIDATE CONSTRAINT "role_permissions_permission_key_fk";
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_clinic_access_role_clinic_fk'
  ) THEN
    ALTER TABLE "user_clinic_access"
      ADD CONSTRAINT "user_clinic_access_role_clinic_fk"
      FOREIGN KEY ("role_id", "clinic_id")
      REFERENCES "roles"("id", "clinic_id")
      ON DELETE RESTRICT NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_clinic_access"
  VALIDATE CONSTRAINT "user_clinic_access_role_clinic_fk";
--> statement-breakpoint

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_permission_overrides_membership_fk'
  ) THEN
    ALTER TABLE "user_permission_overrides"
      ADD CONSTRAINT "user_permission_overrides_membership_fk"
      FOREIGN KEY ("user_id", "clinic_id")
      REFERENCES "user_clinic_access"("user_id", "clinic_id")
      ON DELETE CASCADE NOT VALID;
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "user_permission_overrides"
  VALIDATE CONSTRAINT "user_permission_overrides_membership_fk";
