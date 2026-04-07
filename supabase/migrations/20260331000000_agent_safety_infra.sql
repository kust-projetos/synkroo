-- Migration: Agent Safety Infrastructure
-- Creates: pending_actions, decision_logs, smart_trigger_log
-- Part of Phase 1: Risk scoring + Undo + Decision logging + Smart triggers

-- ============================================
-- PENDING ACTIONS (Undo/Rollback support)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Action details
  action_type VARCHAR(50) NOT NULL, -- 'cancel_appointment', 'book_appointment', 'reschedule', etc.
  risk_score INTEGER NOT NULL DEFAULT 0, -- 0-100
  risk_level VARCHAR(10) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, executed, undone, expired

  -- What was changed (for undo)
  snapshot_before JSONB DEFAULT '{}', -- State before action
  snapshot_after JSONB DEFAULT '{}',  -- State after action
  undo_payload JSONB DEFAULT '{}',    -- What to execute on undo

  -- Confirmation tracking
  confirmation_count INTEGER DEFAULT 0,
  max_confirmations INTEGER DEFAULT 1,
  confirmed_at TIMESTAMPTZ,

  -- TTL for undo window
  undo_deadline TIMESTAMPTZ NOT NULL, -- Usually now() + 5 minutes
  undone_at TIMESTAMPTZ,

  -- Metadata
  reasoning TEXT,
  agent_intent VARCHAR(50),
  confidence DECIMAL(3,2),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_actions_clinic ON public.pending_actions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_pending_actions_status ON public.pending_actions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_pending_actions_deadline ON public.pending_actions(undo_deadline) WHERE status = 'executed';

-- ============================================
-- DECISION LOGS (Explainability)
-- ============================================
CREATE TABLE IF NOT EXISTS public.decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,

  -- Decision details
  intent_classified VARCHAR(50) NOT NULL,
  confidence_score DECIMAL(3,2) NOT NULL,
  action_taken VARCHAR(50) NOT NULL,
  risk_level VARCHAR(10) NOT NULL DEFAULT 'LOW',

  -- Reasoning
  reasoning TEXT NOT NULL,
  escalation_triggered BOOLEAN DEFAULT false,
  human_override BOOLEAN DEFAULT false,

  -- Context snapshot
  message_summary TEXT,
  entities_extracted JSONB DEFAULT '{}',
  rag_sources JSONB DEFAULT '[]',

  -- Performance
  response_time_ms INTEGER,
  tokens_used INTEGER,
  llm_model VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_clinic ON public.decision_logs(clinic_id);
CREATE INDEX IF NOT EXISTS idx_decision_logs_created ON public.decision_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_logs_patient ON public.decision_logs(patient_id);

-- ============================================
-- SMART TRIGGER LOG (Prevent spam + cooldown)
-- ============================================
CREATE TABLE IF NOT EXISTS public.smart_trigger_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

  -- Trigger details
  trigger_type VARCHAR(50) NOT NULL, -- 'no_show_recovery', 'post_appointment_1d', etc.
  priority INTEGER NOT NULL DEFAULT 5,
  message_sent TEXT,
  channel VARCHAR(20) DEFAULT 'whatsapp',

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent, delivered, read, responded, failed

  -- Response tracking
  patient_responded BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  patient_response TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trigger_log_patient ON public.smart_trigger_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_trigger_log_type ON public.smart_trigger_log(trigger_type);
CREATE INDEX IF NOT EXISTS idx_trigger_log_created ON public.smart_trigger_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trigger_log_cooldown ON public.smart_trigger_log(clinic_id, patient_id, trigger_type, created_at DESC);

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE public.pending_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_trigger_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic users manage pending_actions"
  ON public.pending_actions FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Clinic users manage decision_logs"
  ON public.decision_logs FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Clinic users manage smart_trigger_log"
  ON public.smart_trigger_log FOR ALL
  USING (clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid()));

-- ============================================
-- Cleanup: Expire old pending actions
-- ============================================
CREATE OR REPLACE FUNCTION public.cleanup_expired_pending_actions()
RETURNS void AS $$
BEGIN
  UPDATE public.pending_actions
  SET status = 'expired', updated_at = now()
  WHERE status = 'executed'
    AND undo_deadline < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup: Remove old decision logs (> 2 years)
CREATE OR REPLACE FUNCTION public.cleanup_old_decision_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM public.decision_logs
  WHERE created_at < now() - interval '2 years';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
