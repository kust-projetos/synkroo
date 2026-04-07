-- ============================================
-- SYNKROO - Seed Data (Idempotent)
-- ============================================

-- First, clean up existing demo data (if any)
DELETE FROM message_templates WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM knowledge_base WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM appointments WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
);
DELETE FROM conversations WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM patients WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM procedures WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM dentists WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM users WHERE clinic_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
DELETE FROM clinics WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

-- Demo Clinic
INSERT INTO clinics (id, name, slug, phone, email, settings, subscription_plan)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Clínica Sorriso Branco',
    'sorriso-branco',
    '+5511999999999',
    'contato@sorrisobranco.com.br',
    '{"whatsapp_phone_number_id": "123456789", "instagram_account_id": "987654321", "procedures": ["Clareamento", "Limpeza", "Implante", "Canal"]}',
    'professional'
);

-- Demo Users
INSERT INTO users (id, clinic_id, email, name, role, phone, is_active)
VALUES
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'dono@sorrisobranco.com.br', 'Maria Silva', 'owner', '+5511888888881', true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@sorrisobranco.com.br', 'João Santos', 'admin', '+5511888888882', true),
    ('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'dentista@sorrisobranco.com.br', 'Dra. Ana Costa', 'dentist', '+5511888888883', true);

-- Demo Dentists
INSERT INTO dentists (id, clinic_id, name, phone, email, cro, specialty, working_hours)
VALUES
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dra. Ana Costa', '+5511888888883', 'ana@sorrisobranco.com.br', 'CRO-SP 12345', 'Clínico Geral', '{"monday": {"start": "08:00", "end": "18:00"}, "tuesday": {"start": "08:00", "end": "18:00"}, "wednesday": {"start": "08:00", "end": "18:00"}, "thursday": {"start": "08:00", "end": "18:00"}, "friday": {"start": "08:00", "end": "16:00"}}'),
    ('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Dr. Pedro Oliveira', '+5511888888884', 'pedro@sorrisobranco.com.br', 'CRO-SP 54321', 'Implantodontista', '{"monday": {"start": "09:00", "end": "17:00"}, "wednesday": {"start": "09:00", "end": "17:00"}, "friday": {"start": "09:00", "end": "17:00"}}');

-- Demo Procedures
INSERT INTO procedures (clinic_id, name, description, duration_minutes, price, category)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Clareamento Dental', 'Clareamento profissional com laser e gel', 60, 800.00, 'Estética'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Limpeza Profissional', 'Profilaxia e limpeza de tártaro', 40, 150.00, 'Prevenção'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Extração Simples', 'Extração de dente simples', 30, 200.00, 'Cirurgia'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Tratamento de Canal', 'Endodontia - tratamento de canal', 90, 600.00, 'Endodontia'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Implante Dentário', 'Implante com coroa inclusa', 120, 3500.00, 'Implantodontia');

-- Demo Patients
INSERT INTO patients (id, clinic_id, name, phone, email, tags, risk_score)
VALUES
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Carlos Mendes', '+5511777777771', 'carlos@email.com', ARRAY['VIP', 'Frequente'], 0.15),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Fernanda Lima', '+5511777777772', 'fernanda@email.com', ARRAY['Novo'], 0.05),
    ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Roberto Alves', '+5511777777773', 'roberto@email.com', ARRAY['Inativo'], 0.65);

-- Demo Appointments (using procedure names instead of IDs for simplicity)
INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
SELECT
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    NOW() + INTERVAL '2 days 10 hours',
    60,
    'confirmed'
WHERE EXISTS (SELECT 1 FROM patients WHERE id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
SELECT
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    NOW() + INTERVAL '4 days 14 hours',
    40,
    'scheduled'
WHERE EXISTS (SELECT 1 FROM patients WHERE id = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12');

-- Demo Knowledge Base
INSERT INTO knowledge_base (clinic_id, category, question, answer, keywords)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'procedures', 'Clareamento dental', 'O clareamento dental é um procedimento estético que remove manchas e amarelamento dos dentes. O tratamento dura em média 1-2 horas e os resultados podem durar até 3 anos com cuidados adequados.', ARRAY['clareamento', 'branqueamento', 'dentes brancos']),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'procedures', 'Limpeza dental', 'A limpeza dental profissional remove tártaro e placa bacteriana. Recomendamos fazer a cada 6 meses para manter a saúde bucal. O procedimento dura cerca de 30-40 minutos.', ARRAY['limpeza', 'tártaro', 'profilaxia']),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'general', 'Horário de funcionamento', 'Funcionamos de segunda a sexta das 8h às 19h e aos sábados das 8h às 13h.', ARRAY['horário', 'funcionamento', 'abertura']),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'general', 'Formas de pagamento', 'Aceitamos cartões de crédito e débito, PIX, e oferecemos parcelamento em até 12x. Também trabalhamos com convênios.', ARRAY['pagamento', 'cartão', 'convênio', 'parcelamento']);

-- Demo Message Templates
INSERT INTO message_templates (clinic_id, name, category, content, variables, status)
VALUES
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Confirmação de Consulta', 'appointment_confirmation', 'Olá {{patient_name}}! Sua consulta está confirmada para {{date}} às {{time}} com {{dentist_name}}. Responda CONFIRMO para confirmar ou CANELO para cancelar.', '["patient_name", "date", "time", "dentist_name"]', 'approved'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lembrete 24h', 'appointment_reminder', 'Olá {{patient_name}}! Lembrete: sua consulta é amanhã às {{time}}. Até logo! 😊', '["patient_name", "time"]', 'approved'),
    ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Follow-up Pós-Consulta', 'follow_up', 'Olá {{patient_name}}! Tudo bem? Gostaríamos de saber como foi sua consulta. Em caso de dúvidas, estamos à disposição!', '["patient_name"]', 'approved');