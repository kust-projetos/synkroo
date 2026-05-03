-- Create tasks table for CRM task management
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS policies
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Users can only see their clinic's tasks
CREATE POLICY "Users can view their clinic tasks" ON tasks
  FOR SELECT USING (auth.uid() = clinic_id);

CREATE POLICY "Users can insert their clinic tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = clinic_id);

CREATE POLICY "Users can update their clinic tasks" ON tasks
  FOR UPDATE USING (auth.uid() = clinic_id);

CREATE POLICY "Users can delete their clinic tasks" ON tasks
  FOR DELETE USING (auth.uid() = clinic_id);

-- Index for faster queries
CREATE INDEX idx_tasks_clinic_id ON tasks(clinic_id);
CREATE INDEX idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();