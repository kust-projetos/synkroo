import { upsertEmbedding } from '../search';

const where = jest.fn().mockResolvedValue([]);
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
});
