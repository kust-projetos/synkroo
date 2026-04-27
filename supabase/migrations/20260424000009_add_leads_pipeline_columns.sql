-- ============================================
-- Add leads pipeline columns and scoring function
-- Phase 2: Pipeline & Sales foundation
-- Date: 2026-04-24
-- ============================================

-- ============================================================================
-- ADD COLUMNS TO LEADS TABLE
-- ============================================================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_type TEXT CHECK (source_type IN ('whatsapp','manual','referral','website','paid_media')) DEFAULT 'manual';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score DECIMAL(5,2) DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_patient_id UUID;

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_source_type ON leads(source_type);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);

-- ============================================================================
-- LEAD SCORE FUNCTION (Hybrid: tipo + recencia)
-- Weights: WhatsApp=3, Llamada=2, Email=1, Visita=2
-- Time decay: e^(-0.1 * days_ago) for last 30 days
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_lead_score(lead_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_score DECIMAL(5,2) := 0;
  v_days_ago INTEGER;
  v_weight INTEGER;
  v_decay DECIMAL(5,4);
BEGIN
  -- Sum interaction weights with time decay
  SELECT
    COALESCE(SUM(
      CASE
        WHEN ia.activity_type = 'whatsapp' THEN 3
        WHEN ia.activity_type = 'llamada' THEN 2
        WHEN ia.activity_type = 'email' THEN 1
        WHEN ia.activity_type = 'visita' THEN 2
        ELSE 1
      END * EXP(-0.1 * EXTRACT(DAY FROM (now() - ia.performed_at)))
    ), 0) INTO v_score
  FROM lead_activities ia
  WHERE ia.lead_id = calculate_lead_score.lead_id
    AND ia.performed_at >= now() - INTERVAL '30 days';

  -- Normalize to 0-100 scale (rough max is ~90 for very active leads)
  v_score := LEAST(ROUND(v_score::DECIMAL, 2), 100);
  RETURN v_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- UPDATE EXISTING LEADS WITH DEFAULT SCORES
-- ============================================================================
UPDATE leads SET score = 0 WHERE score IS NULL OR score = 0;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN leads.source_type IS 'Lead origin: whatsapp, manual, referral, website, paid_media';
COMMENT ON COLUMN leads.score IS 'Hybrid score 0-100 based on interaction type and recency';
COMMENT ON COLUMN leads.converted_at IS 'Timestamp when lead was converted to patient';
COMMENT ON COLUMN leads.converted_to_patient_id IS 'FK to patient record created from this lead';