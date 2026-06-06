-- Fix: restrict memory management to service_role only
DROP POLICY IF EXISTS "Service role can manage memories" ON conversation_memories;

CREATE POLICY "Service role can manage memories" ON conversation_memories
  FOR ALL TO service_role USING (true) WITH CHECK (true);