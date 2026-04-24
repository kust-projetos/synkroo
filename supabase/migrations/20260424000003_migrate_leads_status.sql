-- ============================================
-- Migrate Leads Status to Pipeline Stages
-- Add stage_id FK to leads, migrate existing status data
-- Expand-contract pattern: keep status column for rollback safety
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- ADD stage_id COLUMN TO LEADS
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;

-- ============================================================================
-- MIGRATE EXISTING DATA
-- Step 1: Match leads.status to pipeline_stages.system_key for known statuses
-- Step 2: Match remaining by name for any custom stages
-- ============================================================================
UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE ps.clinic_id = l.clinic_id
  AND ps.system_key = l.status
  AND l.stage_id IS NULL;

-- Second pass: match by name for any remaining unmapped leads
UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE ps.clinic_id = l.clinic_id
  AND ps.name = l.status
  AND l.stage_id IS NULL;

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM leads WHERE stage_id IS NULL AND status IS NOT NULL) THEN
        RAISE WARNING 'Some leads have unmapped status values. Check: SELECT id, status FROM leads WHERE stage_id IS NULL AND status IS NOT NULL;';
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads(stage_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN leads.stage_id IS 'FK to pipeline_stages. Migrated from leads.status column. Status column kept for rollback safety (expand-contract pattern).';
