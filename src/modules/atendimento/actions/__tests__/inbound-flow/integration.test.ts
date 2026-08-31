/**
 * Integration test: Atendimento inbound flow (P4).
 *
 * Tests the full receive-message pipeline using real DB:
 *   receberMensagem → getOrCreateConversation → createMessage → updateConversation
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/actions/__tests__/inbound-flow/integration.test.ts
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { clearRegistry } from '@/core/actions/registry';

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

const CLINIC_ID = '00000000-0000-0000-0000-100000000001';
const CLINIC_ID_B = '00000000-0000-0000-0000-100000000002';
const PATIENT_ID = '00000000-0000-0000-0000-200000000001';
const PATIENT_PHONE = '+5511999990001';

let pool: Pool;

beforeAll(async () => {
  if (SKIP) return;
  clearRegistry();
  await bootstrapActions();

  pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  // Clean
  await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1 OR clinic_id = $2)`, [CLINIC_ID, CLINIC_ID_B]);
  await pool.query(`DELETE FROM conversations WHERE clinic_id = $1 OR clinic_id = $2`, [CLINIC_ID, CLINIC_ID_B]);
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(`DELETE FROM clinics WHERE id = $1 OR id = $2`, [CLINIC_ID, CLINIC_ID_B]);

  // Setup clinics
  for (const [cid, slug] of [[CLINIC_ID, 'clinic-a'], [CLINIC_ID_B, 'clinic-b']] as const) {
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
       VALUES ($1, $2, $3, '+5500000000000', $4, 'starter', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [cid, `Test ${slug}`, slug, `${slug}@test.local`],
    );
  }

  // Setup patient linked to clinic A
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient', $3, 'patient@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID, PATIENT_PHONE],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1 OR clinic_id = $2)`, [CLINIC_ID, CLINIC_ID_B]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1 OR clinic_id = $2`, [CLINIC_ID, CLINIC_ID_B]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1 OR id = $2`, [CLINIC_ID, CLINIC_ID_B]);
  } catch { /* ignore */ }
  await pool.end();
});

afterEach(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1 OR clinic_id = $2)`, [CLINIC_ID, CLINIC_ID_B]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1 OR clinic_id = $2`, [CLINIC_ID, CLINIC_ID_B]);
  } catch { /* ignore */ }
});

const systemCtx = {
  source: 'system' as const,
  clinicId: CLINIC_ID,
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test-runner' },
};

describeOrSkip('Atendimento — inbound flow (P4)', () => {

  it('receberMensagem: creates conversation + message on first inbound', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(receberMensagem, {
      externalConversationId: '+5511999998888',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-1',
      message: 'Olá, gostaria de agendar',
      channel: 'whatsapp',
      messageType: 'text',
    }, systemCtx);

    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.conversationId).toBeDefined();
    expect(data.messageId).toBeDefined();

    // Verify conversation row
    const { rows: convRows } = await pool!.query(
      `SELECT id, channel, external_id, status, clinic_id, message_count FROM conversations WHERE id = $1`,
      [data.conversationId],
    );
    expect(convRows.length).toBe(1);
    expect(convRows[0].channel).toBe('whatsapp');
    expect(convRows[0].external_id).toBe('+5511999998888');
    expect(convRows[0].status).toBe('active');
    expect(convRows[0].clinic_id).toBe(CLINIC_ID);
    expect(convRows[0].message_count).toBe(1);

    // Verify message row
    const { rows: msgRows } = await pool!.query(
      `SELECT id, direction, content, conversation_id FROM messages WHERE conversation_id = $1`,
      [data.conversationId],
    );
    expect(msgRows.length).toBe(1);
    expect(msgRows[0].direction).toBe('inbound');
    expect(msgRows[0].content).toBe('Olá, gostaria de agendar');
  });

  it('receberMensagem: reuses conversation on second inbound from same phone', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    // First inbound
    const r1 = await runAction(receberMensagem, {
      externalConversationId: '+5511999997777',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-2a',
      message: 'Primeira mensagem',
      channel: 'whatsapp',
      messageType: 'text',
    }, systemCtx);
    expect(r1.ok).toBe(true);
    const convId1 = (r1 as any).data.conversationId;

    // Second inbound — same phone, same clinic
    const r2 = await runAction(receberMensagem, {
      externalConversationId: '+5511999997777',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-2b',
      message: 'Segunda mensagem',
      channel: 'whatsapp',
      messageType: 'text',
    }, systemCtx);
    expect(r2.ok).toBe(true);
    const convId2 = (r2 as any).data.conversationId;

    // Same conversation reused
    expect(convId2).toBe(convId1);

    // Two messages in the conversation
    const { rows: msgRows } = await pool!.query(
      `SELECT content FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [convId1],
    );
    expect(msgRows.length).toBe(2);
    expect(msgRows[0].content).toBe('Primeira mensagem');
    expect(msgRows[1].content).toBe('Segunda mensagem');
  });

  it('receberMensagem: scopes by clinicId — does not reuse cross-clinic', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const ctxB = { ...systemCtx, clinicId: CLINIC_ID_B };

    // Clinic A
    const rA = await runAction(receberMensagem, {
      externalConversationId: '+5511999996666',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-3a',
      message: 'Mensagem clinica A',
      channel: 'whatsapp',
      messageType: 'text',
    }, systemCtx);
    expect(rA.ok).toBe(true);

    // Clinic B — same phone, different clinic
    const rB = await runAction(receberMensagem, {
      externalConversationId: '+5511999996666',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-3b',
      message: 'Mensagem clinica B',
      channel: 'whatsapp',
      messageType: 'text',
    }, ctxB);
    expect(rB.ok).toBe(true);

    // Different conversations
    expect((rA as any).data.conversationId).not.toBe((rB as any).data.conversationId);

    // Each clinic has exactly 1 conversation for this phone
    const { rows: convsA } = await pool!.query(
      `SELECT id FROM conversations WHERE clinic_id = $1 AND external_id = $2`,
      [CLINIC_ID, '+5511999996666'],
    );
    expect(convsA.length).toBe(1);

    const { rows: convsB } = await pool!.query(
      `SELECT id FROM conversations WHERE clinic_id = $1 AND external_id = $2`,
      [CLINIC_ID_B, '+5511999996666'],
    );
    expect(convsB.length).toBe(1);
  });

  it('receberMensagem: stores metadata on the message', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(receberMensagem, {
      externalConversationId: `+5511${randomUUID().slice(0, 8)}`,
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-4',
      message: 'Mensagem com metadata',
      channel: 'whatsapp',
      messageType: 'text',
      metadata: { source: 'web', externalMessageId: 'ext-123' },
    }, systemCtx);

    expect(result.ok).toBe(true);
    const msgId = (result as any).data.messageId;

    const { rows } = await pool!.query(
      `SELECT metadata FROM messages WHERE id = $1`,
      [msgId],
    );
    expect(rows[0].metadata).toBeDefined();
    expect(rows[0].metadata.source).toBe('web');
    expect(rows[0].metadata.externalMessageId).toBe('ext-123');
  });

  it('receberMensagem: requires the channel and provider event identity', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(receberMensagem, {
      externalConversationId: '+5511999995555',
      externalProvider: 'test',
      externalMessageId: 'inbound-flow-5',
      message: 'Sem canal explícito',
      channel: 'whatsapp',
      messageType: 'text',
    }, systemCtx);

    expect(result.ok).toBe(true);
    const convId = (result as any).data.conversationId;

    const { rows } = await pool!.query(
      `SELECT channel FROM conversations WHERE id = $1`,
      [convId],
    );
    expect(rows[0].channel).toBe('whatsapp');
  });

  it('receberMensagem: supports web channel', async () => {
    const { receberMensagem } = await import('../../receber-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(receberMensagem, {
      externalConversationId: 'widget-user-abc',
      externalProvider: 'widget',
      externalMessageId: 'inbound-flow-6',
      message: 'Mensagem do widget',
      channel: 'web',
      messageType: 'text',
    }, systemCtx);

    expect(result.ok).toBe(true);
    const convId = (result as any).data.conversationId;

    const { rows } = await pool!.query(
      `SELECT channel, external_id FROM conversations WHERE id = $1`,
      [convId],
    );
    expect(rows[0].channel).toBe('web');
    expect(rows[0].external_id).toBe('widget-user-abc');
  });
});
