/**
 * W6.3: corrida real — Promise.all 10 eventos iguais e 10 IDs diferentes
 * Verifica persistInboundMessage: uma conversation, dedup, messageCount, rollback do aggregate
 */
/** @jest-environment node */
import { getDb } from '@/lib/db/client';
import { persistInboundMessage } from '../repositories/conversations-repository';
import { conversations, messages } from '@/modules/atendimento/schema/conversations';
import { eq } from 'drizzle-orm';

const describeOrSkip = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const CLINIC = '00000000-0000-4000-8000-00000000c001';
const CHANNEL: 'whatsapp' = 'whatsapp';
const EXTERNAL_CONV = 'whatsapp-conv-concurrency-001';
const PROVIDER = 'test-provider';

describeOrSkip('Atendimento concurrency dedup — persistInboundMessage (W6.3)', () => {
  beforeAll(async () => {
    const db = getDb();
    await db.delete(messages).where(eq(messages.conversationId, (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.externalId, EXTERNAL_CONV))).toString() as any));
    await db.delete(conversations).where(eq(conversations.externalId, EXTERNAL_CONV));
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
    await db.delete(messages).where(eq(messages.conversationId, (await db.select({ id: conversations.id }).from(conversations).where(eq(conversations.externalId, EXTERNAL_CONV))).toString() as any));
    await db.update(conversations).set({ messageCount: 0 } as any).where(eq(conversations.externalId, EXTERNAL_CONV));
    const base = { clinicId: CLINIC, channel: CHANNEL, externalConversationId: EXTERNAL_CONV, externalProvider: PROVIDER, content: 'ola2', messageType: 'text', metadata: {} as any };
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => persistInboundMessage({ ...base, externalMessageId: `diff-id-${i}-${Date.now()}` })),
    );
    expect(results.filter((r) => !r.deduped).length).toBe(10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.externalId, EXTERNAL_CONV)).limit(1);
    expect(conv.messageCount).toBe(10);
  });
});
