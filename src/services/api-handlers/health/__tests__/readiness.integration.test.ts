/**
 * Integration: readiness real contra PostgreSQL migrado (regressão E2a).
 *
 * Motivo: o readiness interno rodava o timeout de statement como
 * `SET LOCAL statement_timeout = $1`. PostgreSQL rejeita parâmetro de
 * protocolo no valor de `SET LOCAL`, então a transação inteira falhava —
 * mesmo com banco acessível e ledger completo — e `checkReadiness()`
 * devolvia `db-unreachable` em poucos ms (falso negativo: DB saudável
 * derrubado pelo probe de readiness). O ledger de migrations continuava
 * correto porque a consulta direta, fora da transação, não passa pelo
 * `SET LOCAL`.
 *
 * Este teste falha antes da correção (`ok:false`, `reason:'db-unreachable'`)
 * e passa depois dela (`set_config('statement_timeout', $1, true)`).
 *
 * Run: npm run test:integration:run -- src/services/api-handlers/health/__tests__/readiness.integration.test.ts
 */

/** @jest-environment node */

import { sql } from 'drizzle-orm';
import { getDb, closeDb } from '@/lib/db/client';
import { EXPECTED_MIGRATIONS, checkMigrations } from '../db';
import { checkReadiness } from '../readiness';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;

type Rows<T> = { rows?: T[] };

describeIntegration('checkReadiness contra PostgreSQL migrado (regressão E2a)', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('DATABASE_URL aponta para um banco acessível e migrado', async () => {
    expect(process.env.DATABASE_URL).toBeTruthy();

    const db = getDb();
    // `SELECT 1` simples — mesma query barata que o readiness executa.
    const ping = (await db.execute(sql`SELECT 1 AS ok`)) as Rows<{ ok: number }>;
    expect(ping.rows?.[0]?.ok).toBe(1);
  });

  it('retorna ok:true (sem reason) quando banco e migrations estão completos', async () => {
    const result = await checkReadiness();

    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(typeof result.durationMs).toBe('number');
  });

  it('o ledger aplicado casa com EXPECTED_MIGRATIONS', async () => {
    const status = await checkMigrations();

    expect(status).toEqual({
      complete: true,
      applied: EXPECTED_MIGRATIONS,
      expected: EXPECTED_MIGRATIONS,
    });
  });

  it('é estável em chamadas repetidas (transação válida, sem estado colateral)', async () => {
    const first = await checkReadiness();
    const second = await checkReadiness();

    expect(second.ok).toBe(true);
    expect(second.reason).toBeUndefined();
    expect(first.ok).toBe(true);
  });
});
