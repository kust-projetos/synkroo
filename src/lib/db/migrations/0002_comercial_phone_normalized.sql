-- Custom migration: Comercial phone_normalized column + dedup merge + unique partial index
-- Task 1: Schema seam and lead dedup
--
-- Adds phone_normalized to leads table, backfills from phone digits,
-- preflight merges duplicates by (clinic_id, phone_normalized), and
-- creates a unique partial index to prevent concurrent same-phone capture.

--> statement-breakpoint
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_normalized varchar(32);

--> statement-breakpoint
UPDATE leads SET phone_normalized = regexp_replace(phone, '\D', '', 'g') WHERE phone_normalized IS NULL;

--> statement-breakpoint
WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id, winner_id FROM ranked WHERE id <> winner_id
)
UPDATE lead_activities SET lead_id = l.winner_id
FROM losers l
WHERE lead_activities.lead_id = l.id;

--> statement-breakpoint
WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id, winner_id FROM ranked WHERE id <> winner_id
)
UPDATE tasks SET lead_id = l.winner_id
FROM losers l
WHERE tasks.lead_id = l.id;

--> statement-breakpoint
WITH ranked AS (
  SELECT id, clinic_id, phone_normalized,
    first_value(id) OVER (
      PARTITION BY clinic_id, phone_normalized
      ORDER BY converted_at DESC NULLS LAST, updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS winner_id
  FROM leads
  WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
), losers AS (
  SELECT id FROM ranked WHERE id <> winner_id
)
UPDATE leads SET status = 'lost', lost_reason = 'merged_duplicate', lost_at = now(), phone_normalized = NULL
WHERE id IN (SELECT id FROM losers);

--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM leads
    WHERE phone_normalized IS NOT NULL AND phone_normalized <> ''
    GROUP BY clinic_id, phone_normalized
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate leads remain before comercial phone_normalized unique index';
  END IF;
END $$;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS leads_clinic_phone_normalized_uniq
ON leads (clinic_id, phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized <> '';

--> statement-breakpoint
-- Rollback:
--   DROP INDEX IF EXISTS leads_clinic_phone_normalized_uniq;
--   ALTER TABLE leads DROP COLUMN IF EXISTS phone_normalized;
