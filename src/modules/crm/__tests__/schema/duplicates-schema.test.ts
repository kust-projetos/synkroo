import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as dbSchema from '@/lib/db/schema';
import { crmDuplicateSuggestions } from '@/modules/crm/schema/duplicates';

const WORKTREE_ROOT = process.cwd();
const MIGRATION_NAME = '0004_crm_duplicate_suggestions.sql';
const MIGRATION_PATH = join(
  WORKTREE_ROOT,
  'src',
  'lib',
  'db',
  'migrations',
  MIGRATION_NAME,
);
const JOURNAL_PATH = join(
  WORKTREE_ROOT,
  'src',
  'lib',
  'db',
  'migrations',
  'meta',
  '_journal.json',
);
const SNAPSHOT_PATH = join(
  WORKTREE_ROOT,
  'src',
  'lib',
  'db',
  'migrations',
  'meta',
  '0004_snapshot.json',
);
const DB_TEST_URL = process.env.CRM_SCHEMA_TEST_DATABASE_URL;
const describeDb = process.env.RUN_CRM_SCHEMA_DB_TESTS === '1'
  ? describe
  : describe.skip;
const INSERT_SUGGESTION_SQL = `
  INSERT INTO crm_duplicate_suggestions (
    clinic_id, owner_type, left_id, right_id, status, confidence,
    duplicate_score, signals, left_snapshot, right_snapshot
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
`;

interface SuggestionFixture {
  clinicId: string | null;
  ownerType?: string;
  leftId?: string;
  rightId?: string;
  status?: string;
  confidence?: string;
  duplicateScore?: number;
}

function insertSuggestion(pool: Pool, fixture: SuggestionFixture) {
  return pool.query(INSERT_SUGGESTION_SQL, [
    fixture.clinicId,
    fixture.ownerType ?? 'patient',
    fixture.leftId ?? randomUUID(),
    fixture.rightId ?? randomUUID(),
    fixture.status ?? 'pending',
    fixture.confidence ?? 'high',
    fixture.duplicateScore ?? 90,
  ]);
}

describe('CRM duplicate suggestions schema', () => {
  it('defines required persistence columns', () => {
    expect({
      clinicId: crmDuplicateSuggestions.clinicId.name,
      ownerType: crmDuplicateSuggestions.ownerType.name,
      status: crmDuplicateSuggestions.status.name,
      confidence: crmDuplicateSuggestions.confidence.name,
      mergeOperationKey: crmDuplicateSuggestions.mergeOperationKey.name,
    }).toEqual({
      clinicId: 'clinic_id',
      ownerType: 'owner_type',
      status: 'status',
      confidence: 'confidence',
      mergeOperationKey: 'merge_operation_key',
    });
  });

  it('requires clinic and duplicate evidence', () => {
    expect({
      clinicId: crmDuplicateSuggestions.clinicId.notNull,
      signals: crmDuplicateSuggestions.signals.notNull,
      leftSnapshot: crmDuplicateSuggestions.leftSnapshot.notNull,
      rightSnapshot: crmDuplicateSuggestions.rightSnapshot.notNull,
    }).toEqual({
      clinicId: true,
      signals: true,
      leftSnapshot: true,
      rightSnapshot: true,
    });
  });

  it('registers lifecycle checks and lookup indexes', () => {
    const config = getTableConfig(crmDuplicateSuggestions);

    expect({
      checks: config.checks.map(({ name }) => name).sort(),
      indexes: config.indexes.map(({ config: index }) => index.name).sort(),
    }).toEqual({
      checks: [
        'crm_duplicate_suggestions_confidence_check',
        'crm_duplicate_suggestions_left_right_check',
        'crm_duplicate_suggestions_owner_type_check',
        'crm_duplicate_suggestions_score_check',
        'crm_duplicate_suggestions_status_check',
        'crm_duplicate_suggestions_winner_check',
      ],
      indexes: [
        'crm_duplicate_suggestions_left_lookup_idx',
        'crm_duplicate_suggestions_merge_operation_key_uniq',
        'crm_duplicate_suggestions_pair_canonical_uniq',
        'crm_duplicate_suggestions_queue_idx',
        'crm_duplicate_suggestions_right_lookup_idx',
      ],
    });
  });

  it('re-exports the table from the aggregate database schema', () => {
    expect(dbSchema.crmDuplicateSuggestions).toBe(crmDuplicateSuggestions);
  });

  it('records canonical constraints in the SQL migration', () => {
    const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');
    const compactSql = migrationSql.replace(/\s+/g, ' ').toLowerCase();

    expect({
      table: compactSql.includes('create table "crm_duplicate_suggestions"'),
      pair: compactSql.includes(
        'unique index "crm_duplicate_suggestions_pair_canonical_uniq"',
      ) && compactSql.includes('least(left_id, right_id)')
        && compactSql.includes('greatest(left_id, right_id)'),
      status: compactSql.includes(
        'constraint "crm_duplicate_suggestions_status_check"',
      ),
      confidence: compactSql.includes(
        'constraint "crm_duplicate_suggestions_confidence_check"',
      ),
      rollback: compactSql.includes(
        'drop table if exists crm_duplicate_suggestions',
      ),
    }).toEqual({
      table: true,
      pair: true,
      status: true,
      confidence: true,
      rollback: true,
    });
  });

  it('registers the migration in the Drizzle journal', () => {
    const journal = JSON.parse(readFileSync(JOURNAL_PATH, 'utf8')) as {
      entries: Array<{ tag: string }>;
    };

    expect(journal.entries.at(-1)?.tag).toBe('0004_crm_duplicate_suggestions');
  });

  it('records the table in the latest Drizzle snapshot', () => {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as {
      tables: Record<string, unknown>;
    };

    expect(
      Object.hasOwn(snapshot.tables, 'public.crm_duplicate_suggestions'),
    ).toBe(true);
  });
});

describeDb('CRM duplicate suggestions database constraints', () => {
  let pool: Pool;
  let clinicId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DB_TEST_URL });
    const slug = `crm-dedup-${randomUUID()}`;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO clinics (name, slug, phone, email)
       VALUES ('CRM Dedup Test', $1, '11999999999', 'crm-dedup@test.local')
       RETURNING id`,
      [slug],
    );
    clinicId = result.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId]);
    await pool.end();
  });

  it('treats reversed ids as the same canonical pair', async () => {
    const leftId = randomUUID();
    const rightId = randomUUID();
    await insertSuggestion(pool, { clinicId, leftId, rightId });

    await expect(
      insertSuggestion(pool, { clinicId, leftId: rightId, rightId: leftId }),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'crm_duplicate_suggestions_pair_canonical_uniq',
    });
  });

  it('rejects suggestions that compare a record with itself', async () => {
    const recordId = randomUUID();

    await expect(
      insertSuggestion(pool, { clinicId, leftId: recordId, rightId: recordId }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'crm_duplicate_suggestions_left_right_check',
    });
  });

  it('rejects unknown lifecycle statuses', async () => {
    await expect(
      insertSuggestion(pool, { clinicId, status: 'unknown' }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'crm_duplicate_suggestions_status_check',
    });
  });

  it('rejects unknown confidence values', async () => {
    await expect(
      insertSuggestion(pool, { clinicId, confidence: 'low' }),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'crm_duplicate_suggestions_confidence_check',
    });
  });

  it('requires clinic scope', async () => {
    await expect(
      insertSuggestion(pool, { clinicId: null }),
    ).rejects.toMatchObject({
      code: '23502',
      column: 'clinic_id',
    });
  });
});
