-- Fix: restrict conversation_states management to service_role only
DROP POLICY IF EXISTS "System can manage conversation states" ON conversation_states;

CREATE POLICY "System can manage conversation states" ON conversation_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);