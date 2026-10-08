/**
 * Integration test: Atendimento send + escalate flow (P4).
 *
 * Tests:
 *   enviarMensagem resolves channel from conversation, delegates to channel-service (WAHA)
 *   enviarMensagem with non-existent conversation → not_found
 *   enviarMensagem failure from WAHA provider → internal
 *   enviarMensagem explicit channel parameter is used instead of conversation channel
 *   enviarMensagem system without approval token → forbidden (transport NOT called)
 *   escalarConversa without permission → forbidden
 *   escalarConversa with permission → success
 *
 * Transport is stubbed at the provider-registry seam (WAHA-first, owner
 * decision 3863c4f): a mock WAHA adapter is registered via
 * `registerWhatsAppProviderAdapter` with `sendTextMessage`; the sidecar
 * fallback is disabled for determinism (env restored afterwards). Facade,
 * idempotency and DB stay real.
 *
 * enviarMensagem is `deny_non_human`, so send scenarios use a human context
 * (`source: 'user'` + valid user). Escalation tests keep the system context.
 *
 * Run: RUN_INTEGRATION_TESTS=1 npm run test:integration -- src/modules/atendimento/actions/__tests__/send/integration.test.ts
 */

/** @jest-environment node */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import { bootstrapActions } from '@/core/actions/bootstrap';
import { clearRegistry } from '@/core/actions/registry';
import {
  registerWhatsAppProviderAdapter,
  resetWhatsAppProviderRegistry,
} from '../../../integrations/whatsapp-provider-registry';

// Transport stub behind the registry seam (WAHA-first). Behavior is set
// per-test; unset default resolves to undefined (falsy → internal).
const mockWahaSendTextMessage = jest.fn();

const SKIP = process.env.RUN_INTEGRATION_TESTS !== '1';
const describeOrSkip = SKIP ? describe.skip : describe;

const CLINIC_ID = '00000000-0000-0000-0000-300000000001';
const CONV_PHONE = '+5511998880001';

let pool: Pool;

// Fallback env saved/restored so the suite never touches the sidecar.
let savedFallbackUrl: string | undefined;
let savedFallbackSecret: string | undefined;

beforeAll(async () => {
  if (SKIP) return;
  // Snapshot defensivo ANTES de qualquer await: se o bootstrap falhar, o
  // afterAll restaura (ou apaga) exatamente o estado original.
  savedFallbackUrl = process.env.WHATSAPP_FALLBACK_URL;
  savedFallbackSecret = process.env.WHATSAPP_FALLBACK_SECRET;
  clearRegistry();
  await bootstrapActions();

  delete process.env.WHATSAPP_FALLBACK_URL;
  delete process.env.WHATSAPP_FALLBACK_SECRET;

  registerWhatsAppProviderAdapter({
    id: 'waha',
    isAvailable: () => true,
    sendTextMessage: mockWahaSendTextMessage,
  } as never);

  pool = new Pool({ connectionString: process.env.DATABASE_URL! });

  await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
  await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
  await pool.query(`DELETE FROM idempotency_keys WHERE key LIKE 'whatsapp:send:${CLINIC_ID}:%'`, []);
  await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);

  await pool.query(
    `INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
     VALUES ($1, 'Test Clinic Send', 'test-clinic-send', '+5500000000009', 'send@test.local', 'starter', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [CLINIC_ID],
  );
}, 60_000);

afterAll(async () => {
  if (SKIP) {
    return;
  }
  resetWhatsAppProviderRegistry();
  if (savedFallbackUrl !== undefined) process.env.WHATSAPP_FALLBACK_URL = savedFallbackUrl;
  else delete process.env.WHATSAPP_FALLBACK_URL;
  if (savedFallbackSecret !== undefined) process.env.WHATSAPP_FALLBACK_SECRET = savedFallbackSecret;
  else delete process.env.WHATSAPP_FALLBACK_SECRET;
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM clinics WHERE id = $1`, [CLINIC_ID]);
  } catch { /* ignore */ }
  await pool.end();
});

afterEach(async () => {
  if (SKIP || !pool) return;
  try {
    await pool.query(`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE clinic_id = $1)`, [CLINIC_ID]);
    await pool.query(`DELETE FROM conversations WHERE clinic_id = $1`, [CLINIC_ID]);
    await pool.query(`DELETE FROM idempotency_keys WHERE key LIKE 'whatsapp:send:${CLINIC_ID}:%'`, []);
  } catch { /* ignore */ }
  mockWahaSendTextMessage.mockReset();
});

// Helper: create a conversation for testing
async function seedConversation(): Promise<string> {
  const { rows } = await pool!.query(
    `INSERT INTO conversations (clinic_id, channel, external_id, status)
     VALUES ($1, 'whatsapp', $2, 'active') RETURNING id`,
    [CLINIC_ID, CONV_PHONE],
  );
  return rows[0].id;
}

const systemCtx = {
  source: 'system' as const,
  clinicId: CLINIC_ID,
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test-runner' },
};

// Human context: enviarMensagem is deny_non_human, so send scenarios run
// as a human principal (no approval token needed for source 'user').
const userCtx = {
  source: 'user' as const,
  clinicId: CLINIC_ID,
  user: { id: '00000000-0000-0000-0000-400000000001', email: 'sender@test.local', name: 'Sender' },
  can: () => true,
  hasModule: () => true,
  audit: { actor: 'test-runner' },
};

// Context WITHOUT escalation permission
const ctxNoEscalate = {
  ...systemCtx,
  can: (perm: string) => perm !== 'atendimento:escalate',
};

describeOrSkip('Atendimento — send flow (P4)', () => {

  // ── enviarMensagem ───────────────────────────────────────────

  it('enviarMensagem: resolves channel from conversation and delegates to WAHA', async () => {
    mockWahaSendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-msg-1' });

    const convId = await seedConversation();
    const { enviarMensagem } = await import('../../enviar-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(enviarMensagem, {
      conversationId: convId,
      message: 'Olá, sua consulta está confirmada!',
    }, userCtx);

    expect(result.ok).toBe(true);
    const data = (result as any).data;
    expect(data.messageId).toBeDefined();

    // WAHA was called with correct phone (claim único vive na facade)
    expect(mockWahaSendTextMessage).toHaveBeenCalledWith(CONV_PHONE, 'Olá, sua consulta está confirmada!');

    // Outbound message persisted
    const { rows: msgRows } = await pool!.query(
      `SELECT direction, content FROM messages WHERE conversation_id = $1`,
      [convId],
    );
    expect(msgRows.length).toBe(1);
    expect(msgRows[0].direction).toBe('outbound');
    expect(msgRows[0].content).toBe('Olá, sua consulta está confirmada!');

    // Idempotency claim recorded (facade claim, REVIEW-A2A3)
    const { rows: keyRows } = await pool!.query(
      `SELECT status FROM idempotency_keys WHERE key LIKE $1`,
      [`whatsapp:send:${CLINIC_ID}:%`],
    );
    expect(keyRows.length).toBe(1);
    expect(keyRows[0].status).toBe('completed');

    // Conversation updated
    const { rows: convRows } = await pool!.query(
      `SELECT last_message_at, message_count FROM conversations WHERE id = $1`,
      [convId],
    );
    expect(convRows[0].last_message_at).not.toBeNull();
    expect(convRows[0].message_count).toBe(1);
  });

  it('enviarMensagem: non-existent conversation returns not_found', async () => {
    const { enviarMensagem } = await import('../../enviar-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const fakeId = randomUUID();
    const result = await runAction(enviarMensagem, {
      conversationId: fakeId,
      message: 'Teste',
    }, userCtx);

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('not_found');
  });

  it('enviarMensagem: WAHA failure returns internal error', async () => {
    mockWahaSendTextMessage.mockResolvedValue({ success: false, error: 'API rate limited' });

    const convId = await seedConversation();
    const { enviarMensagem } = await import('../../enviar-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(enviarMensagem, {
      conversationId: convId,
      message: 'Teste',
    }, userCtx);

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('internal');
    expect((result as any).error.message).toContain('API rate limited');
  });

  it('enviarMensagem: explicit channel parameter is used instead of conversation channel', async () => {
    mockWahaSendTextMessage.mockResolvedValue({ success: true, messageId: 'waha-msg-2' });

    const convId = await seedConversation(); // conversation has channel 'whatsapp'
    const { enviarMensagem } = await import('../../enviar-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(enviarMensagem, {
      conversationId: convId,
      message: 'Mensagem via whatsapp explícito',
      channel: 'whatsapp',
    }, userCtx);

    expect(result.ok).toBe(true);
    expect(mockWahaSendTextMessage).toHaveBeenCalledWith(CONV_PHONE, 'Mensagem via whatsapp explícito');
  });

  it('enviarMensagem: system without approval token returns forbidden and transport is not called', async () => {
    const convId = await seedConversation();
    const { enviarMensagem } = await import('../../enviar-mensagem');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(enviarMensagem, {
      conversationId: convId,
      message: 'Não deve enviar',
    }, systemCtx);

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('forbidden');
    expect(mockWahaSendTextMessage).not.toHaveBeenCalled();

    const { rows: msgRows } = await pool!.query(
      `SELECT id FROM messages WHERE conversation_id = $1`,
      [convId],
    );
    expect(msgRows.length).toBe(0);
  });

  // ── escalarConversa ──────────────────────────────────────────

  it('escalarConversa: with permission, escalates conversation', async () => {
    const convId = await seedConversation();
    const { escalarConversa } = await import('../../escalar-conversa');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(escalarConversa, {
      id: convId,
      reason: 'urgent',
    }, systemCtx);

    expect(result.ok).toBe(true);

    const { rows } = await pool!.query(
      `SELECT status FROM conversations WHERE id = $1`,
      [convId],
    );
    expect(rows[0].status).toBe('escalated');
  });

  it('escalarConversa: without escalation permission returns forbidden', async () => {
    const convId = await seedConversation();
    const { escalarConversa } = await import('../../escalar-conversa');
    const { runAction } = await import('@/core/actions/run');

    const result = await runAction(escalarConversa, {
      id: convId,
      reason: 'urgent',
    }, ctxNoEscalate);

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('forbidden');
  });

  it('escalarConversa: non-existent conversation returns not_found', async () => {
    const { escalarConversa } = await import('../../escalar-conversa');
    const { runAction } = await import('@/core/actions/run');

    const fakeId = randomUUID();
    const result = await runAction(escalarConversa, {
      id: fakeId,
    }, systemCtx);

    expect(result.ok).toBe(false);
    expect((result as any).error.code).toBe('not_found');
  });
});
