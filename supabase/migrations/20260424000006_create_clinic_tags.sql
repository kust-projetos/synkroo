-- ============================================
-- Create Clinic Tags Table
-- Tag color metadata per clinic, adds tags array to leads
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- CLINIC TAGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinic_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(clinic_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_clinic_tags_clinic ON clinic_tags(clinic_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE clinic_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view clinic tags from their clinic"
    ON clinic_tags FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert clinic tags in their clinic"
    ON clinic_tags FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update clinic tags in their clinic"
    ON clinic_tags FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete clinic tags in their clinic"
    ON clinic_tags FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- ADD TAGS COLUMN TO LEADS
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- GIN index for array containment queries
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE clinic_tags IS 'Tag color metadata per clinic. Tags stored as TEXT[] on leads and patients tables. clinic_tags provides display color and centralized management.';
