-- W6.4: explicit HTTPS origin allowlist for public widget installations.
ALTER TABLE "channel_installations"
  ADD COLUMN IF NOT EXISTS "allowed_origins" text[] NOT NULL DEFAULT '{}';
