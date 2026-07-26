import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { buildFixture, type Fixture, runCli } from './seed-local-scale';

async function persist(url: string, fixture: Fixture): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query('BEGIN');
    const clinic = await client.query<{ id: string }>(
      `INSERT INTO clinics (name, slug, phone, email)
       VALUES ($1, 'clinica-demo', $2, $3)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Clínica Demo', '+551100000000', 'demo@synkroo.local'],
    );
    const clinicId = clinic.rows[0].id;
    const full = buildFixture({ preset: 'large', seed: 1337, apply: true });
    const activePatientIds = new Set(fixture.patients.map(({ id }) => id));
    const activeAppointmentIds = new Set(fixture.appointments.map(({ id }) => id));
    const staleAppointments = full.appointments.filter(({ id }) => !activeAppointmentIds.has(id)).map(({ id }) => id);
    const stalePatients = full.patients.filter(({ id }) => !activePatientIds.has(id)).map(({ id }) => id);
    if (staleAppointments.length) await client.query('DELETE FROM appointments WHERE clinic_id = $1 AND id = ANY($2::uuid[])', [clinicId, staleAppointments]);
    if (stalePatients.length) await client.query('DELETE FROM patients WHERE clinic_id = $1 AND id = ANY($2::uuid[])', [clinicId, stalePatients]);
    for (const patient of fixture.patients) {
      await client.query(
        `INSERT INTO patients (id, clinic_id, name, phone) VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone
         WHERE patients.clinic_id = EXCLUDED.clinic_id`,
        [patient.id, clinicId, patient.name, patient.phone],
      );
    }
    for (const appointment of fixture.appointments) {
      await client.query(
        `INSERT INTO appointments (id, clinic_id, patient_id, scheduled_at, status) VALUES ($1, $2, $3, $4, 'scheduled')
         ON CONFLICT (id) DO UPDATE SET patient_id = EXCLUDED.patient_id, scheduled_at = EXCLUDED.scheduled_at, status = EXCLUDED.status
         WHERE appointments.clinic_id = EXCLUDED.clinic_id`,
        [appointment.id, clinicId, appointment.patientId, appointment.scheduledAt],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { await client.end(); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void runCli({ persist, print: console.log }, process.argv.slice(2), process.env).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
