-- ============================================
-- Fix RLS Policies for Phase 1 CRM Tables
-- Creates get_user_clinic_id function (if not exists) and adds RLS policies
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- STEP 1: Create get_user_clinic_id function (idempotent)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_clinic_id') THEN
        CREATE FUNCTION public.get_user_clinic_id()
        RETURNS uuid
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        AS $$
            SELECT clinic_id FROM users WHERE id = auth.uid();
        $$;
    END IF;
END $$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_clinic_id() TO authenticated;

-- ============================================================================
-- STEP 2: Drop deprecated get_current_clinic_id function
-- ============================================================================
DROP FUNCTION IF EXISTS public.get_current_clinic_id();

-- ============================================================================
-- STEP 3: Create RLS policies for pipeline_stages
-- ============================================================================
DROP POLICY IF EXISTS "Users can view pipeline stages from their clinic" ON pipeline_stages;
CREATE POLICY "Users can view pipeline stages from their clinic"
    ON pipeline_stages FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert pipeline stages in their clinic" ON pipeline_stages;
CREATE POLICY "Users can insert pipeline stages in their clinic"
    ON pipeline_stages FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update pipeline stages in their clinic" ON pipeline_stages;
CREATE POLICY "Users can update pipeline stages in their clinic"
    ON pipeline_stages FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete pipeline stages in their clinic" ON pipeline_stages;
CREATE POLICY "Users can delete pipeline stages in their clinic"
    ON pipeline_stages FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 4: Create RLS policies for custom_field_definitions
-- ============================================================================
DROP POLICY IF EXISTS "Users can view custom field definitions from their clinic" ON custom_field_definitions;
CREATE POLICY "Users can view custom field definitions from their clinic"
    ON custom_field_definitions FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert custom field definitions in their clinic" ON custom_field_definitions;
CREATE POLICY "Users can insert custom field definitions in their clinic"
    ON custom_field_definitions FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update custom field definitions in their clinic" ON custom_field_definitions;
CREATE POLICY "Users can update custom field definitions in their clinic"
    ON custom_field_definitions FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete custom field definitions in their clinic" ON custom_field_definitions;
CREATE POLICY "Users can delete custom field definitions in their clinic"
    ON custom_field_definitions FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 5: Create RLS policies for custom_field_values
-- ============================================================================
DROP POLICY IF EXISTS "Users can view custom field values from their clinic" ON custom_field_values;
CREATE POLICY "Users can view custom field values from their clinic"
    ON custom_field_values FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert custom field values in their clinic" ON custom_field_values;
CREATE POLICY "Users can insert custom field values in their clinic"
    ON custom_field_values FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update custom field values in their clinic" ON custom_field_values;
CREATE POLICY "Users can update custom field values in their clinic"
    ON custom_field_values FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete custom field values in their clinic" ON custom_field_values;
CREATE POLICY "Users can delete custom field values in their clinic"
    ON custom_field_values FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 6: Create RLS policies for consents
-- ============================================================================
DROP POLICY IF EXISTS "Users can view consents from their clinic" ON consents;
CREATE POLICY "Users can view consents from their clinic"
    ON consents FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert consents in their clinic" ON consents;
CREATE POLICY "Users can insert consents in their clinic"
    ON consents FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update consents in their clinic" ON consents;
CREATE POLICY "Users can update consents in their clinic"
    ON consents FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete consents in their clinic" ON consents;
CREATE POLICY "Users can delete consents in their clinic"
    ON consents FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 7: Create RLS policies for clinic_tags
-- ============================================================================
DROP POLICY IF EXISTS "Users can view clinic tags from their clinic" ON clinic_tags;
CREATE POLICY "Users can view clinic tags from their clinic"
    ON clinic_tags FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert clinic tags in their clinic" ON clinic_tags;
CREATE POLICY "Users can insert clinic tags in their clinic"
    ON clinic_tags FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update clinic tags in their clinic" ON clinic_tags;
CREATE POLICY "Users can update clinic tags in their clinic"
    ON clinic_tags FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete clinic tags in their clinic" ON clinic_tags;
CREATE POLICY "Users can delete clinic tags in their clinic"
    ON clinic_tags FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 8: Create RLS policies for patient_observations
-- ============================================================================
DROP POLICY IF EXISTS "Users can view patient observations from their clinic" ON patient_observations;
CREATE POLICY "Users can view patient observations from their clinic"
    ON patient_observations FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can insert patient observations in their clinic" ON patient_observations;
CREATE POLICY "Users can insert patient observations in their clinic"
    ON patient_observations FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can update patient observations in their clinic" ON patient_observations;
CREATE POLICY "Users can update patient observations in their clinic"
    ON patient_observations FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

DROP POLICY IF EXISTS "Users can delete patient observations in their clinic" ON patient_observations;
CREATE POLICY "Users can delete patient observations in their clinic"
    ON patient_observations FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- STEP 9: Create audit trigger function for consents (if not exists)
-- ============================================================================
DROP TRIGGER IF EXISTS trg_consent_audit ON consents;
DROP FUNCTION IF EXISTS public.log_consent_change();

CREATE OR REPLACE FUNCTION public.log_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (NEW.clinic_id, auth.uid(), TG_OP, 'consents', NEW.id, NULL, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (NEW.clinic_id, auth.uid(), TG_OP, 'consents', NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (OLD.clinic_id, auth.uid(), TG_OP, 'consents', OLD.id, to_jsonb(OLD), NULL);
        RETURN OLD;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_consent_audit
    AFTER INSERT OR UPDATE OR DELETE ON consents
    FOR EACH ROW
    EXECUTE FUNCTION public.log_consent_change();

-- ============================================================================
-- STEP 10: Seed pipeline stages for all clinics (idempotent)
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
    ('new',       0, '#3b82f6', true,  true,  'new'),
    ('contacted', 1, '#8b5cf6', false, false, NULL),
    ('qualified', 2, '#10b981', false, false, NULL),
    ('proposal',  3, '#f59e0b', false, false, NULL),
    ('negotiation', 4, '#ef4444', false, false, NULL),
    ('converted', 5, '#22c55e', false, true,  'converted'),
    ('lost',      6, '#6b7280', false, true,  'lost')
) AS stage(name, position, color, is_default, is_system, system_key)
WHERE NOT EXISTS (
    SELECT 1 FROM pipeline_stages ps
    WHERE ps.clinic_id = c.id AND ps.name = stage.name
);

-- ============================================================================
-- STEP 11: Add leads.stage_id column and migrate data (idempotent)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'stage_id'
    ) THEN
        ALTER TABLE leads ADD COLUMN stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Migrate existing leads data (only if stage_id is NULL)
UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE ps.clinic_id = l.clinic_id
  AND ps.system_key = l.status
  AND l.stage_id IS NULL;

UPDATE leads l
SET stage_id = ps.id
FROM pipeline_stages ps
WHERE ps.clinic_id = l.clinic_id
  AND ps.name = l.status
  AND l.stage_id IS NULL;

-- ============================================================================
-- STEP 12: Add tags column to leads if not exists
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'tags'
    ) THEN
        ALTER TABLE leads ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- ============================================================================
-- STEP 13: Create indexes (idempotent)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_clinic ON pipeline_stages(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_position ON pipeline_stages(clinic_id, position);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_cfd_clinic ON custom_field_definitions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cfv_contact ON custom_field_values(contact_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_cfv_clinic ON custom_field_values(clinic_id);
CREATE INDEX IF NOT EXISTS idx_cfv_clinic_contact ON custom_field_values(clinic_id, contact_id, definition_id);
CREATE INDEX IF NOT EXISTS idx_consents_clinic ON consents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_consents_contact ON consents(contact_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_patient_obs_patient ON patient_observations(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_obs_clinic ON patient_observations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN(tags);