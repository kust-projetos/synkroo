-- P4 Slice 1B — proposta observável (expand-only, additive, idempotente).
--
-- Só ADICIONA colunas anuláveis em `agent_runs` (`result`/`sources` JSONB,
-- `error_code` TEXT): reaplicação segura via `ADD COLUMN IF NOT EXISTS`.
-- Sem DOWN destrutivo (rollback = forward-fix). Nenhuma tabela de negócio é
-- tocada e as migrations 0000-0037 seguem intactas.
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "result" jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "sources" jsonb;--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN IF NOT EXISTS "error_code" text;