-- Create conversation_states table for scheduler context
CREATE TABLE IF NOT EXISTS conversation_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_conversation_states_conversation ON conversation_states(conversation_id);

-- Enable RLS
ALTER TABLE conversation_states ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view states from their clinic's conversations
CREATE POLICY "Users can view conversation states from their clinic"
  ON conversation_states FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    )
  );

-- RLS Policy: System can manage conversation states
CREATE POLICY "System can manage conversation states"
  ON conversation_states FOR ALL
  USING (true);