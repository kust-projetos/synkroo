-- ============================================
-- SYNKROO - Supabase Schema
-- Version: 1.0.0
-- Date: 2026-03-27
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('owner', 'admin', 'dentist', 'receptionist');
CREATE TYPE channel_type AS ENUM ('whatsapp', 'instagram', 'web', 'telegram');
CREATE TYPE conversation_status AS ENUM ('active', 'waiting', 'closed', 'escalated');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_type AS ENUM ('text', 'image', 'audio', 'document', 'video');
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

-- ============================================
-- TABLES
-- ============================================

-- CLINICS (Multi-tenant root)
CREATE TABLE clinics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    address JSONB DEFAULT '{}',
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'starter',
    subscription_status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- USERS (Clinic staff)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'receptionist',
    phone VARCHAR(20),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(clinic_id, email)
);

-- PATIENTS
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    cpf VARCHAR(14),
    birth_date DATE,
    gender VARCHAR(20),
    address JSONB DEFAULT '{}',
    notes TEXT,
    tags TEXT[] DEFAULT '{}',
    risk_score DECIMAL(3,2) DEFAULT 0.00,
    last_visit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    UNIQUE(clinic_id, phone)
);

-- DENTISTS
CREATE TABLE dentists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    cro VARCHAR(50),
    specialty VARCHAR(100),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    working_hours JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- PROCEDURES
CREATE TABLE procedures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_minutes INTEGER DEFAULT 30,
    price DECIMAL(10,2),
    category VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- CONVERSATIONS
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
    channel channel_type NOT NULL,
    external_id VARCHAR(255) NOT NULL,
    status conversation_status NOT NULL DEFAULT 'active',
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    message_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGES
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    direction message_direction NOT NULL,
    content TEXT NOT NULL,
    message_type message_type NOT NULL DEFAULT 'text',
    media_url TEXT,
    metadata JSONB DEFAULT '{}',
    intent VARCHAR(50),
    entities JSONB DEFAULT '{}',
    confidence DECIMAL(3,2),
    is_ai BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APPOINTMENTS
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dentist_id UUID REFERENCES dentists(id) ON DELETE SET NULL,
    procedure_id UUID REFERENCES procedures(id) ON DELETE SET NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    status appointment_status NOT NULL DEFAULT 'scheduled',
    notes TEXT,
    confirmation_sent_at TIMESTAMPTZ,
    reminder_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- SCHEDULE BLOCKS (Availability)
CREATE TABLE schedule_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    dentist_id UUID REFERENCES dentists(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FOLLOW UPS
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'pending',
    content TEXT,
    response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- KNOWLEDGE BASE
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- WHATSAPP INSTANCES
CREATE TABLE whatsapp_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    phone_number_id VARCHAR(100) NOT NULL,
    business_account_id VARCHAR(100),
    display_name VARCHAR(255),
    quality_rating VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    last_connected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- MESSAGE TEMPLATES
CREATE TABLE message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    meta_template_id VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PATIENT RISK SCORES (Historical)
CREATE TABLE patient_risk_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    score DECIMAL(3,2) NOT NULL,
    factors JSONB DEFAULT '{}',
    calculated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- WAITLIST
CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    dentist_id UUID REFERENCES dentists(id) ON DELETE SET NULL,
    preferred_date DATE,
    preferred_time_start TIME,
    preferred_time_end TIME,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'waiting',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Clinics
CREATE INDEX idx_clinics_slug ON clinics(slug);
CREATE INDEX idx_clinics_subscription ON clinics(subscription_status);

-- Users
CREATE INDEX idx_users_clinic ON users(clinic_id);
CREATE INDEX idx_users_email ON users(email);

-- Patients
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_tags ON patients USING GIN(tags);

-- Conversations
CREATE INDEX idx_conversations_clinic ON conversations(clinic_id);
CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_external ON conversations(external_id);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_messages_intent ON messages(intent);

-- Appointments
CREATE INDEX idx_appointments_clinic ON appointments(clinic_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_dentist ON appointments(dentist_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- Follow Ups
CREATE INDEX idx_follow_ups_clinic ON follow_ups(clinic_id);
CREATE INDEX idx_follow_ups_scheduled ON follow_ups(scheduled_at);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);

-- Audit Logs
CREATE INDEX idx_audit_logs_clinic ON audit_logs(clinic_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE dentists ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clinics
CREATE POLICY "Users can view their own clinic"
    ON clinics FOR SELECT
    USING (id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their own clinic"
    ON clinics FOR UPDATE
    USING (id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for users
CREATE POLICY "Users can view users in their clinic"
    ON users FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can insert users in their clinic"
    ON users FOR INSERT
    WITH CHECK (
        clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin'))
    );

CREATE POLICY "Users can update users in their clinic"
    ON users FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for patients
CREATE POLICY "Users can view patients in their clinic"
    ON patients FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert patients in their clinic"
    ON patients FOR INSERT
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update patients in their clinic"
    ON patients FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for conversations
CREATE POLICY "Users can view conversations in their clinic"
    ON conversations FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert conversations in their clinic"
    ON conversations FOR INSERT
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update conversations in their clinic"
    ON conversations FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- RLS Policies for messages
CREATE POLICY "Users can view messages in their clinic"
    ON messages FOR SELECT
    USING (conversation_id IN (
        SELECT id FROM conversations
        WHERE clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid())
    ));

CREATE POLICY "Service role can insert messages"
    ON messages FOR INSERT
    WITH CHECK (true);

-- RLS Policies for appointments
CREATE POLICY "Users can view appointments in their clinic"
    ON appointments FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert appointments in their clinic"
    ON appointments FOR INSERT
    WITH CHECK (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update appointments in their clinic"
    ON appointments FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM users WHERE id = auth.uid()));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_dentists_updated_at BEFORE UPDATE ON dentists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_procedures_updated_at BEFORE UPDATE ON procedures
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update conversation on new message
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_at = NEW.created_at,
        message_count = message_count + 1
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Calculate patient risk score
CREATE OR REPLACE FUNCTION calculate_patient_risk_score(patient_uuid UUID)
RETURNS DECIMAL AS $$
DECLARE
    v_no_show_count INTEGER;
    v_cancel_count INTEGER;
    v_days_since_last_visit INTEGER;
    v_score DECIMAL(3,2);
BEGIN
    -- Count no-shows in last 12 months
    SELECT COUNT(*) INTO v_no_show_count
    FROM appointments
    WHERE patient_id = patient_uuid
    AND status = 'no_show'
    AND scheduled_at > NOW() - INTERVAL '12 months';

    -- Count cancellations in last 6 months
    SELECT COUNT(*) INTO v_cancel_count
    FROM appointments
    WHERE patient_id = patient_uuid
    AND status = 'cancelled'
    AND scheduled_at > NOW() - INTERVAL '6 months';

    -- Days since last visit
    SELECT EXTRACT(DAY FROM NOW() - MAX(scheduled_at))::INTEGER
    INTO v_days_since_last_visit
    FROM appointments
    WHERE patient_id = patient_uuid
    AND status = 'completed';

    -- Calculate score (0-1, higher = higher risk)
    v_score := LEAST(1.0,
        (v_no_show_count * 0.15) +
        (v_cancel_count * 0.05) +
        (COALESCE(v_days_since_last_visit, 365) / 365.0 * 0.3)
    );

    -- Update patient
    UPDATE patients SET risk_score = v_score WHERE id = patient_uuid;

    RETURN v_score;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEWS
-- ============================================

-- Active conversations view
CREATE VIEW active_conversations AS
SELECT
    c.id,
    c.channel,
    c.status,
    c.last_message_at,
    c.message_count,
    p.name as patient_name,
    p.phone as patient_phone,
    u.name as assigned_to_name,
    clinic.name as clinic_name
FROM conversations c
LEFT JOIN patients p ON c.patient_id = p.id
LEFT JOIN users u ON c.assigned_to = u.id
JOIN clinics clinic ON c.clinic_id = clinic.id
WHERE c.status IN ('active', 'waiting', 'escalated')
ORDER BY c.last_message_at DESC;

-- Upcoming appointments view
CREATE VIEW upcoming_appointments AS
SELECT
    a.id,
    a.scheduled_at,
    a.status,
    a.duration_minutes,
    p.name as patient_name,
    p.phone as patient_phone,
    d.name as dentist_name,
    pr.name as procedure_name,
    clinic.name as clinic_name
FROM appointments a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN dentists d ON a.dentist_id = d.id
LEFT JOIN procedures pr ON a.procedure_id = pr.id
JOIN clinics clinic ON a.clinic_id = clinic.id
WHERE a.scheduled_at > NOW()
AND a.status IN ('scheduled', 'confirmed')
AND a.deleted_at IS NULL
ORDER BY a.scheduled_at ASC;

-- ============================================
-- GRANTS
-- ============================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant select on all tables to authenticated users
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant insert/update/delete on specific tables
GRANT INSERT, UPDATE, DELETE ON patients TO authenticated;
GRANT INSERT, UPDATE, DELETE ON conversations TO authenticated;
GRANT INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT INSERT, UPDATE, DELETE ON appointments TO authenticated;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE clinics IS 'Clínicas odontológicas (multi-tenant root)';
COMMENT ON TABLE users IS 'Funcionários da clínica';
COMMENT ON TABLE patients IS 'Pacientes das clínicas';
COMMENT ON TABLE conversations IS 'Conversas multicanal';
COMMENT ON TABLE messages IS 'Mensagens das conversas';
COMMENT ON TABLE appointments IS 'Agendamentos de consultas';