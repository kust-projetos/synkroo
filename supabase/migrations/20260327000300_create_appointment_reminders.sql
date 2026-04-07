-- Create appointment_reminders table
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL, -- '24h', '2h', etc.
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_appointment_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX idx_appointment_reminders_type ON appointment_reminders(reminder_type, sent_at);

-- Enable RLS
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view reminders for their clinic's appointments
CREATE POLICY "Users can view appointment reminders from their clinic"
  ON appointment_reminders FOR SELECT
  USING (
    appointment_id IN (
      SELECT id FROM appointments
      WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    )
  );

-- Note: Cron jobs are now handled by Vercel Cron (see vercel.json)
-- This is cleaner and doesn't require pg_cron extension
--
-- To manually trigger reminders, call the API endpoint:
-- POST /api/cron/reminders with Authorization: Bearer <CRON_SECRET>

-- Function to clean up old reminders (older than 30 days)
-- Call this manually or via a scheduled job
CREATE OR REPLACE FUNCTION cleanup_old_reminders()
RETURNS void AS $$
BEGIN
  DELETE FROM appointment_reminders
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users (via service role)
GRANT EXECUTE ON FUNCTION cleanup_old_reminders() TO service_role;