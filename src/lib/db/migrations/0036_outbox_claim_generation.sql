-- Fence monotônica do lease do outbox (expand-only, additive + reversível)
-- + gate de manutenção pause/resume/drain com autoridade no PostgreSQL.
--
-- Outras migrations da faixa 0028-0035 não têm snapshot em meta/: por isso o
-- `drizzle-kit generate` deste repo faz diff contra 0027 e reemite o DDL daquela
-- faixa. O journal entry 0036 e o snapshot 0036 vieram do gerador canônico; o
-- SQL abaixo foi reduzido às alterações desta migration (o resto do output do
-- gerador reaplicaria colunas de 0028-0035 e quebraria o migrations-from-zero).
--
-- ── Geração do lease ────────────────────────────────────────────────────────
-- `claimOutboxJob` incrementa `claim_generation` no UPDATE atômico que rouba a
-- linha; cada liquidação (`markOutboxDelivered/Retry/Deferred/DeadLetter`) casa
-- também `claim_generation` e só altera a linha quando o par
-- (id, status, claim_generation) casa. `attempts` não pode servir de fence
-- porque o defer devolve uma tentativa (ABA).
-- Linhas existentes nascem em 0: DEFAULT 0 + NOT NULL backfilla no ADD COLUMN.
--
-- ── EXPANSÃO (gate de manutenção) ───────────────────────────────────────────
-- Esta entrada foi AMPLIADA para carregar também o estado singleton
-- `outbox_control` e o trigger `outbox_enforce_control_gate`. Motivo: o ledger
-- canônico é 36/36 (`EXPECTED_MIGRATIONS`) — uma migration 0037 quebraria a
-- aceitação do ambiente. Consequência conhecida e DELIBERADA: ambiente que JÁ
-- aplicou a 0036 original (apenas `claim_generation`) está com o ledger em 36
-- e NÃO recebe estes objetos (drizzle pula a entrada já aplicada). NÃO há
-- reparo silencioso: `checkReadiness`/`/api/health/db` falham fechados pela
-- checagem funcional (shape + linha singleton + trigger HABILITADO, em
-- `checkMigrations`) e o operador aplica
-- `node scripts/outbox-control-repair.mjs --apply` de forma explícita.
--
-- Semântica do trigger (falha fechada, códigos estáticos, sem PII):
--   * claim (pending→processing OU reclamo de stale: status `processing`
--     preservado com `attempts`/`claim_generation` alterados):
--     - recusado enquanto `paused` (`OUTBOX_PAUSED`);
--     - exige incremento EXATO de `claim_generation` (+1). Reclamo legado que
--       só mexe em `attempts`/`updated_at` NÃO é claim novo e passaria
--       batido pelo teste de status — por isso a detecção também olha
--       `attempts`/`claim_generation` com o status parado
--       (`OUTBOX_CLAIM_GENERATION_INVALID`);
--     - com `release_id` armado, exige `claim_release` igual E o marcador
--       transacional `outbox.claim_marker` = `<release>#<claim_generation>`
--       (`OUTBOX_RELEASE_MISMATCH` / `OUTBOX_CLAIM_IDENTITY_INVALID`).
--       Binário antigo não escreve o GUC nem a coluna: não claima.
--   * liquidação (processing→pending/delivered/dead_letter):
--     - PAUSADO: só o legado PRÉ-PROTOCOLO liquida sem marcador — linha SEM
--       release (`claim_release IS NULL`, claim já em voo na migração/pause),
--       para a fila drenar. Linha portadora de release exige o marcador
--       transacional casando com `<claim_release>#<claim_generation>` da linha
--       (`OUTBOX_LEGACY_SETTLEMENT_DENIED`) — inclusive durante a pausa;
--     - RUNNING: com gate ARMADO, exige o marcador transacional casando com
--       `<claim_release>#<claim_generation>` da linha E o release armado
--       (`OUTBOX_LEGACY_SETTLEMENT_DENIED`); gate desarmado (fresh) preserva
--       o comportamento histórico. O valor da coluna sozinho não autentica
--       ninguém: um UPDATE solto de binário antigo que acerte uma linha já
--       portadora do release atual é recusado.
--   * `cancelled` (redação LGPD/cancelamento) NUNCA é bloqueado.
--   * demais transições (redação de payload, bookkeeping) passam.
--   * sem a linha singleton de controle, TODA transição falha fechada.
--
-- Identidade transacional: `bindClaimIdentity` (outbox-repository) grava
-- `SELECT set_config('outbox.claim_marker', '<release>#<geração>', true)` na
-- MESMA transação do claim/liquidação. `true` = escopo de transação
-- (equivalente a `SET LOCAL`): some no COMMIT/ROLLBACK e não vaza pela conexão
-- do pool. `current_setting('outbox.claim_marker', true)` devolve NULL quando o
-- GUC não foi gravado — é exatamente o caso do binário antigo.
--
-- Trigger: `CREATE OR REPLACE TRIGGER` (PostgreSQL 14+) — idempotente, sem
-- janela de DROP+CREATE e ainda reabilitando um trigger caído em `DISABLED`
-- (verificado: `tgenabled` volta a 'O'). O repair roda o mesmo DDL dentro de
-- uma transação única com lock consultivo, então uma falha no meio desfaz tudo
-- (nenhum objeto parcial) e invocações concorrentes serializam.
--
-- Rollback (down):
--   DROP TRIGGER IF EXISTS "outbox_jobs_control_gate" ON "outbox_jobs";
--   DROP FUNCTION IF EXISTS "outbox_enforce_control_gate";
--   DELETE FROM "outbox_control" WHERE "id" = 1;
--   DROP TABLE IF EXISTS "outbox_control";
--   ALTER TABLE "outbox_jobs" DROP COLUMN IF EXISTS "claim_release";
--   ALTER TABLE "outbox_jobs" DROP COLUMN IF EXISTS "claim_generation";
ALTER TABLE "outbox_jobs"
  ADD COLUMN IF NOT EXISTS "claim_generation" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "outbox_jobs"
  ADD COLUMN IF NOT EXISTS "claim_release" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_control" (
	"id" integer PRIMARY KEY NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"epoch" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"operator" text,
	"release_id" text,
	"paused_at" timestamp with time zone,
	"resumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
INSERT INTO "outbox_control" ("id", "paused", "epoch")
VALUES (1, false, 0)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "outbox_enforce_control_gate"() RETURNS trigger AS $$
DECLARE
	v_paused boolean;
	v_release text;
	v_marker text;
BEGIN
	-- Serializa claim/liquidação contra pause/resume via advisory lock
	-- transacional COMPARTILHADO — pause-vs-claim race-safe nas duas direções
	-- (o gate DB-side alcança até binário antigo/dispatch direto por SQL).
	-- Advisory compartilhado, e não `FOR SHARE` na linha: `SELECT ... FOR SHARE`
	-- exige privilégio UPDATE e quebraria o runtime SELECT-only em
	-- `outbox_control` (permission denied no claim/settlement/cancelamento).
	-- `pg_advisory_xact_lock_shared` não exige privilégio na tabela e é
	-- liberado no fim da transação. Leitores compartilhados NÃO serializam
	-- entre si (claims concorrentes em jobs distintos seguem em paralelo),
	-- enquanto pause/resume — que tomam o exclusivo `pg_advisory_xact_lock` +
	-- `FOR UPDATE` na linha — continuam conflitando com qualquer leitor.
	-- Chave fixa: 8104312345678901 (mesma de `OUTBOX_CONTROL_ADVISORY_KEY`).
	PERFORM pg_advisory_xact_lock_shared(8104312345678901);
	SELECT "paused", "release_id" INTO v_paused, v_release
	  FROM "outbox_control" WHERE "id" = 1;
	IF NOT FOUND THEN
		RAISE EXCEPTION 'OUTBOX_CONTROL_UNAVAILABLE';
	END IF;

	-- Identidade transacional do caller: gravada por
	-- `set_config('outbox.claim_marker', ..., true)` na MESMA transação do
	-- UPDATE. NULL = binário antigo / UPDATE solto sem posse do lease.
	v_marker := current_setting('outbox.claim_marker', true);

	-- Claim: pending→processing OU reclamo de stale. O status pode ficar em
	-- 'processing' (reclamo), então a detecção também olha attempts e geração:
	-- sem isso, um reclamo legado que só incrementa `attempts` passaria batido
	-- pelo teste de status e furaria o gate.
	IF NEW."status" = 'processing'
	   AND (OLD."status" <> 'processing'
	        OR NEW."claim_generation" <> OLD."claim_generation"
	        OR NEW."attempts" <> OLD."attempts") THEN
		IF v_paused THEN
			RAISE EXCEPTION 'OUTBOX_PAUSED';
		END IF;
		IF NEW."claim_generation" <> OLD."claim_generation" + 1 THEN
			RAISE EXCEPTION 'OUTBOX_CLAIM_GENERATION_INVALID';
		END IF;
		IF NEW."claim_release" IS NULL THEN
			-- Só consumidores legados podem omitir release/marker, e somente
			-- enquanto o protocolo ainda não armou um release.
			IF v_release IS NOT NULL OR v_marker IS NOT NULL THEN
				RAISE EXCEPTION 'OUTBOX_RELEASE_MISMATCH';
			END IF;
		ELSE
			IF v_release IS NOT NULL AND NEW."claim_release" IS DISTINCT FROM v_release THEN
				RAISE EXCEPTION 'OUTBOX_RELEASE_MISMATCH';
			END IF;
			IF v_marker IS NULL
			   OR v_marker <> NEW."claim_release" || '#' || NEW."claim_generation"::text THEN
				RAISE EXCEPTION 'OUTBOX_CLAIM_IDENTITY_INVALID';
			END IF;
		END IF;
		RETURN NEW;
	END IF;

	-- Liquidação do lease: processing→pending/delivered/dead_letter.
	IF OLD."status" = 'processing' AND NEW."status" <> 'processing' THEN
		IF NEW."status" <> 'cancelled' THEN
			IF OLD."claim_release" IS NULL THEN
				-- Drain do legado realmente pré-protocolo: somente pode liquidar
				-- enquanto nenhum release novo estiver ativo. O novo consumer
				-- falha fechado se não conhece seu release e sempre grava marker;
				-- assim NULL identifica apenas trabalho legado anterior ao handoff.
				IF v_release IS NOT NULL OR v_marker IS NOT NULL THEN
					RAISE EXCEPTION 'OUTBOX_LEGACY_SETTLEMENT_DENIED';
				END IF;
			ELSE
				-- Qualquer lease atribuído a uma versão identificada exige a
				-- identidade transacional exata em RUNNING e durante PAUSING.
				IF v_marker IS NULL
				   OR v_marker <> OLD."claim_release" || '#' || OLD."claim_generation"::text
				   OR (v_release IS NOT NULL AND OLD."claim_release" IS DISTINCT FROM v_release) THEN
					RAISE EXCEPTION 'OUTBOX_LEGACY_SETTLEMENT_DENIED';
				END IF;
			END IF;
		END IF;
		RETURN NEW;
	END IF;

	-- Demais transições (redação de payload, bookkeeping) passam.
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE TRIGGER "outbox_jobs_control_gate"
BEFORE UPDATE ON "outbox_jobs"
FOR EACH ROW
EXECUTE FUNCTION "outbox_enforce_control_gate"();
