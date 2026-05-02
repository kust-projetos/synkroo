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

-- Get stage IDs
DO $$
DECLARE
  novos_id UUID;
  qualificados_id UUID;
  proposta_id UUID;
  negociacao_id UUID;
  fechado_id UUID;
  perdido_id UUID;
  demo_clinic_id UUID := '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
BEGIN
  SELECT id INTO novos_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Novos';
  SELECT id INTO qualificados_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Qualificados';
  SELECT id INTO proposta_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Proposta';
  SELECT id INTO negociacao_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Negociação';
  SELECT id INTO fechado_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Fechado';
  SELECT id INTO perdido_id FROM pipeline_stages WHERE clinic_id = demo_clinic_id AND name = 'Perdido';

  -- Demo leads
  INSERT INTO leads (clinic_id, name, phone, email, source, temperature, score, stage_id, interest, last_contact_at, status, created_at, updated_at)
  VALUES
  (demo_clinic_id, 'Maria Silva', '+5511999999001', 'maria.silva@example.com', 'instagram', 'hot', 95, novos_id, 'Implante dentário', NOW() - INTERVAL '1 day', 'new', NOW() - INTERVAL '2 days', NOW()),
  (demo_clinic_id, 'João Santos', '+5511999999002', 'joao.santos@example.com', 'google', 'hot', 88, novos_id, 'Clareamento dental', NOW() - INTERVAL '3 days', 'new', NOW() - INTERVAL '5 days', NOW()),
  (demo_clinic_id, 'Ana Oliveira', '+5511999999003', 'ana.oliveira@example.com', 'whatsapp', 'warm', 72, qualificados_id, 'Aparelho ortodôntico', NOW() - INTERVAL '7 days', 'qualified', NOW() - INTERVAL '10 days', NOW()),
  (demo_clinic_id, 'Carlos Ferreira', '+5511999999004', 'carlos.ferreira@example.com', 'indicação', 'warm', 65, qualificados_id, 'Restauração estética', NOW() - INTERVAL '14 days', 'qualified', NOW() - INTERVAL '20 days', NOW()),
  (demo_clinic_id, 'Fernanda Costa', '+5511999999005', 'fernanda.costa@example.com', 'facebook', 'hot', 82, proposta_id, 'Protocolo protocol', NOW() - INTERVAL '5 days', 'proposal', NOW() - INTERVAL '8 days', NOW()),
  (demo_clinic_id, 'Ricardo Lima', '+5511999999006', 'ricardo.lima@example.com', 'google', 'warm', 58, proposta_id, 'Lente de contato dental', NOW() - INTERVAL '10 days', 'proposal', NOW() - INTERVAL '15 days', NOW()),
  (demo_clinic_id, 'Patricia Almeida', '+5511999999007', 'patricia.almeida@example.com', 'instagram', 'hot', 91, negociacao_id, 'Implante + clareamento', NOW() - INTERVAL '2 days', 'negotiation', NOW() - INTERVAL '3 days', NOW()),
  (demo_clinic_id, 'Lucas Mendes', '+5511999999008', 'lucas.mendes@example.com', 'whatsapp', 'warm', 55, negociacao_id, 'Facetas de porcelana', NOW() - INTERVAL '8 days', 'negotiation', NOW() - INTERVAL '12 days', NOW()),
  (demo_clinic_id, 'Juliana Rocha', '+5511999999009', 'juliana.rocha@example.com', 'indicação', 'cold', 30, perdido_id, 'Tratamento geral', NOW() - INTERVAL '30 days', 'lost', NOW() - INTERVAL '45 days', NOW());
END $$;