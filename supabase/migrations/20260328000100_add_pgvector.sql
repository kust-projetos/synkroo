-- ============================================
-- SYNKROO - pgvector Extension for RAG
-- Version: 1.0.0
-- Date: 2026-03-28
-- ============================================

-- Enable pgvector extension (available in Supabase)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ADD EMBEDDING COLUMNS
-- ============================================

-- Add embedding column to knowledge_base (clinic-specific knowledge)
ALTER TABLE knowledge_base
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Add embedding column to messages for conversation memory
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create a dedicated table for conversation memory with embeddings
CREATE TABLE IF NOT EXISTS conversation_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) DEFAULT 'message', -- 'message', 'summary', 'entity'
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR VECTOR SEARCH
-- ============================================

-- HNSW index for fast approximate nearest neighbor search
-- ef_construction=128, m=16 provides good balance of speed/accuracy
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
ON knowledge_base
USING hnsw (embedding vector_cosine_ops)
WITH (ef_construction = 128, m = 16);

CREATE INDEX IF NOT EXISTS idx_messages_embedding
ON messages
USING hnsw (embedding vector_cosine_ops)
WITH (ef_construction = 128, m = 16);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_embedding
ON conversation_memories
USING hnsw (embedding vector_cosine_ops)
WITH (ef_construction = 128, m = 16);

-- Standard indexes for filtering
CREATE INDEX IF NOT EXISTS idx_conversation_memories_clinic
ON conversation_memories(clinic_id);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_conversation
ON conversation_memories(conversation_id);

CREATE INDEX IF NOT EXISTS idx_conversation_memories_patient
ON conversation_memories(patient_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_clinic_active
ON knowledge_base(clinic_id) WHERE is_active = true;

-- ============================================
-- RLS FOR CONVERSATION MEMORIES
-- ============================================

ALTER TABLE conversation_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view memories from their clinic"
  ON conversation_memories FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage memories"
  ON conversation_memories FOR ALL
  USING (true);

-- ============================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================

-- Function to find similar knowledge base entries
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  p_clinic_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  category VARCHAR(100),
  question TEXT,
  answer TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.category,
    kb.question,
    kb.answer,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE kb.clinic_id = p_clinic_id
    AND kb.is_active = true
    AND kb.embedding IS NOT NULL
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to find similar conversation memories
CREATE OR REPLACE FUNCTION search_conversation_memories(
  query_embedding vector(1536),
  p_clinic_id UUID,
  p_patient_id UUID DEFAULT NULL,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  conversation_id UUID,
  patient_id UUID,
  content TEXT,
  content_type VARCHAR(50),
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cm.id,
    cm.conversation_id,
    cm.patient_id,
    cm.content,
    cm.content_type,
    1 - (cm.embedding <=> query_embedding) AS similarity,
    cm.created_at
  FROM conversation_memories cm
  WHERE cm.clinic_id = p_clinic_id
    AND cm.embedding IS NOT NULL
    AND (p_patient_id IS NULL OR cm.patient_id = p_patient_id)
    AND 1 - (cm.embedding <=> query_embedding) > match_threshold
  ORDER BY cm.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to store message with embedding
CREATE OR REPLACE FUNCTION store_message_with_embedding(
  p_conversation_id UUID,
  p_direction message_direction,
  p_content TEXT,
  p_embedding vector(1536),
  p_intent VARCHAR(50) DEFAULT NULL,
  p_entities JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_clinic_id UUID;
  v_patient_id UUID;
BEGIN
  -- Get clinic and patient from conversation
  SELECT clinic_id, patient_id INTO v_clinic_id, v_patient_id
  FROM conversations WHERE id = p_conversation_id;

  -- Insert message
  INSERT INTO messages (
    conversation_id,
    direction,
    content,
    message_type,
    embedding,
    intent,
    entities,
    is_ai
  ) VALUES (
    p_conversation_id,
    p_direction,
    p_content,
    'text',
    p_embedding,
    p_intent,
    p_entities,
    p_direction = 'outbound'
  )
  RETURNING id INTO v_message_id;

  -- Also store in conversation_memories for long-term context
  INSERT INTO conversation_memories (
    clinic_id,
    conversation_id,
    patient_id,
    content,
    content_type,
    embedding,
    metadata
  ) VALUES (
    v_clinic_id,
    p_conversation_id,
    v_patient_id,
    p_content,
    'message',
    p_embedding,
    jsonb_build_object(
      'direction', p_direction,
      'intent', p_intent
    )
  );

  RETURN v_message_id;
END;
$$;

-- Function to create conversation summary embedding
CREATE OR REPLACE FUNCTION summarize_conversation(
  p_conversation_id UUID,
  p_summary TEXT,
  p_embedding vector(1536)
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_memory_id UUID;
  v_clinic_id UUID;
  v_patient_id UUID;
BEGIN
  -- Get clinic and patient from conversation
  SELECT clinic_id, patient_id INTO v_clinic_id, v_patient_id
  FROM conversations WHERE id = p_conversation_id;

  -- Insert summary
  INSERT INTO conversation_memories (
    clinic_id,
    conversation_id,
    patient_id,
    content,
    content_type,
    embedding,
    metadata
  ) VALUES (
    v_clinic_id,
    p_conversation_id,
    v_patient_id,
    p_summary,
    'summary',
    p_embedding,
    jsonb_build_object('type', 'conversation_summary')
  )
  RETURNING id INTO v_memory_id;

  RETURN v_memory_id;
END;
$$;

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION search_knowledge_base TO authenticated;
GRANT EXECUTE ON FUNCTION search_conversation_memories TO authenticated;
GRANT EXECUTE ON FUNCTION store_message_with_embedding TO service_role;
GRANT EXECUTE ON FUNCTION summarize_conversation TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE conversation_memories IS 'Long-term memory storage for AI agent with vector embeddings';
COMMENT ON FUNCTION search_knowledge_base IS 'Semantic search in clinic knowledge base using pgvector';
COMMENT ON FUNCTION search_conversation_memories IS 'Semantic search in conversation history using pgvector';
COMMENT ON FUNCTION store_message_with_embedding IS 'Store message with embedding for RAG';