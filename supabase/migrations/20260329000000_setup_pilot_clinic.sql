-- ============================================
-- SYNKROO - Script de Setup para Clínica Piloto
-- ============================================
--
-- Este script cria uma nova clínica com dados iniciais.
-- Use para configurar uma clínica piloto rapidamente.
--
-- INSTRUÇÕES:
-- 1. Substitua os valores marcados com {{VALOR}}
-- 2. Execute no SQL Editor do Supabase
-- ============================================

-- ============================================
-- VARIÁVEIS - Substitua os valores abaixo
-- ============================================

-- Nome da clínica
-- Ex: 'Clínica Sorriso', 'OdontoVida'
-- %CLINIC_NAME% = 'Nome da Clínica'

-- Email do admin
-- %ADMIN_EMAIL% = 'admin@exemplo.com'

-- Nome do admin
-- %ADMIN_NAME% = 'Dr. Maria Silva'

-- Senha do admin (depois altere no primeiro login)
-- %ADMIN_PASSWORD% = 'senhaSegura123'

-- Telefone/WhatsApp da clínica
-- %CLINIC_PHONE% = '11999999999'

-- ============================================
-- EXECUÇÃO
-- ============================================

DO $$
DECLARE
    v_clinic_id UUID;
    v_user_id UUID;
    v_clinic_name TEXT := '%CLINIC_NAME%';
    v_admin_email TEXT := '%ADMIN_EMAIL%';
    v_admin_name TEXT := '%ADMIN_NAME%';
    v_admin_password TEXT := '%ADMIN_PASSWORD%';
    v_clinic_phone TEXT := '%CLINIC_PHONE%';
    v_slug TEXT;
BEGIN
    -- Gerar slug
    v_slug := lower(regexp_replace(v_clinic_name, '[^a-zA-Z0-9]', '-', 'g'));
    v_slug := regexp_replace(v_slug, '-+', '-', 'g');
    v_slug := trim(both '-' from v_slug);

    RAISE NOTICE 'Criando clínica: %', v_clinic_name;
    RAISE NOTICE 'Slug: %', v_slug;

    -- ============================================
    -- 1. CRIAR CLÍNICA
    -- ============================================
    INSERT INTO clinics (
        name,
        slug,
        phone,
        email,
        settings
    ) VALUES (
        v_clinic_name,
        v_slug,
        v_clinic_phone,
        v_admin_email,
        jsonb_build_object(
            'business_hours', jsonb_build_object(
                'monday', jsonb_build_object('open', '08:00', 'close', '18:00'),
                'tuesday', jsonb_build_object('open', '08:00', 'close', '18:00'),
                'wednesday', jsonb_build_object('open', '08:00', 'close', '18:00'),
                'thursday', jsonb_build_object('open', '08:00', 'close', '18:00'),
                'friday', jsonb_build_object('open', '08:00', 'close', '18:00'),
                'saturday', jsonb_build_object('open', '08:00', 'close', '12:00'),
                'sunday', jsonb_build_object('open', null, 'close', null)
            ),
            'ai_settings', jsonb_build_object(
                'auto_response', true,
                'escalation_enabled', true,
                'business_name', v_clinic_name
            )
        )
    )
    RETURNING id INTO v_clinic_id;

    RAISE NOTICE 'Clínica criada com ID: %', v_clinic_id;

    -- ============================================
    -- 2. CRIAR USUÁRIO ADMIN
    -- ============================================
    -- Nota: Em produção, use o Supabase Auth
    -- Aqui criamos apenas o profile para um usuário existente

    INSERT INTO users (
        id,
        clinic_id,
        email,
        name,
        role,
        is_active
    ) VALUES (
        gen_random_uuid(),
        v_clinic_id,
        v_admin_email,
        v_admin_name,
        'owner',
        true
    )
    RETURNING id INTO v_user_id;

    RAISE NOTICE 'Usuário admin criado com ID: %', v_user_id;

    -- ============================================
    -- 3. CRIAR DENTISTAS PADRÃO
    -- ============================================
    -- Adicione mais dentistas conforme necessário

    INSERT INTO dentists (clinic_id, name, phone, email, cro, specialty, is_active)
    VALUES
        (v_clinic_id, 'Dr. Exemplo 1', '(11) 99999-0001', 'dentista1@exemplo.com', 'CRO-SP 00001', 'Clínico Geral', true),
        (v_clinic_id, 'Dra. Exemplo 2', '(11) 99999-0002', 'dentista2@exemplo.com', 'CRO-SP 00002', 'Ortodontista', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Dentistas criados';

    -- ============================================
    -- 4. CRIAR PROCEDIMENTOS PADRÃO
    -- ============================================

    INSERT INTO procedures (clinic_id, name, description, duration_minutes, price, category, is_active)
    VALUES
        (v_clinic_id, 'Consulta de Rotina', 'Avaliação clínica geral', 30, 150.00, 'Consulta', true),
        (v_clinic_id, 'Limpeza Profissional', 'Profilaxia completa com flúor', 45, 200.00, 'Prevenção', true),
        (v_clinic_id, 'Clareamento Dental', 'Clareamento profissional com LED', 60, 800.00, 'Estética', true),
        (v_clinic_id, 'Extração Simples', 'Extração de dente sem complicação', 30, 300.00, 'Cirurgia', true),
        (v_clinic_id, 'Restauração Estética', 'Obturação com resina composta', 40, 250.00, 'Restauração', true),
        (v_clinic_id, 'Tratamento de Canal', 'Endodontia - tratamento de canal', 90, 800.00, 'Endodontia', true),
        (v_clinic_id, 'Aparelho Ortodôntico', 'Aparelho fixo metálico', 60, 3000.00, 'Ortodontia', true),
        (v_clinic_id, 'Implante Dentário', 'Implante com coroa de porcelana', 120, 4000.00, 'Implantodontia', true)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Procedimentos criados';

    -- ============================================
    -- 5. CRIAR KNOWLEDGE BASE INICIAL
    -- ============================================

    INSERT INTO knowledge_base (clinic_id, question, answer, category, keywords)
    VALUES
        (v_clinic_id, 'Qual o horário de funcionamento?', 'Funcionamos de segunda a sexta das 8h às 18h, e sábados das 8h às 12h.', 'horarios', ARRAY['horário', 'funcionamento', 'abre', 'fecha']),
        (v_clinic_id, 'Vocês atendem emergência?', 'Sim, atendemos emergências. Por favor, ligue ou envie mensagem que tentaremos encaixar o mais rápido possível.', 'emergencia', ARRAY['emergência', 'urgente', 'dor', 'urgência']),
        (v_clinic_id, 'Quais formas de pagamento vocês aceitam?', 'Aceitamos dinheiro, PIX, cartões de crédito e débito. Trabalhamos também com convênios.', 'pagamento', ARRAY['pagamento', 'cartão', 'dinheiro', 'pix', 'convênio']),
        (v_clinic_id, 'Vocês fazem clareamento dental?', 'Sim! Oferecemos clareamento profissional com LED e também clareamento caseiro com moldeiras personalizadas.', 'procedimentos', ARRAY['clareamento', 'clarear', 'dente branco']),
        (v_clinic_id, 'Qual o valor da consulta?', 'A consulta de rotina custa R$ 150,00. Para outros procedimentos, os valores variam conforme a complexidade.', 'valores', ARRAY['valor', 'preço', 'quanto custa', 'consulta'])
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Knowledge base criada';

    -- ============================================
    -- RESULTADO
    -- ============================================
    RAISE NOTICE '====================================';
    RAISE NOTICE 'SETUP CONCLUÍDO COM SUCESSO!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Clínica: %', v_clinic_name;
    RAISE NOTICE 'ID: %', v_clinic_id;
    RAISE NOTICE 'Slug: %', v_slug;
    RAISE NOTICE 'Email admin: %', v_admin_email;
    RAISE NOTICE '====================================';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Criar usuário no Supabase Auth';
    RAISE NOTICE '2. Atualizar o user.id na tabela users';
    RAISE NOTICE '3. Fazer login no dashboard';
    RAISE NOTICE '4. Personalizar horários e dentistas';
    RAISE NOTICE '====================================';
END $$;

-- ============================================
-- QUERIES ÚTEIS
-- ============================================

-- Ver clínica criada
-- SELECT * FROM clinics WHERE slug = 'seu-slug';

-- Ver dentistas da clínica
-- SELECT * FROM dentists WHERE clinic_id = 'id-da-clinica';

-- Ver procedimentos da clínica
-- SELECT * FROM procedures WHERE clinic_id = 'id-da-clinica';

-- Ver knowledge base
-- SELECT * FROM knowledge_base WHERE clinic_id = 'id-da-clinica';