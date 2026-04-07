-- ============================================
-- SQL Functions for Synkroo
-- ============================================

-- Get available time slots for a dentist
CREATE OR REPLACE FUNCTION get_availability(
    p_clinic_id UUID,
    p_dentist_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (start_time TIME, end_time TIME) AS $$
DECLARE
    v_day_of_week INTEGER;
    v_working_hours JSONB;
    v_start_time TIME;
    v_end_time TIME;
    v_current_time TIME;
    v_end_time_slot TIME;
BEGIN
    -- Get day of week (0 = Sunday, 1 = Monday, etc.)
    v_day_of_week := EXTRACT(DOW FROM p_date);

    -- Get dentist working hours for this day
    SELECT working_hours->v_day_of_week::TEXT INTO v_working_hours
    FROM dentists
    WHERE id = p_dentist_id AND clinic_id = p_clinic_id;

    IF v_working_hours IS NULL THEN
        RETURN;
    END IF;

    v_start_time := (v_working_hours->>'start')::TIME;
    v_end_time := (v_working_hours->>'end')::TIME;

    -- Get existing appointments for this day
    CREATE TEMP TABLE existing_appointments AS
    SELECT scheduled_at, duration_minutes
    FROM appointments
    WHERE dentist_id = p_dentist_id
    AND DATE(scheduled_at) = p_date
    AND status NOT IN ('cancelled', 'no_show');

    -- Generate available slots
    v_current_time := v_start_time;

    WHILE v_current_time + (p_duration_minutes || ' minutes')::INTERVAL <= v_end_time LOOP
        v_end_time_slot := v_current_time + (p_duration_minutes || ' minutes')::INTERVAL;

        -- Check if slot overlaps with existing appointments
        IF NOT EXISTS (
            SELECT 1 FROM existing_appointments
            WHERE (scheduled_at::TIME < v_end_time_slot)
            AND ((scheduled_at + (duration_minutes || ' minutes')::INTERVAL)::TIME > v_current_time)
        ) THEN
            RETURN QUERY SELECT v_current_time, v_end_time_slot;
        END IF;

        v_current_time := v_current_time + '30 minutes'::INTERVAL;
    END LOOP;

    DROP TABLE existing_appointments;
END;
$$ LANGUAGE plpgsql;

-- Create or get conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_clinic_id UUID,
    p_channel TEXT,
    p_external_id TEXT,
    p_patient_phone TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_patient_id UUID;
BEGIN
    -- Try to get existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE clinic_id = p_clinic_id
    AND channel = p_channel::channel_type
    AND external_id = p_external_id;

    IF v_conversation_id IS NOT NULL THEN
        RETURN v_conversation_id;
    END IF;

    -- Try to find patient by phone
    IF p_patient_phone IS NOT NULL THEN
        SELECT id INTO v_patient_id
        FROM patients
        WHERE clinic_id = p_clinic_id
        AND phone = p_patient_phone;
    END IF;

    -- Create new conversation
    INSERT INTO conversations (
        clinic_id,
        channel,
        external_id,
        patient_id,
        status
    ) VALUES (
        p_clinic_id,
        p_channel::channel_type,
        p_external_id,
        v_patient_id,
        'active'
    ) RETURNING id INTO v_conversation_id;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql;

-- Get conversation context for AI
CREATE OR REPLACE FUNCTION get_conversation_context(
    p_conversation_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    role TEXT,
    content TEXT,
    intent TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE WHEN direction = 'inbound' THEN 'user' ELSE 'assistant' END,
        content,
        intent,
        created_at
    FROM messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update patient last visit
CREATE OR REPLACE FUNCTION update_patient_last_visit()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' THEN
        UPDATE patients
        SET last_visit_at = NEW.scheduled_at
        WHERE id = NEW.patient_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_last_visit
    AFTER UPDATE OF status ON appointments
    FOR EACH ROW
    WHEN (NEW.status = 'completed')
    EXECUTE FUNCTION update_patient_last_visit();

-- Get patient insights
CREATE OR REPLACE FUNCTION get_patient_insights(
    p_patient_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_appointments', (
            SELECT COUNT(*) FROM appointments WHERE patient_id = p_patient_id
        ),
        'completed_appointments', (
            SELECT COUNT(*) FROM appointments WHERE patient_id = p_patient_id AND status = 'completed'
        ),
        'no_shows', (
            SELECT COUNT(*) FROM appointments WHERE patient_id = p_patient_id AND status = 'no_show'
        ),
        'cancellations', (
            SELECT COUNT(*) FROM appointments WHERE patient_id = p_patient_id AND status = 'cancelled'
        ),
        'last_visit', (
            SELECT MAX(scheduled_at) FROM appointments WHERE patient_id = p_patient_id AND status = 'completed'
        ),
        'risk_score', (
            SELECT risk_score FROM patients WHERE id = p_patient_id
        ),
        'most_common_procedure', (
            SELECT pr.name
            FROM appointments a
            JOIN procedures pr ON a.procedure_id = pr.id
            WHERE a.patient_id = p_patient_id AND a.status = 'completed'
            GROUP BY pr.name
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;