-- ============================================
-- Create Pipeline Stages Table
-- Sales pipeline stages per clinic with default odontologia stages
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- PIPELINE STAGES
-- ============================================================================
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(7) DEFAULT '#6b7280',
    is_default BOOLEAN DEFAULT false,
    is_system BOOLEAN DEFAULT false,
    system_key VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(clinic_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_clinic ON pipeline_stages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(clinic_id, position);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pipeline stages from their clinic"
    ON pipeline_stages FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert pipeline stages in their clinic"
    ON pipeline_stages FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update pipeline stages in their clinic"
    ON pipeline_stages FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete pipeline stages in their clinic"
    ON pipeline_stages FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- SEED DEFAULT STAGES FOR ALL EXISTING CLINICS
-- ============================================================================
INSERT INTO pipeline_stages (clinic_id, name, position, color, is_default, is_system, system_key)
SELECT
    c.id,
    stage.name,
    stage.position,
    stage.color,
    stage.is_default,
    stage.is_system,
    stage.system_key
FROM clinics c
CROSS JOIN (VALUES
    ('new',            0, '#3b82f6', true,  true,  'new'),
    ('contacted',      1, '#8b5cf6', false, false, NULL),
    ('qualified',      2, '#10b981', false, false, NULL),
    ('proposal',       3, '#f59e0b', false, false, NULL),
    ('negotiation',    4, '#ef4444', false, false, NULL),
    ('converted',      5, '#22c55e', false, true,  'converted'),
    ('lost',           6, '#6b7280', false, true,  'lost')
) AS stage(name, position, color, is_default, is_system, system_key)
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    WHERE ps.clinic_id = c.id AND ps.name = stage.name
);

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE pipeline_stages IS 'Sales pipeline stages per clinic. Default stages seeded for odontologia. Used by leads.stage_id FK for pipeline tracking.';

-- Updated_at trigger
CREATE TRIGGER update_pipeline_stages_updated_at
    BEFORE UPDATE ON pipeline_stages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
