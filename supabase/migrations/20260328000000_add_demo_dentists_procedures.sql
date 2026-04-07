-- Script para adicionar dados de demonstração para Dentistas e Procedimentos
-- Execute este script no Supabase SQL Editor

-- Inserir dentistas de demonstração
INSERT INTO dentists (id, clinic_id, name, phone, email, specialty, cro_number, is_active) VALUES
  ('11111111-1111-1111-1111-111111111101', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Dra. Ana Carolina Silva', '(11) 99999-1001', 'ana.silva@clinicademo.com', 'Clínico Geral', '12345/SP', true),
  ('11111111-1111-1111-1111-111111111102', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Dr. Bruno Oliveira', '(11) 99999-1002', 'bruno.oliveira@clinicademo.com', 'Ortodontia', '23456/SP', true),
  ('11111111-1111-1111-1111-111111111103', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Dra. Carolina Mendes', '(11) 99999-1003', 'carolina.mendes@clinicademo.com', 'Implantodontia', '34567/SP', true),
  ('11111111-1111-1111-1111-111111111104', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Dr. Daniel Santos', '(11) 99999-1004', 'daniel.santos@clinicademo.com', 'Endodontia', '45678/SP', true),
  ('11111111-1111-1111-1111-111111111105', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Dra. Fernanda Lima', '(11) 99999-1005', 'fernanda.lima@clinicademo.com', 'Odontopediatria', '56789/SP', true)
ON CONFLICT (id) DO NOTHING;

-- Inserir procedimentos de demonstração
INSERT INTO procedures (id, clinic_id, name, description, duration_minutes, price, is_active) VALUES
  ('22222222-2222-2222-2222-222222222201', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Consulta Inicial', 'Avaliação completa do paciente, histórico médico e planejamento de tratamento', 60, 150.00, true),
  ('22222222-2222-2222-2222-222222222202', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Limpeza Profissional', 'Profilaxia e limpeza completa dos dentes', 45, 200.00, true),
  ('22222222-2222-2222-2222-222222222203', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Clareamento a Laser', 'Clareamento dental com tecnologia a laser', 90, 800.00, true),
  ('22222222-2222-2222-2222-222222222204', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Tratamento de Canal', 'Tratamento endodôntico de canal', 90, 600.00, true),
  ('22222222-2222-2222-2222-222222222205', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Extração Simples', 'Extração de dente sem complicação', 30, 250.00, true),
  ('22222222-2222-2222-2222-222222222206', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Aparelho Ortodôntico', 'Instalação de aparelho fixo metálico', 120, 3500.00, true),
  ('22222222-2222-2222-2222-222222222207', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Implante Dental', 'Implante de titânio com coroa', 180, 4500.00, true),
  ('22222222-2222-2222-2222-222222222208', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Restauração Estética', 'Restauração com resina composta', 45, 180.00, true),
  ('22222222-2222-2222-2222-222222222209', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Coroa de Porcelana', 'Coroa total em porcelana', 90, 1200.00, true),
  ('22222222-2222-2222-2222-222222222210', 'fc4cacb7-00d5-4f82-93d2-c09946f92935', 'Manutenção de Aparelho', 'Ajuste e manutenção mensal do aparelho ortodôntico', 30, 150.00, true)
ON CONFLICT (id) DO NOTHING;

-- Atualizar alguns agendamentos existentes para associar com dentistas e procedimentos
UPDATE appointments
SET dentist_id = '11111111-1111-1111-1111-111111111101',
    procedure_id = '22222222-2222-2222-2222-222222222201'
WHERE dentist_id IS NULL AND clinic_id = 'fc4cacb7-00d5-4f82-93d2-c09946f92935'
LIMIT 2;

UPDATE appointments
SET dentist_id = '11111111-1111-1111-1111-111111111102',
    procedure_id = '22222222-2222-2222-2222-222222222202'
WHERE dentist_id IS NULL AND clinic_id = 'fc4cacb7-00d5-4f82-93d2-c09946f92935'
LIMIT 2;

UPDATE appointments
SET dentist_id = '11111111-1111-1111-1111-111111111103',
    procedure_id = '22222222-2222-2222-2222-222222222203'
WHERE dentist_id IS NULL AND clinic_id = 'fc4cacb7-00d5-4f82-93d2-c09946f92935'
LIMIT 2;