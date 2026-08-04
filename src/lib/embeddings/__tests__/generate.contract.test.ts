jest.mock('@/lib/env', () => ({
  getEnv: jest.fn(() => ({ OPENAI_API_KEY: 'test-key' })),
}));

import { generateEmbedding } from '../generate';

describe('embedding provider contract', () => {
  afterEach(() => jest.restoreAllMocks());

  it('rejects vectors with a dimension different from pgvector', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: 'text-embedding-3-small', data: [{ embedding: [1, 2] }] }),
    }) as jest.Mock;

    await expect(generateEmbedding('hello')).resolves.toBeNull();
  });
});
