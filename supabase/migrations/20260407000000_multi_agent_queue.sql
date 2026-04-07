-- Multi-Agent Queue Infrastructure
-- Creates: agent_queue, agent_queue_dlq tables + trigger for NOTIFY

-- ============================================
-- AGENT QUEUE (Main queue)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_agent VARCHAR(50) NOT NULL,
  to_agent VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  process_after TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_queue_status ON public.agent_queue(status);
CREATE INDEX IF NOT EXISTS idx_agent_queue_to_agent ON public.agent_queue(to_agent);
CREATE INDEX IF NOT EXISTS idx_agent_queue_process_after ON public.agent_queue(process_after);

-- ============================================
-- AGENT DLQ (Dead Letter Queue)
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue_id UUID REFERENCES public.agent_queue(id) ON DELETE SET NULL,
  from_agent VARCHAR(50),
  to_agent VARCHAR(50),
  payload JSONB,
  error TEXT,
  retry_count INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  manual_action_required BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_agent_dlq_created ON public.agent_dlq(created_at);

-- ============================================
-- NOTIFY TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION public.agent_queue_notify()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('agent_queue', json_build_object(
    'id', NEW.id,
    'to_agent', NEW.to_agent,
    'status', NEW.status
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS agent_queue_notify ON public.agent_queue;
CREATE TRIGGER agent_queue_notify
AFTER INSERT OR UPDATE ON public.agent_queue
FOR EACH ROW EXECUTE FUNCTION public.agent_queue_notify();

-- ============================================
-- RLS Policies (admin only for queue)
-- ============================================
ALTER TABLE public.agent_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_dlq ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to agent_queue"
  ON public.agent_queue FOR ALL TO service_role USING (true);

CREATE POLICY "Service role full access to agent_dlq"
  ON public.agent_dlq FOR ALL TO service_role USING (true);
