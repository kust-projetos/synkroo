-- Custom migration: appointments_no_overlap EXCLUDE constraint
-- Task F2a: anti-overbooking constraint
-- Prevents overlapping appointments for the same dentist in the same clinic.
-- Uses btree_gist extension for GiST exclusion with equality + bigint range overlap.
--
-- Note: uses EXTRACT(EPOCH FROM ... AT TIME ZONE 'UTC') to ensure IMMUTABLE
-- expression required by GiST exclusion constraints. The UTC conversion is
-- safe because timestamptz is an absolute point in time and the check is
-- consistent regardless of client timezone.

-- Preflight: detect existing overlapping active appointments
DO $$
DECLARE
  overlap_count INTEGER;
BEGIN
  WITH overlapping_ids AS (
    SELECT DISTINCT a1.id
    FROM appointments a1
    JOIN appointments a2 ON
      a1.id <> a2.id
      AND a1.clinic_id = a2.clinic_id
      AND a1.dentist_id = a2.dentist_id
      AND a1.dentist_id IS NOT NULL
      AND a1.status NOT IN ('cancelled', 'no_show')
      AND a2.status NOT IN ('cancelled', 'no_show')
      AND a1.deleted_at IS NULL
      AND a2.deleted_at IS NULL
      AND int8range(
        EXTRACT(EPOCH FROM a1.scheduled_at AT TIME ZONE 'UTC')::bigint,
        EXTRACT(EPOCH FROM (a1.scheduled_at AT TIME ZONE 'UTC' + COALESCE(a1.duration_minutes, 30) * interval '1 minute'))::bigint,
        '[)'
      ) && int8range(
        EXTRACT(EPOCH FROM a2.scheduled_at AT TIME ZONE 'UTC')::bigint,
        EXTRACT(EPOCH FROM (a2.scheduled_at AT TIME ZONE 'UTC' + COALESCE(a2.duration_minutes, 30) * interval '1 minute'))::bigint,
        '[)'
      )
  )
  SELECT COUNT(*) INTO overlap_count FROM overlapping_ids;

  IF overlap_count > 0 THEN
    RAISE EXCEPTION 'F2a PREFLIGHT: % overlapping active appointment(s) found. Resolve conflicts manually before applying constraint.', overlap_count;
  ELSE
    RAISE NOTICE 'F2a PREFLIGHT: no overlapping active appointments found. Safe to proceed.';
  END IF;
END $$;
--> statement-breakpoint

-- Enable btree_gist extension for GiST exclusion with equality operators
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint

-- Add EXCLUDE constraint on appointments:
--   - Same clinic_id + dentist_id
--   - Time ranges overlap (int8range using epoch seconds)
--   - Only applies to active (non-cancelled, non-no_show) appointments with soft-delete
--   - When duration_minutes is NULL, defaults to 30 minutes
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
EXCLUDE USING gist (
  clinic_id WITH =,
  dentist_id WITH =,
  int8range(
    EXTRACT(EPOCH FROM scheduled_at AT TIME ZONE 'UTC')::bigint,
    EXTRACT(EPOCH FROM (scheduled_at AT TIME ZONE 'UTC' + COALESCE(duration_minutes, 30) * interval '1 minute'))::bigint,
    '[)'
  ) WITH &&
) WHERE (status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL);
--> statement-breakpoint

-- Rollback:
--   ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
