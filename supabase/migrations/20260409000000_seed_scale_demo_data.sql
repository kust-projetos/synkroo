-- ============================================
-- SYNKROO - Scale Demo Data for clinica-demo
-- Adds ~90 patients, ~80 appointments, ~30 conversations,
-- ~200 messages, ~30 leads, ~100 lead activities,
-- 7 campaigns, waitlist, feedback, schedule blocks, templates
-- ============================================

DO $$
DECLARE
    v_clinic_id UUID;
    v_dentist_ids UUID[];
    v_procedure_ids UUID[];
    v_patient_ids UUID[];
    v_conv_ids UUID[];
    v_lead_ids UUID[];
    v_campaign_ids UUID[];
    v_user_id UUID;
    i INTEGER;
BEGIN
    -- Get clinic ID by slug
    SELECT id INTO v_clinic_id FROM clinics WHERE slug = 'clinica-demo' LIMIT 1;
    IF v_clinic_id IS NULL THEN
        RAISE NOTICE 'Demo clinic not found, skipping seed';
        RETURN;
    END IF;

    -- Get admin user for created_by fields
    SELECT id INTO v_user_id FROM users WHERE clinic_id = v_clinic_id AND role IN ('admin', 'owner') LIMIT 1;

    -- ============================================
    -- 1. ADDITIONAL DENTISTS (2 new = 5 total)
    -- ============================================
    INSERT INTO dentists (id, clinic_id, name, phone, email, cro, specialty, is_active)
    VALUES
        (gen_random_uuid(), v_clinic_id, 'Dr. Felipe Andrade', '(11) 99999-1004', 'felipe@clinicademo.com', 'CRO-SP 22222', 'Endodontista', true),
        (gen_random_uuid(), v_clinic_id, 'Dra. Bianca Rocha', '(11) 99999-1005', 'bianca@clinicademo.com', 'CRO-SP 33333', 'Protesista', true)
    ON CONFLICT DO NOTHING;

    -- Collect all dentist IDs
    SELECT array_agg(id) INTO v_dentist_ids FROM dentists WHERE clinic_id = v_clinic_id AND is_active = true;

    -- ============================================
    -- 2. ADDITIONAL PROCEDURES (5 new = 15 total)
    -- ============================================
    INSERT INTO procedures (clinic_id, name, description, duration_minutes, price, category, is_active)
    VALUES
        (v_clinic_id, 'Faceta de Porcelana', 'Faceta laminada em porcelana', 60, 2500.00, 'Estética', true),
        (v_clinic_id, 'Profilaxia com AirFlow', 'Limpeza com jato de bicarbonato', 30, 249.00, 'Prevenção', true),
        (v_clinic_id, 'Pulpoterapia', 'Tratamento de polpa dentária em crianças', 45, 450.00, 'Endodontia', true),
        (v_clinic_id, 'Prótese Total', 'Prótese dentária total removível', 90, 3200.00, 'Prótese', true),
        (v_clinic_id, 'Lente de Contato Dental', 'Lentes de contato ultrafinas', 60, 3000.00, 'Estética', true)
    ON CONFLICT DO NOTHING;

    SELECT array_agg(id) INTO v_procedure_ids FROM procedures WHERE clinic_id = v_clinic_id AND is_active = true;

    -- ============================================
    -- 3. ADDITIONAL PATIENTS (90 new = ~150 total)
    -- ============================================
    INSERT INTO patients (clinic_id, name, phone, email, cpf, birth_date, tags, risk_score, last_visit_at, notes)
    VALUES
        -- Active patients (recent visits)
        (v_clinic_id, 'Adriana Figueiredo', '11988882001', 'adriana.figueiredo@example.com', '23456789001', '1986-04-12', ARRAY['VIP'], 0.08, NOW() - INTERVAL '5 days', 'Almente fiel'),
        (v_clinic_id, 'Bruno Augusto', '11988882002', 'bruno.augusto@example.com', '23456789002', '1991-08-23', ARRAY['Frequente'], 0.15, NOW() - INTERVAL '8 days', NULL),
        (v_clinic_id, 'Cássia Mello', '11988882003', 'cassia.mello@example.com', '23456789003', '1994-01-07', ARRAY['Frequente'], 0.12, NOW() - INTERVAL '6 days', 'Ormiodontia em tratamento'),
        (v_clinic_id, 'Diego Tavares', '11988882004', 'diego.tavares@example.com', '23456789004', '1983-05-19', ARRAY[], 0.22, NOW() - INTERVAL '12 days', NULL),
        (v_clinic_id, 'Elaine Cardoso', '11988882005', 'elaine.cardoso@example.com', '23456789005', '1979-09-30', ARRAY['VIP', 'Convênio'], 0.10, NOW() - INTERVAL '4 days', 'Amil'),
        (v_clinic_id, 'Flávio Peixoto', '11988882006', 'flavio.peixoto@example.com', '23456789006', '1988-12-14', ARRAY[], 0.25, NOW() - INTERVAL '15 days', NULL),
        (v_clinic_id, 'Gabriela Neves', '11988882007', 'gabriela.neves@example.com', '23456789007', '1996-03-28', ARRAY['Novo'], 0.05, NOW() - INTERVAL '2 days', 'Primeira consulta ótima'),
        (v_clinic_id, 'Hugo Renan', '11988882008', 'hugo.renan@example.com', '23456789008', '1990-07-05', ARRAY[], 0.28, NOW() - INTERVAL '18 days', NULL),
        (v_clinic_id, 'Ingrid Sampaio', '11988882009', 'ingrid.sampaio@example.com', '23456789009', '1993-11-18', ARRAY['Frequente'], 0.14, NOW() - INTERVAL '9 days', NULL),
        (v_clinic_id, 'Jorge Rangel', '11988882010', 'jorge.rangel@example.com', '23456789010', '1981-02-22', ARRAY[], 0.30, NOW() - INTERVAL '22 days', NULL),

        -- More active
        (v_clinic_id, 'Karen Braga', '11988882011', 'karen.braga@example.com', '23456789011', '1997-06-09', ARRAY['Jovem'], 0.09, NOW() - INTERVAL '7 days', 'Estudante universitária'),
        (v_clinic_id, 'Leonardo Pinto', '11988882012', 'leonardo.pinto@example.com', '23456789012', '1985-10-01', ARRAY[], 0.32, NOW() - INTERVAL '25 days', NULL),
        (v_clinic_id, 'Monica Sales', '11988882013', 'monica.sales@example.com', '23456789013', '1992-04-15', ARRAY['Frequente'], 0.11, NOW() - INTERVAL '11 days', NULL),
        (v_clinic_id, 'Nicolas Duarte', '11988882014', 'nicolas.duarte@example.com', '23456789014', '1989-08-27', ARRAY[], 0.26, NOW() - INTERVAL '19 days', NULL),
        (v_clinic_id, 'Olga Monteiro', '11988882015', 'olga.monteiro@example.com', '23456789015', '1975-12-03', ARRAY['Convênio'], 0.18, NOW() - INTERVAL '14 days', 'SulAmérica'),
        (v_clinic_id, 'Priscila Gusmão', '11988882016', 'priscila.gusmao@example.com', '23456789016', '1998-01-20', ARRAY['Novo'], 0.06, NOW() - INTERVAL '3 days', NULL),
        (v_clinic_id, 'Quentin Torres', '11988882017', 'quentin.torres@example.com', '23456789017', '1987-05-12', ARRAY[], 0.35, NOW() - INTERVAL '28 days', NULL),
        (v_clinic_id, 'Regina Lemos', '11988882018', 'regina.lemos@example.com', '23456789018', '1980-09-24', ARRAY['VIP'], 0.07, NOW() - INTERVAL '6 days', 'Indica muitas pacientes'),
        (v_clinic_id, 'Samuel Cavalcanti', '11988882019', 'samuel.cavalcanti@example.com', '23456789019', '1994-02-08', ARRAY[], 0.24, NOW() - INTERVAL '16 days', NULL),
        (v_clinic_id, 'Tatiane Viana', '11988882020', 'tatiane.viana@example.com', '23456789020', '1991-06-30', ARRAY['Frequente'], 0.13, NOW() - INTERVAL '10 days', NULL),

        -- Moderate inactive (30-60 days)
        (v_clinic_id, 'Ulisses Barros', '11988882021', 'ulisses.barros@example.com', '23456789021', '1984-10-14', ARRAY['Inativo'], 0.50, NOW() - INTERVAL '35 days', 'Ligar para reagendar'),
        (v_clinic_id, 'Valéria Soares', '11988882022', 'valeria.soares@example.com', '23456789022', '1978-03-28', ARRAY['Inativo'], 0.55, NOW() - INTERVAL '42 days', 'Mudou de telefone'),
        (v_clinic_id, 'Wagner Macedo', '11988882023', 'wagner.macedo@example.com', '23456789023', '1990-07-10', ARRAY['Inativo'], 0.48, NOW() - INTERVAL '38 days', NULL),
        (v_clinic_id, 'Xuxa Meneghel', '11988882024', 'xuxa.meneghel@example.com', '23456789024', '1962-11-22', ARRAY['Inativo', 'VIP'], 0.45, NOW() - INTERVAL '50 days', 'Verificar retorno'),
        (v_clinic_id, 'Yuri Machado', '11988882025', 'yuri.machado@example.com', '23456789025', '1996-04-05', ARRAY['Inativo'], 0.52, NOW() - INTERVAL '45 days', NULL),
        (v_clinic_id, 'Zuleica Ferri', '11988882026', 'zuleica.ferri@example.com', '23456789026', '1982-08-18', ARRAY['Inativo'], 0.53, NOW() - INTERVAL '55 days', 'Faltou 2x seguidas'),
        (v_clinic_id, 'Alberto Lage', '11988882027', 'alberto.lage@example.com', '23456789027', '1977-01-30', ARRAY['Inativo'], 0.56, NOW() - INTERVAL '40 days', NULL),
        (v_clinic_id, 'Bianca Teles', '11988882028', 'bianca.teles@example.com', '23456789028', '1995-06-12', ARRAY['Inativo'], 0.49, NOW() - INTERVAL '32 days', NULL),
        (v_clinic_id, 'Cesar Mourão', '11988882029', 'cesar.mourao@example.com', '23456789029', '1988-10-25', ARRAY['Inativo'], 0.51, NOW() - INTERVAL '48 days', 'Solicitar retorno urgente'),
        (v_clinic_id, 'Debora Accioly', '11988882030', 'debora.accioly@example.com', '23456789030', '1993-03-07', ARRAY['Inativo'], 0.47, NOW() - INTERVAL '36 days', NULL),

        -- Very inactive (60-180 days)
        (v_clinic_id, 'Eriberto Nogueira', '11988882031', 'eriberto.nogueira@example.com', '23456789031', '1974-07-19', ARRAY['Muito Inativo'], 0.70, NOW() - INTERVAL '90 days', 'Cliente antigo, tentar reativar'),
        (v_clinic_id, 'Flora Diniz', '11988882032', 'flora.diniz@example.com', '23456789032', '1969-11-01', ARRAY['Muito Inativo', 'Idoso'], 0.75, NOW() - INTERVAL '120 days', 'Precisa de prótese'),
        (v_clinic_id, 'Geraldo Vilaça', '11988882033', 'geraldo.vilaca@example.com', '23456789033', '1981-04-14', ARRAY['Muito Inativo'], 0.68, NOW() - INTERVAL '100 days', NULL),
        (v_clinic_id, 'Helena Gouveia', '11988882034', 'helena.gouveia@example.com', '23456789034', '1990-08-27', ARRAY['Muito Inativo'], 0.72, NOW() - INTERVAL '110 days', 'Mudou de cidade'),
        (v_clinic_id, 'Ivanilde Pontes', '11988882035', 'ivanilde.pontes@example.com', '23456789035', '1965-12-09', ARRAY['Muito Inativo', 'Idoso'], 0.80, NOW() - INTERVAL '180 days', 'Não responde mensagens'),
        (v_clinic_id, 'José Américo', '11988882036', 'jose.americo@example.com', '23456789036', '1986-05-22', ARRAY['Muito Inativo'], 0.65, NOW() - INTERVAL '85 days', 'Extração pendente'),
        (v_clinic_id, 'Kátia Rendeiro', '11988882037', 'katia.rendeiro@example.com', '23456789037', '1973-09-03', ARRAY['Muito Inativo'], 0.73, NOW() - INTERVAL '150 days', 'Retorno após tratamento longo'),
        (v_clinic_id, 'Luiz Fernando', '11988882038', 'luiz.fernando@example.com', '23456789038', '1992-01-16', ARRAY['Muito Inativo'], 0.67, NOW() - INTERVAL '95 days', NULL),
        (v_clinic_id, 'Marlene Bittencourt', '11988882039', 'marlene.bittencourt@example.com', '23456789039', '1958-06-29', ARRAY['Muito Inativo', 'Idoso'], 0.82, NOW() - INTERVAL '200 days', 'Familia ainda é paciente'),
        (v_clinic_id, 'Nelson Prado', '11988882040', 'nelson.prado@example.com', '23456789040', '1979-10-11', ARRAY['Muito Inativo'], 0.69, NOW() - INTERVAL '130 days', NULL),

        -- New patients (last 7 days)
        (v_clinic_id, 'Osvaldo Menezes', '11988882041', 'osvaldo.menezes@example.com', '23456789041', '1998-03-24', ARRAY['Novo'], 0.04, NOW() - INTERVAL '1 day', 'Veio pelo Google'),
        (v_clinic_id, 'Paula Antunes', '11988882042', 'paula.antunes@example.com', '23456789042', '1995-07-08', ARRAY['Novo', 'Indicação'], 0.05, NOW() - INTERVAL '2 days', 'Indicado pela Regina Lemos'),
        (v_clinic_id, 'Queila Furtado', '11988882043', 'queila.furtado@example.com', '23456789043', '1989-11-20', ARRAY['Novo'], 0.03, NOW() - INTERVAL '1 day', 'Primeira consulta'),
        (v_clinic_id, 'Renato Filipe', '11988882044', 'renato.filipe@example.com', '23456789044', '1997-04-02', ARRAY['Novo'], 0.04, NOW() - INTERVAL '3 days', NULL),
        (v_clinic_id, 'Solange Martins', '11988882045', 'solange.martins@example.com', '23456789045', '1984-08-15', ARRAY['Novo', 'Convênio'], 0.06, NOW() - INTERVAL '4 days', 'Bradesco Saúde'),
        (v_clinic_id, 'Thales Medeiros', '11988882046', 'thales.medeiros@example.com', '23456789046', '1991-12-28', ARRAY['Novo'], 0.03, NOW() - INTERVAL '2 days', NULL),
        (v_clinic_id, 'Ursula Marinho', '11988882047', 'ursula.marinho@example.com', '23456789047', '1996-05-10', ARRAY['Novo'], 0.05, NOW() - INTERVAL '1 day', 'Instagram'),

        -- Regular/neutral patients
        (v_clinic_id, 'Vera Tomaz', '11988882048', 'vera.tomaz@example.com', '23456789048', '1980-09-22', ARRAY[], 0.30, NOW() - INTERVAL '20 days', NULL),
        (v_clinic_id, 'William Brandão', '11988882049', 'william.brandao@example.com', '23456789049', '1987-01-05', ARRAY[], 0.33, NOW() - INTERVAL '26 days', NULL),
        (v_clinic_id, 'Ximena Luz', '11988882050', 'ximena.luz@example.com', '23456789050', '1994-06-18', ARRAY[], 0.27, NOW() - INTERVAL '24 days', NULL),
        (v_clinic_id, 'Yasmin Rocha', '11988882051', 'yasmin.rocha@example.com', '23456789051', '1999-10-01', ARRAY['Jovem'], 0.08, NOW() - INTERVAL '13 days', 'Universitária'),
        (v_clinic_id, 'Zeca Baleiro', '11988882052', 'zeca.baleiro@example.com', '23456789052', '1982-03-14', ARRAY[], 0.36, NOW() - INTERVAL '30 days', NULL),
        (v_clinic_id, 'Aline Souza', '11988882053', 'aline.souza@example.com', '23456789053', '1993-07-26', ARRAY[], 0.23, NOW() - INTERVAL '17 days', NULL),
        (v_clinic_id, 'Breno Aguiar', '11988882054', 'breno.aguiar@example.com', '23456789054', '1988-11-08', ARRAY[], 0.29, NOW() - INTERVAL '21 days', NULL),
        (v_clinic_id, 'Clara Requião', '11988882055', 'clara.requiao@example.com', '23456789055', '1996-04-20', ARRAY[], 0.20, NOW() - INTERVAL '14 days', NULL),
        (v_clinic_id, 'Davi Marcondes', '11988882056', 'davi.marcondes@example.com', '23456789056', '1990-08-02', ARRAY[], 0.34, NOW() - INTERVAL '27 days', NULL),
        (v_clinic_id, 'Eva Bentes', '11988882057', 'eva.bentes@example.com', '23456789057', '1985-12-15', ARRAY[], 0.31, NOW() - INTERVAL '23 days', NULL),
        (v_clinic_id, 'Fábio Correia', '11988882058', 'fabio.correia@example.com', '23456789058', '1992-05-28', ARRAY[], 0.37, NOW() - INTERVAL '29 days', NULL),
        (v_clinic_id, 'Giovanna Leal', '11988882059', 'giovanna.leal@example.com', '23456789059', '1998-09-10', ARRAY['Jovem', 'Novo'], 0.06, NOW() - INTERVAL '5 days', NULL),
        (v_clinic_id, 'Hector Basílio', '11988882060', 'hector.basilio@example.com', '23456789060', '1983-01-23', ARRAY[], 0.38, NOW() - INTERVAL '31 days', NULL),

        -- Family group
        (v_clinic_id, 'Rosa Almeida (mãe)', '11988882061', 'rosa.almeida@example.com', '23456789061', '1972-06-05', ARRAY['Família', 'VIP'], 0.12, NOW() - INTERVAL '9 days', 'Mãe - família completa é paciente'),
        (v_clinic_id, 'Tiago Almeida (filho)', '11988882062', 'tiago.almeida@example.com', '23456789062', '2000-10-18', ARRAY['Família', 'Jovem'], 0.08, NOW() - INTERVAL '9 days', 'Filho da Rosa'),
        (v_clinic_id, 'Luana Almeida (filha)', '11988882063', 'luana.almeida@example.com', '23456789063', '2003-02-28', ARRAY['Família'], 0.06, NOW() - INTERVAL '15 days', 'Filha da Rosa, aparelho'),

        -- Pregnant and special
        (v_clinic_id, 'Mariana Gravida', '11988882064', 'mariana.gravida@example.com', '23456789064', '1994-07-12', ARRAY['Gestante'], 0.10, NOW() - INTERVAL '7 days', '7 meses de gestação'),
        (v_clinic_id, 'Paulo Diabético', '11988882065', 'paulo.diabetico@example.com', '23456789065', '1960-11-25', ARRAY['Especial', 'Convênio'], 0.20, NOW() - INTERVAL '11 days', 'Diabético, cuidado especial'),
        (v_clinic_id, 'Ana Autista', '11988882066', 'ana.autista@example.com', '23456789066', '1999-03-08', ARRAY['Especial'], 0.09, NOW() - INTERVAL '8 days', 'TEA - precisa de ambiente calmo'),

        -- More variety
        (v_clinic_id, 'Rodrigo Palmeira', '11988882067', 'rodrigo.palmeira@example.com', '23456789067', '1986-07-20', ARRAY[], 0.40, NOW() - INTERVAL '33 days', NULL),
        (v_clinic_id, 'Sônia Viana', '11988882068', 'sonia.viana@example.com', '23456789069', '1968-11-02', ARRAY['Convênio'], 0.22, NOW() - INTERVAL '16 days', 'Unimed'),
        (v_clinic_id, 'Túlio Marques', '11988882069', 'tulio.marques@example.com', '23456789070', '1991-04-14', ARRAY[], 0.35, NOW() - INTERVAL '26 days', NULL),
        (v_clinic_id, 'Úrsula Fagundes', '11988882070', 'ursula.fagundes@example.com', '23456789071', '1995-08-27', ARRAY[], 0.19, NOW() - INTERVAL '19 days', NULL),
        (v_clinic_id, 'Vítor Leme', '11988882071', 'vitor.leme@example.com', '23456789072', '1989-12-09', ARRAY[], 0.41, NOW() - INTERVAL '34 days', NULL),
        (v_clinic_id, 'Wanda Martins', '11988882072', 'wanda.martins@example.com', '23456789073', '1976-05-22', ARRAY['VIP'], 0.11, NOW() - INTERVAL '7 days', 'Empresária local'),
        (v_clinic_id, 'Xavier Cunha', '11988882073', 'xavier.cunha@example.com', '23456789074', '1993-10-05', ARRAY[], 0.28, NOW() - INTERVAL '22 days', NULL),
        (v_clinic_id, 'Yara Peçanha', '11988882074', 'yara.pecanha@example.com', '23456789075', '1980-03-18', ARRAY['Frequente'], 0.16, NOW() - INTERVAL '13 days', NULL),
        (v_clinic_id, 'Zilda Fontes', '11988882075', 'zilda.fontes@example.com', '23456789076', '1971-08-30', ARRAY[], 0.43, NOW() - INTERVAL '60 days', 'Reativar')
    ON CONFLICT DO NOTHING;

    -- Collect ALL patient IDs
    SELECT array_agg(id) INTO v_patient_ids FROM patients WHERE clinic_id = v_clinic_id;

    -- ============================================
    -- 4. SCHEDULE BLOCKS (working hours per dentist)
    -- ============================================
    INSERT INTO schedule_blocks (clinic_id, dentist_id, day_of_week, start_time, end_time, is_available)
    SELECT v_clinic_id, d.id, day, st, et, avail
    FROM dentists d
    CROSS JOIN (
        VALUES
            (0, '08:00'::TIME, '12:00'::TIME, false),
            (1, '08:00'::TIME, '18:00'::TIME, true),
            (2, '08:00'::TIME, '18:00'::TIME, true),
            (3, '08:00'::TIME, '18:00'::TIME, true),
            (4, '08:00'::TIME, '18:00'::TIME, true),
            (5, '08:00'::TIME, '12:00'::TIME, true),
            (6, '00:00'::TIME, '00:00'::TIME, false)
    ) AS days(day, st, et, avail)
    WHERE d.clinic_id = v_clinic_id AND d.is_active = true
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- 5. ADDITIONAL APPOINTMENTS (~80 new)
    -- ============================================

    -- TODAY (8 appointments)
    FOR i IN 1..8 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status, notes)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW()) + (8 + i)::numeric * INTERVAL '1 hour',
            CASE floor(random() * 3)::int WHEN 0 THEN 30 WHEN 1 THEN 40 ELSE 60 END,
            CASE i
                WHEN 1 THEN 'confirmed'
                WHEN 2 THEN 'confirmed'
                WHEN 3 THEN 'confirmed'
                WHEN 4 THEN 'in_progress'
                WHEN 5 THEN 'completed'
                WHEN 6 THEN 'scheduled'
                WHEN 7 THEN 'scheduled'
                ELSE 'scheduled'
            END,
            NULL
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- YESTERDAY (6 appointments)
    FOR i IN 1..6 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status, notes)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() - INTERVAL '1 day') + (8 + i)::numeric * INTERVAL '1 hour',
            CASE floor(random() * 3)::int WHEN 0 THEN 30 WHEN 1 THEN 40 ELSE 60 END,
            CASE i WHEN 5 THEN 'cancelled' WHEN 6 THEN 'no_show' ELSE 'completed' END,
            CASE WHEN i = 5 THEN 'Cancelou por motivos pessoais' WHEN i = 6 THEN 'Não compareceu' ELSE NULL END
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- PAST WEEK (25 appointments, various statuses)
    FOR i IN 1..25 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status, notes)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() - (2 + floor(random() * 5))::numeric * INTERVAL '1 day') + (8 + floor(random() * 9))::numeric * INTERVAL '1 hour',
            CASE floor(random() * 4)::int WHEN 0 THEN 30 WHEN 1 THEN 40 WHEN 2 THEN 60 ELSE 90 END,
            CASE floor(random() * 20)::int
                WHEN 0 THEN 'cancelled'
                WHEN 1 THEN 'no_show'
                ELSE 'completed'
            END,
            NULL
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- TOMORROW (6 appointments)
    FOR i IN 1..6 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() + INTERVAL '1 day') + (8 + i)::numeric * INTERVAL '1 hour',
            CASE floor(random() * 3)::int WHEN 0 THEN 30 WHEN 1 THEN 40 ELSE 60 END,
            CASE WHEN floor(random() * 3)::int = 0 THEN 'confirmed' ELSE 'scheduled' END
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- NEXT 7 DAYS (15 appointments)
    FOR i IN 1..15 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() + (2 + floor(random() * 5))::numeric * INTERVAL '1 day') + (8 + floor(random() * 9))::numeric * INTERVAL '1 hour',
            CASE floor(random() * 4)::int WHEN 0 THEN 30 WHEN 1 THEN 40 WHEN 2 THEN 60 ELSE 90 END,
            CASE WHEN floor(random() * 4)::int = 0 THEN 'confirmed' ELSE 'scheduled' END
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- NEXT 30 DAYS (25 appointments)
    FOR i IN 1..25 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() + (8 + floor(random() * 22))::numeric * INTERVAL '1 day') + (8 + floor(random() * 9))::numeric * INTERVAL '1 hour',
            CASE floor(random() * 4)::int WHEN 0 THEN 30 WHEN 1 THEN 40 WHEN 2 THEN 60 ELSE 90 END,
            'scheduled'
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- DEEP PAST 30-90 days (15 completed)
    FOR i IN 1..15 LOOP
        INSERT INTO appointments (clinic_id, patient_id, dentist_id, procedure_id, scheduled_at, duration_minutes, status)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() - (30 + floor(random() * 60))::numeric * INTERVAL '1 day') + (8 + floor(random() * 9))::numeric * INTERVAL '1 hour',
            CASE floor(random() * 4)::int WHEN 0 THEN 30 WHEN 1 THEN 40 WHEN 2 THEN 60 ELSE 90 END,
            'completed'
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- ============================================
    -- 6. ADDITIONAL CONVERSATIONS (~30 new)
    -- ============================================

    -- WhatsApp conversations
    INSERT INTO conversations (clinic_id, patient_id, channel, external_id, status, last_message_at, message_count)
    SELECT
        v_clinic_id,
        v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
        'whatsapp',
        '5511' || (9900000000 + floor(random() * 9999999))::text,
        CASE floor(random() * 5)::int
            WHEN 0 THEN 'waiting'
            WHEN 1 THEN 'escalated'
            WHEN 2 THEN 'closed'
            ELSE 'active'
        END,
        NOW() - floor(random() * 1440)::numeric * INTERVAL '1 minute',
        floor(random() * 10 + 1)::int
    FROM generate_series(1, 15)
    ON CONFLICT DO NOTHING;

    -- Instagram conversations
    INSERT INTO conversations (clinic_id, channel, external_id, status, last_message_at, message_count)
    SELECT
        v_clinic_id,
        'instagram',
        '@user_' || floor(random() * 99999)::text,
        CASE floor(random() * 4)::int
            WHEN 0 THEN 'waiting'
            WHEN 1 THEN 'escalated'
            WHEN 2 THEN 'closed'
            ELSE 'active'
        END,
        NOW() - floor(random() * 2880)::numeric * INTERVAL '1 minute',
        floor(random() * 8 + 1)::int
    FROM generate_series(1, 8)
    ON CONFLICT DO NOTHING;

    -- Web conversations
    INSERT INTO conversations (clinic_id, channel, external_id, status, last_message_at, message_count)
    SELECT
        v_clinic_id,
        'web',
        'web_session_' || floor(random() * 999999)::text,
        CASE floor(random() * 4)::int
            WHEN 0 THEN 'waiting'
            WHEN 1 THEN 'escalated'
            WHEN 2 THEN 'closed'
            ELSE 'active'
        END,
        NOW() - floor(random() * 1440)::numeric * INTERVAL '1 minute',
        floor(random() * 6 + 1)::int
    FROM generate_series(1, 10)
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- 7. MESSAGES FOR CONVERSATIONS (~200+)
    -- ============================================
    -- Collect conversation IDs
    SELECT array_agg(id) INTO v_conv_ids FROM conversations WHERE clinic_id = v_clinic_id;

    -- Add 4-8 messages per conversation
    FOR i IN 1..array_length(v_conv_ids, 1) LOOP
        DECLARE
            msg_count int := 4 + floor(random() * 5)::int;
            j int;
            base_time timestamptz;
            intents text[] := ARRAY['agendamento', 'confirmacao', 'duvida', 'emergencia', 'reclamacao', 'outros'];
            inbound_msgs text[] := ARRAY[
                'Olá, gostaria de agendar uma consulta',
                'Qual o horário disponível amanhã?',
                'Preciso cancelar meu agendamento de amanhã',
                'Qual o valor do implante dentário?',
                'Estou com dor no dente, o que posso fazer?',
                'Vocês atendem pelo convênio Bradesco?',
                'Quero fazer um clareamento dental',
                'Posso reagendar para próxima semana?',
                'Gostaria de saber sobre aparelho invisível',
                'Preciso de uma extração de siso',
                'Vocês fazem faceta de porcelana?',
                'Quanto tempo dura o tratamento de canal?',
                'Tem como parcelar o tratamento?',
                'Preciso de uma limpeza urgente',
                'Quais formas de pagamento vocês aceitam?'
            ];
            outbound_msgs text[] := ARRAY[
                'Olá! Claro, posso te ajudar. Qual procedimento deseja?',
                'Temos horários às 9h, 11h e 15h. Qual prefere?',
                'Entendi, vou cancelar para você. Deseja reagendar?',
                'O implante com coroa fica R$ 4.500. Posso agendar uma avaliação?',
                'Recomendo que venha o mais rápido possível. Temos horário hoje às 16h.',
                'Sim, atendemos Bradesco Saúde! Posso verificar sua cobertura.',
                'Ótimo! Temos clareamento profissional e caseiro. O profissional tem resultado imediato.',
                'Claro! Quando seria melhor para você?',
                'Temos aparelho metálico e estético. Agende uma avaliação ortodôntica!',
                'A extração de siso leva cerca de 45 minutos. Quer agendar?',
                'Sim! A faceta fica pronta em 2 sessões. Valor a partir de R$ 2.500.',
                'O tratamento de canal leva em média 2 sessões de 90 minutos.',
                'Parcelamos em até 10x sem juros no cartão!',
                'Perfeito! Temos horário de limpeza ainda hoje às 17h.',
                'Aceitamos cartão, PIX, dinheiro e até 10x sem juros.'
            ];
        BEGIN
            base_time := NOW() - (floor(random() * 120) + 10)::numeric * INTERVAL '1 minute';

            FOR j IN 1..msg_count LOOP
                INSERT INTO messages (conversation_id, direction, content, intent, is_ai, created_at)
                VALUES (
                    v_conv_ids[i],
                    CASE WHEN j % 2 = 1 THEN 'inbound' ELSE 'outbound' END,
                    CASE WHEN j % 2 = 1
                        THEN inbound_msgs[1 + floor(random() * array_length(inbound_msgs, 1))::int]
                        ELSE outbound_msgs[1 + floor(random() * array_length(outbound_msgs, 1))::int]
                    END,
                    intents[1 + floor(random() * array_length(intents, 1))::int],
                    j % 2 = 0,
                    base_time + (j * 5)::numeric * INTERVAL '1 minute'
                );
            END LOOP;
        END;
    END LOOP;

    -- ============================================
    -- 8. ADDITIONAL LEADS (30 new = ~50 total)
    -- ============================================
    INSERT INTO leads (clinic_id, name, phone, email, source, status, temperature, score, interest, has_budget, has_timeline, notes, contact_count, last_contact_at, next_followup_at)
    VALUES
        -- Hot
        (v_clinic_id, 'Renata Albuquerque', '11977770031', 'renata.albuquerque@example.com', 'referral', 'proposal', 'hot', 82, 'Implante Dentário', true, true, 'Proposta enviada ontem', 3, NOW() - INTERVAL '1 day', NOW() + INTERVAL '2 days'),
        (v_clinic_id, 'Marcos Vinícius', '11977770032', 'marcos.vinicius@example.com', 'whatsapp', 'negotiation', 'hot', 88, 'Aparelho Ortodôntico', true, true, 'Negociando valor e parcelas', 4, NOW() - INTERVAL '3 hours', NOW() + INTERVAL '1 day'),
        (v_clinic_id, 'Carla Augusta', '11977770033', 'carla.augusta@example.com', 'instagram', 'qualified', 'hot', 79, 'Clareamento', true, false, 'Quer fazer antes do casamento em maio', 2, NOW() - INTERVAL '2 days', NOW() + INTERVAL '3 days'),
        (v_clinic_id, 'Felipe Stern', '11977770034', 'felipe.stern@example.com', 'web', 'proposal', 'hot', 85, 'Faceta de Porcelana', true, true, 'Orçamento aprovado, marcar', 3, NOW() - INTERVAL '1 day', NOW()),
        (v_clinic_id, 'Juliana Marselha', '11977770035', 'juliana.marselha@example.com', 'referral', 'negotiation', 'hot', 90, 'Prótese Total', true, true, 'Fechando nesta semana', 5, NOW() - INTERVAL '5 hours', NOW() + INTERVAL '12 hours'),

        -- Warm
        (v_clinic_id, 'Rodrigo Barreto', '11977770036', 'rodrigo.barreto@example.com', 'web', 'contacted', 'warm', 55, 'Limpeza Profissional', false, false, 'Primeiro contato, parece interessado', 1, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days'),
        (v_clinic_id, 'Simone Ferraz', '11977770037', 'simone.ferraz@example.com', 'instagram', 'new', 'warm', 48, 'Clareamento', false, false, 'Curtiu vários posts', 0, NULL, NOW() + INTERVAL '1 day'),
        (v_clinic_id, 'Tomás Pacheco', '11977770038', 'tomas.pacheco@example.com', 'whatsapp', 'qualified', 'warm', 62, 'Tratamento de Canal', true, false, 'Com dor mas comparando preços', 2, NOW() - INTERVAL '1 day', NOW() + INTERVAL '4 days'),
        (v_clinic_id, 'Úrsula Diniz', '11977770039', 'ursula.diniz@example.com', 'referral', 'contacted', 'warm', 58, 'Aparelho Ortodôntico', false, true, 'Filha precisa de aparelho', 1, NOW() - INTERVAL '4 days', NOW() + INTERVAL '3 days'),
        (v_clinic_id, 'Vinicius Leal', '11977770040', 'vinicius.leal@example.com', 'web', 'new', 'warm', 45, 'Extração de Siso', false, true, 'Formulário preenchido ontem', 0, NULL, NOW() + INTERVAL '2 days'),
        (v_clinic_id, 'Wanda Cruz', '11977770041', 'wanda.cruz@example.com', 'instagram', 'contacted', 'warm', 52, 'Coroa de Porcelana', false, false, 'Segunda tentativa de contato', 2, NOW() - INTERVAL '5 days', NOW() + INTERVAL '1 day'),
        (v_clinic_id, 'Xavier Borges', '11977770042', 'xavier.borges@example.com', 'whatsapp', 'qualified', 'warm', 60, 'Implante Dentário', true, false, 'Tem orçamento, avaliando', 2, NOW() - INTERVAL '2 days', NOW() + INTERVAL '5 days'),
        (v_clinic_id, 'Yasmin Fontes', '11977770043', 'yasmin.fontes@example.com', 'web', 'contacted', 'warm', 50, 'Restauração Estética', false, true, 'Precisa urgente mas sem pressa', 1, NOW() - INTERVAL '6 days', NOW() + INTERVAL '4 days'),
        (v_clinic_id, 'Zeca Nogueira', '11977770044', 'zeca.nogueira@example.com', 'referral', 'new', 'warm', 47, 'Limpeza Profissional', false, false, 'Indicado por paciente existente', 0, NULL, NOW() + INTERVAL '1 day'),
        (v_clinic_id, 'Adriana Teles', '11977770045', 'adriana.teles@example.com', 'instagram', 'contacted', 'warm', 54, 'Lente de Contato Dental', false, false, 'Interesse em estética', 1, NOW() - INTERVAL '3 days', NOW() + INTERVAL '2 days'),

        -- Cold
        (v_clinic_id, 'Bernardo Rocha', '11977770046', 'bernardo.rocha@example.com', 'web', 'new', 'cold', 22, 'Limpeza Profissional', false, false, 'Só consultou preço', 0, NULL, NOW() + INTERVAL '7 days'),
        (v_clinic_id, 'Cláudia Ribeiro', '11977770047', 'claudia.ribeiro@example.com', 'instagram', 'new', 'cold', 18, 'Clareamento', false, false, 'Curtiu post, sem urgência', 0, NULL, NOW() + INTERVAL '5 days'),
        (v_clinic_id, 'Danilo Esteves', '11977770048', 'danilo.esteves@example.com', 'whatsapp', 'contacted', 'cold', 28, 'Restauração', false, false, 'Não respondeu mensagens', 1, NOW() - INTERVAL '10 days', NOW() + INTERVAL '7 days'),
        (v_clinic_id, 'Elisa Marques', '11977770049', 'elisa.marques@example.com', 'web', 'new', 'cold', 15, 'Implante Dentário', false, false, 'Orçamento muito alto', 0, NULL, NOW() + INTERVAL '14 days'),
        (v_clinic_id, 'Fernando Gil', '11977770050', 'fernando.gil@example.com', 'instagram', 'contacted', 'cold', 25, 'Aparelho Ortodôntico', false, false, 'Disse que vai pensar', 1, NOW() - INTERVAL '7 days', NOW() + INTERVAL '10 days'),
        (v_clinic_id, 'Gisela Porto', '11977770051', 'gisela.porto@example.com', 'web', 'new', 'cold', 20, 'Extração de Siso', false, false, 'Sem urgência', 0, NULL, NOW() + INTERVAL '7 days'),
        (v_clinic_id, 'Humberto Tavares', '11977770052', 'humberto.tavares@example.com', 'whatsapp', 'new', 'cold', 12, 'Limpeza Profissional', false, false, 'Mandou mensagem genérica', 0, NULL, NOW() + INTERVAL '5 days'),
        (v_clinic_id, 'Irene Bastos', '11977770053', 'irene.bastos@example.com', 'instagram', 'contacted', 'cold', 30, 'Profilaxia', false, false, 'Não demonstrou interesse real', 2, NOW() - INTERVAL '14 days', NULL),

        -- Converted
        (v_clinic_id, 'José Renato', '11977770054', 'jose.renato@example.com', 'referral', 'converted', 'hot', 95, 'Implante Dentário', true, true, 'Convertido! Agendado para próxima semana', 4, NOW() - INTERVAL '1 day', NULL),
        (v_clinic_id, 'Kelly Sampaio', '11977770055', 'kelly.sampaio@example.com', 'instagram', 'converted', 'hot', 88, 'Clareamento', true, true, 'Fechou clareamento profissional', 3, NOW() - INTERVAL '3 days', NULL),
        (v_clinic_id, 'Leonardo Faria', '11977770056', 'leonardo.faria@example.com', 'whatsapp', 'converted', 'hot', 91, 'Aparelho Ortodôntico', true, true, 'Fechou aparelho estético', 3, NOW() - INTERVAL '2 days', NULL),
        (v_clinic_id, 'Marina Luz', '11977770057', 'marina.luz@example.com', 'web', 'converted', 'hot', 87, 'Restauração Estética', true, true, 'Convertido pelo site', 2, NOW() - INTERVAL '4 days', NULL),

        -- Lost
        (v_clinic_id, 'Nathalia Cunha', '11977770058', 'nathalia.cunha@example.com', 'whatsapp', 'lost', 'warm', 38, 'Aparelho Ortodôntico', false, false, 'Escolheu outra clínica mais barata', 3, NOW() - INTERVAL '10 days', NULL),
        (v_clinic_id, 'Otávio Mendes', '11977770059', 'otavio.mendes@example.com', 'web', 'lost', 'cold', 20, 'Limpeza Profissional', false, false, 'Sem resposta após 3 tentativas', 3, NOW() - INTERVAL '15 days', NULL),
        (v_clinic_id, 'Patrícia Gomes', '11977770060', 'patricia.gomes@example.com', 'instagram', 'lost', 'warm', 35, 'Clareamento', false, false, 'Desistiu por causa do preço', 2, NOW() - INTERVAL '12 days', NULL)
    ON CONFLICT DO NOTHING;

    -- Collect lead IDs
    SELECT array_agg(id) INTO v_lead_ids FROM leads WHERE clinic_id = v_clinic_id;

    -- ============================================
    -- 9. LEAD ACTIVITIES (~100+)
    -- ============================================
    FOR i IN 1..array_length(v_lead_ids, 1) LOOP
        DECLARE
            act_count int := 2 + floor(random() * 4)::int;
            j int;
            act_types text[] := ARRAY['call', 'email', 'whatsapp', 'note', 'meeting', 'proposal_sent'];
            act_descs text[] := ARRAY[
                'Tentativa de contato por telefone',
                'Email enviado com proposta comercial',
                'Mensagem via WhatsApp enviada',
                'Nota interna adicionada',
                'Reunião realizada na clínica',
                'Proposta comercial enviada',
                'Retorno de ligação recebido',
                'Follow-up por email',
                'Ligação atendida - cliente interessado',
                'Orçamento detalhado enviado por email',
                'Cliente pediu mais tempo para decidir',
                'Indicação recebida de outro paciente',
                'Agendamento de avaliação confirmado',
                'Cliente pediu desconto'
            ];
        BEGIN
            FOR j IN 1..act_count LOOP
                INSERT INTO lead_activities (lead_id, activity_type, description, performed_at)
                VALUES (
                    v_lead_ids[i],
                    act_types[1 + floor(random() * array_length(act_types, 1))::int],
                    act_descs[1 + floor(random() * array_length(act_descs, 1))::int],
                    NOW() - (j * floor(random() * 48 + 1))::numeric * INTERVAL '1 hour'
                );
            END LOOP;
        END;
    END LOOP;

    -- ============================================
    -- 10. ADDITIONAL CAMPAIGNS (7 new = 12 total)
    -- ============================================
    INSERT INTO campaigns (clinic_id, name, description, campaign_type, channel, status, message_template, total_recipients, sent_count, response_count, conversion_count, scheduled_at, started_at, created_by)
    VALUES
        (v_clinic_id, 'Black Novembro - Implantes', 'Promoção de black friday para implantes com 40% off', 'promotional', 'whatsapp', 'draft', '🖤 BLACK FRIDAY 🖤 Implante com 40% de desconto! De R$ 4.500 por R$ 2.700. Válido apenas para novembro. Responda IMPLANTE para agendar avaliação.', 0, 0, 0, 0, NULL, NULL, v_user_id),
        (v_clinic_id, 'Volta às Aulas - Jovens', 'Campanha para jovens com desconto em aparelho', 'promotional', 'instagram', 'scheduled', '📚 VOLTA ÀS AULAS 📚 Aparelho ortodôntico com entrada facilitada! Parcelamos em até 18x. Marque sua avaliação gratuita!', 0, 0, 0, 0, DATE(NOW() + INTERVAL '15 days') + INTERVAL '8 hours', NULL, v_user_id),
        (v_clinic_id, 'Aniversariantes do Mês', 'Desconto especial para pacientes aniversariantes', 'promotional', 'whatsapp', 'running', '🎂 FELIZ ANIVERSÁRIO! 🎂 Em comemoração ao seu mês, ganhe 25% de desconto em qualquer procedimento estético! Válido até o final do mês. Responda ANIVERSARIO.', 30, 18, 6, 2, NULL, NOW() - INTERVAL '5 days', v_user_id),
        (v_clinic_id, 'Pós-Tratamento Canal', 'Follow-up para pacientes que fizeram canal recentemente', 'follow_up', 'whatsapp', 'running', 'Olá {{patient_name}}! Como está se sentindo após o tratamento de canal? Se tiver qualquer desconforto, entre em contato. Sua saúde bucal é nossa prioridade! 😊', 15, 12, 8, 0, NULL, NOW() - INTERVAL '10 days', v_user_id),
        (v_clinic_id, 'Reativação Q1', 'Reativar pacientes que não vêm desde o início do ano', 'reactivation', 'whatsapp', 'paused', 'Olá {{patient_name}}! Estamos com saudades! 💙 Preparamos uma surpresa especial para seu retorno. Responda VOLTAR para receber um desconto exclusivo!', 40, 10, 2, 1, NULL, NOW() - INTERVAL '20 days', v_user_id),
        (v_clinic_id, 'Pesquisa de Satisfação Q1', 'Coletar feedback dos pacientes do primeiro trimestre', 'follow_up', 'whatsapp', 'completed', 'Olá {{patient_name}}! Sua opinião vale muito! 🙏 Responda nossa pesquisa rápida (1 minuto) e concorra a uma limpeza gratuita: [link]', 90, 85, 52, 0, NULL, NOW() - INTERVAL '30 days', v_user_id),
        (v_clinic_id, 'Dia das Mães - Estética', 'Promoção de Dia das Mães para procedimentos estéticos', 'promotional', 'instagram', 'scheduled', '💐 DIA DAS MÃES 💐 Presenteie quem você ama com um sorriso novo! Clareamento + Limpeza com 30% off. vouchers limitados! Responda MAES.', 0, 0, 0, 0, DATE(NOW() + INTERVAL '30 days') + INTERVAL '8 hours', NULL, v_user_id)
    ON CONFLICT DO NOTHING;

    -- Collect campaign IDs
    SELECT array_agg(id) INTO v_campaign_ids FROM campaigns WHERE clinic_id = v_clinic_id;

    -- ============================================
    -- 11. CAMPAIGN RECIPIENTS (~185+)
    -- ============================================
    FOR i IN 1..array_length(v_campaign_ids, 1) LOOP
        DECLARE
            rec_count int := 10 + floor(random() * 30)::int;
            j int;
        BEGIN
            FOR j IN 1..rec_count LOOP
                INSERT INTO campaign_recipients (campaign_id, patient_id, status, sent_at, delivered_at)
                SELECT
                    v_campaign_ids[i],
                    v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
                    CASE floor(random() * 4)::int
                        WHEN 0 THEN 'sent'
                        WHEN 1 THEN 'delivered'
                        WHEN 2 THEN 'responded'
                        ELSE 'delivered'
                    END,
                    NOW() - floor(random() * 168)::numeric * INTERVAL '1 hour',
                    NOW() - floor(random() * 160)::numeric * INTERVAL '1 hour'
                ON CONFLICT DO NOTHING;
            END LOOP;
        END;
    END LOOP;

    -- ============================================
    -- 12. WAITLIST (15 entries)
    -- ============================================
    FOR i IN 1..15 LOOP
        INSERT INTO waitlist (clinic_id, patient_id, dentist_id, procedure_id, preferred_date, preferred_time_start, preferred_time_end, priority, status, notes)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            v_dentist_ids[1 + floor(random() * array_length(v_dentist_ids, 1))::int],
            v_procedure_ids[1 + floor(random() * array_length(v_procedure_ids, 1))::int],
            DATE(NOW() + (1 + floor(random() * 14))::numeric * INTERVAL '1 day'),
            (8 + floor(random() * 4))::numeric * INTERVAL '1 hour',
            (14 + floor(random() * 4))::numeric * INTERVAL '1 hour',
            floor(random() * 5 + 1)::int,
            'waiting',
            'Paciente aguardando vaga'
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- ============================================
    -- 13. PATIENT FEEDBACK (30 entries)
    -- ============================================
    FOR i IN 1..30 LOOP
        INSERT INTO patient_feedback (clinic_id, patient_id, feedback_type, rating, nps_score, would_recommend, comments, improvements, collected_at, channel)
        SELECT
            v_clinic_id,
            v_patient_ids[1 + floor(random() * array_length(v_patient_ids, 1))::int],
            CASE floor(random() * 3)::int WHEN 0 THEN 'post_appointment' WHEN 1 THEN 'general' ELSE 'nps' END,
            3 + floor(random() * 3)::int,
            6 + floor(random() * 5)::int,
            random() > 0.2,
            CASE floor(random() * 5)::int
                WHEN 0 THEN 'Excelente atendimento! Equipe muito atenciosa.'
                WHEN 1 THEN 'Gostei do resultado. Recomendo a clínica.'
                WHEN 2 THEN 'Bom atendimento, mas a espera foi um pouco longa.'
                WHEN 3 THEN 'Profissional muito competente e cuidadoso.'
                ELSE 'Ambiente agradável e moderno. Me senti à vontade.'
            END,
            CASE WHEN random() > 0.5 THEN ARRAY['Tempo de espera', 'Estacionamento'] ELSE NULL END,
            NOW() - floor(random() * 720)::numeric * INTERVAL '1 hour',
            CASE floor(random() * 3)::int WHEN 0 THEN 'whatsapp' WHEN 1 THEN 'email' ELSE 'in_person' END
        ON CONFLICT DO NOTHING;
    END LOOP;

    -- ============================================
    -- 14. ADDITIONAL MESSAGE TEMPLATES (7 new = 10 total)
    -- ============================================
    INSERT INTO message_templates (clinic_id, name, category, content, variables, status)
    VALUES
        (v_clinic_id, 'Confirmação de Agendamento', 'appointment', 'Olá {{patient_name}}! Confirmamos seu agendamento para {{procedure}} no dia {{date}} às {{time}} com {{dentist_name}}. Responda CONFIRMAR para confirmar ou CANCELAR para reagendar.', '{"patient_name": "", "procedure": "", "date": "", "time": "", "dentist_name": ""}', 'approved'),
        (v_clinic_id, 'Lembrete 24h', 'reminder', 'Olá {{patient_name}}! Lembrete: sua consulta é amanhã às {{time}} com {{dentist_name}}. Estamos te esperando! 😊', '{"patient_name": "", "time": "", "dentist_name": ""}', 'approved'),
        (v_clinic_id, 'Lembrete 1h', 'reminder', 'Olá {{patient_name}}! Sua consulta começa em 1 hora. Confirme sua presença respondendo SIM.', '{"patient_name": ""}', 'approved'),
        (v_clinic_id, 'Pós-Consulta', 'follow_up', 'Olá {{patient_name}}! Como está se sentindo após sua consulta de {{procedure}}? Se tiver qualquer dúvida, estamos aqui! 😊', '{"patient_name": "", "procedure": ""}', 'approved'),
        (v_clinic_id, 'Pesquisa NPS', 'feedback', 'Olá {{patient_name}}! Em uma escala de 0 a 10, o quanto você recomendaria nossa clínica para um amigo? Sua opinião é muito importante!', '{"patient_name": ""}', 'approved'),
        (v_clinic_id, 'Reativação', 'retention', 'Olá {{patient_name}}! Sentimos sua falta! 💙 Faz {{days_since}} dias que não te vemos. Que tal agendar uma revisão? Responda HORARIOS para ver disponibilidade.', '{"patient_name": "", "days_since": ""}', 'approved'),
        (v_clinic_id, 'Aniversário', 'promotional', 'Olá {{patient_name}}! 🎂 Feliz aniversário! Para celebrar, ganhe 25% de desconto em qualquer procedimento estético este mês. Responda ANIVERSARIO para agendar!', '{"patient_name": ""}', 'approved')
    ON CONFLICT DO NOTHING;

    -- ============================================
    -- 15. ADDITIONAL PROCEDURE GUIDELINES (4 new = 8 total)
    -- ============================================
    INSERT INTO procedure_guidelines (clinic_id, procedure_name, title, instructions, emergency_contact, recovery_time_days, restrictions, warning_signs, is_active)
    VALUES
        (v_clinic_id, 'Implante Dentário', 'Cuidados Pós-Implante', 'Mantenha a região limpa com bochechos leves. Evite tocar no local com a língua ou dedos. Use medicação conforme prescrito.', true, 7, ARRAY['Não fazer força na região', 'Evitar alimentos duros por 7 dias', 'Não fumar por 72 horas'], ARRAY['Sangramento excessivo', 'Dor intensa após 48h', 'Inchaço progressivo'], true),
        (v_clinic_id, 'Aparelho Ortodôntico', 'Cuidados com Aparelho', 'Escove após cada refeição. Use floss ortodôntico diariamente. Evite alimentos pegajosos e duros.', false, 0, ARRAY['Não mascar chiclete', 'Evitar balas duras e caramelos', 'Cortar frutas em pedaços pequenos'], ARRAY['Fio ou brquete solto', 'Fio cortando a bochecha', 'Dor intensa ao morder'], true),
        (v_clinic_id, 'Faceta de Porcelana', 'Cuidados Pós-Faceta', 'Evite morder objetos duros. Mantenha higiene normal. Use protetor bucal se pratica esportes.', false, 3, ARRAY['Evitar abrir embalagens com os dentes', 'Não roer unhas', 'Evitar alimentos muito duros por 3 dias'], ARRAY['Faceta solta ou quebrada', 'Sensibilidade extrema ao frio', 'Dor ao morder'], true),
        (v_clinic_id, 'Prótese Total', 'Adaptação à Prótese', 'Nos primeiros dias, coma alimentos macios. Leia em voz alta para adaptar a fala. Remova à noite para limpar.', false, 14, ARRAY['Não dormir com a prótese', 'Não usar água quente para limpar', 'Evitar adesivo em excesso'], ARRAY['Dor intensa que não melhora', 'Feridas na gengiva', 'Prótese não encaixa mais'], true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Scale demo data seeded successfully for clinic: %', v_clinic_id;
    RAISE NOTICE 'Patients: %, Dentists: %, Procedures: %',
        (SELECT count(*) FROM patients WHERE clinic_id = v_clinic_id),
        (SELECT count(*) FROM dentists WHERE clinic_id = v_clinic_id AND is_active = true),
        (SELECT count(*) FROM procedures WHERE clinic_id = v_clinic_id AND is_active = true);
END $$;
