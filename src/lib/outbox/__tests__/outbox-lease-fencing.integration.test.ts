/**
 * Integration — fence de lease do outbox (`claim_generation`), contra PostgreSQL real.
 *
 * O outbox é at-least-once e o lease de 5min é RECUPERÁVEL: um worker lento
 * pode estar liquidando uma linha que outro já reclamou. Antes da migration
 * 0036 a fence era só `(id, status='processing')` — e `attempts` não serve de
 * gereração porque o DEFER a decrementa (o valor se repete depois do reclaim:
 * ABA). Estas provas mostram o desfecho com a geração do claim.
 *
 * Cenários:
 *  1. lease A envelhecido → reclaim B → liquidação de A (delivered/retry/
 *     defer/deadletter) é RECUSADA e a linha continua exatamente como B deixou;
 *  2. liquidação de B é aceita;
 *  3. ABA crítico: B defere (devolve tentativa, geração intacta) → C reclama
 *     incrementando a geração → o token antigo de B continua recusado para
 *     todos os marcos e a tentativa de C não é consumida por ele.
 *
 * Rodar com o harness canônico (DB isolado `synkroo_test`, defaults locais
 * versionados — nunca `.env` privado):
 *   TEST_DATABASE_URL=postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo_test \
 *     npm run test:integration:run -- src/lib/outbox/__tests__/outbox-lease-fencing.integration.test.ts
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { closeDb, getDb } from '@/lib/db/client';
import {
  claimOutboxJob,
  enqueueOutboxForTests,
  markOutboxDeadLetter,
  markOutboxDeferred,
  markOutboxDelivered,
  markOutboxRetry,
  type OutboxJob,
} from '@/lib/outbox/outbox-repository';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
// Isolamento por processo: outras suites usam o mesmo synkroo_test e podem
// limpar jobs por clinic_id durante o harness completo.
const clinicId = randomUUID();
const prefix = `outbox-lease-fencing:${process.pid}:${Date.now()}`;
// Isolamento entre arquivos de integração: o harness usa o mesmo banco de
// teste em paralelo; o nome exclusivo evita claims cruzados de outras suites.
const OPERATION = 'integration.test';

let pool: Pool;

/** Torna a linha claiming de novo (lease expirado / agendamento vencido). */
async function forceReclaimable(businessKey: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs
        SET updated_at = NOW() - interval '10 minutes',
            next_attempt_at = NOW() - interval '1 second'
      WHERE business_key = $1`,
    [businessKey],
  );
}

async function row(businessKey: string): Promise<{ status: string; attempts: number; claim_generation: number; last_error_code: string | null }> {
  const { rows } = await pool.query(
    'SELECT status, attempts, claim_generation, last_error_code FROM outbox_jobs WHERE business_key = $1',
    [businessKey],
  );
  return rows[0];
}

/** Claim que falha ruidosamente se não vier com a geração do lease. */
async function claimLease(): Promise<OutboxJob> {
  const claimed = await claimOutboxJob({ operations: [OPERATION] });
  expect(claimed).toBeDefined();
  return claimed as OutboxJob;
}

describeIntegration('outbox lease fencing (claim_generation) against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES ($1, 'Outbox Lease Fencing Clinic', 'outbox-lease-fencing-clinic', '+5500000000002', 'lease-fencing@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [clinicId]);
  });

  afterEach(async () => {
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
    await pool.end();
    await closeDb();
  });

  it('incrementa a geração a cada claim e preserva a semântica de attempts', async () => {
    const businessKey = `${prefix}:generation`;
    await enqueueOutboxForTests(getDb(), { clinicId, operation: OPERATION, businessKey, payload: { safe: true } });

    const first = await claimLease();
    expect(first.claimGeneration).toBe(1);
    expect(first.attempts).toBe(1);
    expect(first.status).toBe('processing');

    // Sem acordo de agendamento/updated_at o claim não é elegível.
    await expect(claimOutboxJob({ operations: [OPERATION] })).resolves.toBeUndefined();

    await forceReclaimable(businessKey);
    const second = await claimLease();
    expect(second.claimGeneration).toBe(2);
    expect(second.attempts).toBe(2);
  });

  it('liquidação do lease PERDIDO (A) é recusada para todos os marcos; a linha segue como B deixou', async () => {
    const businessKey = `${prefix}:stale-holder`;
    await enqueueOutboxForTests(getDb(), { clinicId, operation: OPERATION, businessKey, payload: { safe: true } });

    // A reclama (geração 1) e demora mais que o lease de 5min.
    const stale = await claimLease();
    expect(stale.claimGeneration).toBe(1);
    await forceReclaimable(businessKey);

    // B reclama a mesma linha (geração 2) — A já não é dono de nada.
    const current = await claimLease();
    expect(current.claimGeneration).toBe(2);
    const asB = await row(businessKey);

    // Todo marco de A é recusado pelo fence (id, status, geração).
    await expect(markOutboxDelivered(stale.id, stale.claimGeneration)).resolves.toBe(false);
    await expect(markOutboxRetry(stale.id, stale.claimGeneration, stale.attempts, 'STALE')).resolves.toBe(false);
    await expect(markOutboxDeferred(stale.id, stale.claimGeneration, 'STALE', 600)).resolves.toBe(false);
    await expect(markOutboxDeadLetter(stale.id, stale.claimGeneration, 'STALE')).resolves.toBe(false);

    // A linha continua EXATAMENTE como B deixou: nem liquidation, nem erro.
    expect(await row(businessKey)).toEqual(asB);

    // B liquida normalmente.
    await expect(markOutboxDelivered(current.id, current.claimGeneration)).resolves.toBe(true);
    expect(await row(businessKey)).toMatchObject({ status: 'delivered', claim_generation: 2 });
  });

  it('ABA: B defere (attempts -1, geração intacta) → C reclama → token antigo de B continua recusado', async () => {
    const businessKey = `${prefix}:aba`;
    await enqueueOutboxForTests(getDb(), { clinicId, operation: OPERATION, businessKey, payload: { safe: true } });

    // A reclama (geração 1) e perde o lease; B reclama (geração 2).
    await claimLease();
    await forceReclaimable(businessKey);
    const b = await claimLease();
    expect(b.claimGeneration).toBe(2);
    const attemptsBefore = b.attempts;

    // B defere: a tentativa é DEVOLVIDA e a geração NUNCA é decrementada —
    // é por isso que `attempts` não pode servir de fence.
    await expect(markOutboxDeferred(b.id, b.claimGeneration, 'OUTBOX_SEND_DEFERRED', 600)).resolves.toBe(true);
    const afterDefer = await row(businessKey);
    expect(afterDefer).toMatchObject({ status: 'pending', claim_generation: 2 });
    expect(afterDefer.attempts).toBe(attemptsBefore - 1);

    // C reclama a linha adiada (geração 3): `attempts` volta a subir e passa a
    // repetir o valor que B tinha — somente a geração distingue os holders.
    await forceReclaimable(businessKey);
    const c = await claimLease();
    expect(c.claimGeneration).toBe(3);
    expect(c.attempts).toBe(afterDefer.attempts + 1);

    // O token antigo de B (geração 2) é recusado em TODOS os marcos, inclusive
    // no defer — que é justamente onde o `attempts` voltaria a casar.
    await expect(markOutboxDeferred(b.id, b.claimGeneration, 'OUTBOX_SEND_DEFERRED', 600)).resolves.toBe(false);
    await expect(markOutboxDelivered(b.id, b.claimGeneration)).resolves.toBe(false);
    await expect(markOutboxRetry(b.id, b.claimGeneration, b.attempts, 'STALE')).resolves.toBe(false);
    await expect(markOutboxDeadLetter(b.id, b.claimGeneration, 'STALE')).resolves.toBe(false);

    const asC = await row(businessKey);
    expect(asC).toMatchObject({ status: 'processing', claim_generation: 3 });
    // A tentativa devolvida pelo defer de B NÃO é consumida de novo pela
    // liquidação recusada: a linha segue com o orçamento de C.
    expect(asC.attempts).toBe(c.attempts);
    expect(asC.last_error_code).toBe('OUTBOX_SEND_DEFERRED');

    // C liquida com o próprio lease.
    await expect(markOutboxDeadLetter(c.id, c.claimGeneration, 'OUTBOX_DELIVERY_UNKNOWN')).resolves.toBe(true);
    expect(await row(businessKey)).toMatchObject({
      status: 'dead_letter',
      claim_generation: 3,
      last_error_code: 'OUTBOX_DELIVERY_UNKNOWN',
    });
  });
});
