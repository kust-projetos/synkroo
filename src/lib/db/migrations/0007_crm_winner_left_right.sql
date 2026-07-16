-- CRM duplicate suggestions: ensure winner_confirmed_id is left_id or right_id.
-- Uses DO block for idempotent execution (safe to re-run).

--> statement-breakpoint
DO $$BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'crm_duplicate_suggestions'::regclass
    AND conname = 'crm_duplicate_suggestions_winner_left_right_check'
  ) THEN
    ALTER TABLE crm_duplicate_suggestions
      ADD CONSTRAINT crm_duplicate_suggestions_winner_left_right_check
      CHECK (winner_confirmed_id IS NULL OR winner_confirmed_id IN (left_id, right_id));
  END IF;
END$$;

-- Rollback:
--   ALTER TABLE crm_duplicate_suggestions DROP CONSTRAINT crm_duplicate_suggestions_winner_left_right_check;
