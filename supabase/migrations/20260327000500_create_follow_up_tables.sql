-- Migration: Follow-up and Retention Tables
-- Description: Creates tables for post-consultation follow-up, campaigns, budgets, and treatment plans
-- Date: 2026-03-27

-- ============================================================================
-- PROCEDURE GUIDELINES (Orientações pós-procedimento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.procedure_guidelines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
    procedure_name VARCHAR(255) NOT NULL, -- Can match by name if procedure_id is null
    title VARCHAR(255) NOT NULL,
    instructions TEXT NOT NULL,
    emergency_contact BOOLEAN DEFAULT false,
    recovery_time_days INTEGER,
    restrictions TEXT[], -- Array of restrictions
    warning_signs TEXT[], -- Array of warning signs to watch for
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(clinic_id, procedure_name)
);

-- Index for quick lookup by procedure
CREATE INDEX idx_procedure_guidelines_clinic ON public.procedure_guidelines(clinic_id);
CREATE INDEX idx_procedure_guidelines_procedure ON public.procedure_guidelines(procedure_id);

-- ============================================================================
-- PATIENT FEEDBACK (Feedback dos pacientes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.patient_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    feedback_type VARCHAR(50) NOT NULL DEFAULT 'post_consultation', -- post_consultation, nps, general
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
    would_recommend BOOLEAN,
    comments TEXT,
    improvements TEXT[],
    collected_at TIMESTAMPTZ DEFAULT now(),
    channel VARCHAR(50) DEFAULT 'whatsapp', -- whatsapp, instagram, web
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for analytics
CREATE INDEX idx_patient_feedback_clinic ON public.patient_feedback(clinic_id);
CREATE INDEX idx_patient_feedback_patient ON public.patient_feedback(patient_id);
CREATE INDEX idx_patient_feedback_collected ON public.patient_feedback(collected_at);

-- ============================================================================
-- CAMPAIGNS (Campanhas de reativação)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(50) NOT NULL, -- reactivation, retention, promotional, follow_up
    target_segment VARCHAR(100), -- inactive_30, inactive_60, inactive_90, incomplete_treatment
    message_template TEXT NOT NULL,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status VARCHAR(50) DEFAULT 'draft', -- draft, scheduled, running, paused, completed, cancelled
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    response_count INTEGER DEFAULT 0,
    conversion_count INTEGER DEFAULT 0,
    opt_out_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for campaign management
CREATE INDEX idx_campaigns_clinic ON public.campaigns(clinic_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON public.campaigns(scheduled_at);

-- ============================================================================
-- CAMPAIGN RECIPIENTS (Destinatários das campanhas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, delivered, failed, responded, converted, opted_out
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    response_content TEXT,
    converted_at TIMESTAMPTZ,
    conversion_appointment_id UUID REFERENCES public.appointments(id),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(campaign_id, patient_id)
);

-- Indexes for recipient tracking
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_patient ON public.campaign_recipients(patient_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);

-- ============================================================================
-- BUDGETS (Orçamentos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    title VARCHAR(255),
    description TEXT,
    total_value DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    discount_value DECIMAL(10, 2) DEFAULT 0,
    final_value DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, accepted, rejected, expired, converted
    valid_until TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    responded_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    conversion_appointment_id UUID REFERENCES public.appointments(id),
    notes TEXT,
    follow_up_sequence INTEGER DEFAULT 0,
    next_follow_up_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Budget items (procedimentos no orçamento)
CREATE TABLE IF NOT EXISTS public.budget_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
    procedure_name VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    discount_percent DECIMAL(5, 2) DEFAULT 0,
    total_price DECIMAL(10, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for budget tracking
CREATE INDEX idx_budgets_clinic ON public.budgets(clinic_id);
CREATE INDEX idx_budgets_patient ON public.budgets(patient_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);
CREATE INDEX idx_budgets_follow_up ON public.budgets(next_follow_up_at);
CREATE INDEX idx_budget_items_budget ON public.budget_items(budget_id);

-- ============================================================================
-- TREATMENT PLANS (Planos de tratamento)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.treatment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_sessions INTEGER DEFAULT 1,
    completed_sessions INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'in_progress', -- planned, in_progress, completed, cancelled, abandoned
    started_at TIMESTAMPTZ,
    expected_completion_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    last_session_at TIMESTAMPTZ,
    next_session_due_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Treatment plan items (sessões/procedimentos do plano)
CREATE TABLE IF NOT EXISTS public.treatment_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_plan_id UUID NOT NULL REFERENCES public.treatment_plans(id) ON DELETE CASCADE,
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE SET NULL,
    procedure_name VARCHAR(255) NOT NULL,
    session_number INTEGER NOT NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, scheduled, completed, cancelled
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(treatment_plan_id, session_number)
);

-- Indexes for treatment tracking
CREATE INDEX idx_treatment_plans_clinic ON public.treatment_plans(clinic_id);
CREATE INDEX idx_treatment_plans_patient ON public.treatment_plans(patient_id);
CREATE INDEX idx_treatment_plans_status ON public.treatment_plans(status);
CREATE INDEX idx_treatment_plans_next_session ON public.treatment_plans(next_session_due_at);
CREATE INDEX idx_treatment_plan_items_plan ON public.treatment_plan_items(treatment_plan_id);

-- ============================================================================
-- FOLLOW-UP CONFIGURATIONS (Configurações de follow-up)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.follow_up_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    config_type VARCHAR(50) NOT NULL, -- post_consultation, return_reminder, budget_follow_up
    procedure_id UUID REFERENCES public.procedures(id) ON DELETE CASCADE,
    procedure_name VARCHAR(255), -- For matching by name
    delay_hours INTEGER, -- For post-consultation
    delay_days INTEGER, -- For return reminders
    delay_months INTEGER, -- For periodic procedures
    message_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(clinic_id, config_type, COALESCE(procedure_id, '00000000-0000-0000-0000-000000000000'::UUID))
);

CREATE INDEX idx_follow_up_configs_clinic ON public.follow_up_configs(clinic_id);
CREATE INDEX idx_follow_up_configs_type ON public.follow_up_configs(config_type);

-- ============================================================================
-- PATIENT OPT-OUT (Opt-out de pacientes)
-- ============================================================================
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS opt_out_marketing BOOLEAN DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS opt_out_reminders BOOLEAN DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS opt_out_at TIMESTAMPTZ;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.procedure_guidelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_configs ENABLE ROW LEVEL SECURITY;

-- Policies for procedure_guidelines
CREATE POLICY "Users can view guidelines from their clinic"
    ON public.procedure_guidelines FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage guidelines from their clinic"
    ON public.procedure_guidelines FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for patient_feedback
CREATE POLICY "Users can view feedback from their clinic"
    ON public.patient_feedback FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage feedback from their clinic"
    ON public.patient_feedback FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for campaigns
CREATE POLICY "Users can view campaigns from their clinic"
    ON public.campaigns FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage campaigns from their clinic"
    ON public.campaigns FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for campaign_recipients
CREATE POLICY "Users can view recipients from their clinic campaigns"
    ON public.campaign_recipients FOR SELECT
    USING (campaign_id IN (SELECT id FROM public.campaigns WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Users can manage recipients from their clinic campaigns"
    ON public.campaign_recipients FOR ALL
    USING (campaign_id IN (SELECT id FROM public.campaigns WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())))
    WITH CHECK (campaign_id IN (SELECT id FROM public.campaigns WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

-- Policies for budgets
CREATE POLICY "Users can view budgets from their clinic"
    ON public.budgets FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage budgets from their clinic"
    ON public.budgets FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for budget_items
CREATE POLICY "Users can view budget items from their clinic"
    ON public.budget_items FOR SELECT
    USING (budget_id IN (SELECT id FROM public.budgets WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Users can manage budget items from their clinic"
    ON public.budget_items FOR ALL
    USING (budget_id IN (SELECT id FROM public.budgets WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())))
    WITH CHECK (budget_id IN (SELECT id FROM public.budgets WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

-- Policies for treatment_plans
CREATE POLICY "Users can view treatment plans from their clinic"
    ON public.treatment_plans FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage treatment plans from their clinic"
    ON public.treatment_plans FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- Policies for treatment_plan_items
CREATE POLICY "Users can view treatment plan items from their clinic"
    ON public.treatment_plan_items FOR SELECT
    USING (treatment_plan_id IN (SELECT id FROM public.treatment_plans WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

CREATE POLICY "Users can manage treatment plan items from their clinic"
    ON public.treatment_plan_items FOR ALL
    USING (treatment_plan_id IN (SELECT id FROM public.treatment_plans WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())))
    WITH CHECK (treatment_plan_id IN (SELECT id FROM public.treatment_plans WHERE clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid())));

-- Policies for follow_up_configs
CREATE POLICY "Users can view follow-up configs from their clinic"
    ON public.follow_up_configs FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can manage follow-up configs from their clinic"
    ON public.follow_up_configs FOR ALL
    USING (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()))
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM public.users WHERE id = auth.uid()));

-- ============================================================================
-- SEED DATA - Default procedure guidelines
-- ============================================================================
INSERT INTO public.procedure_guidelines (clinic_id, procedure_name, title, instructions, emergency_contact, recovery_time_days, restrictions, warning_signs) VALUES
((SELECT id FROM public.clinics LIMIT 1), 'Limpeza', 'Cuidados pós-limpeza',
 'Parabéns por realizar sua limpeza dental! 🦷

✅ **O que esperar:**
- Leve sensibilidade nos primeiros dias
- Gengivas podem ficar levemente inchadas

🚫 **Evite nas primeiras 24h:**
- Alimentos e bebidas muito quentes ou frios
- Alimentos muito duros ou crocantes

💡 **Dicas:**
- Escove os dentes suavemente
- Use fio dental normalmente
- Agende sua próxima limpeza em 6 meses',
 false, 1,
 ARRAY['Alimentos muito quentes/frios por 24h'],
 ARRAY['Sangramento persistente', 'Dor intensa']),

((SELECT id FROM public.clinics LIMIT 1), 'Clareamento', 'Cuidados pós-clareamento',
 'Seu clareamento foi realizado com sucesso! ✨

⚠️ **IMPORTANTE - Dieta Branca (48h):**
Evite alimentos e bebidas pigmentados:
- Café, chá, refrigerantes escuros
- Vinho, sucos de uva/cenoura
- Molhos coloridos (ketchup, mostarda)
- Chocolate, beterraba

✅ **Pode consumir:**
- Arroz, macarrão, pão branco
- Carnes brancas (frango, peixe)
- Queijo branco, leite
- Água em abundância

🚫 **Evite por 7 dias:**
- Tabaco/cigarro
- Alimentos ácidos

💡 **Dicas:**
- Use canudo para bebidas
- Escove após cada refeição
- Use pasta para dentes sensíveis

📱 Qualquer dúvida, entre em contato!',
 false, 7,
 ARRAY['Alimentos pigmentados por 48h', 'Tabaco por 7 dias', 'Bebidas ácidas'],
 ARRAY['Sensibilidade extrema', 'Manchas brancas nos dentes', 'Dor nas gengivas']),

((SELECT id FROM public.clinics LIMIT 1), 'Extração', 'Cuidados pós-extração',
 'Sua extração foi realizada! Aqui estão os cuidados importantes:

🩸 **Nas primeiras horas:**
- Mantenha a gaze no local por 30-60 minutos
- Não cuspa nem faça bochechos
- Não tome bebidas quentes
- Não fume

❄️ **Para reduzir inchaço:**
- Aplique compressa de gelo no rosto (15 min ligado / 15 min desligado)
- Durma com a cabeça levemente elevada

💊 **Medicação:**
- Tome os medicamentos conforme prescrição
- Antibiótico deve ser completado até o fim

🚫 **NÃO FAÇA (por 72h):**
- Não fume
- Não use canudinho
- Não faça exercícios físicos
- Não consuma álcool
- Não tome líquidos quentes

🍽️ **Alimentação:**
- Alimentos frios/mornos e pastosos
- Evite mastigar do lado da extração

📞 **Entre em contato se:**
- Sangramento não parar após 2h
- Febre acima de 38°C
- Dor que não melhora com medicação
- Inchaço excessivo

🆘 **Emergência:** Ligue para a clínica',
 true, 7,
 ARRAY['Fumar por 72h', 'Usar canudinho por 72h', 'Exercícios físicos por 72h', 'Alimentos quentes por 24h', 'Bochechos por 24h'],
 ARRAY['Sangramento abundante', 'Febre acima de 38°C', 'Dor intensa que não melhora', 'Inchaço excessivo', 'Dificuldade para respirar']),

((SELECT id FROM public.clinics LIMIT 1), 'Canal', 'Cuidados pós-tratamento de canal',
 'Seu tratamento de canal foi realizado! 🦷

⚠️ **Atenção:**
- O dente pode ficar sensível por alguns dias
- É NORMAL desconforto ao morder
- Analgésicos ajudam no conforto

🚫 **Evite:**
- Morder alimentos duros com o dente tratado
- Alimentos muito quentes nas primeiras 24h

💊 **Medicação:**
- Siga a prescrição corretamente
- Complete o antibiótico se prescrito

⏰ **Próximos passos:**
- O dente precisa de restauração definitiva
- Agende sua próxima consulta para proteção do dente

📞 **Contate-nos se:**
- Dor forte ou pulsátil
- Inchaço no rosto
- Febre
- Dificuldade para abrir a boca

💡 **Lembre-se:** O tratamento de canal salva seu dente natural!',
 false, 5,
 ARRAY['Alimentos duros com o dente tratado', 'Ignorar a restauração definitiva'],
 ARRAY['Dor pulsátil intensa', 'Inchaço facial', 'Febre', 'Dificuldade para abrir a boca']);

-- ============================================================================
-- SEED DATA - Default follow-up configs
-- ============================================================================
INSERT INTO public.follow_up_configs (clinic_id, config_type, delay_hours, message_template) VALUES
((SELECT id FROM public.clinics LIMIT 1), 'post_consultation', 2,
 'Olá, {{patient_name}}! 👋

Sua consulta hoje foi registrada com sucesso.

{{procedure_guidelines}}

Como foi sua experiência? De 1 a 5, que nota você daria para o atendimento? 💙

_Esta mensagem é automática. Responda com sua avaliação._');

INSERT INTO public.follow_up_configs (clinic_id, config_type, message_template) VALUES
((SELECT id FROM public.clinics LIMIT 1), 'budget_follow_up',
 'Olá, {{patient_name}}!

Notamos que você ainda não decidiu sobre o orçamento que apresentamos.

💳 Temos opções de parcelamento disponíveis!

Posso ajudar com alguma dúvida? É só responder esta mensagem. 😊');

-- Return reminder configs for procedures
INSERT INTO public.follow_up_configs (clinic_id, config_type, delay_months, procedure_name, message_template) VALUES
((SELECT id FROM public.clinics LIMIT 1), 'return_reminder', 6, 'Limpeza',
 'Olá, {{patient_name}}! 🦷

Já se passaram 6 meses desde sua última limpeza. Está na hora de agendar sua próxima!

A limpeza regular é fundamental para manter sua saúde bucal.

📅 Quer que eu te ajude a agendar? É só me dizer qual dia funciona para você!');

INSERT INTO public.follow_up_configs (clinic_id, config_type, delay_months, procedure_name, message_template) VALUES
((SELECT id FROM public.clinics LIMIT 1), 'return_reminder', 12, 'Clareamento',
 'Olá, {{patient_name}}! ✨

Já faz um ano desde seu clareamento!

Para manter aquele sorriso brilhante, que tal uma avaliação? Às vezes um retoque faz toda a diferença.

📅 Posso ajudar a agendar uma avaliação?');