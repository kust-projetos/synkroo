-- Create dentists table
CREATE TABLE IF NOT EXISTS dentists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  specialty TEXT,
  cro_number TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster clinic lookups
CREATE INDEX idx_dentists_clinic_id ON dentists(clinic_id);
CREATE INDEX idx_dentists_active ON dentists(clinic_id, is_active);

-- Enable RLS
ALTER TABLE dentists ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see dentists from their clinic
CREATE POLICY "Users can view dentists from their clinic"
  ON dentists FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policy: Only admins can manage dentists
CREATE POLICY "Admins can manage dentists"
  ON dentists FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create procedures table
CREATE TABLE IF NOT EXISTS procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  price DECIMAL(10, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster clinic lookups
CREATE INDEX idx_procedures_clinic_id ON procedures(clinic_id);
CREATE INDEX idx_procedures_active ON procedures(clinic_id, is_active);

-- Enable RLS
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see procedures from their clinic
CREATE POLICY "Users can view procedures from their clinic"
  ON procedures FOR SELECT
  USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policy: Only admins can manage procedures
CREATE POLICY "Admins can manage procedures"
  ON procedures FOR ALL
  USING (
    clinic_id IN (
      SELECT clinic_id FROM users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Add foreign key constraints to appointments
ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_dentist
  FOREIGN KEY (dentist_id) REFERENCES dentists(id) ON DELETE SET NULL;

ALTER TABLE appointments
  ADD CONSTRAINT fk_appointments_procedure
  FOREIGN KEY (procedure_id) REFERENCES procedures(id) ON DELETE SET NULL;

-- Insert sample data for demo clinic
INSERT INTO dentists (clinic_id, name, phone, email, specialty, cro_number) VALUES
  ('clinic-123', 'Dr. Maria Silva', '11999990001', 'maria@clinica.com', 'Ortodontia', 'CRO-SP 12345'),
  ('clinic-123', 'Dr. João Santos', '11999990002', 'joao@clinica.com', 'Implantodontia', 'CRO-SP 54321'),
  ('clinic-123', 'Dr. Ana Oliveira', '11999990003', 'ana@clinica.com', 'Endodontia', 'CRO-SP 67890');

INSERT INTO procedures (clinic_id, name, description, duration_minutes, price) VALUES
  ('clinic-123', 'Consulta de Rotina', 'Consulta preventiva e avaliação geral', 30, 150.00),
  ('clinic-123', 'Limpeza Dental', 'Profilaxia e limpeza profissional', 45, 200.00),
  ('clinic-123', 'Clareamento Dental', 'Clareamento a laser ou caseiro', 60, 800.00),
  ('clinic-123', 'Canal', 'Tratamento de canal radicular', 90, 600.00),
  ('clinic-123', 'Extração', 'Extração simples ou complexa', 45, 300.00),
  ('clinic-123', 'Obturação', 'Restauração de cáries', 30, 200.00);