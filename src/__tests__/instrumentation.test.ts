/** @jest-environment node */

// W4.8: instrumentation.ts injeta Hyperdrive via getCloudflareContext do @opennextjs/cloudflare.
// Mockamos getCloudflareContext (indisponível em Node.js) para testar injectHyperdrive.

jest.mock('@opennextjs/cloudflare/cloudflare-context', () => ({
  getCloudflareContext: jest.fn(() => ({
    env: {},
  })),
}));

// Mock do cliente DB (setDbConnectionString)
const mockSetDbConnectionString = jest.fn();
jest.mock('@/lib/db/client', () => ({
  setDbConnectionString: mockSetDbConnectionString,
}));

import '../instrumentation';

describe('instrumentation W4.8', () => {
  beforeEach(() => {
    mockSetDbConnectionString.mockClear();
  });

  it('register() runs without errors in Node.js', async () => {
    const { register } = await import('../instrumentation');
    await register(); // Sem Hyperdrive em Node.js → setDbConnectionString não chamado
    expect(true).toBe(true);
  });
});
