-- ============================================
-- SYNKROO - Comprehensive Demo Data
-- ============================================

-- Get the demo clinic ID
DO $$
DECLARE
    v_clinic_id UUID;
    v_dentist1_id UUID;
    v_dentist2_id UUID;
BEGIN
    -- Get clinic ID
    SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'clinica-demo' LIMIT 1;

    IF v_clinic_id IS NULL THEN
        RAISE NOTICE 'Demo clinic not found';
        RETURN;
    END IF;

    -- ============================================
    -- DENTISTS
    -- ============================================
    INSERT INTO dentists (id, clinic_id, name, phone, email, cro, specialty, is_active)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Dra. Carolina Mendes', '(11) 99999-1001', 'carolina@clinicademo.com', 'CRO-SP 54321', 'Clínico Geral', true),
        (gen_random_uuid(), v_clinic_id, 'Dr. Ricardo Santos', '(11) 99999-1002', 'ricardo@clinicademo.com', 'CRO-SP 67890', 'Implantodontista', true),
        (gen_random_uuid(), v_clinic_id, 'Dra. Juliana Costa', '(11) 99999-1003', 'juliana@clinicademo.com', 'CRO-SP 11111', 'Ortodontista', true)
    ON CONFLICT DO NOTHING;

    -- Get dentist IDs
    SELECT id INTO v_dentist1_id FROM dentists WHERE clinic_id = v_clinic_id LIMIT 1;
    SELECT id INTO v_dentist2_id FROM dentists WHERE clinic_id = v_clinic_id OFFSET 1 LIMIT 1;

    -- ============================================
    -- PROCEDURES
    -- ============================================
    INSERT INTO procedures (clinic_id, name, description, duration_minutes, price, category, is_active)
    VALUES
        (v_clinic_id, 'Clareamento Dental', 'Clareamento profissional com gel e LED', 60, 899.00, 'Estética', true),
        (v_clinic_id, 'Limpeza Profissional', 'Profilaxia completa com flúor', 40, 199.00, 'Prevenção', true),
        (v_clinic_id, 'Tratamento de Canal', 'Endodontia - tratamento de canal radicular', 90, 799.00, 'Endodontia', true),
        (v_clinic_id, 'Extração Simples', 'Extração de dente sem complicação', 30, 299.00, 'Cirurgia', true),
        (v_clinic_id, 'Extração de Siso', 'Extração de terceiro molar', 45, 599.00, 'Cirurgia', true),
        (v_clinic_id, 'Implante Dentário', 'Implante com coroa de porcelana', 120, 4500.00, 'Implantodontia', true),
        (v_clinic_id, 'Aparelho Ortodôntico', 'Aparelho fixo metálico', 60, 3500.00, 'Ortodontia', true),
        (v_clinic_id, 'Restauração Estética', 'Obturação com resina composta', 40, 249.00, 'Restauração', true),
        (v_clinic_id, 'Coroa de Porcelana', 'Coroa total em porcelana', 60, 1800.00, 'Prótese', true),
        (v_clinic_id, 'Clareamento Caseiro', 'Moldeira personalizada com gel', 30, 499.00, 'Estética', true)
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- PATIENTS (60 patients)
    -- ============================================
    INSERT INTO patients (clinic_id, name, phone, email, cpf, birth_date, tags, risk_score, last_visit, notes)
    VALUES
        -- VIP Patients
        (v_clinic_id, 'Ana Paula Ferreira', '11988881001', 'ana.ferreira@example.com', '12345678001', '1985-03-15', ARRAY['VIP', 'Frequente'], 0.1, NOW() - INTERVAL '15 days', 'Paciente assídua, sempre pontual'),
        (v_clinic_id, 'Carlos Eduardo Silva', '11988881002', 'carlos.silva@example.com', '12345678002', '1978-07-22', ARRAY['VIP', 'Empresário'], 0.15, NOW() - INTERVAL '20 days', 'Prefere agendamentos no fim do dia'),
        (v_clinic_id, 'Mariana Costa', '11988881003', 'mariana.costa@example.com', '12345678003', '1990-11-08', ARRAY['VIP'], 0.08, NOW() - INTERVAL '10 days', 'Alta indicação de amigos'),

        -- Frequent Patients
        (v_clinic_id, 'Roberto Almeida', '11988881004', 'roberto.almeida@example.com', '12345678004', '1982-05-30', ARRAY['Frequente'], 0.2, NOW() - INTERVAL '25 days', 'Tratamento de canal em andamento'),
        (v_clinic_id, 'Fernanda Lima', '11988881005', 'fernanda.lima@example.com', '12345678005', '1995-02-14', ARRAY['Frequente', 'Jovem'], 0.12, NOW() - INTERVAL '12 days', 'Usa aparelho ortodôntico'),
        (v_clinic_id, 'Paulo Henrique', '11988881006', 'paulo.henrique@example.com', '12345678006', '1988-09-03', ARRAY['Frequente'], 0.18, NOW() - INTERVAL '18 days', 'Tratamento de gengiva'),
        (v_clinic_id, 'Juliana Santos', '11988881007', 'juliana.santos@example.com', '12345678007', '1992-12-25', ARRAY['Frequente'], 0.14, NOW() - INTERVAL '8 days', 'Indicou 3 pacientes'),
        (v_clinic_id, 'Marcos Oliveira', '11988881008', 'marcos.oliveira@example.com', '12345678008', '1975-04-11', ARRAY['Frequente'], 0.22, NOW() - INTERVAL '30 days', 'Implante realizado com sucesso'),

        -- New Patients
        (v_clinic_id, 'Camila Rodrigues', '11988881009', 'camila.rodrigues@example.com', '12345678009', '1998-06-18', ARRAY['Novo'], 0.05, NOW() - INTERVAL '5 days', 'Primeira consulta realizada'),
        (v_clinic_id, 'Thiago Martins', '11988881010', 'thiago.martins@example.com', '12345678010', '1993-01-27', ARRAY['Novo', 'Indicação'], 0.08, NOW() - INTERVAL '7 days', 'Indicado pela Ana Paula'),
        (v_clinic_id, 'Larissa Pereira', '11988881011', 'larissa.pereira@example.com', '12345678011', '1997-08-05', ARRAY['Novo'], 0.06, NOW() - INTERVAL '3 days', 'Veio pelo Instagram'),
        (v_clinic_id, 'Bruno Carvalho', '11988881012', 'bruno.carvalho@example.com', '12345678012', '1989-10-20', ARRAY['Novo'], 0.07, NOW() - INTERVAL '10 days', 'Interessado em clareamento'),

        -- Inactive Patients (30+ days)
        (v_clinic_id, 'Patricia Souza', '11988881013', 'patricia.souza@example.com', '12345678013', '1980-03-08', ARRAY['Inativo', 'Reativação'], 0.55, NOW() - INTERVAL '45 days', 'Ligar para reagendar'),
        (v_clinic_id, 'Daniel Ferreira', '11988881014', 'daniel.ferreira@example.com', '12345678014', '1985-07-15', ARRAY['Inativo'], 0.6, NOW() - INTERVAL '60 days', 'Faltou última consulta'),
        (v_clinic_id, 'Amanda Cristina', '11988881015', 'amanda.cristina@example.com', '12345678015', '1991-11-22', ARRAY['Inativo'], 0.52, NOW() - INTERVAL '50 days', 'Mudou de cidade, verificar'),
        (v_clinic_id, 'Lucas Ribeiro', '11988881016', 'lucas.ribeiro@example.com', '12345678016', '1994-05-09', ARRAY['Inativo'], 0.58, NOW() - INTERVAL '55 days', 'Solicitar retorno'),
        (v_clinic_id, 'Vanessa Gomes', '11988881017', 'vanessa.gomes@example.com', '12345678017', '1987-09-30', ARRAY['Inativo', 'Família'], 0.48, NOW() - INTERVAL '40 days', 'Marido e filhos são pacientes'),

        -- Very Inactive (60+ days)
        (v_clinic_id, 'Ricardo Moura', '11988881018', 'ricardo.moura@example.com', '12345678018', '1972-02-14', ARRAY['Muito Inativo'], 0.75, NOW() - INTERVAL '90 days', 'Cliente de longa data, contactar'),
        (v_clinic_id, 'Cristina Alves', '11988881019', 'cristina.alves@example.com', '12345678019', '1968-06-25', ARRAY['Muito Inativo', 'Idoso'], 0.7, NOW() - INTERVAL '120 days', 'Precisa de limpeza urgente'),
        (v_clinic_id, 'Fernando Dias', '11988881020', 'fernando.dias@example.com', '12345678020', '1983-10-08', ARRAY['Muito Inativo'], 0.72, NOW() - INTERVAL '100 days', 'Extração pendente'),

        -- Regular Patients
        (v_clinic_id, 'Beatriz Mendes', '11988881021', 'beatriz.mendes@example.com', '12345678021', '1996-04-12', ARRAY[], 0.25, NOW() - INTERVAL '22 days', NULL),
        (v_clinic_id, 'Gustavo Nascimento', '11988881022', 'gustavo.nascimento@example.com', '12345678022', '1990-08-19', ARRAY[], 0.28, NOW() - INTERVAL '28 days', NULL),
        (v_clinic_id, 'Isabela Torres', '11988881023', 'isabela.torres@example.com', '12345678023', '1999-12-03', ARRAY[], 0.2, NOW() - INTERVAL '35 days', NULL),
        (v_clinic_id, 'Vinicius Rocha', '11988881024', 'vinicius.rocha@example.com', '12345678024', '1986-01-28', ARRAY[], 0.3, NOW() - INTERVAL '32 days', NULL),
        (v_clinic_id, 'Tatiana Barbosa', '11988881025', 'tatiana.barbosa@example.com', '12345678025', '1993-05-16', ARRAY[], 0.26, NOW() - INTERVAL '38 days', NULL),
        (v_clinic_id, 'Eduardo Lopes', '11988881026', 'eduardo.lopes@example.com', '12345678026', '1981-09-07', ARRAY[], 0.32, NOW() - INTERVAL '42 days', NULL),
        (v_clinic_id, 'Carolina Freitas', '11988881027', 'carolina.freitas@example.com', '12345678027', '1997-03-21', ARRAY[], 0.24, NOW() - INTERVAL '26 days', NULL),
        (v_clinic_id, 'André Silva', '11988881028', 'andre.silva@example.com', '12345678028', '1989-07-04', ARRAY[], 0.29, NOW() - INTERVAL '44 days', NULL),
        (v_clinic_id, 'Michele Araújo', '11988881029', 'michele.araujo@example.com', '12345678029', '1994-11-17', ARRAY[], 0.27, NOW() - INTERVAL '48 days', NULL),
        (v_clinic_id, 'Rafael Campos', '11988881030', 'rafael.campos@example.com', '12345678030', '1991-02-09', ARRAY[], 0.31, NOW() - INTERVAL '52 days', NULL),

        -- More diverse patients
        (v_clinic_id, 'Sandra Vieira', '11988881031', 'sandra.vieira@example.com', '12345678031', '1976-06-30', ARRAY['Convênio'], 0.35, NOW() - INTERVAL '15 days', 'Bradesco Saúde'),
        (v_clinic_id, 'Marcelo Teixeira', '11988881032', 'marcelo.teixeira@example.com', '12345678032', '1984-10-13', ARRAY['Convênio'], 0.33, NOW() - INTERVAL '20 days', 'SulAmérica'),
        (v_clinic_id, 'Renata Farias', '11988881033', 'renata.farias@example.com', '12345678033', '1995-04-26', ARRAY['Estudante'], 0.15, NOW() - INTERVAL '10 days', 'Desconto estudante'),
        (v_clinic_id, 'Felipe Moreira', '11988881034', 'felipe.moreira@example.com', '12345678034', '1992-08-08', ARRAY[], 0.38, NOW() - INTERVAL '25 days', NULL),
        (v_clinic_id, 'Daniela Pinto', '11988881035', 'daniela.pinto@example.com', '12345678035', '1988-12-21', ARRAY['Gestante'], 0.12, NOW() - INTERVAL '12 days', '6 meses de gestação'),
        (v_clinic_id, 'Thiago Bernardes', '11988881036', 'thiago.bernardes@example.com', '12345678036', '1990-05-05', ARRAY[], 0.4, NOW() - INTERVAL '30 days', NULL),
        (v_clinic_id, 'Juliana Ramos', '11988881037', 'juliana.ramos@example.com', '12345678037', '1996-09-18', ARRAY['Novo'], 0.08, NOW() - INTERVAL '6 days', NULL),
        (v_clinic_id, 'Pedro Lucas', '11988881038', 'pedro.lucas@example.com', '12345678038', '1998-01-31', ARRAY['Novo', 'Jovem'], 0.06, NOW() - INTERVAL '4 days', NULL),
        (v_clinic_id, 'Aline Martins', '11988881039', 'aline.martins@example.com', '12345678039', '1993-06-14', ARRAY[], 0.36, NOW() - INTERVAL '22 days', NULL),
        (v_clinic_id, 'Bruno Henrique', '11988881040', 'bruno.henrique@example.com', '12345678040', '1987-11-27', ARRAY[], 0.42, NOW() - INTERVAL '55 days', NULL),

        -- Additional patients
        (v_clinic_id, 'Carla Eduardo', '11988881041', 'carla.eduardo@example.com', '12345678041', '1991-03-10', ARRAY[], 0.28, NOW() - INTERVAL '18 days', NULL),
        (v_clinic_id, 'Lucas Gabriel', '11988881042', 'lucas.gabriel@example.com', '12345678042', '1997-07-23', ARRAY['Novo'], 0.07, NOW() - INTERVAL '8 days', NULL),
        (v_clinic_id, 'Mariana Luz', '11988881043', 'mariana.luz@example.com', '12345678043', '1994-10-06', ARRAY['VIP'], 0.09, NOW() - INTERVAL '14 days', NULL),
        (v_clinic_id, 'Rafaela Costa', '11988881044', 'rafaela.costa@example.com', '12345678044', '1990-02-19', ARRAY[], 0.34, NOW() - INTERVAL '40 days', NULL),
        (v_clinic_id, 'Diego Fernandes', '11988881045', 'diego.fernandes@example.com', '12345678045', '1985-06-02', ARRAY[], 0.45, NOW() - INTERVAL '65 days', NULL),
        (v_clinic_id, 'Letícia Prado', '11988881046', 'leticia.prado@example.com', '12345678046', '1996-09-15', ARRAY[], 0.22, NOW() - INTERVAL '28 days', NULL),
        (v_clinic_id, 'Mateus Alves', '11988881047', 'mateus.alves@example.com', '12345678047', '1989-01-28', ARRAY[], 0.39, NOW() - INTERVAL '35 days', NULL),
        (v_clinic_id, 'Natália Cruz', '11988881048', 'natalia.cruz@example.com', '12345678048', '1995-05-11', ARRAY['Novo'], 0.05, NOW() - INTERVAL '3 days', NULL),
        (v_clinic_id, 'Gabriel Santos', '11988881049', 'gabriel.santos@example.com', '12345678049', '1993-08-24', ARRAY[], 0.31, NOW() - INTERVAL '32 days', NULL),
        (v_clinic_id, 'Lorena Melo', '11988881050', 'lorena.melo@example.com', '12345678050', '1998-12-07', ARRAY['Jovem'], 0.11, NOW() - INTERVAL '16 days', NULL),

        -- Even more patients
        (v_clinic_id, 'Fábio Júnior', '11988881051', 'fabio.junior@example.com', '12345678051', '1983-04-20', ARRAY[], 0.44, NOW() - INTERVAL '70 days', NULL),
        (v_clinic_id, 'Patrícia Lima', '11988881052', 'patricia.lima@example.com', '12345678052', '1986-07-03', ARRAY['Família'], 0.16, NOW() - INTERVAL '12 days', 'Filhos também são pacientes'),
        (v_clinic_id, 'Thiago Reis', '11988881053', 'thiago.reis@example.com', '12345678053', '1991-10-16', ARRAY[], 0.37, NOW() - INTERVAL '45 days', NULL),
        (v_clinic_id, 'Vanessa Souza', '11988881054', 'vanessa.souza@example.com', '12345678054', '1994-02-29', ARRAY[], 0.29, NOW() - INTERVAL '24 days', NULL),
        (v_clinic_id, 'André Luiz', '11988881055', 'andre.luiz@example.com', '12345678055', '1988-05-12', ARRAY[], 0.41, NOW() - INTERVAL '58 days', NULL),
        (v_clinic_id, 'Caroline Dias', '11988881056', 'caroline.dias@example.com', '12345678056', '1996-08-25', ARRAY['Novo'], 0.06, NOW() - INTERVAL '9 days', NULL),
        (v_clinic_id, 'Ricardo Filho', '11988881057', 'ricardo.filho@example.com', '12345678057', '1990-11-08', ARRAY[], 0.33, NOW() - INTERVAL '36 days', NULL),
        (v_clinic_id, 'Juliana Freitas', '11988881058', 'juliana.freitas@example.com', '12345678058', '1997-03-21', ARRAY[], 0.19, NOW() - INTERVAL '20 days', NULL),
        (v_clinic_id, 'Bruno Macedo', '11988881059', 'bruno.macedo@example.com', '12345678059', '1984-06-04', ARRAY[], 0.48, NOW() - INTERVAL '85 days', NULL),
        (v_clinic_id, 'Fernanda Torres', '11988881060', 'fernanda.torres@example.com', '12345678060', '1993-09-17', ARRAY['VIP'], 0.1, NOW() - INTERVAL '11 days', NULL)
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- APPOINTMENTS (Various dates and statuses)
    -- ============================================
    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW()) + INTERVAL '9 hours',
        40,
        'confirmed',
        'Limpeza profissional'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Ana Paula Ferreira'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW()) + INTERVAL '10 hours',
        60,
        'confirmed',
        'Clareamento dental'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Carlos Eduardo Silva'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW()) + INTERVAL '11 hours',
        90,
        'scheduled',
        'Tratamento de canal'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Roberto Almeida'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW()) + INTERVAL '14 hours',
        40,
        'scheduled',
        'Retorno aparelho'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Fernanda Lima'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW()) + INTERVAL '15 hours',
        30,
        'confirmed',
        'Restauração estética'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Mariana Costa'
    ON CONFLICT DO NOTHING;

    -- Tomorrow appointments
    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '1 day') + INTERVAL '9 hours',
        40,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Paulo Henrique'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() + INTERVAL '1 day') + INTERVAL '10 hours',
        60,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Juliana Santos'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '1 day') + INTERVAL '11 hours',
        45,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Camila Rodrigues'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() + INTERVAL '1 day') + INTERVAL '14 hours',
        90,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Marcos Oliveira'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '1 day') + INTERVAL '15 hours',
        40,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Thiago Martins'
    ON CONFLICT DO NOTHING;

    -- Past appointments (completed)
    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() - INTERVAL '1 day') + INTERVAL '10 hours',
        40,
        'completed'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Beatriz Mendes'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() - INTERVAL '1 day') + INTERVAL '11 hours',
        60,
        'completed'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Gustavo Nascimento'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() - INTERVAL '2 days') + INTERVAL '9 hours',
        40,
        'completed'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Isabela Torres'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() - INTERVAL '3 days') + INTERVAL '14 hours',
        90,
        'completed'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Vinicius Rocha'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() - INTERVAL '4 days') + INTERVAL '10 hours',
        30,
        'completed'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Tatiana Barbosa'
    ON CONFLICT DO NOTHING;

    -- Cancelled appointments
    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() - INTERVAL '2 days') + INTERVAL '15 hours',
        40,
        'cancelled',
        'Paciente cancelou por motivos pessoais'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Eduardo Lopes'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status, notes)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() - INTERVAL '5 days') + INTERVAL '11 hours',
        60,
        'no_show',
        'Não compareceu, reagendar'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Felipe Moreira'
    ON CONFLICT DO NOTHING;

    -- Next week appointments
    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '7 days') + INTERVAL '10 hours',
        120,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Larissa Pereira'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() + INTERVAL '7 days') + INTERVAL '14 hours',
        60,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Bruno Carvalho'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '8 days') + INTERVAL '9 hours',
        40,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Daniela Pinto'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist2_id,
        DATE(NOW() + INTERVAL '8 days') + INTERVAL '11 hours',
        45,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Thiago Bernardes'
    ON CONFLICT DO NOTHING;

    INSERT INTO appointments (clinic_id, patient_id, dentist_id, scheduled_at, duration_minutes, status)
    SELECT
        v_clinic_id,
        p.id,
        v_dentist1_id,
        DATE(NOW() + INTERVAL '10 days') + INTERVAL '15 hours',
        90,
        'scheduled'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Juliana Ramos'
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- CONVERSATIONS (20+ conversations)
    -- ============================================
    -- WhatsApp conversations
    INSERT INTO conversations (clinic_id, patient_id, channel, external_id, status, last_message_at)
    SELECT
        v_clinic_id,
        p.id,
        'whatsapp',
        '5511988881001',
        'active',
        NOW() - INTERVAL '5 minutes'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Ana Paula Ferreira'
    ON CONFLICT DO NOTHING;

    INSERT INTO conversations (clinic_id, patient_id, channel, external_id, status, last_message_at)
    SELECT
        v_clinic_id,
        p.id,
        'whatsapp',
        '5511988881002',
        'active',
        NOW() - INTERVAL '1 hour'
    FROM patients p WHERE p.clinic_id = v_clinic_id AND p.name = 'Carlos Eduardo Silva'
    ON CONFLICT DO NOTHING;

    INSERT INTO conversations (clinic_id, channel, external_id, status, last_message_at)
    VALUES
        (v_clinic_id, 'whatsapp', '5511977777001', 'waiting', NOW() - INTERVAL '2 hours'),
        (v_clinic_id, 'whatsapp', '5511977777002', 'active', NOW() - INTERVAL '30 minutes'),
        (v_clinic_id, 'whatsapp', '5511977777003', 'escalated', NOW() - INTERVAL '45 minutes'),
        (v_clinic_id, 'whatsapp', '5511977777004', 'active', NOW() - INTERVAL '10 minutes'),
        (v_clinic_id, 'whatsapp', '5511977777005', 'closed', NOW() - INTERVAL '1 day')
    ON CONFLICT DO NOTHING;

    -- Instagram conversations
    INSERT INTO conversations (clinic_id, channel, external_id, status, last_message_at)
    VALUES
        (v_clinic_id, 'instagram', '@maria.silva_123', 'active', NOW() - INTERVAL '15 minutes'),
        (v_clinic_id, 'instagram', '@joao.dentista', 'waiting', NOW() - INTERVAL '3 hours'),
        (v_clinic_id, 'instagram', '@clinicadental.sp', 'active', NOW() - INTERVAL '1 hour'),
        (v_clinic_id, 'instagram', '@pedro_ortodontia', 'escalated', NOW() - INTERVAL '2 hours'),
        (v_clinic_id, 'instagram', '@ana_clareamento', 'active', NOW() - INTERVAL '25 minutes')
    ON CONFLICT DO NOTHING;

    -- Web conversations
    INSERT INTO conversations (clinic_id, channel, external_id, status, last_message_at)
    VALUES
        (v_clinic_id, 'web', 'web_user_001', 'active', NOW() - INTERVAL '20 minutes'),
        (v_clinic_id, 'web', 'web_user_002', 'closed', NOW() - INTERVAL '2 days'),
        (v_clinic_id, 'web', 'web_user_003', 'waiting', NOW() - INTERVAL '4 hours'),
        (v_clinic_id, 'web', 'web_user_004', 'active', NOW() - INTERVAL '5 minutes')
    ON CONFLICT DO NOTHING;

    -- More WhatsApp conversations with patients
    INSERT INTO conversations (clinic_id, patient_id, channel, external_id, status, last_message_at)
    SELECT
        v_clinic_id,
        p.id,
        'whatsapp',
        REPLACE(p.phone, '-', ''),
        'active',
        NOW() - INTERVAL '50 minutes'
    FROM patients p
    WHERE p.clinic_id = v_clinic_id
    AND p.name IN ('Fernanda Lima', 'Juliana Santos', 'Camila Rodrigues', 'Mariana Costa')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- MESSAGES (For conversations)
    -- ============================================
    -- Messages for first conversation
    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'inbound',
        'Olá, gostaria de agendar uma limpeza dental para esta semana',
        'agendamento',
        false,
        NOW() - INTERVAL '1 hour'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511988881001'
    ON CONFLICT DO NOTHING;

    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'outbound',
        'Olá! Tudo bem? Temos horários disponíveis amanhã às 10h e às 15h. Qual prefere?',
        'agendamento',
        true,
        NOW() - INTERVAL '55 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511988881001'
    ON CONFLICT DO NOTHING;

    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'inbound',
        '15h seria perfeito!',
        'confirmacao',
        false,
        NOW() - INTERVAL '50 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511988881001'
    ON CONFLICT DO NOTHING;

    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'outbound',
        'Perfeito! Agendei sua limpeza dental para amanhã às 15h com a Dra. Carolina. Confirmado! 😊',
        'confirmacao',
        true,
        NOW() - INTERVAL '45 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511988881001'
    ON CONFLICT DO NOTHING;

    -- Messages for escalated conversation
    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'inbound',
        'Estou com muita dor no dente, acho que é um canal que fez mal',
        'emergencia',
        false,
        NOW() - INTERVAL '2 hours'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511977777003'
    ON CONFLICT DO NOTHING;

    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'outbound',
        'Entendo sua situação. Vou transferir você para nossa equipe técnica que pode te ajudar melhor. Aguarde um momento.',
        'emergencia',
        true,
        NOW() - INTERVAL '1 hour 55 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511977777003'
    ON CONFLICT DO NOTHING;

    -- More message samples
    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'inbound',
        'Qual o valor do clareamento?',
        'duvida',
        false,
        NOW() - INTERVAL '30 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511977777002'
    ON CONFLICT DO NOTHING;

    INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
    SELECT
        c.id,
        'outbound',
        'Temos duas opções de clareamento: profissional por R$ 899 (resultado imediato) e caseiro por R$ 499 (moldeira personalizada). Gostaria de agendar uma avaliação?',
        'duvida',
        true,
        NOW() - INTERVAL '25 minutes'
    FROM conversations c
    WHERE c.clinic_id = v_clinic_id AND c.external_id = '5511977777002'
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- LEADS (20+ leads)
    -- ============================================
    INSERT INTO leads (clinic_id, name, phone, email, source, status, temperature, score, interest, notes)
    VALUES
        -- Hot leads
        (v_clinic_id, 'Marina Ribeiro', '11977770011', 'marina.ribeiro@example.com', 'instagram', 'qualified', 'hot', 85, 'Implante Dentário', 'Quer implante urgente, tem orçamento aprovado'),
        (v_clinic_id, 'Fábio Nascimento', '11977770012', 'fabio.nascimento@example.com', 'whatsapp', 'proposal', 'hot', 78, 'Clareamento', 'Proposta enviada, aguardando resposta'),
        (v_clinic_id, 'Carla Duarte', '11977770013', 'carla.duarte@example.com', 'referral', 'negotiation', 'hot', 92, 'Aparelho Ortodôntico', 'Indicação da paciente Ana Paula, fechar esta semana'),

        -- Warm leads
        (v_clinic_id, 'Ricardo Veiga', '11977770014', 'ricardo.veiga@example.com', 'web', 'contacted', 'warm', 55, 'Implante Dentário', 'Primeiro contato feito, interessado'),
        (v_clinic_id, 'Juliana Mars', '11977770015', 'juliana.mars@example.com', 'instagram', 'new', 'warm', 48, 'Limpeza Profissional', 'Veio pelo Instagram, ainda não contatado'),
        (v_clinic_id, 'Pedro Augusto', '11977770016', 'pedro.augusto@example.com', 'whatsapp', 'qualified', 'warm', 62, 'Tratamento de Canal', 'Tem dor, precisa urgente mas está comparando preços'),
        (v_clinic_id, 'Amanda Vieira', '11977770017', 'amanda.vieira@example.com', 'referral', 'contacted', 'warm', 58, 'Clareamento', 'Indicação do Carlos Eduardo'),
        (v_clinic_id, 'Lucas Mendonça', '11977770018', 'lucas.mendonca@example.com', 'web', 'new', 'warm', 45, 'Extração de Siso', 'Formulário web preenchido ontem'),
        (v_clinic_id, 'Beatriz Lima', '11977770019', 'beatriz.lima@example.com', 'instagram', 'contacted', 'warm', 52, 'Aparelho Ortodôntico', 'Segunda tentativa de contato'),
        (v_clinic_id, 'Fernando Cruz', '11977770020', 'fernando.cruz@example.com', 'whatsapp', 'qualified', 'warm', 65, 'Coroa de Porcelana', 'Tem orçamento, está avaliando'),

        -- Cold leads
        (v_clinic_id, 'Patrícia Novaes', '11977770021', 'patricia.novaes@example.com', 'web', 'new', 'cold', 25, 'Limpeza Profissional', 'Apenas consulta de preço'),
        (v_clinic_id, 'Gustavo Almeida', '11977770022', 'gustavo.almeida@example.com', 'instagram', 'new', 'cold', 20, 'Clareamento', 'Curtiu post mas sem urgência'),
        (v_clinic_id, 'Renata Figueiredo', '11977770023', 'renata.figueiredo@example.com', 'whatsapp', 'contacted', 'cold', 30, 'Restauração', 'Não respondeu às mensagens'),
        (v_clinic_id, 'Marcelo Diniz', '11977770024', 'marcelo.diniz@example.com', 'web', 'new', 'cold', 15, 'Implante Dentário', 'Orçamento muito alto para ele'),

        -- Converted leads
        (v_clinic_id, 'Sandra Borges', '11977770025', 'sandra.borges@example.com', 'referral', 'converted', 'hot', 95, 'Implante Dentário', 'Convertido! Agendado para próxima semana'),
        (v_clinic_id, 'João Pedro', '11977770026', 'joao.pedro@example.com', 'instagram', 'converted', 'hot', 88, 'Clareamento', 'Convertido! Fechou clareamento profissional'),

        -- Lost leads
        (v_clinic_id, 'Camila Rosa', '11977770027', 'camila.rosa@example.com', 'whatsapp', 'lost', 'warm', 40, 'Aparelho Ortodôntico', 'Escolheu outra clínica mais barata'),
        (v_clinic_id, 'André Moreira', '11977770028', 'andre.moreira@example.com', 'web', 'lost', 'cold', 22, 'Limpeza Profissional', 'Sem resposta após 3 tentativas'),

        -- New leads
        (v_clinic_id, 'Lívia Martins', '11977770029', 'livia.martins@example.com', 'instagram', 'new', 'warm', 42, 'Clareamento', 'Nova lead do Instagram hoje'),
        (v_clinic_id, 'Rafael Souza', '11977770030', 'rafael.souza@example.com', 'whatsapp', 'new', 'hot', 75, 'Extração de Siso', 'Com muita dor, precisa urgente')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- CAMPAIGNS (5 campaigns)
    -- ============================================
    INSERT INTO campaigns (clinic_id, name, description, campaign_type, channel, status, message_template, total_recipients, sent_count, response_count, conversion_count)
    VALUES
        (v_clinic_id, 'Reativação de Pacientes Inativos', 'Campanha para trazer de volta pacientes que não visitam há mais de 60 dias', 'reactivation', 'whatsapp', 'running', 'Olá {{patient_name}}! Sentimos sua falta! 💙 Que tal agendar uma limpeza com desconto especial de 20%? Responda SIM para agendar.', 45, 32, 8, 3),
        (v_clinic_id, 'Promoção Clareamento', 'Promoção de inverno - 30% off no clareamento profissional', 'promotional', 'whatsapp', 'running', '✨ PROMOÇÃO ESPECIAL ✨ Clareamento profissional com 30% de desconto! De R$ 899 por R$ 629. Válido até 30/04. Responda CLAREAMENTO para agendar sua avaliação gratuita!', 60, 45, 12, 5),
        (v_clinic_id, 'Lembrete 6 Meses', 'Lembrete para pacientes que estão há 6 meses sem consulta', 'retention', 'whatsapp', 'scheduled', 'Olá {{patient_name}}! Já passaram 6 meses desde sua última consulta. Que tal agendar uma revisão? 😊 Responda HORÁRIOS para ver disponibilidade.', 25, 0, 0, 0),
        (v_clinic_id, 'Follow-up Pós-Consulta', 'Agradecimento e pesquisa de satisfação após consulta', 'follow_up', 'whatsapp', 'completed', 'Olá {{patient_name}}! Obrigado pela visita hoje! 😊 Sua opinião é muito importante para nós. De 0 a 10, como foi sua experiência?', 80, 80, 45, 0),
        (v_clinic_id, 'Indique um Amigo', 'Programa de indicação - desconto para quem indicar', 'promotional', 'whatsapp', 'running', '🎁 INDIQUE UM AMIGO 🎁 Ganhe R$ 50 de desconto na próxima consulta para cada amigo que agendar! Seu amigo também ganha 10% off. Responda INDICAR para participar!', 100, 65, 18, 7)
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- CAMPAIGN RECIPIENTS (sample)
    -- ============================================
    INSERT INTO campaign_recipients (campaign_id, patient_id, status, sent_at, delivered_at)
    SELECT
        c.id,
        p.id,
        'delivered',
        NOW() - INTERVAL '2 days',
        NOW() - INTERVAL '2 days'
    FROM campaigns c, patients p
    WHERE c.clinic_id = v_clinic_id
    AND c.name = 'Reativação de Pacientes Inativos'
    AND p.clinic_id = v_clinic_id
    AND p.tags && ARRAY['Inativo', 'Muito Inativo']
    LIMIT 15
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Demo data seeded successfully for clinic: %', v_clinic_id;
END $$;