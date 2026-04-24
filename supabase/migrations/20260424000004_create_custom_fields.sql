-- ============================================
-- Create Custom Fields Tables (EAV with typed columns)
-- custom_field_definitions: schema definitions per clinic
-- custom_field_values: typed EAV storage with clinic_id denormalized
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- CUSTOM FIELD DEFINITIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_field_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox')),
    options JSONB DEFAULT '[]',
    required BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(clinic_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cfd_clinic ON custom_field_definitions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cfd_type ON custom_field_definitions(clinic_id, field_type);
CREATE INDEX IF NOT EXISTS idx_cfd_active ON custom_field_definitions(clinic_id, is_active) WHERE is_active = true;

-- ============================================================================
-- CUSTOM FIELD VALUES (EAV with typed columns)
-- ============================================================================
CREATE TABLE IF NOT EXISTS custom_field_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('patient', 'lead')),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    value_text TEXT,
    value_number NUMERIC,
    value_date DATE,
    value_boolean BOOLEAN,
    value_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(definition_id, contact_id, contact_type)
);

-- Indexes for typed column lookups
CREATE INDEX IF NOT EXISTS idx_cfv_contact ON custom_field_values(contact_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_cfv_text ON custom_field_values(definition_id) WHERE value_text IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfv_number ON custom_field_values(definition_id) WHERE value_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfv_date ON custom_field_values(definition_id) WHERE value_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfv_boolean ON custom_field_values(definition_id) WHERE value_boolean IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cfv_json ON custom_field_values USING GIN(value_json) WHERE value_json IS NOT NULL;

-- Composite index for per-clinic contact field lookups (review feedback: Action 3)
CREATE INDEX IF NOT EXISTS idx_cfv_clinic_contact ON custom_field_values(clinic_id, contact_id, definition_id);

-- Index for clinic-level filtering (RLS support)
CREATE INDEX IF NOT EXISTS idx_cfv_clinic ON custom_field_values(clinic_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- Policies for custom_field_definitions
CREATE POLICY "Users can view custom field definitions from their clinic"
    ON custom_field_definitions FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert custom field definitions in their clinic"
    ON custom_field_definitions FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update custom field definitions in their clinic"
    ON custom_field_definitions FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete custom field definitions in their clinic"
    ON custom_field_definitions FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- Policies for custom_field_values
CREATE POLICY "Users can view custom field values from their clinic"
    ON custom_field_values FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert custom field values in their clinic"
    ON custom_field_values FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update custom field values in their clinic"
    ON custom_field_values FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete custom field values in their clinic"
    ON custom_field_values FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE custom_field_values IS 'EAV with typed columns. Queried by timeline via contact_id, filtered by clinic_id. Used by Contacts API Plan 02, Custom Fields API Plan 03, Timeline API Plan 04.';

-- Updated_at triggers
CREATE TRIGGER update_custom_field_definitions_updated_at
    BEFORE UPDATE ON custom_field_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_custom_field_values_updated_at
    BEFORE UPDATE ON custom_field_values
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
