-- Migration: Add remaining RLS policies for tables with RLS enabled but no policies
-- Affected tables: follow_ups, patient_risk_scores, audit_logs
-- These tables have RLS enabled but no policies, making them inaccessible to authenticated users.

-- ============================================
-- follow_ups: Clinic users can manage their clinic's follow-ups
-- RLS already enabled in initial schema
-- ============================================
DROP POLICY IF EXISTS "Clinic users manage follow_ups" ON public.follow_ups;

CREATE POLICY "Clinic users manage follow_ups"
  ON public.follow_ups FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));

-- ============================================
-- patient_risk_scores: Clinic users can manage their clinic's patient risk scores
-- Table has patient_id but no direct clinic_id; must join through patients
-- ============================================
ALTER TABLE public.patient_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clinic users manage patient_risk_scores" ON public.patient_risk_scores;

CREATE POLICY "Clinic users manage patient_risk_scores"
  ON public.patient_risk_scores FOR ALL
  USING (patient_id IN (
    SELECT id FROM public.patients
    WHERE clinic_id IN (
      SELECT clinic_id FROM public.users
      WHERE id = auth.uid() AND is_active = true
    )
  ));

-- ============================================
-- audit_logs: Only admins and owners can view audit logs
-- ============================================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and owners can view audit_logs" ON public.audit_logs;

CREATE POLICY "Admins and owners can view audit_logs"
  ON public.audit_logs FOR SELECT
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('admin', 'owner')
  ));
