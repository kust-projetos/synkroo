-- Fence monotônica do lease do outbox (expand-only, additive + reversível).
--
-- Outras migrations da faixa 0028-0035 não têm snapshot em meta/: por isso o
-- `drizzle-kit generate` deste repo faz diff contra 0027 e reemite o DDL daquela
-- faixa. O journal entry 0036 e o snapshot 0036 vieram do gerador canônico; o
-- SQL abaixo foi reduzido à ÚNICA alteração nova desta migration (o resto do
-- output do gerador reaplicaria colunas de 0028-0035 e quebraria o
-- migrations-from-zero).
--
-- Geração do lease: `claimOutboxJob` incrementa `claim_generation` no UPDATE
-- atômico que rouba a linha; cada liquidação (`markOutboxDelivered/Retry/
-- Deferred/DeadLetter`) casa também `claim_generation` e só altera a linha
-- quando o par (id, status, claim_generation) casa. `attempts` não pode servir
-- de fence porque o defer devolve uma tentativa (ABA).
--
-- Linhas existentes nascem em 0: DEFAULT 0 + NOT NULL backfilla no ADD COLUMN.
-- Rollback (down): ALTER TABLE "outbox_jobs"
--   DROP COLUMN IF EXISTS "claim_generation";
ALTER TABLE "outbox_jobs"
  ADD COLUMN IF NOT EXISTS "claim_generation" integer DEFAULT 0 NOT NULL;
