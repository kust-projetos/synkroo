-- ============================================
-- Create Consents Table with Audit Trigger
-- LGPD-compliant consent tracking with automatic audit logging
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- CONSENTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL,
    contact_type VARCHAR(10) NOT NULL CHECK (contact_type IN ('patient', 'lead')),
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('data_collection', 'marketing', 'whatsapp_communication')),
    granted BOOLEAN NOT NULL DEFAULT true,
    granted_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    channel VARCHAR(20) DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'manual')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(contact_id, contact_type, purpose)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consents_clinic ON consents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_consents_contact ON consents(contact_id, contact_type);
CREATE INDEX IF NOT EXISTS idx_consents_purpose ON consents(clinic_id, purpose);
CREATE INDEX IF NOT EXISTS idx_consents_granted ON consents(granted) WHERE granted = false;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view consents from their clinic"
    ON consents FOR SELECT
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can insert consents in their clinic"
    ON consents FOR INSERT
    WITH CHECK (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can update consents in their clinic"
    ON consents FOR UPDATE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

CREATE POLICY "Users can delete consents in their clinic"
    ON consents FOR DELETE
    USING (clinic_id = (SELECT public.get_user_clinic_id()));

-- ============================================================================
-- AUDIT TRIGGER FUNCTION
-- Automatically logs all consent changes to audit_logs
-- ============================================================================
CREATE OR REPLACE FUNCTION public.log_consent_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (
            NEW.clinic_id,
            auth.uid(),
            TG_OP,
            'consents',
            NEW.id,
            NULL,
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (
            NEW.clinic_id,
            auth.uid(),
            TG_OP,
            'consents',
            NEW.id,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
        VALUES (
            OLD.clinic_id,
            auth.uid(),
            TG_OP,
            'consents',
            OLD.id,
            to_jsonb(OLD),
            NULL
        );
        RETURN OLD;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create the audit trigger
DROP TRIGGER IF EXISTS trg_consent_audit ON consents;
CREATE TRIGGER trg_consent_audit
    AFTER INSERT OR UPDATE OR DELETE ON consents
    FOR EACH ROW
    EXECUTE FUNCTION public.log_consent_change();

-- ============================================================================
-- MIGRATE EXISTING OPT-OUT DATA FROM PATIENTS
-- ============================================================================
-- Migrate marketing opt-outs
INSERT INTO consents (contact_id, contact_type, purpose, granted, granted_at, channel)
SELECT
    id,
    'patient',
    'marketing',
    NOT opt_out_marketing,
    COALESCE(opt_out_at, now()),
    'manual'
FROM patients
WHERE opt_out_marketing = true
ON CONFLICT (contact_id, contact_type, purpose) DO NOTHING;

-- Migrate whatsapp_communication opt-outs (from opt_out_reminders)
INSERT INTO consents (contact_id, contact_type, purpose, granted, granted_at, channel)
SELECT
    id,
    'patient',
    'whatsapp_communication',
    NOT opt_out_reminders,
    COALESCE(opt_out_at, now()),
    'manual'
FROM patients
WHERE opt_out_reminders = true
ON CONFLICT (contact_id, contact_type, purpose) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE consents IS 'LGPD-compliant consent tracking. audit trigger (trg_consent_audit) logs all changes to audit_logs. Migrated from patients.opt_out_marketing and opt_out_reminders columns.';
COMMENT ON FUNCTION public.log_consent_change() IS 'SECURITY DEFINER trigger function. Logs all consent INSERT/UPDATE/DELETE to audit_logs with full old/new values.';

-- Updated_at trigger
CREATE TRIGGER update_consents_updated_at
    BEFORE UPDATE ON consents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
