-- ============================================
-- SYNKROO - Appointment Slot Reservation RPC
-- Fixes race condition in appointment creation
-- Date: 2026-04-12
-- ============================================

CREATE OR REPLACE FUNCTION reserve_appointment_slot(
  p_clinic_id        UUID,
  p_patient_id       UUID,
  p_dentist_id       UUID,
  p_procedure_id     UUID,
  p_scheduled_at     TIMESTAMPTZ,
  p_duration_minutes INTEGER,
  p_notes            TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key        BIGINT;
  v_end_time        TIMESTAMPTZ;
  v_conflict_id     UUID;
  v_appointment_id  UUID;
BEGIN
  -- Derive a deterministic lock key from dentist_id + date.
  -- All slots for the same dentist on the same day share the lock,
  -- allowing parallelism across different days/dentists.
  v_lock_key := (
     (EXTRACT(YEAR  FROM p_scheduled_at)::BIGINT * 10000) +
     (EXTRACT(MONTH FROM p_scheduled_at)::BIGINT * 100) +
      EXTRACT(DAY   FROM p_scheduled_at)
  ) * 100000 + (hashtext(COALESCE(p_dentist_id::TEXT, 'no_dentist')) % 100000)::BIGINT;

  -- Acquire exclusive advisory lock.
  -- Released automatically when transaction commits or rolls back.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Compute end time of requested slot
  v_end_time := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Conflict check: overlapping appointments for the same dentist
  SELECT a.id INTO v_conflict_id
  FROM appointments a
  WHERE a.clinic_id     = p_clinic_id
    AND a.dentist_id    = p_dentist_id
    AND a.status       IN ('scheduled', 'confirmed', 'in_progress')
    AND a.scheduled_at  < v_end_time
    AND a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL > p_scheduled_at
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Horário indisponível. Já existe um agendamento neste horário.'
    );
  END IF;

  -- Insert the appointment
  INSERT INTO appointments (
    clinic_id, patient_id, dentist_id, procedure_id,
    scheduled_at, duration_minutes, status, notes
  )
  VALUES (
    p_clinic_id, p_patient_id, p_dentist_id, p_procedure_id,
    p_scheduled_at, p_duration_minutes, 'scheduled', p_notes
  )
  RETURNING id INTO v_appointment_id;

  -- Return full appointment record
  RETURN jsonb_build_object(
    'success',    true,
    'appointment_id', v_appointment_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION reschedule_appointment_slot(
  p_appointment_id   UUID,
  p_clinic_id        UUID,
  p_dentist_id       UUID,
  p_scheduled_at     TIMESTAMPTZ,
  p_duration_minutes INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_lock_key       BIGINT;
  v_end_time       TIMESTAMPTZ;
  v_conflict_id    UUID;
BEGIN
  -- Same locking scheme: lock by dentist+date
  v_lock_key := (
     (EXTRACT(YEAR  FROM p_scheduled_at)::BIGINT * 10000) +
     (EXTRACT(MONTH FROM p_scheduled_at)::BIGINT * 100) +
      EXTRACT(DAY   FROM p_scheduled_at)
  ) * 100000 + (hashtext(COALESCE(p_dentist_id::TEXT, 'no_dentist')) % 100000)::BIGINT;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  v_end_time := p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Check for conflicts excluding the appointment being rescheduled
  SELECT a.id INTO v_conflict_id
  FROM appointments a
  WHERE a.clinic_id     = p_clinic_id
    AND a.dentist_id    = p_dentist_id
    AND a.id           != p_appointment_id
    AND a.status       IN ('scheduled', 'confirmed', 'in_progress')
    AND a.scheduled_at  < v_end_time
    AND a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL > p_scheduled_at
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error',   'Horário indisponível. Já existe um agendamento neste horário.'
    );
  END IF;

  -- Perform the update
  UPDATE appointments
  SET
    scheduled_at = p_scheduled_at,
    status       = 'scheduled'
  WHERE id = p_appointment_id;

  RETURN jsonb_build_object(
    'success',     true,
    'scheduled_at', p_scheduled_at
  );
END;
$$;

-- Grant execute to authenticated users (RLS still applies to the table itself)
GRANT EXECUTE ON FUNCTION reserve_appointment_slot TO authenticated;
GRANT EXECUTE ON FUNCTION reschedule_appointment_slot TO authenticated;
