/**
 * Integration — segurança de entrega do outbox WhatsApp (E4), contra PostgreSQL real.
 *
 * Cobre o residual de duplicate-send ponta a ponta, com o banco real
 * (`idempotency_keys` + `outbox_jobs`), o claim real de `src/lib/idempotency`
 * e o facade real (`channel-service`). O provider é injetado no seam do
 * registry (`whatsapp-provider-registry`) — nenhuma chamada de rede sai daqui.
 *
 * Cenário: (1) job despachado com sucesso uma única vez sob chave
 * tenant/job-bound; (2) job com entrega NÃO confirmada vai direto para a DLQ
 * (sem consumir retry, sem ser marcado como entregue) e a linha de
 * idempotência permanece terminal `unknown`; (3) replay do mesmo job NÃO
 * despacha de novo ao provider; (4) conflito do claim antes do TTL defere o
 * job sem consumir tentativa — e, expirado o TTL, o mesmo job despacha;
 * (5) liquidação cercada (E4): o hook que marca o lembrete como entregue só
 * roda dentro da transação cujo fence confirmou a posse do lease, e uma falha
 * de ESCRITA do hook desfaz o `delivered` para o job voltar a `processing` e
 * ser reexecutado (o claim dedupa o reenvio ao provider). O hook cerca o
 * lembrete pelo tenant do job: um `reminderId` de outra clínica não atualiza
 * linha nenhuma e a recusa — sendo SEMÂNTICA, não de infra — leva a linha
 * direto para a DLQ com o código fixo `REMINDER_SETTLEMENT_REJECTED` (a
 * entrega ao provider já ocorreu; reexecutar reenviaria).
 *
 * Rodar com o harness canônico (DB isolado `synkroo_test`, defaults locais
 * versionados — nunca `.env` privado):
 *   TEST_DATABASE_URL=postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo_test \
 *     npm run test:integration:run -- src/lib/outbox/__tests__/outbound-delivery-safety.integration.test.ts
 */

import { Pool } from 'pg';
import { closeDb, getDb } from '@/lib/db/client';
import { dispatchNextOutbox } from '@/lib/outbox/dispatch-outbox';
import { enqueueOutboxForTests, markOutboxDelivered } from '@/lib/outbox/outbox-repository';
import { dispatchOutboundMessageJob } from '@/modules/atendimento/services/dispatch-outbound-message';
import { buildOutboundIdempotencyKey } from '@/lib/http/outbound-idempotency';
import {
  registerWhatsAppProviderAdapter,
  resetWhatsAppProviderRegistry,
} from '@/modules/atendimento/integrations/whatsapp-provider-registry';
import type { WhatsAppProviderAdapter } from '@/modules/atendimento/integrations/whatsapp-provider-adapter';

// Cold DB (migrate + seed + primeira conexão do pool) já flakeou uma vez em 30s
// sem falha de lógica: o teto acompanha o custo real de setup do harness.
jest.setTimeout(90_000);

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const clinicId = '00000000-0000-0000-0000-000000000001';
/** Segunda clínica: job de outbox de um tenant apontando lembrete de outro. */
const otherClinicId = '00000000-0000-0000-0000-000000000002';
const prefix = `outbound-safety-integration:${process.pid}:${Date.now()}`;
// Isolamento entre arquivos de integração: o harness executa suites em
// paralelo contra o mesmo `synkroo_test`; nome exclusivo impede que outro
// dispatcher de teste reclame jobs deste arquivo (ou vice-versa).
const OPERATION = `atendimento.outbound.safety.${process.pid}.${Date.now()}`;

let pool: Pool;
const usedKeys: string[] = [];

/** Provider falso: conta dispatches e decide o desfecho por teste (modo comutável). */
function fakeProvider(mode: 'ok' | 'ambiguous' | 'deterministic'): WhatsAppProviderAdapter & {
  dispatches: number;
  mode: 'ok' | 'ambiguous' | 'deterministic';
} {
  const adapter = {
    id: 'waha' as const,
    dispatches: 0,
    mode,
    isAvailable: (): boolean => true,
    sendTextMessage: async (): Promise<{ success: boolean; messageId?: string }> => {
      adapter.dispatches += 1;
      if (adapter.mode === 'ok') return { success: true, messageId: 'waha-fake-1' };
      // Falha determinística PRÉ-dispatch (marcador estrutural
      // `delivery: 'not_attempted'`): nada saiu para a rede. O claim fica
      // `failed` com TTL de 600s e o job segue retryável comum.
      if (adapter.mode === 'deterministic') {
        throw Object.assign(new Error('invalid destination'), { delivery: 'not_attempted' });
      }
      // Ambíguo: SEM marcador `delivery: 'not_attempted'` — o dispatch pode ter
      // ocorrido, então nenhum fallback/retry é permitido.
      throw new Error('provider timeout after dispatch');
    },
  };
  return adapter;
}

async function enqueueOutbound(businessKey: string): Promise<string> {
  const db = getDb();
  const job = await enqueueOutboxForTests(db, {
    clinicId,
    operation: OPERATION,
    businessKey,
    payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Lembrete de consulta' },
  });
  return job!.id;
}

async function outboxRow(businessKey: string): Promise<{ status: string; attempts: number; last_error_code: string | null }> {
  const { rows } = await pool.query(
    'SELECT status, attempts, last_error_code FROM outbox_jobs WHERE business_key = $1',
    [businessKey],
  );
  return rows[0];
}

/** Linha do lembrete atrelada ao job (fixture mínima: patient → appointment → reminder). */
async function createReminder(businessKey: string): Promise<string> {
  const tag = `${prefix}:${businessKey}`;
  const { rows: patient } = await pool.query(
    `INSERT INTO patients (clinic_id, name, phone) VALUES ($1, $2, $3) RETURNING id`,
    [clinicId, `Outbound Safety Patient ${tag}`, `+5500000000${Math.floor(Math.random() * 1e6).toString().padStart(6, '0')}`],
  );
  const { rows: appointment } = await pool.query(
    `INSERT INTO appointments (clinic_id, patient_id, scheduled_at, duration_minutes, status, notes)
     VALUES ($1, $2, NOW() + interval '2 days', 30, 'scheduled', $3) RETURNING id`,
    [clinicId, patient[0].id, tag],
  );
  const { rows: reminder } = await pool.query(
    `INSERT INTO appointment_reminders (appointment_id, reminder_type, channel, status)
     VALUES ($1, 'appointment_24h', 'whatsapp', 'queued') RETURNING id`,
    [appointment[0].id],
  );
  return reminder[0].id;
}

async function reminderRow(reminderId: string): Promise<{ status: string; message_id: string | null }> {
  const { rows } = await pool.query(
    'SELECT status, message_id FROM appointment_reminders WHERE id = $1',
    [reminderId],
  );
  return rows[0];
}

/** Enfileira o job de outbound carregando o `reminderId` no payload. */
async function enqueueOutboundWithReminder(businessKey: string, reminderId: string, jobClinicId: string = clinicId): Promise<string> {
  const db = getDb();
  const job = await enqueueOutboxForTests(db, {
    clinicId: jobClinicId,
    operation: OPERATION,
    businessKey,
    payload: { channel: 'whatsapp', externalId: '5511999990000', message: 'Lembrete de consulta', reminderId },
  });
  return job!.id;
}

/** Claim que falha ruidosamente se não vier com a geração do lease. */
async function claimLeaseForOperation(): Promise<{ id: string; claimGeneration: number }> {
  const { claimOutboxJob } = await import('@/lib/outbox/outbox-repository');
  const claimed = await claimOutboxJob({ operations: [OPERATION] });
  expect(claimed).toBeDefined();
  expect(typeof claimed!.claimGeneration).toBe('number');
  return claimed as { id: string; claimGeneration: number };
}

describeIntegration('outbox WhatsApp — keyed delivery safety against PostgreSQL', () => {
  const originalEnv = process.env;

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES ($1, 'Outbound Safety Clinic', 'outbound-safety-clinic', '+5500000000009', 'outbound-safety@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [clinicId]);
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES ($1, 'Outbound Safety Clinic B', 'outbound-safety-clinic-b', '+5500000000010', 'outbound-safety-b@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [otherClinicId]);
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.WAHA_API_URL = 'https://waha.invalid.test';
    process.env.WAHA_API_KEY = 'waha-test-key';
    delete process.env.WHATSAPP_FALLBACK_URL;
    delete process.env.WHATSAPP_FALLBACK_SECRET;
    resetWhatsAppProviderRegistry();
  });

  afterEach(async () => {
    process.env = originalEnv;
    resetWhatsAppProviderRegistry();
    await pool.query('DELETE FROM appointment_reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE clinic_id = $1 AND notes LIKE $2)', [clinicId, `${prefix}%`]);
    await pool.query('DELETE FROM appointments WHERE clinic_id = $1 AND notes LIKE $2', [clinicId, `${prefix}%`]);
    await pool.query('DELETE FROM patients WHERE clinic_id = $1 AND name LIKE $2', [clinicId, `Outbound Safety Patient ${prefix}%`]);
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
    if (usedKeys.length > 0) {
      await pool.query('DELETE FROM idempotency_keys WHERE key = ANY($1::text[])', [usedKeys.splice(0)]);
    }
  });

  afterAll(async () => {
    await pool.end();
    await closeDb();
  });

  it('job entregue é despachado UMA vez e a chave fica tenant/job-bound', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:delivered`;
    const jobId = await enqueueOutbound(businessKey);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    const result = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
    });

    expect(result.status).toBe('delivered');
    expect(provider.dispatches).toBe(1);
    expect(await outboxRow(businessKey)).toMatchObject({ status: 'delivered' });

    const { rows } = await pool.query('SELECT status FROM idempotency_keys WHERE key = $1', [
      buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`),
    ]);
    expect(rows[0]?.status).toBe('completed');
  });

  it('entrega não confirmada → DLQ imediata, um único dispatch, replay NÃO reenvia', async () => {
    const provider = fakeProvider('ambiguous');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:unknown`;
    const jobId = await enqueueOutbound(businessKey);
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`);
    usedKeys.push(key);

    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const first = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
      onDeadLetter,
    });

    // Falha permanente: DLQ imediata, sem esperar as 5 tentativas.
    expect(first).toEqual({ status: 'dead_letter', jobId });
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
    const row = await outboxRow(businessKey);
    expect(row.status).toBe('dead_letter');
    expect(row.attempts).toBe(1); // somente o incremento do claim — nenhum retry consumido
    // Código sanitizado: nem telefone, nem texto, nem detalhe de provider.
    expect(row.last_error_code).toBe('OUTBOX_DELIVERY_UNKNOWN');
    expect(row.last_error_code).not.toContain('5511999990000');
    expect(row.last_error_code).not.toContain('Lembrete');

    // A linha de idempotência permanece TERMINAL `unknown` para o operador.
    const { rows: claimRows } = await pool.query('SELECT status FROM idempotency_keys WHERE key = $1', [key]);
    expect(claimRows[0]?.status).toBe('unknown');

    // Replay: o job em DLQ não é claimable e o provider NÃO é chamado de novo.
    const replay = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
      onDeadLetter,
    });
    expect(replay.status).toBe('empty');
    expect(provider.dispatches).toBe(1);
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
  });

  it('conflito de claim antes do TTL → defer (sem consumir tentativa); após o TTL, despacha', async () => {
    const provider = fakeProvider('deterministic');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:deferred`;
    const jobId = await enqueueOutbound(businessKey);
    const key = buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`);
    usedKeys.push(key);

    // 1) Falha determinística conhecida do provider: retryável comum. O claim
    //    fica `failed` com TTL de 600s — o replay antes do TTL conflita.
    const first = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
    });
    expect(first.status).toBe('retryable');
    expect(provider.dispatches).toBe(1);
    const afterFailure = await outboxRow(businessKey);
    expect(afterFailure.status).toBe('pending');
    expect(afterFailure.attempts).toBe(1);

    // 2) O timer de retry (60s) dispara ANTES do TTL do claim (600s):
    //    conflito `retry_after`. O job é adiado — provider NÃO é chamado,
    //    a tentativa do claim é devolvida e o próximo agendamento fica depois
    //    do TTL da chave. Sem entregar e sem DLQ.
    await pool.query('UPDATE outbox_jobs SET next_attempt_at = NOW() - interval \'1 second\' WHERE business_key = $1', [businessKey]);
    const second = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
      onDeadLetter: jest.fn().mockResolvedValue(undefined),
    });
    expect(second).toEqual({ status: 'retryable', jobId });
    expect(provider.dispatches).toBe(1);
    const afterDefer = await outboxRow(businessKey);
    expect(afterDefer.status).toBe('pending');
    // Orçamento de tentativas preservado: a espera pela chave alheia não
    // esgotou as 5 tentativas (claim +1, defer -1).
    expect(afterDefer.attempts).toBe(1);
    expect(afterDefer.last_error_code).toBe('OUTBOX_SEND_DEFERRED');
    const { rows: schedule } = await pool.query(
      'SELECT next_attempt_at > NOW() + interval \'590 seconds\' AS after_claim_ttl FROM outbox_jobs WHERE business_key = $1',
      [businessKey],
    );
    expect(schedule[0].after_claim_ttl).toBe(true);

    // 3) Expirado o TTL do claim (e o agendamento), o MESMO job despacha:
    //    falha determinística + conflito + recuperação = 2 tentativas reais
    //    de handler, sem esgotar o orçamento e sem dead-letter.
    provider.mode = 'ok';
    await pool.query('UPDATE idempotency_keys SET expires_at = NOW() - interval \'1 second\' WHERE key = $1', [key]);
    await pool.query('UPDATE outbox_jobs SET next_attempt_at = NOW() - interval \'1 second\' WHERE business_key = $1', [businessKey]);
    const third = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
    });
    expect(third).toEqual({ status: 'delivered', jobId });
    expect(provider.dispatches).toBe(2);
    const afterRecovery = await outboxRow(businessKey);
    expect(afterRecovery.status).toBe('delivered');
    expect(afterRecovery.attempts).toBe(2);
    const { rows: claimRows } = await pool.query('SELECT status FROM idempotency_keys WHERE key = $1', [key]);
    expect(claimRows[0]?.status).toBe('completed');
  });

  it('falha de infra no claim → fail-closed: nenhum dispatch, job fica retryável', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:infra`;
    const jobId = await enqueueOutbound(businessKey);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    // Injeta a falha de infra no claim real de idempotência (`db.select`), sem
    // derrubar o restante do banco: o claim do OUTBOX usa `db.transaction` e
    // segue intacto — exatamente o cenário "banco oscilando para a chave".
    const db = getDb() as unknown as { select: (...args: unknown[]) => unknown };
    const originalSelect = (db as { select: (...args: unknown[]) => unknown }).select.bind(db);
    (db as { select: (...args: unknown[]) => unknown }).select = (): never => {
      throw new Error('simulated idempotency store outage');
    };

    let result: { status: string; jobId?: string };
    try {
      result = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), { operations: [OPERATION] });
    } finally {
      (db as { select: (...args: unknown[]) => unknown }).select = originalSelect;
    }

    // Fail-closed: o claim falhou ANTES do dispatch — o provider NUNCA foi
    // chamado (nenhum duplicate-send por outage) e a entrega NÃO foi registrada.
    expect(result!.status).toBe('retryable');
    expect(provider.dispatches).toBe(0);
    const row = await outboxRow(businessKey);
    expect(row.status).toBe('pending'); // retryável, jamais `delivered`
    expect(row.last_error_code).toBe('IdempotencyInfraError');
    // Nenhuma linha de idempotência foi criada: nada foi reivindicado.
    const { rows } = await pool.query('SELECT 1 FROM idempotency_keys WHERE key = $1', [
      buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`),
    ]);
    expect(rows).toHaveLength(0);
  });

  // ─── E4 — liquidação cercada: o hook do lembrete só corre dono da linha ────
  // O sender confirma o provider e devolve um hook; o marco de entrega é quem
  // decide se a escrita adicional acontece. Um holder de lease obsoleto nunca
  // passa pelo fence, e uma falha do hook desfaz o `delivered`.

  it('entrega confirmada + fence do lease → lembrete marcado NA MESMA transação', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:reminder-hook`;
    const reminderId = await createReminder(businessKey);
    const jobId = await enqueueOutboundWithReminder(businessKey, reminderId);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    const result = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
    });

    expect(result.status).toBe('delivered');
    expect(provider.dispatches).toBe(1);
    expect(await outboxRow(businessKey)).toMatchObject({ status: 'delivered' });
    // O hook rodou dentro da transação da liquidação: lembrete `sent` com o id.
    expect(await reminderRow(reminderId)).toMatchObject({ status: 'sent', message_id: 'waha-fake-1' });
  });

  it('hook recebe o tx da liquidação e comita junto com o delivered', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:hook-tx`;
    const reminderId = await createReminder(businessKey);
    const jobId = await enqueueOutboundWithReminder(businessKey, reminderId);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    // Sender trocado para provar que o `tx` entregue ao hook é o MESMO da
    // transação da liquidação: a escrita do lembrete usa o executor recebido.
    let receivedTx: unknown;
    const result = await dispatchNextOutbox(async (job) => {
      const hook = await dispatchOutboundMessageJob(job, OPERATION);
      return hook ? async (tx: unknown) => {
        receivedTx = tx;
        return hook(tx);
      } : undefined;
    }, { operations: [OPERATION] });

    expect(result.status).toBe('delivered');
    expect(receivedTx).toBeDefined();
    expect(typeof (receivedTx as { update?: unknown }).update).toBe('function');
    expect(await reminderRow(reminderId)).toMatchObject({ status: 'sent' });
  });

  it('hook que falha desfaz o delivered: job volta a processing e o replay reexecuta o hook', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:hook-rollback`;
    const reminderId = await createReminder(businessKey);
    const jobId = await enqueueOutboundWithReminder(businessKey, reminderId);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    // Falha determinística do hook (queda de escrita no lembrete) DEPOIS de a
    // marcação ter rodado DENTRO do `tx` da liquidação: o rollback precisa ser
    // genuíno — a escrita do lembrete ocorreu na transação e foi desfeita
    // junto com o `delivered`. O job ainda está `processing`, então o claim de
    // idempotência NÃO foi consumido — o provider já entregou e a chave segue
    // `completed` (dedup), apta a reexecutar só a liquidação.
    let failHook = true;
    let firstError: unknown;
    try {
      await dispatchNextOutbox(async (job) => {
        const hook = await dispatchOutboundMessageJob(job, OPERATION);
        return hook ? async (tx: unknown) => {
          await hook(tx);
          if (failHook) throw new Error('reminder write unavailable');
        } : undefined;
      }, { operations: [OPERATION] });
    } catch (err) {
      firstError = err;
    }
    expect((firstError as Error)?.message).toBe('reminder write unavailable');

    // O `delivered` foi desfeito com o hook: a linha continua `processing`.
    const rolledBack = await outboxRow(businessKey);
    expect(rolledBack.status).toBe('processing');
    expect(rolledBack.last_error_code).toBeNull();
    // O lembrete NÃO ficou marcado: a escritança dentro da transação foi
    // revertida também (status e message_id voltaram ao estado original).
    expect(await reminderRow(reminderId)).toMatchObject({ status: 'queued', message_id: null });
    // O provider foi chamado UMA vez (a chave já está `completed`).
    expect(provider.dispatches).toBe(1);
    const { rows: claimRows } = await pool.query('SELECT status FROM idempotency_keys WHERE key = $1', [
      buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`),
    ]);
    expect(claimRows[0]?.status).toBe('completed');

    // Replay: lease vencido (5min) deixa a linha elegível de novo. O claim
    // dedupa o reenvio ao provider e a liquidação agora completa — com o
    // lembrete marcado. Nenhum segundo dispatch.
    failHook = false;
    await pool.query(
      `UPDATE outbox_jobs SET updated_at = NOW() - interval '10 minutes', next_attempt_at = NOW() - interval '1 second'
       WHERE business_key = $1`,
      [businessKey],
    );
    const replay = await dispatchNextOutbox(async (job) => {
      const hook = await dispatchOutboundMessageJob(job, OPERATION);
      return hook ? async (tx: unknown) => {
        await hook(tx);
        if (failHook) throw new Error('reminder write unavailable');
      } : undefined;
    }, { operations: [OPERATION] });

    expect(replay).toEqual({ status: 'delivered', jobId });
    expect(provider.dispatches).toBe(1);
    expect(await outboxRow(businessKey)).toMatchObject({ status: 'delivered' });
    expect(await reminderRow(reminderId)).toMatchObject({ status: 'sent', message_id: null });
  });

  it('reminderId de OUTRA clínica → hook recusa no cerco de tenant: DLQ com código fixo, lembrete intacto', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:reminder-cross-clinic`;
    // Lembrete (e compromisso) pertencem à clínica A...
    const reminderId = await createReminder(businessKey);
    // ...mas o job foi enfileirado pela clínica B com o MESMO `reminderId`:
    // cenário de payload/reminderId descasados entre tenants.
    const jobId = await enqueueOutboundWithReminder(businessKey, reminderId, otherClinicId);
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', otherClinicId, `outbox:${jobId}`));

    const onDeadLetter = jest.fn().mockResolvedValue(undefined);
    const result = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
      onDeadLetter,
    });

    // Rejeição SEMÂNTICA da liquidação: o `delivered` foi desfeito junto com o
    // hook, e a entrega AO PROVIDER já ocorreu — reexecutar o job reexecutaria
    // o envio e liquidar como entregue marcaria um lembrete não enviado. DLQ
    // imediata com código fixo, sem consumir tentativa (não é falha de
    // provider: nenhum `markOutboxRetry`) e sem reportar entrega.
    expect(result).toEqual({ status: 'dead_letter', jobId });
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
    const row = await outboxRow(businessKey);
    expect(row.status).toBe('dead_letter');
    expect(row.attempts).toBe(1); // somente o incremento do claim — nenhum retry consumido
    // Código fixo e sanitizado: nem reminderId, telefone, texto ou detale de banco.
    expect(row.last_error_code).toBe('REMINDER_SETTLEMENT_REJECTED');
    expect(row.last_error_code).not.toContain(reminderId);
    expect(row.last_error_code).not.toContain('5511999990000');

    // O lembrete da clínica A NÃO foi marcado: o EXISTS do cerco não casou.
    expect(await reminderRow(reminderId)).toMatchObject({ status: 'queued', message_id: null });
    // O provider foi chamado UMA vez (a entrega ocorreu; só a liquidação falhou).
    expect(provider.dispatches).toBe(1);

    // A linha em DLQ não é claimable: nenhum segundo dispatch, nenhum loop.
    const replay = await dispatchNextOutbox((job) => dispatchOutboundMessageJob(job, OPERATION), {
      operations: [OPERATION],
      onDeadLetter,
    });
    expect(replay.status).toBe('empty');
    expect(provider.dispatches).toBe(1);
    expect(onDeadLetter).toHaveBeenCalledTimes(1);
  });

  it('lease obsoleto: o fence recusa o UPDATE e o hook de sucesso NUNCA é invocado', async () => {
    const provider = fakeProvider('ok');
    registerWhatsAppProviderAdapter(provider);
    const businessKey = `${prefix}:stale-hook`;
    const jobId = await enqueueOutboundWithReminder(businessKey, await createReminder(businessKey));
    usedKeys.push(buildOutboundIdempotencyKey('whatsapp', clinicId, `outbox:${jobId}`));

    // A reclama (geração 1) e demora mais que o lease de 5min.
    const stale = await claimLeaseForOperation();
    expect(stale.claimGeneration).toBe(1);
    await pool.query(
      `UPDATE outbox_jobs SET updated_at = NOW() - interval '10 minutes', next_attempt_at = NOW() - interval '1 second'
       WHERE business_key = $1`,
      [businessKey],
    );
    // B reclama a mesma linha (geração 2): A não é dono de nada.
    const current = await claimLeaseForOperation();
    expect(current.claimGeneration).toBe(2);

    let hookInvocations = 0;
    // A tenta liquidar com UM hook: o fence recusa antes de invocá-lo.
    const settled = await markOutboxDelivered(stale.id, stale.claimGeneration, async () => {
      hookInvocations += 1;
    });
    expect(settled).toBe(false);
    expect(hookInvocations).toBe(0);
    expect(await outboxRow(businessKey)).toMatchObject({ status: 'processing' });
    // B liquida normalmente, com o próprio hook.
    expect(await markOutboxDelivered(current.id, current.claimGeneration, async () => {
      hookInvocations += 1;
    })).toBe(true);
    expect(hookInvocations).toBe(1);
  });
});
