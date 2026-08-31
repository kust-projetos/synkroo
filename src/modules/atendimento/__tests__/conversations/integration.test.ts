/**
 * Integration test: Atendimento conversation actions.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento
 *
 * Guard: skips all hooks/tests when RUN_INTEGRATION_TESTS is not set.
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { clearRegistry } from '@/core/actions/registry';
import { getDb } from '@/lib/db/client';
import { clinics, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

const CLINIC_ID = '00000000-0000-0000-0000-00000000a001';
const PATIENT_ID = '00000000-0000-0000-0000-00000000a002';
const PHONE = '+5511999990001';
const EXTERNAL_ID = PHONE;

let pool: Pool;

beforeAll(async () => {
  if (SKIP) return;
  clearRegistry();
  await bootstrapActions();

  pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
  await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
  await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);

  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic E01', 'test-clinic-e01', '+5500000000000', 'e01@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );
  await pool.query(
    `INSERT INTO patients (id, clinic_id, name, phone, email)
     VALUES ($1, $2, 'Test Patient E01', $3, 'patient-e01@test.local')
     ON CONFLICT (id) DO NOTHING`,
    [PATIENT_ID, CLINIC_ID, PHONE],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM patients WHERE id = $1`, [PATIENT_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
  await pool.end();
});

afterEach(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
});

const ctx = {
  source: 'system' as const,
  clinicId: CLINIC_ID,
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test-runner' },
};

describeOrSkip('Atendimento — repository (P1 — real queries, no legacy)', () => {

  it('createConversation: stores a new conversation row', async () => {
    const repo = await import('../../repositories/conversations-repository');
    const result = await repo.createConversation({
      clinicId: CLINIC_ID,
      channel: 'whatsapp',
      externalId: '+5511999997777',
      status: 'active',
    });
    expect(result.id).toBeDefined();

    const { rows } = await pool!.query(`SELECT id, channel, external_id, status FROM conversations WHERE id = $1`, [result.id]);
    expect(rows.length).toBe(1);
    expect(rows[0].channel).toBe('whatsapp');
    expect(rows[0].status).toBe('active');
  });

  it('createMessage: stores a message and returns MessageRow', async () => {
    // Create conversation first
    const { rows: convRows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [CLINIC_ID, '+5511999996666'],
    );
    const convId = convRows[0].id;

    const repo = await import('../../repositories/conversations-repository');
    const msg = await repo.createMessage({
      conversationId: convId,
      direction: 'inbound',
      content: 'Test message',
      messageType: 'text',
      isAi: false,
    });
    expect(msg.id).toBeDefined();
    expect(msg.direction).toBe('inbound');
    expect(msg.content).toBe('Test message');

    const { rows: msgRows } = await pool!.query(`SELECT content, direction FROM messages WHERE id = $1`, [msg.id]);
    expect(msgRows.length).toBe(1);
  });

  it('appendInboundMessage: convenience wrapper works', async () => {
    const { rows: convRows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [CLINIC_ID, '+5511999995555'],
    );
    const convId = convRows[0].id;

    const repo = await import('../../repositories/conversations-repository');
    const msg = await repo.appendInboundMessage(CLINIC_ID, {
      conversationId: convId,
      content: 'Inbound test',
      metadata: { source: 'test' },
    });
    expect(msg.direction).toBe('inbound');
    expect((msg.metadata as any).source).toBe('test');
  });

  it('countByClinic: returns real count of conversations', async () => {
    // Clean first
    await pool!.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool!.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);

    await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', 'ext1', 'active')`,
      [CLINIC_ID],
    );
    await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'instagram', 'ext2', 'active')`,
      [CLINIC_ID],
    );

    const repo = await import('../../repositories/conversations-repository');
    const total = await repo.countByClinic(CLINIC_ID);
    expect(total).toBe(2);

    const whatsapp = await repo.countByClinic(CLINIC_ID, { channel: 'whatsapp' });
    expect(whatsapp).toBe(1);
  });

  it('getOrCreateConversation: creates if not exists, returns existing if does', async () => {
    const repo = await import('../../repositories/conversations-repository');

    // First call: creates
    const id1 = await repo.getOrCreateConversation(CLINIC_ID, 'whatsapp', '+5511999994444');
    expect(id1).toBeDefined();

    // Second call: returns same
    const id2 = await repo.getOrCreateConversation(CLINIC_ID, 'whatsapp', '+5511999994444');
    expect(id2).toBe(id1);
  });

  it('findById: returns conversation with correct fields', async () => {
    const repo = await import('../../repositories/conversations-repository');
    const id = await repo.getOrCreateConversation(CLINIC_ID, 'web', 'web_ext_test');

    const conv = await repo.findByIdForClinic(id, CLINIC_ID);
    expect(conv).not.toBeNull();
    expect(conv!.clinicId).toBe(CLINIC_ID);
    expect(conv!.channel).toBe('web');
    expect(conv!.externalId).toBe('web_ext_test');
  });

  it('updateConversation: updates timestamp and increments count', async () => {
    const repo = await import('../../repositories/conversations-repository');
    const id = await repo.getOrCreateConversation(CLINIC_ID, 'whatsapp', '+5511999993333');

    await repo.updateConversation(CLINIC_ID, id, {
      lastMessageAt: new Date(),
      messageCountIncrement: 1,
    });

    const { rows } = await pool!.query(`SELECT last_message_at, message_count FROM conversations WHERE id = $1`, [id]);
    expect(rows[0].last_message_at).not.toBeNull();
    expect(rows[0].message_count).toBe(1);
  });

  it('findMessagesByConversation: returns messages ordered by createdAt', async () => {
    const repo = await import('../../repositories/conversations-repository');
    const id = await repo.getOrCreateConversation(CLINIC_ID, 'whatsapp', '+5511999992222');

    await repo.createMessage({ conversationId: id, direction: 'inbound', content: 'First', isAi: false });
    await repo.createMessage({ conversationId: id, direction: 'outbound', content: 'Second', isAi: false });

    const msgs = await repo.findMessagesByConversation(CLINIC_ID, id);
    expect(msgs.length).toBe(2);
    expect(msgs[0].content).toBe('First');
    expect(msgs[1].content).toBe('Second');
  });

  it('appendInboundMessage + updateConversationTimestamp: webhook flow', async () => {
    const repo = await import('../../repositories/conversations-repository');
    const conv = await repo.findOrCreateConversation(CLINIC_ID, 'whatsapp', '+5511999991111');
    expect(conv).not.toBeNull();

    const msg = await repo.appendInboundMessage(CLINIC_ID, {
      conversationId: conv!.id,
      content: 'Webhook test',
      metadata: { externalMessageId: 'ext-123' },
    });
    expect(msg.id).toBeDefined();

    await repo.updateConversationTimestamp(CLINIC_ID, conv!.id, new Date());

    const { rows } = await pool!.query(`SELECT last_message_at FROM conversations WHERE id = $1`, [conv!.id]);
    expect(rows[0].last_message_at).not.toBeNull();
  });

  it('does not import legacy @/repositories/conversations', async () => {
    // Static verification: the repo file should not contain the legacy import
    const fs = await import('fs');
    const content = fs.readFileSync(
      require.resolve('../../repositories/conversations-repository'),
      'utf-8',
    );
    expect(content).not.toContain("from '@/repositories/conversations'");
    expect(content).not.toContain('from "@/repositories/conversations"');
  });
});

describeOrSkip('Atendimento — conversation actions (F3)', () => {
  it('iniciarConversa: should create a conversation and return id', async () => {
    const { iniciarConversa } = await import('../../actions/iniciar-conversa');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(iniciarConversa, { channel: 'whatsapp', externalId: EXTERNAL_ID, patientId: PATIENT_ID }, ctx);
    if (!result.ok) throw new Error(`iniciarConversa failed: ${result.error.code} — ${result.error.message}`);
    expect(result.ok).toBe(true);
    const { id } = (result as any).data;
    expect(id).toBeDefined();

    const { rows } = await pool!.query(`SELECT id, channel, status FROM conversations WHERE id = $1`, [id]);
    expect(rows.length).toBe(1);
    expect(rows[0].channel).toBe('whatsapp');
    expect(rows[0].status).toBe('active');
  });

  it('listarConversas: should return created conversations', async () => {
    // Create a conversation first
    await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', $2, 'active')`,
      [CLINIC_ID, EXTERNAL_ID],
    );
    const { listarConversas } = await import('../../actions/listar-conversas');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(listarConversas, {}, ctx);
    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.conversations.length).toBeGreaterThanOrEqual(1);
    expect(data.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('obterConversa: should return conversation with messages', async () => {
    const { rows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
      [CLINIC_ID, EXTERNAL_ID + '_get'],
    );
    const convId = rows[0].id;
    await pool!.query(
      `INSERT INTO messages (conversation_id, direction, content, message_type) VALUES ($1, 'inbound', 'Olá', 'text')`,
      [convId],
    );

    const { obterConversa } = await import('../../actions/obter-conversa');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(obterConversa, { id: convId }, ctx);
    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.conversation).toBeDefined();
    expect(data.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('arquivarConversa: should set status to archived', async () => {
    const { rows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'instagram', $2, 'active') RETURNING id`,
      [CLINIC_ID, 'ig_' + EXTERNAL_ID],
    );
    const convId = rows[0].id;

    const { arquivarConversa } = await import('../../actions/arquivar-conversa');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(arquivarConversa, { id: convId }, ctx);
    if (!result.ok) {
      process.stderr.write(`arquivar failed: ${JSON.stringify(result.error)}\n`);
    }
    expect(result.ok).toBe(true);

    const { rows: updated } = await pool!.query(`SELECT status FROM conversations WHERE id = $1`, [convId]);
    expect(updated[0].status).toBe('closed');
  });

  it('escalarConversa: should set status to escalated', async () => {
    const { rows } = await pool!.query(
      `INSERT INTO conversations (clinic_id, channel, external_id, status) VALUES ($1, 'web', $2, 'active') RETURNING id`,
      [CLINIC_ID, 'web_' + EXTERNAL_ID],
    );
    const convId = rows[0].id;

    const { escalarConversa } = await import('../../actions/escalar-conversa');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(escalarConversa, { id: convId, reason: 'urgent' }, ctx);
    expect(result.ok).toBe(true);
    const { rows: updated } = await pool!.query(`SELECT status FROM conversations WHERE id = $1`, [convId]);
    expect(updated[0].status).toBe('escalated');
  });

  it('action names registered correctly', async () => {
    const { getAction } = await import('@/core/actions/registry');
    expect(getAction('atendimento.iniciarConversa')).toBeDefined();
    expect(getAction('atendimento.listarConversas')).toBeDefined();
    expect(getAction('atendimento.obterConversa')).toBeDefined();
    expect(getAction('atendimento.arquivarConversa')).toBeDefined();
    expect(getAction('atendimento.escalarConversa')).toBeDefined();
    expect(getAction('atendimento.receberMensagem')).toBeDefined();
    expect(getAction('atendimento.enviarMensagem')).toBeDefined();
  });

  it('classificarIntencao: heuristic returns intent', async () => {
    const { classificarIntencao } = await import('../../actions/classificar-intencao');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(classificarIntencao, { message: 'Quero agendar uma consulta' }, ctx);
    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.intent).toBe('agendamento');
    expect(data.confidence).toBeGreaterThan(0);
  });

  it('receberMensagem: creates conversation + message via real repository', async () => {
    const { receberMensagem } = await import('../../actions/receber-mensagem');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(receberMensagem, {
      externalConversationId: '+5511999998888',
      externalProvider: 'test',
      externalMessageId: 'conversation-inbound-1',
      message: 'Olá, preciso agendar',
      channel: 'whatsapp',
      messageType: 'text',
    }, ctx);
    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.conversationId).toBeDefined();
    expect(data.messageId).toBeDefined();

    // Verify via raw SQL
    const { rows: convRows } = await pool!.query(`SELECT id, channel, status FROM conversations WHERE id = $1`, [data.conversationId]);
    expect(convRows.length).toBe(1);
    expect(convRows[0].status).toBe('active');

    const { rows: msgRows } = await pool!.query(`SELECT id, content, direction FROM messages WHERE conversation_id = $1`, [data.conversationId]);
    expect(msgRows.length).toBe(1);
    expect(msgRows[0].content).toBe('Olá, preciso agendar');
    expect(msgRows[0].direction).toBe('inbound');
  });

  it('extrairEntidades: heuristic extracts date and time', async () => {
    const { extrairEntidades } = await import('../../actions/extrair-entidades');
    const { runAction } = await import('@/core/actions/run');
    const result = await runAction(extrairEntidades, { message: 'Quero marcar para amanhã às 10h' }, ctx);
    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.entities.data).toBeDefined();
    expect(data.entities.hora).toBe('10:00');
  });
});

describeOrSkip('Evolution tenancy isolation', () => {
  const OTHER_CLINIC_ID = '00000000-0000-0000-0000-00000000a009';
  const ENABLED_INSTANCE = 'evolution-enabled-e01';
  const DISABLED_INSTANCE = 'evolution-disabled-e01';
  const OTHER_INSTANCE = 'evolution-other-e01';

  it('fails closed for unknown and disabled instances and preserves the installation owner', async () => {
    await pool!.query(
      `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
       VALUES ($1, 'Other Clinic E01', 'test-clinic-other-e01', '+5500000000009', 'other-e01@test.local', 'starter', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_CLINIC_ID],
    );
    await pool!.query(
      `INSERT INTO channel_installations (clinic_id, provider, installation_id, secret_hash, enabled)
       VALUES
         ($1, 'evolution', $2, repeat('a', 64), true),
         ($1, 'evolution', $3, repeat('b', 64), false),
         ($4, 'evolution', $5, repeat('c', 64), true)
       ON CONFLICT (installation_id) DO UPDATE SET enabled = EXCLUDED.enabled, clinic_id = EXCLUDED.clinic_id`,
      [CLINIC_ID, ENABLED_INSTANCE, DISABLED_INSTANCE, OTHER_CLINIC_ID, OTHER_INSTANCE],
    );

    const repo = await import('../../repositories/conversations-repository');
    await expect(repo.getClinicByInstance('unknown-e01')).resolves.toBeNull();
    await expect(repo.getClinicByInstance(DISABLED_INSTANCE)).resolves.toBeNull();
    await expect(repo.getClinicByInstance(ENABLED_INSTANCE)).resolves.toBe(CLINIC_ID);
    await expect(repo.getClinicByInstance(OTHER_INSTANCE)).resolves.toBe(OTHER_CLINIC_ID);

    await pool!.query(
      `DELETE FROM channel_installations WHERE installation_id IN ($1, $2, $3)`,
      [ENABLED_INSTANCE, DISABLED_INSTANCE, OTHER_INSTANCE],
    );
    await pool!.query(`DELETE FROM clinics WHERE id = $1`, [OTHER_CLINIC_ID]);
  });
});
