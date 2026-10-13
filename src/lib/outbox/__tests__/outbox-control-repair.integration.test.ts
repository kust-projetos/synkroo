/**
 * Integration — repair explícito do gate de manutenção + fail-closed FUNCIONAL
 * do readiness, contra PostgreSQL real (migration 0036 expandida).
 *
 * O que está sob teste (findings do reviewer):
 *  - readiness/repair não aceitam SHAPE: a linha singleton precisa EXISTIR e o
 *    trigger precisa estar HABILITADO (`tgenabled = 'O'`) antes de qualquer
 *    UPDATE — objeto presente mas inativo não decide nada;
 *  - o repair é ATOMICO: uma transação única, então um statement que falha no
 *    meio reverte o lote inteiro (nenhum gate parcialmente instalado);
 *  - o repair é idempotente e ainda REABILITA um trigger caído em DISABLED —
 *    `CREATE OR REPLACE TRIGGER` (PG14+) não tem janela de DROP+CREATE;
 *  - o ledger tem de casar EXATO com o journal: journal+1 (à frente) é recusado.
 *
 * Rodar com o harness canônico (DB isolado `synkroo_test`, defaults locais
 * versionados — nunca `.env` privado):
 *   TEST_DATABASE_URL=postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo_test \
 *     npm run test:integration:run -- src/lib/outbox/__tests__/outbox-control-repair.integration.test.ts
 */

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { Pool } from 'pg';
import { closeDb, getDb } from '@/lib/db/client';
import { claimOutboxJob, enqueueOutboxForTests } from '@/lib/outbox/outbox-repository';
import { pauseOutboxConsumption } from '@/lib/outbox/control';
import { checkMigrations } from '@/services/api-handlers/health/db';
import { checkReadiness } from '@/services/api-handlers/health/readiness';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

const PROJECT_ROOT = resolve(__dirname, '..', '..', '..', '..');
const REPAIR_SCRIPT = resolve(PROJECT_ROOT, 'scripts', 'outbox-control-repair.mjs');
const GATE_TRIGGER = 'outbox_jobs_control_gate';
const GATE_FUNCTION = 'outbox_enforce_control_gate';

const clinicId = randomUUID();
const prefix = `outbox-control-repair:${process.pid}:${Date.now()}`;
const OPERATION = 'outbox.repair.test';

let pool: Pool;

/** Roda o CLI do repair de verdade (processo filho, mesma connection string). */
function runRepairCli(args: string[]): { status: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync(process.execPath, [REPAIR_SCRIPT, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { status: failure.status ?? 1, stdout: failure.stdout ?? '', stderr: failure.stderr ?? '' };
  }
}

async function dropGateObjects(): Promise<void> {
  await pool.query(`DROP TRIGGER IF EXISTS "${GATE_TRIGGER}" ON "outbox_jobs"`);
  await pool.query(`DROP FUNCTION IF EXISTS "${GATE_FUNCTION}"()`);
}

async function gateTriggerEnabled(): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT t.tgenabled, t.tgtype, t.tgqual IS NULL AS no_predicate FROM pg_trigger t
      WHERE t.tgrelid = 'outbox_jobs'::regclass AND t.tgname = $1 AND NOT t.tgisinternal`,
    [GATE_TRIGGER],
  );
  return rows[0]?.tgenabled === 'O' && rows[0]?.tgtype === 19 && rows[0]?.no_predicate === true;
}

async function gateFunctionExists(): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = $1 AND n.nspname = current_schema()`,
    [GATE_FUNCTION],
  );
  return rows.length > 0;
}

/** Claim LEGADO por SQL direto — fence da 0036, sem release/marcador. */
async function legacyClaim(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE outbox_jobs
        SET status = 'processing', attempts = attempts + 1,
            claim_generation = claim_generation + 1, updated_at = NOW()
      WHERE id = $1 AND status = 'pending' AND next_attempt_at <= NOW()`,
    [jobId],
  );
}

describeIntegration('outbox control repair + readiness fail-closed against PostgreSQL', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES ($1, 'Outbox Control Repair Clinic', $2, '+5500000000013', 'outbox-repair@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [clinicId, `outbox-repair-${clinicId.slice(0, 8)}`]);
  });

  afterEach(async () => {
    await pool.query(
      `UPDATE outbox_control
          SET paused = false, epoch = 0, reason = NULL, operator = NULL,
              release_id = NULL, paused_at = NULL, resumed_at = NULL
        WHERE id = 1`,
    );
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
  });

  afterAll(async () => {
    // O gate é estado GLOBAL do banco de teste: garante a volta ao íntegro.
    if (!(await gateTriggerEnabled()) || !(await gateFunctionExists())) {
      runRepairCli(['--apply']);
    }
    await pool.query('DELETE FROM outbox_jobs WHERE business_key LIKE $1', [`${prefix}%`]);
    await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
    await pool.end();
    await closeDb();
  });

  // ─── 3. Readiness falha fechado sem linha singleton / trigger inativo ─────
  it('readiness falha fechado sem a linha singleton de controle', async () => {
    await pool.query('DELETE FROM outbox_control WHERE id = 1');
    try {
      const migrations = await checkMigrations();
      expect(migrations.maintenanceControl).toBe('missing');
      expect(migrations.complete).toBe(false);
      expect(migrations.ledgerComplete).toBe(true);

      const readiness = await checkReadiness();
      expect(readiness.ok).toBe(false);
      expect(readiness.reason).toBe('maintenance-control-missing');
    } finally {
      await pool.query(
        `INSERT INTO outbox_control (id, paused, epoch) VALUES (1, false, 0)
         ON CONFLICT (id) DO NOTHING`,
      );
    }
    expect((await checkMigrations()).maintenanceControl).toBe('present');
  });

  it('readiness falha fechado com o trigger desabilitado (shape não é segurança)', async () => {
    await pool.query(`ALTER TABLE "outbox_jobs" DISABLE TRIGGER "${GATE_TRIGGER}"`);
    try {
      // Objeto EXISTE, mas não decide: o gate não vale nada desabilitado.
      expect((await checkMigrations()).maintenanceControl).toBe('missing');
      expect((await checkReadiness()).ok).toBe(false);

      // A evidência do perigo: com o trigger fora, o pause não é aplicado pelo
      // banco e um claim por SQL direto passa.
      await pauseOutboxConsumption({ reason: 'disabled trigger window' });
      const job = await enqueueOutboxForTests(getDb(), {
        clinicId, operation: OPERATION, businessKey: `${prefix}:disabled-trigger`, payload: { safe: true },
      });
      await legacyClaim(job!.id);
      expect((await claimOutboxJob({ operations: [OPERATION], jobId: job!.id }))).toBeUndefined();
    } finally {
      await pool.query(`ALTER TABLE "outbox_jobs" ENABLE TRIGGER "${GATE_TRIGGER}"`);
    }
    expect((await checkMigrations()).maintenanceControl).toBe('present');
  });

  it('readiness passa com o gate funcional (linha + trigger habilitado)', async () => {
    const migrations = await checkMigrations();
    expect(migrations.ledgerComplete).toBe(true);
    expect(migrations.maintenanceControl).toBe('present');
    expect(migrations.complete).toBe(true);
    expect(migrations.applied).toBe(migrations.expected);
    expect((await checkReadiness()).ok).toBe(true);
  });

  // ─── 4. Repair: dry-run, apply idempotente, reabilitação e atomicidade ────
  it('repair dry-run não muta e --apply instala o gate de forma idempotente', async () => {
    await dropGateObjects();
    expect((await checkMigrations()).maintenanceControl).toBe('missing');

    const dry = runRepairCli([]);
    expect(dry.status).toBe(1);
    expect(dry.stdout).toContain('OUTBOX_CONTROL_SHAPE=missing');
    expect(dry.stdout).toContain('dry-run: nothing was changed');
    expect((await checkMigrations()).maintenanceControl).toBe('missing');

    const applied = runRepairCli(['--apply']);
    expect(applied.status).toBe(0);
    expect(applied.stdout).toContain('OUTBOX_CONTROL_REPAIR=applied');
    expect(applied.stdout).toContain('OUTBOX_CONTROL_SHAPE=present');
    expect((await checkMigrations()).maintenanceControl).toBe('present');
    expect(await gateTriggerEnabled()).toBe(true);

    // Segunda execução: shape já presente, nada reaplicado.
    const again = runRepairCli(['--apply']);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain('OUTBOX_CONTROL_SHAPE=present');
    expect(again.stdout).not.toContain('OUTBOX_CONTROL_REPAIR=applied');

    // Funcional: o trigger voltou a gatear o pause no banco.
    await pauseOutboxConsumption({ reason: 'post-repair gate check' });
    const job = await enqueueOutboxForTests(getDb(), {
      clinicId, operation: OPERATION, businessKey: `${prefix}:post-repair-gate`, payload: { safe: true },
    });
    await expect(legacyClaim(job!.id)).rejects.toThrow(/OUTBOX_PAUSED/);
  });

  it('repair reabilita trigger caído em DISABLED sem janela de DROP+CREATE', async () => {
    await pool.query(`ALTER TABLE "outbox_jobs" DISABLE TRIGGER "${GATE_TRIGGER}"`);
    expect((await checkMigrations()).maintenanceControl).toBe('missing');

    const applied = runRepairCli(['--apply']);
    expect(applied.status).toBe(0);
    expect(applied.stdout).toContain('OUTBOX_CONTROL_SHAPE=present');

    // CREATE OR REPLACE TRIGGER: o trigger volta HABILITADO (sem DROP+CREATE,
    // sem janela em que o gate não existe).
    expect(await gateTriggerEnabled()).toBe(true);
    expect((await checkMigrations()).maintenanceControl).toBe('present');
    expect((await checkReadiness()).ok).toBe(true);
  });

  it('readiness rejeita trigger habilitado com evento/timing/granularidade incorretos e repair corrige', async () => {
    await pool.query(`DROP TRIGGER "${GATE_TRIGGER}" ON "outbox_jobs"`);
    await pool.query(
      `CREATE TRIGGER "${GATE_TRIGGER}" AFTER DELETE ON "outbox_jobs"
       FOR EACH STATEMENT EXECUTE FUNCTION "${GATE_FUNCTION}"()`,
    );
    const wrongShape = await pool.query(
      `SELECT tgtype, tgqual IS NULL AS no_predicate, tgenabled
         FROM pg_trigger WHERE tgrelid = 'outbox_jobs'::regclass AND tgname = $1`,
      [GATE_TRIGGER],
    );
    expect(wrongShape.rows[0]).toMatchObject({ tgtype: 8, no_predicate: true, tgenabled: 'O' });
    expect((await checkMigrations()).maintenanceControl).toBe('missing');
    expect((await checkReadiness()).reason).toBe('maintenance-control-missing');

    const applied = runRepairCli(['--apply']);
    expect(applied.status).toBe(0);
    expect((await checkMigrations()).maintenanceControl).toBe('present');
    const repairedShape = await pool.query(
      `SELECT tgtype, tgqual IS NULL AS no_predicate, tgenabled
         FROM pg_trigger WHERE tgrelid = 'outbox_jobs'::regclass AND tgname = $1`,
      [GATE_TRIGGER],
    );
    expect(repairedShape.rows[0]).toMatchObject({ tgtype: 19, no_predicate: true, tgenabled: 'O' });
  });

  it('repair reverte atomicamente quando um statement falha (nada parcial)', async () => {
    await dropGateObjects();
    // Sabota a tabela de controle: NOT NULL sem default faz o INSERT da
    // migration falhar no MEIO do lote.
    await pool.query('DROP TABLE IF EXISTS outbox_control');
    await pool.query(
      `CREATE TABLE outbox_control (
         id integer PRIMARY KEY NOT NULL,
         paused boolean DEFAULT false NOT NULL,
         epoch integer DEFAULT 0 NOT NULL,
         sabotage_col text NOT NULL
       )`,
    );
    expect((await checkMigrations()).maintenanceControl).toBe('missing');

    try {
      const failed = runRepairCli(['--apply']);
      expect(failed.status).toBe(1);
      expect(failed.stderr).toContain('OUTBOX_CONTROL_REPAIR=failed');

      // Nada parcialmente aplicado: função e trigger continuam ausentes e o
      // INSERT revertido junto com o lote (transação única).
      expect(await gateFunctionExists()).toBe(false);
      expect(await gateTriggerEnabled()).toBe(false);
      expect((await checkMigrations()).maintenanceControl).toBe('missing');
    } finally {
      await pool.query('DROP TABLE outbox_control');
    }

    // Com a sabotagem removida, o repair converge de verdade.
    const repaired = runRepairCli(['--apply']);
    expect(repaired.status).toBe(0);
    expect((await checkMigrations()).maintenanceControl).toBe('present');
  });

  // ─── 6. Ledger EXATO: à frente do journal também é recusado ──────────────
  it('repair recusa ledger à frente do journal (journal+1) e não muda nada', async () => {
    await dropGateObjects();
    await pool.query(
      `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`,
      [`outbox-repair-probe-${process.pid}-${Date.now()}`, 1],
    );
    try {
      expect((await checkMigrations()).ledgerComplete).toBe(false);

      const dry = runRepairCli([]);
      expect(dry.status).toBe(1);
      expect(dry.stderr).toContain('LEDGER_AHEAD');

      const applied = runRepairCli(['--apply']);
      expect(applied.status).toBe(1);
      expect(applied.stderr).toContain('LEDGER_AHEAD');
      // Recusa sem mutar: o gate continuava ausente antes e depois.
      expect(await gateFunctionExists()).toBe(false);
      expect((await checkMigrations()).maintenanceControl).toBe('missing');
    } finally {
      await pool.query(
        `DELETE FROM drizzle.__drizzle_migrations WHERE hash LIKE $1`,
        [`outbox-repair-probe-${process.pid}-%`],
      );
    }

    expect((await checkMigrations()).ledgerComplete).toBe(true);
    const repaired = runRepairCli(['--apply']);
    expect(repaired.status).toBe(0);
    expect((await checkMigrations()).maintenanceControl).toBe('present');
  });
});
