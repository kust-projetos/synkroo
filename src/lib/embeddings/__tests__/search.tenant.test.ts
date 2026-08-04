import { upsertEmbedding } from '../search';

const returning = jest.fn().mockResolvedValue([]);
const where = jest.fn(() => ({ returning }));
const update = jest.fn(() => ({
  set: jest.fn(() => ({ where })),
}));

jest.mock('@/lib/db/client', () => ({ getDb: () => ({ update }) }));

describe('embedding ownership', () => {
  it('scopes updates to the active clinic', async () => {
    const result = await upsertEmbedding('clinic-a', 'knowledge-b', [1, 2]);

    expect(result).toBe(false);
    expect(where).not.toHaveBeenCalled();
  });

  it('reports not found when tenant-scoped knowledge does not exist', async () => {
    const embedding = Array.from({ length: 1536 }, () => 0.1);

    await expect(upsertEmbedding('clinic-a', 'knowledge-b', embedding)).resolves.toBe(false);
    expect(returning).toHaveBeenCalledTimes(1);
  });
});
