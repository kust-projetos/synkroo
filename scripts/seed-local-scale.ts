import { createHash } from 'node:crypto';

export type SeedOptions = { preset: 'small' | 'large'; seed: number; apply: boolean };
type Patient = { id: string; name: string; phone: string };
type Appointment = { id: string; patientId: string; scheduledAt: string };
export type Fixture = { clinic: { slug: 'clinica-demo' }; patients: Patient[]; appointments: Appointment[] };
export type CliDependencies = { persist: (url: string, fixture: Fixture) => Promise<void>; print: (text: string) => void };
export type SeedStore = { transaction<T>(callback: (store: SeedStore) => Promise<T>): Promise<T>; resolveClinicId(slug: 'clinica-demo'): Promise<string>; assertOwnership(clinicId: string, ids: string[]): Promise<void>; deleteAppointments(clinicId: string, ids: string[]): Promise<void>; deletePatients(clinicId: string, ids: string[]): Promise<void>; upsertPatients(clinicId: string, rows: Patient[]): Promise<void>; upsertAppointments(clinicId: string, rows: Appointment[]): Promise<void> };

const PRESETS = { small: [20, 40], large: [200, 400] } as const;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function parseOptions(argv: string[]): SeedOptions {
  const seen = new Set<string>();
  let preset: SeedOptions['preset'] = 'small';
  let seed = 1337;
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
    if (flag === '--apply') { seen.add(flag); apply = true; continue; }
    if (flag === '--preset' && ['small', 'large'].includes(argv[index + 1])) { seen.add(flag); preset = argv[++index] as SeedOptions['preset']; continue; }
    if (flag === '--seed' && /^-?\d+$/.test(argv[index + 1] ?? '')) { seen.add(flag); seed = Number(argv[++index]); continue; }
    throw new Error(`Invalid argument: ${flag}`);
  }
  return { preset, seed, apply };
}

export function validateScaleDatabaseUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Scale seed requires loopback PostgreSQL database synkroo'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !LOOPBACK_HOSTS.has(url.hostname) || url.pathname !== '/synkroo') throw new Error('Scale seed requires loopback PostgreSQL database synkroo');
  return value;
}

function uuid(key: string): string {
  const hex = createHash('sha256').update(`synkroo-scale:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildFixture(options: SeedOptions): Fixture {
  const [patientCount, appointmentCount] = PRESETS[options.preset];
  const seed = String(Math.abs(options.seed) % 10_000).padStart(4, '0');
  const patients = Array.from({ length: patientCount }, (_, index) => ({ id: uuid(`patient-${index + 1}`), name: `Demo Patient ${index + 1}`, phone: `11${seed}${String(index + 1).padStart(5, '0')}` }));
  const appointments = Array.from({ length: appointmentCount }, (_, index) => ({ id: uuid(`appointment-${index + 1}`), patientId: patients[index % patients.length].id, scheduledAt: new Date(Date.UTC(2025, 0, 1, 8 + (index % 8))).toISOString() }));
  return { clinic: { slug: 'clinica-demo' }, patients, appointments };
}

export async function persistFixture(store: SeedStore, fixture: Fixture): Promise<void> {
  await store.transaction(async (transaction) => {
    const clinicId = await transaction.resolveClinicId('clinica-demo');
    const large = buildFixture({ preset: 'large', seed: 1337, apply: true });
    const activePatients = new Set(fixture.patients.map(({ id }) => id));
    const activeAppointments = new Set(fixture.appointments.map(({ id }) => id));
    const staleAppointments = large.appointments.filter(({ id }) => !activeAppointments.has(id)).map(({ id }) => id);
    const stalePatients = large.patients.filter(({ id }) => !activePatients.has(id)).map(({ id }) => id);
    await transaction.assertOwnership(clinicId, [...fixture.patients.map(({ id }) => id), ...fixture.appointments.map(({ id }) => id)]);
    await transaction.deleteAppointments(clinicId, staleAppointments);
    await transaction.deletePatients(clinicId, stalePatients);
    await transaction.upsertPatients(clinicId, fixture.patients);
    await transaction.upsertAppointments(clinicId, fixture.appointments);
  });
}

export async function runCli(deps: CliDependencies, argv: string[], env: Record<string, string | undefined>): Promise<void> {
  const options = parseOptions(argv);
  const fixture = buildFixture(options);
  deps.print(JSON.stringify({ preset: options.preset, patients: fixture.patients.length, appointments: fixture.appointments.length, apply: options.apply }));
  if (options.apply) await deps.persist(validateScaleDatabaseUrl(env.DATABASE_URL ?? ''), fixture);
}
