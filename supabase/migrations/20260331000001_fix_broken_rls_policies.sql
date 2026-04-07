-- Migration: Fix broken RLS policies referencing non-existent 'profiles' table
-- The policies referenced public.profiles which doesn't exist; should be public.users
-- Affected tables: conversation_sessions, pending_actions, decision_logs, smart_trigger_log

-- ============================================
-- conversation_sessions: Fix RLS policy
-- ============================================
DROP POLICY IF EXISTS "Clinic users can manage conversation sessions" ON public.conversation_sessions;

CREATE POLICY "Clinic users can manage conversation sessions"
  ON public.conversation_sessions
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE clinic_id = (
        SELECT clinic_id FROM public.users
        WHERE id = auth.uid() AND is_active = true
      )
    )
  );

-- ============================================
-- pending_actions: Fix RLS policy
-- ============================================
DROP POLICY IF EXISTS "Clinic users manage pending_actions" ON public.pending_actions;

CREATE POLICY "Clinic users manage pending_actions"
  ON public.pending_actions FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));

-- ============================================
-- decision_logs: Fix RLS policy
-- ============================================
DROP POLICY IF EXISTS "Clinic users manage decision_logs" ON public.decision_logs;

CREATE POLICY "Clinic users manage decision_logs"
  ON public.decision_logs FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));

-- ============================================
-- smart_trigger_log: Fix RLS policy
-- ============================================
DROP POLICY IF EXISTS "Clinic users manage smart_trigger_log" ON public.smart_trigger_log;

CREATE POLICY "Clinic users manage smart_trigger_log"
  ON public.smart_trigger_log FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));
