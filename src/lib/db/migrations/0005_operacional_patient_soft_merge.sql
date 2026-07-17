-- Patient soft-merge: adds merge tracking fields for duplicate merge support.
-- Loser records are soft-merged, not deleted physically.
-- Default queries should filter WHERE merge_status IS NULL.

--> statement-breakpoint
ALTER TABLE patients ADD COLUMN IF NOT EXISTS merge_status text;
--> statement-breakpoint
ALTER TABLE patients ADD COLUMN IF NOT EXISTS merged_into_id uuid;
--> statement-breakpoint
ALTER TABLE patients ADD COLUMN IF NOT EXISTS merged_at timestamp with time zone;

-- Rollback:
--   ALTER TABLE patients DROP COLUMN IF EXISTS merged_at;
--   ALTER TABLE patients DROP COLUMN IF EXISTS merged_into_id;
--   ALTER TABLE patients DROP COLUMN IF EXISTS merge_status;
