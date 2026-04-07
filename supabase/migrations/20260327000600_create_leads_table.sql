-- Migration: Leads Table
-- Description: Creates table for lead capture, scoring, and sales pipeline management
-- Date: 2026-03-28

-- ============================================================================
-- LEADS (Prospects and sales pipeline)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

    -- Contact Information
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),

    -- Lead Source
    source VARCHAR(20) NOT NULL DEFAULT 'other', -- whatsapp, instagram, web, referral, campaign, other
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,

    -- Lead Scoring
    score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    temperature VARCHAR(10) DEFAULT 'cold' CHECK (temperature IN ('cold', 'warm', 'hot')),

    -- Status and Pipeline
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost')),

    -- Interest and Qualification
    interest VARCHAR(255), -- Procedure they're interested in
    has_budget BOOLEAN,
    has_timeline BOOLEAN,

    -- Assignment
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,

    -- Tracking
    last_contact_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    contact_count INTEGER DEFAULT 0,

    -- Conversion
    converted_at TIMESTAMPTZ,
    converted_appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

    -- Loss
    lost_reason TEXT,
    lost_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lead management
CREATE INDEX idx_leads_clinic ON public.leads(clinic_id);
CREATE INDEX idx_leads_patient ON public.leads(patient_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_temperature ON public.leads(temperature);
CREATE INDEX idx_leads_score ON public.leads(score DESC);
CREATE INDEX idx_leads_source ON public.leads(source);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to);
CREATE INDEX idx_leads_next_followup ON public.leads(next_followup_at);
CREATE INDEX idx_leads_created ON public.leads(created_at DESC);

-- Index for hot leads query (common dashboard query)
CREATE INDEX idx_leads_hot ON public.leads(clinic_id, score DESC)
    WHERE temperature = 'hot' AND status IN ('new', 'contacted', 'qualified');

-- ============================================================================
-- LEAD ACTIVITIES (Track all interactions with leads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL, -- call, message, email, meeting, note, status_change, qualification
    description TEXT,
    performed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_activities_lead ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_type ON public.lead_activities(activity_type);
CREATE INDEX idx_lead_activities_performed ON public.lead_activities(performed_at DESC);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Policies for leads
CREATE POLICY "Users can view leads from their clinic"
    ON public.leads FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage leads from their clinic"
    ON public.leads FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for lead_activities
CREATE POLICY "Users can view lead activities from their clinic"
    ON public.lead_activities FOR SELECT
    USING (lead_id IN (SELECT id FROM public.leads WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Users can manage lead activities from their clinic"
    ON public.lead_activities FOR ALL
    USING (lead_id IN (SELECT id FROM public.leads WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())))
    WITH CHECK (lead_id IN (SELECT id FROM public.leads WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update lead score based on activities
CREATE OR REPLACE FUNCTION public.update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the lead's updated_at timestamp
    UPDATE public.leads
    SET updated_at = now()
    WHERE id = NEW.lead_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track lead activities
CREATE TRIGGER trg_lead_activity_update
    AFTER INSERT ON public.lead_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_lead_score();

-- ============================================================================
-- STATISTICS VIEW
-- ============================================================================
CREATE OR REPLACE VIEW public.lead_statistics AS
SELECT
    clinic_id,
    COUNT(*) AS total_leads,
    COUNT(*) FILTER (WHERE status = 'new') AS new_leads,
    COUNT(*) FILTER (WHERE status = 'contacted') AS contacted_leads,
    COUNT(*) FILTER (WHERE status = 'qualified') AS qualified_leads,
    COUNT(*) FILTER (WHERE status = 'proposal') AS proposal_leads,
    COUNT(*) FILTER (WHERE status = 'negotiation') AS negotiation_leads,
    COUNT(*) FILTER (WHERE status = 'converted') AS converted_leads,
    COUNT(*) FILTER (WHERE status = 'lost') AS lost_leads,
    COUNT(*) FILTER (WHERE temperature = 'hot') AS hot_leads,
    COUNT(*) FILTER (WHERE temperature = 'warm') AS warm_leads,
    COUNT(*) FILTER (WHERE temperature = 'cold') AS cold_leads,
    ROUND(AVG(score)::numeric, 2) AS avg_score,
    ROUND(
        (COUNT(*) FILTER (WHERE status = 'converted')::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
    ) AS conversion_rate
FROM public.leads
GROUP BY clinic_id;

-- Grant access to the view
GRANT SELECT ON public.lead_statistics TO authenticated;

-- ============================================================================
-- SEED DATA - Sample lead sources with initial scores
-- ============================================================================
COMMENT ON TABLE public.leads IS 'Sales leads captured from various channels with scoring and pipeline tracking';
COMMENT ON COLUMN public.leads.score IS 'Lead score 0-100 based on BANT criteria and engagement';
COMMENT ON COLUMN public.leads.temperature IS 'cold: <40, warm: 40-69, hot: >=70';
COMMENT ON COLUMN public.leads.source IS 'Channel where the lead originated: whatsapp, instagram, web, referral, campaign, other';