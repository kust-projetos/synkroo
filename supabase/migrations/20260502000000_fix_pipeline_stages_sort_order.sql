-- Fix schema mismatch: rename position to sort_order in pipeline_stages
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS sort_order integer;
UPDATE pipeline_stages SET sort_order = position WHERE position IS NOT NULL;
ALTER TABLE pipeline_stages DROP COLUMN IF EXISTS position;