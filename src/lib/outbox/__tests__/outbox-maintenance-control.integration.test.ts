/**
 * Integration — gate de manutenção do outbox (pause/resume/drain) contra
 * PostgreSQL real (migration 0036 expandida).
 *
 * Autoridade no banco: `outbox_control` (linha singleton) + trigger
 * `outbox_enforce_control_gate`. Prova dos dois lados do gate — o claim em
 * código (`claimOutboxJob`) e o dispatch legado por SQL direto (binário antigo
 * que não lê estado algum) — mais o drain observável, o CAS do resume, a fence
 * preservada e o fail-closed sem estado de controle.
 *
 * Rodar com o harness canônico (DB isolado `synkroo_test`, defaults locais
 * versionados — nunca `.env` privado):
 *   TEST_DATABASE_URL=postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo_test \
 *     npm run test:integration:run -- src/lib/outbox/__tests__/outbox-maintenance-control.integration.test.ts
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { closeDb, getDb } from '@/lib/db/client';
import {
  claimOutboxJob,
  enqueueOutboxForTests,
  markOutboxDelivered,
  markOutboxRetry,
} from '@/lib/outbox/outbox-repository';
import { buildClaimMarker, resolveConsumerRelease } from '@/lib/outbox/consumer-release';
import { POST as outboxCronPost } from '@/app/api/cron/outbox/route';
import { OUTBOX_OPERATIONS } from '@/lib/outbox/operations';
import {
  OutboxControlError,
  getOutboxControlStatus,
  pauseOutboxConsumption,
  resumeOutboxConsumption,
} from '@/lib/outbox/control';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
// Isolamento por processo: outras suites usam o mesmo synkroo_test em série.
const clinicId = randomUUID();
const clinicBId = randomUUID();
const prefix = `outbox-maintenance:${process.pid}:${Date.now()}`;
const OPERATION = 'outbox.maintenance.test';
const RELEASE = 'a'.repeat(40);

let pool: Pool;
const originalReleaseEnv = process.env.OUTBOX_RELEASE_ID;

/**
 * Claim LEGADO por SQL direto — binário antigo não lê estado de controle e não
 * escreve `claim_release`. Fala a fence da 0036 (incrementa a geração) mas não
 * a identidade transacional: por isso passa no estado fresh e é recusado
 * (`OUTBOX_RELEASE_MISMATCH`) quando o gate arma um release.
 */
async function legacyClaim(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs
        SET status = 'processing', attempts = attempts + 1,
            claim_generation = claim_generation + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'pending' AND next_attempt_at <= NOW()`,
    [jobId],
  );
}

/**
 * Reclamo LEGADO de lease stale: status continua `processing`, `attempts` sobe,
 * `updated_at` é renovado — e `claim_generation` NÃO é incrementada. É o buraco
 * que a detecção de claim por attempts/geração fecha: sem ela o teste de status
 * do trigger não reconheceria a transição como claim.
 */
async function legacyStaleReclaim(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs
        SET attempts = attempts + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'processing'`,
    [jobId],
  );
}

/** Liquidação LEGADA por SQL direto — sem fence e sem marcador transacional. */
async function legacySettle(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs SET status = 'delivered', updated_at = NOW()
      WHERE id = $1 AND status = 'processing'`,
    [jobId],
  );
}

/**
 * Liquidação por SQL direto COM marcador transacional explícito
 * (`set_config('outbox.claim_marker', <token>, true)` na mesma transação).
 * É o caminho que prova o gate por identidade: marcador válido passa; marcador
 * ausente ou errado é negado — inclusive quando a linha JÁ porta o release
 * atual (o valor da coluna, sozinho, não autentica ninguém).
 */
async function settleWithMarker(jobId: string, marker: string | null): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (marker !== null) {
      await client.query('SELECT set_config($1, $2, true)', ['outbox.claim_marker', marker]);
    }
    await client.query(
      `UPDATE outbox_jobs SET status = 'delivered', updated_at = NOW()
        WHERE id = $1 AND status = 'processing'`,
      [jobId],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Torna a linha stale (lease vencido) sem tocar status/geração — permitido. */
async function forceStale(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs SET updated_at = NOW() - interval '10 minutes', next_attempt_at = NOW() - interval '1 second' WHERE id = $1`,
    [jobId],
  );
}

async function row(jobId: string): Promise<{ status: string; attempts: number; claim_generation: number; claim_release: string | null }> {
  const { rows } = await pool.query(
    'SELECT status, attempts, claim_generation, claim_release FROM outbox_jobs WHERE id = $1',
    [jobId],
  );
  return rows[0];
}

/** Restaura a linha singleton — o controle é estado GLOBAL do banco de teste. */
async function resetControl(): Promise<void> {
  await pool.query(
    `UPDATE outbox_control
        SET paused = false, epoch = 0, reason = NULL, operator = NULL,
            release_id = NULL, paused_at = NULL, resumed_at = NULL
      WHERE id = 1`,
  );
}

describeIntegration('outbox maintenance control (pause/resume/drain) against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    for (const id of [clinicId, clinicBId]) {
      await pool.query(`
        INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
        VALUES ($1, 'Outbox Maintenance Clinic', $2, '+5500000000009', 'outbox-maintenance@test.local', 'starter', 'active')
        ON CONFLICT (id) DO NOTHING
      `, [id, `outbox-maintenance-${id.slice(0, 8)}`]);
    }
    process.env.OUTBOX_RELEASE_ID = RELEASE;
  });

  afterEach(async () => {
    await resetControl();
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
  });

  afterAll(async () => {
    delete process.env.OUTBOX_RELEASE_ID;
    if (originalReleaseEnv !== undefined) process.env.OUTBOX_RELEASE_ID = originalReleaseEnv;
    await resetControl();
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM clinics WHERE id = ANY($1)', [[clinicId, clinicBId]]);
    await pool.end();
    await closeDb();
  });

  // ─── 1. Pause não derruba enqueue (negócio segue escrevendo) ───────────────
  it('pause preserva o enqueue transacional (INSERT não é gateado)', async () => {
    await pauseOutboxConsumption({ reason: 'maintenance window', operator: 'operator-a' });
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:enqueue-while-paused`, payload: { safe: true },
    });
    expect(enqueued).toBeDefined();
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  // ─── 2. Pause bloqueia claim (caminho de código) ──────────────────────────
  it('pause bloqueia o claim em código e o dispatcher não encontra trabalho', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:claim-blocked`, payload: { safe: true },
    });
    const paused = await pauseOutboxConsumption({ reason: 'drain window' });
    expect(paused.paused).toBe(true);
    expect(paused.epoch).toBe(1);
    expect(paused.reason).toBe('drain window');

    await expect(claimOutboxJob({ operations: [OPERATION] })).resolves.toBeUndefined();
    // A linha segue pending e elegível — o pause não consome tentativa.
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  it('POST do scheduler respeita pause: responde sem dispatch e preserva o job pending', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:scheduler-paused`, payload: { safe: true },
    });
    const oldSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'integration-cron-secret';
    try {
      await pauseOutboxConsumption({ reason: 'scheduler gate' });
      const request = new Request('http://localhost/api/cron/outbox?limit=1', {
        method: 'POST',
        headers: { Authorization: 'Bearer integration-cron-secret' },
      });
      const response = await outboxCronPost(request as never);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ success: true, processed: 0, results: [] });
      expect((await row(enqueued!.id)).status).toBe('pending');
    } finally {
      if (oldSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = oldSecret;
    }
  });

  // ─── 3. Binário legado (SQL direto) não claimed durante o pause ────────────
  it('claim legado por SQL direto é recusado pelo trigger durante o pause', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-claim-paused`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'legacy gate' });

    await expect(legacyClaim(enqueued!.id)).rejects.toThrow(/OUTBOX_PAUSED/);
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  // ─── 4. Liquidação legada PRÉ-PROTOCOLO em voo durante o pause ────────────
  it('lease legado PRÉ-PROTOCOLO (claim_release IS NULL) liquida durante o pause (drain possível)', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-drain`, payload: { safe: true },
    });
    // Claim do binário antigo ANTES do pause: linha sem release — é o legado já
    // em voo na migração/pause, o único que ainda liquida sem marcador.
    await legacyClaim(enqueued!.id);
    expect((await row(enqueued!.id)).claim_release).toBeNull();

    await pauseOutboxConsumption({ reason: 'legacy drain window' });
    // Em voo: a liquidação do lease PRÉ-PROTOCOLO não é bloqueada pelo pause.
    await legacySettle(enqueued!.id);
    expect((await row(enqueued!.id)).status).toBe('delivered');

    const status = await getOutboxControlStatus();
    expect(status.paused).toBe(true);
    expect(status.drained).toBe(true);
  });

  // ─── 4b. Lease do PROTOCOCO não liquida sem marcador, nem pausado ─────────
  it('pausa NÃO abre liquidação marcador-less de lease portador de release', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:paused-markerless-denied`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(claimed).toBeDefined();
    expect((await row(enqueued!.id)).claim_release).toBe(RELEASE);

    await pauseOutboxConsumption({ reason: 'markerless paused window' });

    // Worker legado sem marcador tentando liquidar lease do protocolo durante
    // a pausa: recusado — a pausa drena SÓ o pré-protocolo (sem release).
    await expect(legacySettle(enqueued!.id)).rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
    const after = await row(enqueued!.id);
    expect(after.status).toBe('processing');
    expect(after.claim_release).toBe(RELEASE);
    expect(after.claim_generation).toBe(claimed!.claimGeneration);

    // Marcador de OUTRA release com a MESMA geração: também recusado — o par
    // exige release E geração da linha.
    await expect(settleWithMarker(enqueued!.id, buildClaimMarker('d'.repeat(40), claimed!.claimGeneration)))
      .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
    expect((await row(enqueued!.id)).status).toBe('processing');

    // Marcador EXATO (`<claim_release>#<claim_generation>` da linha) liquida
    // mesmo durante a pausa — é o caminho do repositório.
    await settleWithMarker(enqueued!.id, buildClaimMarker(RELEASE, claimed!.claimGeneration));
    expect((await row(enqueued!.id)).status).toBe('delivered');
  });

  // ─── 5. Claim concorrente duplicado ───────────────────────────────────────
  it('dois claims concorrentes do mesmo job elegível: somente um ganha', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:concurrent`, payload: { safe: true },
    });
    const [a, b] = await Promise.all([
      claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }),
      claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }),
    ]);
    const winners = [a, b].filter((job) => job !== undefined);
    expect(winners).toHaveLength(1);
    expect((await row(enqueued!.id)).claim_generation).toBe(1);
  });

  // ─── 5b. Corrida pause-vs-claim: ordem serializada pelo lock do controle ───
  it('corrida pause×claim nunca deixa o job em estado inconsistente', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:race`, payload: { safe: true },
    });
    // Claim e pause disparam juntos; o lock da linha singleton serializa.
    const [claimed] = await Promise.all([
      claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }),
      pauseOutboxConsumption({ reason: 'race window' }),
    ]);
    const after = await row(enqueued!.id);
    if (claimed) {
      // Claim venceu a ordem: a liquidação em voo segue permitida (drain).
      expect(after.status).toBe('processing');
      await expect(markOutboxDelivered(claimed.id, claimed.claimGeneration)).resolves.toBe(true);
    } else {
      // Pause venceu a ordem: a linha nunca foi claimed.
      expect(after.status).toBe('pending');
    }
    // Nos dois casos, depois do pause nenhum claim novo passa.
    await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id })).resolves.toBeUndefined();
  });

  // ─── 5c. Claims concorrentes em jobs distintos completam (lock compatível) ──
  it('dois claims concorrentes em jobs distintos completam sem corromper gerações', async () => {
    const jobA = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:distinct-a`, payload: { safe: true },
    });
    const jobB = await enqueueOutboxForTests(getDb(), {
      clinicId: clinicBId, operation: OPERATION, businessKey: `${prefix}:distinct-b`, payload: { safe: true },
    });
    // Disparam juntos: com o controle sob advisory compartilhado, os dois
    // reivindicam em paralelo (antes, o FOR UPDATE global serializava a fila
    // inteira, e o FOR SHARE exigia UPDATE — incompatível com SELECT-only).
    const [a, b] = await Promise.all([
      claimOutboxJob({ operations: [OPERATION], jobId: jobA!.id }),
      claimOutboxJob({ operations: [OPERATION], jobId: jobB!.id }),
    ]);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(a!.id).toBe(jobA!.id);
    expect(b!.id).toBe(jobB!.id);
    // Geração é POR LINHA: cada job começa em 1, sem contaminação entre leases.
    expect((await row(jobA!.id)).claim_generation).toBe(1);
    expect((await row(jobB!.id)).claim_generation).toBe(1);
    // E os dois liquidam com a fence própria (marcador transacional).
    await expect(markOutboxDelivered(a!.id, a!.claimGeneration)).resolves.toBe(true);
    await expect(markOutboxDelivered(b!.id, b!.claimGeneration)).resolves.toBe(true);
    const status = await getOutboxControlStatus();
    expect(status.counts.processing).toBe(0);
  });

  // ─── 5d. Contrato de lock: advisory compartilhado nos leitores, exclusivo só no pause ───
  it('controle sob advisory lock: leitores de claim/liquidação coexistem; exclusivo do pause conflita', async () => {
    const readerA = await pool.connect();
    const readerB = await pool.connect();
    const pauser = await pool.connect();
    /** Falha se a query não completar dentro do budget (prova de bloqueio). */
    const withBudget = <T,>(query: Promise<T>, budgetMs = 3000): Promise<T> =>
      Promise.race([
        query,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('LOCK_BLOCKED')), budgetMs)),
      ]);
    try {
      await readerA.query('BEGIN');
      await readerB.query('BEGIN');
      // Dois leitores (claim/liquidação/trigger) seguram o advisory
      // COMPARTILHADO ao mesmo tempo — é o que permite claims concorrentes no
      // pool de 5 workers sem exigir UPDATE na tabela de controle.
      await readerA.query('SELECT pg_advisory_xact_lock_shared(8104312345678901)');
      await expect(withBudget(
        readerB.query('SELECT pg_advisory_xact_lock_shared(8104312345678901)'),
      )).resolves.toBeDefined();

      // O lock EXCLUSIVO que pause/resume tomam CONFLITA com os leitores:
      // estoura o lock_timeout enquanto o compartilhado está segurado.
      await pauser.query("SET lock_timeout = '400ms'");
      await expect(pauser.query('SELECT pg_advisory_xact_lock(8104312345678901)'))
        .rejects.toThrow(/lock timeout|deadlock|canceling statement/i);

      // Liberados os leitores, o exclusivo passa — e a pause real da aplicação
      // continua funcionando (autoridade intacta).
      await readerA.query('ROLLBACK');
      await readerB.query('ROLLBACK');
      await expect(withBudget(pauser.query('SELECT pg_advisory_xact_lock(8104312345678901)')))
        .resolves.toBeDefined();
      await pauser.query('ROLLBACK');

      const paused = await pauseOutboxConsumption({ reason: 'lock contract window' });
      expect(paused.paused).toBe(true);
      // Enquanto pausado, nenhum claim passa (o gate segue race-safe).
      const enqueued = await enqueueOutboxForTests(getDb(), {
        clinicId, operation: OPERATION, businessKey: `${prefix}:lock-contract`, payload: { safe: true },
      });
      await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id })).resolves.toBeUndefined();
    } finally {
      for (const client of [readerA, readerB, pauser]) {
        try { await client.query('ROLLBACK'); } catch { /* sessão já sem transação */ }
        client.release();
      }
    }
  });

  // ─── 5e. Runtime SELECT-only: claim/settlement/cancelamento funcionam; pause/resume negados ───
  it('papel SELECT-only em outbox_control claima, liquida e cancela; pause/resume exigem admin', async () => {
    const role = `select_only_${process.pid}_${Date.now() % 1000000}`;
    const password = `pw_${randomUUID().replace(/-/g, '').slice(0, 16)}A1!`;
    // Cria o papel restrito: SELECT no controle, CRUD no outbox_jobs.
    await pool.query(`CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`);
    try {
      await pool.query(`GRANT CONNECT ON DATABASE synkroo_test TO "${role}"`);
      await pool.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
      await pool.query(`GRANT SELECT ON public.outbox_control TO "${role}"`);
      await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.outbox_jobs TO "${role}"`);
      const rolePool = new Pool({
        connectionString: `postgres://${role}:${encodeURIComponent(password)}@localhost:${new URL(process.env.DATABASE_URL!).port}/synkroo_test`,
      });
      try {
        // Claim via SQL direto com release+marker (caminho do repositório) passa
        // sem UPDATE no controle — prova que o advisory lock não exige privilégio.
        const enqueued = await enqueueOutboxForTests(getDb(), {
          clinicId, operation: OPERATION, businessKey: `${prefix}:select-only-claim`, payload: { safe: true },
        });
        const client = await rolePool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT pg_advisory_xact_lock_shared(8104312345678901)');
          const gate = await client.query('SELECT paused, release_id FROM public.outbox_control WHERE id = 1');
          expect(gate.rows[0].paused).toBe(false);
          // Geração atual para compor o marcador transacional exato
          // `<release>#<new_generation>` (o trigger exige a identidade do caller).
          const current = await client.query(
            'SELECT claim_generation FROM public.outbox_jobs WHERE id=$1',
            [enqueued!.id],
          );
          const nextGeneration = Number(current.rows[0].claim_generation) + 1;
          await client.query('SELECT set_config($1, $2, true)', [
            'outbox.claim_marker',
            `${RELEASE}#${nextGeneration}`,
          ]);
          await client.query(
            `UPDATE public.outbox_jobs SET status='processing', attempts=attempts+1,
               claim_generation=claim_generation+1, claim_release=$2, updated_at=NOW()
             WHERE id=$1 AND status='pending'`,
            [enqueued!.id, RELEASE],
          );
          await client.query('COMMIT');
        } finally {
          client.release();
        }
        expect((await row(enqueued!.id)).status).toBe('processing');

        // Liquidação com o marcador exato também passa como SELECT-only.
        const settleClient = await rolePool.connect();
        try {
          await settleClient.query('BEGIN');
          await settleClient.query('SELECT pg_advisory_xact_lock_shared(8104312345678901)');
          const claimedRow = await settleClient.query(
            'SELECT claim_generation, claim_release FROM public.outbox_jobs WHERE id=$1',
            [enqueued!.id],
          );
          await settleClient.query('SELECT set_config($1, $2, true)', [
            'outbox.claim_marker',
            `${claimedRow.rows[0].claim_release}#${claimedRow.rows[0].claim_generation}`,
          ]);
          await settleClient.query(
            `UPDATE public.outbox_jobs SET status='delivered', updated_at=NOW()
             WHERE id=$1 AND status='processing'`,
            [enqueued!.id],
          );
          await settleClient.query('COMMIT');
        } finally {
          settleClient.release();
        }
        expect((await row(enqueued!.id)).status).toBe('delivered');

        // Cancelamento LGPD pelo papel restrito também passa (redação nunca bloqueada).
        const cancelJob = await enqueueOutboxForTests(getDb(), {
          clinicId, operation: OPERATION, businessKey: `${prefix}:select-only-cancel`, payload: { safe: true },
        });
        await rolePool.query(
          `UPDATE public.outbox_jobs SET status='cancelled', payload='{"redacted":true}'::jsonb WHERE id=$1`,
          [cancelJob!.id],
        );
        expect((await row(cancelJob!.id)).status).toBe('cancelled');

        // Mas UPDATE direto no singleton é negado ao papel restrito.
        await expect(rolePool.query(
          `UPDATE public.outbox_control SET paused=true WHERE id=1`,
        )).rejects.toThrow(/permission denied|not allowed|denied/i);
      } finally {
        await rolePool.end();
      }
    } finally {
      await pool.query(`REVOKE SELECT, INSERT, UPDATE, DELETE ON public.outbox_jobs FROM "${role}"`);
      await pool.query(`REVOKE SELECT ON public.outbox_control FROM "${role}"`);
      await pool.query(`REVOKE USAGE ON SCHEMA public FROM "${role}"`);
      await pool.query(`REVOKE CONNECT ON DATABASE synkroo_test FROM "${role}"`);
      await pool.query(`DROP ROLE IF EXISTS "${role}"`);
    }
  });

  // ─── 6. Stale processing NÃO é prova de drain ─────────────────────────────
  it('processing stale mantém drained=false e fica observável em staleProcessing', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:stale`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    await forceStale(claimed!.id);

    const status = await getOutboxControlStatus();
    expect(status.counts.processing).toBe(1);
    expect(status.counts.staleProcessing).toBe(1);
    // Lease vencido NÃO é drain: só a ausência delinhas processing é.
    expect(status.drained).toBe(false);
    expect(status.leaseMs).toBe(5 * 60 * 1000);

    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
    expect((await getOutboxControlStatus()).drained).toBe(true);
  });

  // ─── 7. Resume é CAS por epoch + release; drain guard antes de novas posse ─
  it('resume exige epoch esperada (CAS), release e processing=0 — sem force', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:resume-cas`, payload: { safe: true },
    });
    // Lease em voo ANTES do pause (durante o pause nada novo é claimed).
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect((await row(enqueued!.id)).status).toBe('processing');
    const paused = await pauseOutboxConsumption({ reason: 'cas window' });
    expect(paused.epoch).toBe(1);

    // epoch errada → CAS recusa.
    await expect(resumeOutboxConsumption({ expectedEpoch: 99, releaseId: RELEASE }))
      .rejects.toMatchObject({ code: 'OUTBOX_EPOCH_MISMATCH' });
    // release ausente/desconhecido/malformado → falha fechada.
    await expect(resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: '   ' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_REQUIRED' });
    await expect(resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: 'unknown' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_UNKNOWN' });
    await expect(resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: 'release#1' }))
      .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_INVALID' });

    // Lease em voo (processing > 0) → recusado. E NÃO existe force: a capability
    // foi removida, então nem um input com `force: true` extra passa — abandonar
    // um envio em andamento descartaria work in flight (duplicate-send).
    await expect(resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: RELEASE }))
      .rejects.toMatchObject({ code: 'OUTBOX_RESUME_BLOCKED_PROCESSING' });
    const forced = { expectedEpoch: paused.epoch, releaseId: RELEASE, force: true } as unknown as Parameters<
      typeof resumeOutboxConsumption
    >[0];
    await expect(resumeOutboxConsumption(forced))
      .rejects.toMatchObject({ code: 'OUTBOX_RESUME_BLOCKED_PROCESSING' });

    // Drenagem durante o pause: a liquidação em voo é liberada e zera processing.
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
    const resumed = await resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: RELEASE });
    expect(resumed.paused).toBe(false);
    expect(resumed.epoch).toBe(2);
    expect(resumed.releaseId).toBe(RELEASE);

    // Segundo resume com a mesma epoch → CAS recusa (estado mudou).
    await expect(resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: RELEASE }))
      .rejects.toMatchObject({ code: 'OUTBOX_NOT_PAUSED' });
  });

  it('pause duplicado é recusado (estado explícito, não idempotente cego)', async () => {
    await pauseOutboxConsumption({ reason: 'twice' });
    await expect(pauseOutboxConsumption({ reason: 'twice again' }))
      .rejects.toMatchObject({ code: 'OUTBOX_ALREADY_PAUSED' });
  });

  // ─── 8. Depois do release armado: fence preservada + legado negado ─────────
  it('após resume, claim novo usa a fence e liquidação velha é recusada', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:fence-after-resume`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'fence window' });
    const resumed = await resumeOutboxConsumption({
      expectedEpoch: 1, releaseId: RELEASE, operator: 'operator-b',
    });
    expect(resumed.releaseId).toBe(RELEASE);

    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(claimed).toBeDefined();
    expect((await row(enqueued!.id)).claim_release).toBe(RELEASE);

    // Reclamo por stale (geração 2) invalida o token antigo (fence 0036).
    await forceStale(enqueued!.id);
    const reclaimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(reclaimed!.claimGeneration).toBe(2);
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(false);
    await expect(markOutboxDelivered(reclaimed!.id, reclaimed!.claimGeneration)).resolves.toBe(true);
    expect((await row(enqueued!.id)).status).toBe('delivered');
  });

  it('claim legado por SQL é recusado depois do release armado (sem pause)', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-after-release`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'release window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    await expect(legacyClaim(enqueued!.id)).rejects.toThrow(/OUTBOX_RELEASE_MISMATCH/);
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  it('release ausente falha fechado antes do primeiro pause', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:unknown-release`, payload: { safe: true },
    });
    const savedRelease = process.env.OUTBOX_RELEASE_ID;
    delete process.env.OUTBOX_RELEASE_ID;
    try {
      await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }))
        .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_UNKNOWN' });
      expect((await row(enqueued!.id)).status).toBe('pending');
    } finally {
      if (savedRelease === undefined) delete process.env.OUTBOX_RELEASE_ID;
      else process.env.OUTBOX_RELEASE_ID = savedRelease;
    }
  });

  it('release antiga não liquida o mesmo job depois de nova geração assumir (inclusive após pause)', async () => {
    const releaseA = 'b'.repeat(40);
    const releaseB = 'c'.repeat(40);
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:same-job-handoff`, payload: { safe: true },
    });
    const savedRelease = process.env.OUTBOX_RELEASE_ID;
    try {
      process.env.OUTBOX_RELEASE_ID = releaseA;
      await pauseOutboxConsumption({ reason: 'handoff to release A' });
      await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: releaseA });
      const claimedA = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
      expect(claimedA).toBeDefined();

      // Recuo cercado pela release A deixa o mesmo job reclamável; a pausa
      // seguinte drena o estado A antes de dar posse à versão B.
      await pauseOutboxConsumption({ reason: 'handoff A to B' });
      await expect(markOutboxRetry(
        claimedA!.id, claimedA!.claimGeneration, claimedA!.attempts, 'test-retry', new Date(Date.now() - 1000),
      )).resolves.toBe(true);
      // Recria a condição de takeover no mesmo job sem envio externo.
      await pool.query(
        `UPDATE outbox_jobs SET next_attempt_at = NOW() - interval '1 second' WHERE id = $1`,
        [enqueued!.id],
      );

      process.env.OUTBOX_RELEASE_ID = releaseB;
      await resumeOutboxConsumption({ expectedEpoch: 3, releaseId: releaseB });
      const claimedB = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
      expect(claimedB!.claimGeneration).toBe(claimedA!.claimGeneration + 1);
      expect((await row(enqueued!.id)).claim_release).toBe(releaseB);

      await expect(legacySettle(enqueued!.id)).rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
      await expect(settleWithMarker(enqueued!.id, buildClaimMarker(releaseA, claimedA!.claimGeneration)))
        .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
      expect((await row(enqueued!.id)).status).toBe('processing');
      await expect(markOutboxDelivered(claimedB!.id, claimedB!.claimGeneration)).resolves.toBe(true);
    } finally {
      if (savedRelease === undefined) delete process.env.OUTBOX_RELEASE_ID;
      else process.env.OUTBOX_RELEASE_ID = savedRelease;
    }
  });

  it('claim por SQL com geração certa mas release de outro deployment é recusado', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:foreign-release-claim`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'foreign release window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    // Fence respeitada (geração +1) e release DIVERGENTE do gate armado.
    await expect(pool.query(
      `UPDATE outbox_jobs
          SET status = 'processing', attempts = attempts + 1,
              claim_generation = claim_generation + 1, claim_release = $2,
              updated_at = NOW()
        WHERE id = $1 AND status = 'pending' AND next_attempt_at <= NOW()`,
      [enqueued!.id, 'e'.repeat(40)],
    )).rejects.toThrow(/OUTBOX_RELEASE_MISMATCH/);
    expect((await row(enqueued!.id)).status).toBe('pending');

    // Release CERTO mas sem marcador transacional: identidade não autenticada.
    await expect(pool.query(
      `UPDATE outbox_jobs
          SET status = 'processing', attempts = attempts + 1,
              claim_generation = claim_generation + 1, claim_release = $2,
              updated_at = NOW()
        WHERE id = $1 AND status = 'pending' AND next_attempt_at <= NOW()`,
      [enqueued!.id, RELEASE],
    )).rejects.toThrow(/OUTBOX_CLAIM_IDENTITY_INVALID/);
    const after = await row(enqueued!.id);
    expect(after.status).toBe('pending');
    expect(after.claim_release).toBeNull();
  });

  it('liquidação legada em RUNNING é negada; cancelamento (LGPD) nunca é', async () => {
    const legacyJob = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-settle-running`, payload: { safe: true },
    });
    const cancelledJob = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:cancelled`, payload: { safe: true },
    });
    // Lease sem release (binário antigo) criado antes do gate armar.
    await legacyClaim(legacyJob!.id);
    expect((await row(legacyJob!.id)).claim_release).toBeNull();

    await pauseOutboxConsumption({ reason: 'settle window' });
    // Drenagem: o legado em voo liquida durante o pause (processing volta a 0),
    // então o resume NÃO precisa abandonar nada.
    await legacySettle(legacyJob!.id);
    expect((await row(legacyJob!.id)).status).toBe('delivered');
    // RUNNING com release armado — sem force, porque não há lease em voo.
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    // Claim novo (binário atual): a linha passa a portar o release armado.
    const armed = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:armed-claim`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: armed!.id });
    expect(claimed).toBeDefined();
    expect((await row(armed!.id)).claim_release).toBe(RELEASE);

    // RUNNING com release armado: liquidação SEM marcador transacional é negada
    // mesmo acertando uma linha que já carrega o release atual — o valor da
    // coluna não autentica ninguém.
    await expect(legacySettle(armed!.id)).rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
    expect((await row(armed!.id)).status).toBe('processing');

    // Marcador com release CERTO e geração ERRADA (holder antigo da mesma
    // release): negado.
    await expect(settleWithMarker(armed!.id, buildClaimMarker(RELEASE, claimed!.claimGeneration + 1)))
      .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);

    // Marcador válido (release + geração exatos): passa — prova que a negação
    // acima é do gate de identidade, não da fence do WHERE.
    await settleWithMarker(armed!.id, buildClaimMarker(RELEASE, claimed!.claimGeneration));
    expect((await row(armed!.id)).status).toBe('delivered');

    // Redação LGPD/cancelamento passa pelo gate em qualquer estado.
    await pauseOutboxConsumption({ reason: 'privacy window' });
    await pool.query(`UPDATE outbox_jobs SET status = 'cancelled', payload = '{"redacted":true}'::jsonb WHERE id = $1`, [cancelledJob!.id]);
    expect((await row(cancelledJob!.id)).status).toBe('cancelled');
  });

  // ─── 8a. Release antiga NÃO liquida claim da release nova (marcador velho) ─
  it('depois do resume, release antiga (A) não liquida claim da release nova (B) — nem com marcador velho', async () => {
    const releaseA = 'b'.repeat(40);
    const releaseB = 'c'.repeat(40);
    const eraAJob = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:era-a`, payload: { safe: true },
    });
    const eraBJob = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:era-b`, payload: { safe: true },
    });

    // ── Era A: gate armado com releaseA, lease legítimo da era antiga ──
    const savedRelease = process.env.OUTBOX_RELEASE_ID;
    try {
      process.env.OUTBOX_RELEASE_ID = releaseA;
      const pausedA = await pauseOutboxConsumption({ reason: 'era A window' });
      await resumeOutboxConsumption({ expectedEpoch: pausedA.epoch, releaseId: releaseA });
      const claimedA = await claimOutboxJob({ operations: [OPERATION], jobId: eraAJob!.id });
      expect(claimedA).toBeDefined();
      expect((await row(eraAJob!.id)).claim_release).toBe(releaseA);
      // O worker A liquida a PRÓPRIA linha com o marcador da própria era.
      await expect(markOutboxDelivered(claimedA!.id, claimedA!.claimGeneration)).resolves.toBe(true);
      const staleTokenA = buildClaimMarker(releaseA, claimedA!.claimGeneration);

      // ── Era B: gate rearmado; o processo agora é releaseB ──
      process.env.OUTBOX_RELEASE_ID = releaseB;
      const pausedB = await pauseOutboxConsumption({ reason: 'era B window' });
      await resumeOutboxConsumption({ expectedEpoch: pausedB.epoch, releaseId: releaseB });
      const claimedB = await claimOutboxJob({ operations: [OPERATION], jobId: eraBJob!.id });
      expect(claimedB).toBeDefined();
      expect((await row(eraBJob!.id)).claim_release).toBe(releaseB);

      // Worker zumbi da era A tenta liquidar o claim da era B carregando o
      // marcador VELHO (release + geração da era A): recusado mesmo que a
      // geração coincida — a posse é do par `<release>#<geração>` da linha.
      await expect(settleWithMarker(eraBJob!.id, staleTokenA))
        .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
      expect((await row(eraBJob!.id)).status).toBe('processing');

      // Marcador com a release certa mas geração errada: recusado.
      await expect(settleWithMarker(eraBJob!.id, buildClaimMarker(releaseB, claimedB!.claimGeneration + 1)))
        .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
      expect((await row(eraBJob!.id)).status).toBe('processing');

      // O dono legítimo (era B, marcador exato) liquida.
      await settleWithMarker(eraBJob!.id, buildClaimMarker(releaseB, claimedB!.claimGeneration));
      expect((await row(eraBJob!.id)).status).toBe('delivered');
    } finally {
      if (savedRelease !== undefined) process.env.OUTBOX_RELEASE_ID = savedRelease;
    }
  });

  // ─── 8b. Reclamo de stale legado: claim sem incremento de geração ─────────
  it('reclamo legado de stale (attempts++, geração parada) é bloqueado pelo gate', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-stale-reclaim`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    await forceStale(enqueued!.id);

    // Estado fresh (gate desarmado): o claim AINDA precisa incrementar a geração
    // exatamente uma vez — attempts++ sozinho não é claim novo.
    await expect(legacyStaleReclaim(enqueued!.id)).rejects.toThrow(/OUTBOX_CLAIM_GENERATION_INVALID/);
    const after = await row(enqueued!.id);
    expect(after.claim_generation).toBe(claimed!.claimGeneration);
    expect(after.attempts).toBe(claimed!.attempts);

    // Reclamo legado com o gate ARMADO (RUNNING): mesma recusa.
    await pauseOutboxConsumption({ reason: 'reclaim window' });
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });
    const second = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-stale-reclaim-2`, payload: { safe: true },
    });
    const claimedSecond = await claimOutboxJob({ operations: [OPERATION], jobId: second!.id });
    await forceStale(second!.id);
    await expect(legacyStaleReclaim(second!.id)).rejects.toThrow(/OUTBOX_CLAIM_GENERATION_INVALID/);
    expect((await row(second!.id)).claim_generation).toBe(claimedSecond!.claimGeneration);
  });

  it('reclamo legado de stale durante o pause é recusado (sem claim novo)', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:legacy-stale-reclaim-paused`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    await forceStale(enqueued!.id);
    await pauseOutboxConsumption({ reason: 'paused reclaim window' });

    await expect(legacyStaleReclaim(enqueued!.id)).rejects.toThrow(/OUTBOX_PAUSED/);
    const after = await row(enqueued!.id);
    expect(after.claim_generation).toBe(claimed!.claimGeneration);
    expect(after.attempts).toBe(claimed!.attempts);
  });

  it('liquidação da geração anterior é recusada depois do reclamo (marcador)', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:old-generation-settle`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'generation fence window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    const first = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    await forceStale(enqueued!.id);
    const reclaimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(reclaimed!.claimGeneration).toBe(first!.claimGeneration + 1);

    // Holder da geração 1 tentando liquidar com marcador da própria geração:
    // o gate nega — a posse é da geração ATUAL, não do release.
    await expect(settleWithMarker(enqueued!.id, buildClaimMarker(RELEASE, first!.claimGeneration)))
      .rejects.toThrow(/OUTBOX_LEGACY_SETTLEMENT_DENIED/);
    expect((await row(enqueued!.id)).status).toBe('processing');

    // Holder atual liquida normalmente.
    await expect(markOutboxDelivered(reclaimed!.id, reclaimed!.claimGeneration)).resolves.toBe(true);
    expect((await row(enqueued!.id)).status).toBe('delivered');
  });

  it('claim e liquidação novos carregam o marcador transacional e passam', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:marker-valid`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'marker window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    // Claim novo grava release + marcador transacional na mesma transação.
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(claimed).toBeDefined();
    expect((await row(enqueued!.id)).claim_release).toBe(RELEASE);
    // E a liquidação pelo repositório (marcador armado por ele) passa.
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
  });

  it('claim com release divergente do gate armado é recusado', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:marker-divergent`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'divergent window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    const saved = process.env.OUTBOX_RELEASE_ID;
    process.env.OUTBOX_RELEASE_ID = 'd'.repeat(40);
    try {
      expect(resolveConsumerRelease()).toBe('d'.repeat(40));
      await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }))
        .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_MISMATCH' });
    } finally {
      if (saved !== undefined) process.env.OUTBOX_RELEASE_ID = saved;
      else delete process.env.OUTBOX_RELEASE_ID;
    }
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  // ─── 8c. Release completo (sha) válido arma o gate ────────────────────────
  it('release sha de 64 chars arma o gate e passa intacto (sem redação)', async () => {
    const sha = 'c'.repeat(64);
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:sha-release`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'sha release window', operator: 'operator-sha' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: sha });

    const status = await getOutboxControlStatus();
    expect(status.releaseId).toBe(sha);

    const saved = process.env.OUTBOX_RELEASE_ID;
    process.env.OUTBOX_RELEASE_ID = sha;
    try {
      const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
      expect(claimed).toBeDefined();
      expect((await row(enqueued!.id)).claim_release).toBe(sha);
      await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
      expect((await row(enqueued!.id)).status).toBe('delivered');
    } finally {
      if (saved !== undefined) process.env.OUTBOX_RELEASE_ID = saved;
    }
  });

  // ─── 9. Release desconhecido falha fechado no claim ───────────────────────
  it('release desconhecido falha fechado no claim quando o gate está armado', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:unknown-release`, payload: { safe: true },
    });
    await pauseOutboxConsumption({ reason: 'unknown release window' });
    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });

    const saved = process.env.OUTBOX_RELEASE_ID;
    delete process.env.OUTBOX_RELEASE_ID;
    try {
      await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }))
        .rejects.toMatchObject({ code: 'OUTBOX_RELEASE_UNKNOWN' });
    } finally {
      if (saved !== undefined) process.env.OUTBOX_RELEASE_ID = saved;
    }
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  // ─── 10. Escopo tenant inalterado (pause é global; claim não filtra tenant) ─
  it('escopo de tenant do claim fica inalterado (pause é global, sem filtro novo)', async () => {
    const jobA = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:tenant-a`, payload: { safe: true },
    });
    const jobB = await enqueueOutboxForTests(getDb(), {
      clinicId: clinicBId, operation: OPERATION, businessKey: `${prefix}:tenant-b`, payload: { safe: true },
    });

    const claimedA = await claimOutboxJob({ operations: [OPERATION], jobId: jobA!.id });
    const claimedB = await claimOutboxJob({ operations: [OPERATION], jobId: jobB!.id });
    expect(claimedA).toBeDefined();
    expect(claimedB).toBeDefined();

    await pauseOutboxConsumption({ reason: 'global window' });
    await expect(claimOutboxJob({ operations: [OPERATION] })).resolves.toBeUndefined();

    // Drain durante o pause (liquidação em voo permitida) libera o resume.
    await expect(markOutboxDelivered(claimedA!.id, claimedA!.claimGeneration)).resolves.toBe(true);
    await expect(markOutboxDelivered(claimedB!.id, claimedB!.claimGeneration)).resolves.toBe(true);
    const status = await getOutboxControlStatus();
    expect(status.counts.processing).toBe(0);
    expect(status.drained).toBe(true);

    await resumeOutboxConsumption({ expectedEpoch: 1, releaseId: RELEASE });
    const afterResume = await claimOutboxJob({ operations: [OPERATION] });
    expect(afterResume).toBeUndefined(); // ambos os tenants liquidados — nada elegível
  });

  // ─── 10b. Consumer/scheduler invocation: pausado = zero dispatch ──────────
  it('invocação do consumer (processOutboxBatch) não despacha nada enquanto pausado', async () => {
    const { processOutboxBatch } = await import('@/lib/outbox/worker');
    // Operação CONHECIDA do worker (handler existe, módulo habilitado no seed):
    // o job é elegível de verdade — o vazio não pode ser vácuo.
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId,
      operation: OUTBOX_OPERATIONS.CRM_CONTACT_CHANGED,
      businessKey: `${prefix}:scheduler-paused`,
      payload: { ownerType: 'patient', ownerId: clinicId },
    });
    await pauseOutboxConsumption({ reason: 'scheduler paused window' });

    const results = await processOutboxBatch(2, 1);
    expect(results).toEqual([]);
    // Nada foi claimed: a linha segue pending, sem tentativa consumida.
    const after = await row(enqueued!.id);
    expect(after.status).toBe('pending');
    expect(after.attempts).toBe(0);
    expect(after.claim_generation).toBe(0);

    // A elegibilidade é REAL: rearmado o gate, o MESMO job é claimable pelo
    // claim do scheduler (o [] acima veio do pause, não de fila vazia).
    const paused = await getOutboxControlStatus();
    await resumeOutboxConsumption({ expectedEpoch: paused.epoch, releaseId: RELEASE });
    const claimed = await claimOutboxJob({
      operations: [OUTBOX_OPERATIONS.CRM_CONTACT_CHANGED], jobId: enqueued!.id,
    });
    expect(claimed).toBeDefined();
    // Limpeza pela fence do próprio lease (sem invocar handler de verdade).
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
    expect((await row(enqueued!.id)).status).toBe('delivered');
  });

  // ─── 11. Razão/operador sanitizados (sem PII/segredo no estado) ───────────
  it('reason/operator são sanitizados: sem PII/segredo e com teto de tamanho', async () => {
    const dirtyReason = 'contato maria.silva@example.com CPF 123.456.789-00 tel +55 11 98888-7777 token=example_token_abcdef1234567890 ' + 'x'.repeat(500);
    const paused = await pauseOutboxConsumption({ reason: dirtyReason, operator: '  operator\n' });

    const stored = await pool.query('SELECT reason, operator FROM outbox_control WHERE id = 1');
    const reason = stored.rows[0].reason as string;
    const operator = stored.rows[0].operator as string;
    for (const leak of ['maria.silva@example.com', '123.456.789-00', '98888-7777', 'example_token_abcdef1234567890', 'x'.repeat(500)]) {
      expect(reason).not.toContain(leak);
      expect(operator).not.toContain(leak);
    }
    expect(reason.length).toBeLessThanOrEqual(200);
    // Caractere de controle/newline não sobrevivem à sanitização.
    expect(operator).toBe('operator');
    expect(reason).not.toMatch(/[\u0000-\u001F]/);

    const status = await getOutboxControlStatus();
    expect(JSON.stringify(status)).not.toContain('maria.silva@example.com');
    expect(status.reason).toBe(paused.reason);
  });

  // ─── 12. Fail closed sem estado de controle ───────────────────────────────
  it('sem a linha singleton de controle o claim falha fechado', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:no-control`, payload: { safe: true },
    });
    await pool.query('DELETE FROM outbox_control WHERE id = 1');
    try {
      await expect(claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id }))
        .rejects.toBeInstanceOf(OutboxControlError);
      await expect(getOutboxControlStatus()).rejects.toMatchObject({ code: 'OUTBOX_CONTROL_UNAVAILABLE' });
    } finally {
      await pool.query(
        `INSERT INTO outbox_control (id, paused, epoch) VALUES (1, false, 0) ON CONFLICT (id) DO NOTHING`,
      );
    }
    expect((await row(enqueued!.id)).status).toBe('pending');
  });

  // ─── 13. Sem gate armado (fresh), claim e liquidação seguem normais ────────
  it('sem release armado o comportamento fresh é preservado (claim/liquidação)', async () => {
    const enqueued = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:fresh`, payload: { safe: true },
    });
    const claimed = await claimOutboxJob({ operations: [OPERATION], jobId: enqueued!.id });
    expect(claimed).toBeDefined();
    expect((await row(enqueued!.id)).claim_release).toBe(RELEASE);
    await expect(markOutboxDelivered(claimed!.id, claimed!.claimGeneration)).resolves.toBe(true);
    expect((await row(enqueued!.id)).status).toBe('delivered');
  });
});
