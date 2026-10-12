-- S5-PERSIST: approval tokens persistidos (multi-instância, single-use fail-closed).
-- Guarda SÓ o sha256 do token (token_hash, PK) — NUNCA o token em log ou coluna.
-- Tabela efêmera (TTL default 15min); expirados removidos por lazy purge no consumo.
-- clinic_id/user_id/on_behalf_of são text sem FK (escopo por igualdade de valor).
-- Rollback (down): DROP TABLE IF EXISTS "approval_tokens";
CREATE TABLE IF NOT EXISTS "approval_tokens" (
  "token_hash" text PRIMARY KEY,
  "action" text NOT NULL,
  "input_hash" text NOT NULL,
  "clinic_id" text NOT NULL,
  "actor" text NOT NULL,
  "user_id" text,
  "on_behalf_of" text,
  "source" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz
);
