-- ============================================
-- Add leads stage_id FK and pipeline triggers
-- Phase 2: Pipeline & Sales
-- Date: 2026-04-25
-- ============================================

-- ============================================================================
-- ADD stage_id COLUMN TO LEADS TABLE
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES pipeline_stages(id);

-- Index for efficient stage lookups
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON leads(stage_id);

-- ============================================================================
-- AUTO-SCORE TRIGGER (MEDIUM-1)
-- Recalculates lead score on insert or when last_contact/source changes
-- ============================================================================
CREATE OR REPLACE FUNCTION trigger_auto_score_lead()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate score using the hybrid formula from calculate_lead_score
  -- Weights: WhatsApp=3, Llamada=2, Email=1, Visita=2
  -- Time decay: e^(-0.1 * days_ago) for last 30 days
  SELECT
    COALESCE(SUM(
      CASE
        WHEN ia.activity_type = 'whatsapp' THEN 3
        WHEN ia.activity_type = 'llamada' THEN 2
        WHEN ia.activity_type = 'email' THEN 1
        WHEN ia.activity_type = 'visita' THEN 2
        ELSE 1
      END * EXP(-0.1 * EXTRACT(DAY FROM (now() - ia.performed_at)))
    ), 0) INTO NEW.score
  FROM lead_activities ia
  WHERE ia.lead_id = NEW.id
    AND ia.performed_at >= now() - INTERVAL '30 days';

  -- Normalize to 0-100 scale
  NEW.score := LEAST(ROUND(NEW.score::DECIMAL, 2), 100);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on INSERT (new leads get auto-calculated score)
DROP TRIGGER IF EXISTS trg_lead_score_on_insert ON leads;
CREATE TRIGGER trg_lead_score_on_insert
  BEFORE INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION trigger_auto_score_lead();

-- Trigger on UPDATE (recalculate when last_contact or source changes)
DROP TRIGGER IF EXISTS trg_lead_score_on_update ON leads;
CREATE TRIGGER trg_lead_score_on_update
  BEFORE UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.last_contact_at IS DISTINCT FROM NEW.last_contact_at
     OR OLD.source IS DISTINCT FROM NEW.source)
  EXECUTE FUNCTION trigger_auto_score_lead();

-- ============================================================================
-- DEFAULT STAGE MANAGEMENT
-- ============================================================================

-- Function to get default stage ID for a clinic
CREATE OR REPLACE FUNCTION get_default_stage_id(p_clinic_id UUID)
RETURNS UUID AS $$
DECLARE
  v_default_id UUID;
BEGIN
  SELECT id INTO v_default_id
  FROM pipeline_stages
  WHERE clinic_id = p_clinic_id AND is_default = true
  LIMIT 1;

  RETURN v_default_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- MIGRATE EXISTING LEADS TO DEFAULT STAGE
-- ============================================================================
DO $$
DECLARE
  v_default_stage_id UUID;
  v_clinic_id UUID;
BEGIN
  -- For each clinic with leads but no stage_id, assign to default stage
  FOR v_clinic_id IN DISTINCT SELECT clinic_id FROM leads WHERE stage_id IS NULL LOOP
    SELECT get_default_stage_id(v_clinic_id) INTO v_default_stage_id;

    IF v_default_stage_id IS NOT NULL THEN
      UPDATE leads SET stage_id = v_default_stage_id WHERE clinic_id = v_clinic_id AND stage_id IS NULL;
      RAISE NOTICE 'Migrated leads in clinic % to default stage %', v_clinic_id, v_default_stage_id;
    ELSE
      RAISE WARNING 'No default stage found for clinic % -- leads remain unstaged', v_clinic_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN leads.stage_id IS 'FK to pipeline_stages. Lead pipeline stage assignment.';
COMMENT ON FUNCTION trigger_auto_score_lead() IS 'Automatically recalculates lead score on insert/update based on interaction recency and type.';
COMMENT ON FUNCTION get_default_stage_id(UUID) IS 'Returns the default stage ID for a clinic.';