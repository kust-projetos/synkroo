-- Seed pipeline stages and demo leads for CRM
-- Run after 20260425000001_add_leads_pipeline_columns.sql

-- Pipeline stages (default for dental clinic CRM)
INSERT INTO pipeline_stages (clinic_id, name, color, sort_order, created_at, updated_at) VALUES
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Novos', '#3b82f6', 1, NOW(), NOW()),
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Qualificados', '#8b5cf6', 2, NOW(), NOW()),
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Proposta', '#f59e0b', 3, NOW(), NOW()),
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Negociação', '#f97316', 4, NOW(), NOW()),
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Fechado', '#22c55e', 5, NOW(), NOW()),
('1e211b5d-d8a9-44ef-a5c7-5ce6c583218a', 'Perdido', '#ef4444', 6, NOW(), NOW());

-- Demo leads (CTE to get stage IDs)
WITH stages AS (
  SELECT id, name FROM pipeline_stages
  WHERE clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a'
)
INSERT INTO leads (clinic_id, name, phone, email, source, temperature, score, stage_id, interest, last_contact_at, status, created_at, updated_at)
SELECT
  '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a',
  t.name, t.phone, t.email, t.source, t.temperature, t.score,
  s.id, t.interest, t.last_contact, t.status, t.created, NOW()
FROM (VALUES
  ('Maria Silva', '+5511999999001', 'maria.silva@email.com', 'instagram', 'hot', 95, 'Implante dentário', NOW()-INTERVAL '1 day', 'new', NOW()-INTERVAL '2 day'),
  ('João Santos', '+5511999999002', 'joao.santos@email.com', 'google', 'hot', 88, 'Clareamento dental', NOW()-INTERVAL '3 day', 'new', NOW()-INTERVAL '5 day'),
  ('Ana Oliveira', '+5511999999003', 'ana.oliveira@email.com', 'whatsapp', 'warm', 72, 'Aparelho ortodôntico', NOW()-INTERVAL '7 day', 'qualified', NOW()-INTERVAL '10 day'),
  ('Carlos Ferreira', '+5511999999004', 'carlos.ferreira@email.com', 'indicação', 'warm', 65, 'Restauração estética', NOW()-INTERVAL '14 day', 'qualified', NOW()-INTERVAL '20 day'),
  ('Fernanda Costa', '+5511999999005', 'fernanda.costa@email.com', 'facebook', 'hot', 82, 'Protocolo', NOW()-INTERVAL '5 day', 'proposal', NOW()-INTERVAL '8 day'),
  ('Ricardo Lima', '+5511999999006', 'ricardo.lima@email.com', 'google', 'warm', 58, 'Lente de contato dental', NOW()-INTERVAL '10 day', 'proposal', NOW()-INTERVAL '15 day'),
  ('Patricia Almeida', '+5511999999007', 'patricia.almeida@email.com', 'instagram', 'hot', 91, 'Implante + clareamento', NOW()-INTERVAL '2 day', 'negotiation', NOW()-INTERVAL '3 day'),
  ('Lucas Mendes', '+5511999999008', 'lucas.mendes@email.com', 'whatsapp', 'warm', 55, 'Facetas de porcelana', NOW()-INTERVAL '8 day', 'negotiation', NOW()-INTERVAL '12 day'),
  ('Juliana Rocha', '+5511999999009', 'juliana.rocha@email.com', 'indicação', 'cold', 30, 'Tratamento geral', NOW()-INTERVAL '30 day', 'lost', NOW()-INTERVAL '45 day')
) AS t(name, phone, email, source, temperature, score, interest, last_contact, status, created)
JOIN stages s ON s.name = t.stage;