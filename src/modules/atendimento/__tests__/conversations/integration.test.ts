/**
 * Integration test: Atendimento conversation actions.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento
 *
 * Guard: skips all hooks/tests when RUN_INTEGRATION_TESTS is not set.
 */

/** @jest-environment node */

process.env.DATABASE_URL = 'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

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
