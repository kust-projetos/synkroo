import { config } from 'dotenv';
import { eq, ilike, or } from 'drizzle-orm';
import { getDb, closeDb } from '../src/lib/db/client';
import { clinics, users, userCredentials } from '../src/lib/db/schema';
import { hashPassword } from '../src/lib/auth/password';

config({ path: '.env.local' });
config();

const DEMO_EMAIL = 'admin@clinicademo.com';
const DEMO_PASSWORD = 'demo123';
const DEMO_NAME = 'Admin Demo';

async function findOrCreateDemoClinic() {
  const db = getDb();
  const existing = await db
    .select()
    .from(clinics)
    .where(or(
      eq(clinics.slug, 'clinica-demo'),
      ilike(clinics.email, '%clinicademo.com%'),
      ilike(clinics.name, '%demo%'),
    ))
    .limit(1);

  if (existing[0]) return existing[0];

  const [clinic] = await db.insert(clinics).values({
    name: 'Clínica Demo',
    slug: 'clinica-demo',
    phone: '(11) 99999-0000',
    email: 'contato@clinicademo.com',
    settings: {
      business_hours: {
        monday: { open: '08:00', close: '18:00' },
        tuesday: { open: '08:00', close: '18:00' },
        wednesday: { open: '08:00', close: '18:00' },
        thursday: { open: '08:00', close: '18:00' },
        friday: { open: '08:00', close: '18:00' },
        saturday: { open: '08:00', close: '12:00' },
        sunday: { open: null, close: null },
      },
      ai_settings: {
        auto_response: true,
        escalation_enabled: true,
        business_name: 'Clínica Demo',
      },
    },
  }).returning();

  return clinic;
}

async function upsertDemoUser() {
  const db = getDb();
  const clinic = await findOrCreateDemoClinic();
  const passwordHash = hashPassword(DEMO_PASSWORD);

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);

  const [user] = existing[0]
    ? await db.update(users)
        .set({
          clinicId: clinic.id,
          name: DEMO_NAME,
          role: 'owner',
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing[0].id))
        .returning()
    : await db.insert(users).values({
        clinicId: clinic.id,
        email: DEMO_EMAIL,
        name: DEMO_NAME,
        role: 'owner',
        phone: '(11) 99999-0000',
        isActive: true,
      }).returning();

  const credentials = await db
    .select()
    .from(userCredentials)
    .where(eq(userCredentials.userId, user.id))
    .limit(1);

  if (credentials[0]) {
    await db.update(userCredentials)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(userCredentials.userId, user.id));
  } else {
    await db.insert(userCredentials).values({ userId: user.id, passwordHash });
  }

  return { clinic, user };
}

upsertDemoUser()
  .then(({ clinic, user }) => {
    console.log(`Demo credentials ready: ${user.email} / ${DEMO_PASSWORD}`);
    console.log(`Clinic: ${clinic.name} (${clinic.id})`);
  })
  .finally(() => closeDb());
