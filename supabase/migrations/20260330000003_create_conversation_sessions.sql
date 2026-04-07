-- Migration: Create conversation_sessions table
-- Stores conversation context that survives serverless cold starts
-- Replaces in-memory Map in ConversationContext service

CREATE TABLE IF NOT EXISTS public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  entries JSONB NOT NULL DEFAULT '[]',
  extracted_info JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unique_conversation_session UNIQUE (conversation_id)
);

-- Index for fast lookup by conversation_id
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_conv_id
  ON public.conversation_sessions (conversation_id);

-- Index for cleanup of expired sessions (older than 30 minutes)
CREATE INDEX IF NOT EXISTS idx_conversation_sessions_last_activity
  ON public.conversation_sessions (last_activity_at);

-- Enable RLS
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: clinic users can access their clinic's conversation sessions
CREATE POLICY "Clinic users can manage conversation sessions"
  ON public.conversation_sessions
  FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM public.conversations
      WHERE clinic_id = (
        SELECT clinic_id FROM public.profiles
        WHERE id = auth.uid()
      )
    )
  );

-- Auto-cleanup: delete sessions older than 30 minutes
-- (Called periodically or on read)
CREATE OR REPLACE FUNCTION public.cleanup_expired_conversation_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.conversation_sessions
  WHERE last_activity_at < now() - interval '30 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
