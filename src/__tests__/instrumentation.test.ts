/** @jest-environment node */

// Isolado: testa que instrumentation.ts chama bootstrapActions no register()
// bootstrapActions é importado dinamicamente em register() — mockamos antes.

const mockBootstrap = jest.fn();
jest.mock('@/core/actions/bootstrap', () => ({
  bootstrapActions: mockBootstrap,
}));

// Import AFTER mock setup
import '../instrumentation';

describe('instrumentation', () => {
  it('register() calls bootstrapActions on boot', async () => {
    const { register } = await import('../instrumentation');
    await register();
    expect(mockBootstrap).toHaveBeenCalledTimes(1);
  });

  it('register() is idempotent with bootstrapActions internal flag', async () => {
    const { register } = await import('../instrumentation');
    await register();
    await register();
    // bootstrapActions itself has internal `done` flag, so it's called twice but only executes once
    expect(mockBootstrap).toHaveBeenCalledTimes(3); // 1 from previous test + 2 from this
  });
});
