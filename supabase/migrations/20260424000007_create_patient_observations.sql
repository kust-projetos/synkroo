-- ============================================
-- Create Patient Observations Table
-- Individual timestamped notes per patient with attribution
-- Addresses review concern: avoids text-concatenation workaround for notes
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- PATIENT OBSERVATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patient_obs_patient ON patient_observations(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_obs_clinic ON patient_observations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_obs_created_by ON patient_observations(created_by);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE patient_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view patient observations from their clinic"
    ON patient_observations FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert patient observations in their clinic"
    ON patient_observations FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update patient observations in their clinic"
    ON patient_observations FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete patient observations in their clinic"
    ON patient_observations FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE patient_observations IS 'Individual timestamped notes per patient. Used by Timeline API (Plan 04) as the notes data source. Replaces the patients.notes text field concatenation workaround.';

-- Updated_at trigger
CREATE TRIGGER update_patient_observations_updated_at
    BEFORE UPDATE ON patient_observations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
