/** @jest-environment node */

import { Pool } from 'pg';
import { closeDb } from '@/lib/db/client';
import { searchByVector } from '../search';

const describeIntegration = process.env.RUN_INTEGRATION_TESTS === '1' ? describe : describe.skip;
const CLINIC_A = '00000000-0000-0000-0000-00000000e101';
const CLINIC_B = '00000000-0000-0000-0000-00000000e102';
const KNOWLEDGE_A = '00000000-0000-0000-0000-00000000e111';
const KNOWLEDGE_B = '00000000-0000-0000-0000-00000000e112';
const KNOWLEDGE_INACTIVE = '00000000-0000-0000-0000-00000000e113';
const EMBEDDING = Array.from({ length: 1536 }, () => 0);

let pool: Pool;

describeIntegration('PostgreSQL embedding search', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const vector = `[${EMBEDDING.join(',')}]`;
    await pool.query(`
      INSERT INTO clinics (id, name, slug, phone, email, subscription_plan, subscription_status)
      VALUES
        ($1, 'Embedding Clinic A', 'embedding-clinic-a', '+5500000000101', 'embedding-a@test.local', 'starter', 'active'),
        ($2, 'Embedding Clinic B', 'embedding-clinic-b', '+5500000000102', 'embedding-b@test.local', 'starter', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [CLINIC_A, CLINIC_B]);
    await pool.query(`
      INSERT INTO knowledge_base (id, clinic_id, category, question, answer, keywords, embedding, is_active)
      VALUES
        ($1, $4, 'faq', 'Clinic A question', 'Clinic A answer', ARRAY['a'], $5::vector, true),
        ($2, $6, 'faq', 'Clinic B question', 'Clinic B answer', ARRAY['b'], $5::vector, true),
        ($3, $4, 'faq', 'Inactive question', 'Inactive answer', ARRAY['inactive'], $5::vector, false)
      ON CONFLICT (id) DO UPDATE SET clinic_id = EXCLUDED.clinic_id, embedding = EXCLUDED.embedding, is_active = EXCLUDED.is_active
    `, [KNOWLEDGE_A, KNOWLEDGE_B, KNOWLEDGE_INACTIVE, CLINIC_A, vector, CLINIC_B]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM knowledge_base WHERE id IN ($1, $2, $3)', [KNOWLEDGE_A, KNOWLEDGE_B, KNOWLEDGE_INACTIVE]);
    await pool.query('DELETE FROM clinics WHERE id IN ($1, $2)', [CLINIC_A, CLINIC_B]);
    await pool.end();
    await closeDb();
  });

  it('returns active knowledge only for the requested clinic', async () => {
    const results = await searchByVector(CLINIC_A, EMBEDDING, 10, 0.5);

    expect(results).toEqual([
      expect.objectContaining({ id: KNOWLEDGE_A, category: 'faq', question: 'Clinic A question' }),
    ]);
    expect(results.some((result) => result.id === KNOWLEDGE_B)).toBe(false);
    expect(results.some((result) => result.id === KNOWLEDGE_INACTIVE)).toBe(false);
  });
});
