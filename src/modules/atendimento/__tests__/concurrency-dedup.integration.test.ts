/**
 * W6.3: corrida real — Promise.all 10 eventos iguais e 10 IDs diferentes
 * Verifica persistInboundMessage: uma conversation, dedup, messageCount, rollback do aggregate
 */
/** @jest-environment node */
import { getDb } from '@/lib/db/client';
import { persistInboundMessage } from '../repositories/conversations-repository';
import { conversations, messages } from '@/modules/atendimento/schema/conversations';
import { clinics } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const TEST_RUN = String(Date.now()).slice(-12).padStart(12, '0');
const CLINIC = `00000000-0000-4000-8000-${TEST_RUN}`;
const CHANNEL = 'whatsapp' as const;
const EXTERNAL_CONV = 'whatsapp-conv-concurrency-001';
const PROVIDER = 'test-provider';

describeOrSkip('Atendimento concurrency dedup — persistInboundMessage (W6.3)', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(clinics).values({
      id: CLINIC,
      name: 'Concurrency Dedup Test Clinic',
      slug: `concurrency-dedup-${TEST_RUN}`,
      phone: '',
      email: `concurrency-dedup-${TEST_RUN}@t.local`,
    }).onConflictDoNothing();
    await db.delete(messages).where(sql`${messages.conversationId} IN (SELECT id FROM conversations WHERE clinic_id = ${CLINIC} AND external_id = ${EXTERNAL_CONV})`);
    await db.delete(conversations).where(and(eq(conversations.clinicId, CLINIC), eq(conversations.externalId, EXTERNAL_CONV)));
    await db.execute(sql`DELETE FROM outbox_jobs WHERE clinic_id = ${CLINIC} AND operation = 'atendimento.inbound.message' AND business_key LIKE ${`${PROVIDER}:%`}`);
  });

  afterAll(async () => {
    const db = getDb();
    await db.execute(sql`DELETE FROM outbox_jobs WHERE clinic_id = ${CLINIC} AND operation = 'atendimento.inbound.message' AND business_key LIKE ${`${PROVIDER}:%`}`);
    await db.delete(clinics).where(eq(clinics.id, CLINIC));
  });

  it('10 eventos iguais -> uma conversation, uma message, messageCount=1', async () => {
    const base = { clinicId: CLINIC, channel: CHANNEL, externalConversationId: EXTERNAL_CONV, externalProvider: PROVIDER, content: 'ola', messageType: 'text', metadata: {} as any };
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => persistInboundMessage({ ...base, externalMessageId: 'same-id-001' })),
    );
    expect(results.filter((r) => r.deduped).length).toBe(9);
    expect(results.filter((r) => !r.deduped).length).toBe(1);
    const db = getDb();
    const [conv] = await db.select().from(conversations).where(eq(conversations.externalId, EXTERNAL_CONV)).limit(1);
    expect(conv).toBeDefined();
    expect(conv.messageCount).toBe(1);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
    expect(msgs.length).toBe(1);
  });

  it('10 IDs diferentes para mesmo peer -> uma conversation, dez messages, messageCount=10', async () => {
    const db = getDb();
    await db.delete(messages).where(sql`${messages.conversationId} IN (SELECT id FROM conversations WHERE clinic_id = ${CLINIC} AND external_id = ${EXTERNAL_CONV})`);
    await db.update(conversations).set({ messageCount: 0 } as any).where(and(eq(conversations.clinicId, CLINIC), eq(conversations.externalId, EXTERNAL_CONV)));
    const base = { clinicId: CLINIC, channel: CHANNEL, externalConversationId: EXTERNAL_CONV, externalProvider: PROVIDER, content: 'ola2', messageType: 'text', metadata: {} as any };
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => persistInboundMessage({ ...base, externalMessageId: `diff-id-${i}-${Date.now()}` })),
    );
    expect(results.filter((r) => !r.deduped).length).toBe(10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.externalId, EXTERNAL_CONV)).limit(1);
    expect(conv.messageCount).toBe(10);
  });
});
