-- Add missing tables for agent logs, smart triggers, appointment reminder configs, and procedure types

-- agent_logs
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  conversation_id UUID,
  intent TEXT,
  confidence DECIMAL(3,2),
  response_time_ms INTEGER,
  action_taken TEXT,
  escalation BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- smart_trigger_log
CREATE TABLE IF NOT EXISTS smart_trigger_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL,
  patient_id UUID NOT NULL,
  appointment_id UUID,
  trigger_type TEXT NOT NULL,
  priority INTEGER DEFAULT 0,
  message_sent TEXT,
  channel TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'sent',
  patient_responded BOOLEAN DEFAULT false,
  response_at TIMESTAMPTZ,
  patient_response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- appointment_reminder_configs
CREATE TABLE IF NOT EXISTS appointment_reminder_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  procedure_type_id UUID NOT NULL,
  hours_before INTEGER NOT NULL,
  message_template TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- procedure_types
CREATE TABLE IF NOT EXISTS procedure_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- campaign_segments
CREATE TABLE IF NOT EXISTS campaign_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  criteria JSONB NOT NULL,
  patient_count INTEGER DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
