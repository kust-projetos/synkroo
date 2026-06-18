/**
 * W4.5: Bootstrap do runtime — inicializado uma vez no boot do Worker/Node.
 * Chama bootstrapActions() (W3.4) via dynamic import para evitar que o build
 * do Workers resolva `next-auth/crypto` estaticamente (edge: crypto é global).
 *
 * Idempotente: bootstrapActions já tem flag `done` interno.
 * Edge-compatible: sem APIs Node (Buffer/fs). Apenas console + import dinâmico.
 */
export async function register() {
  // Bootstrap lazy: dynamic import para evitar que edge runtime tente carregar pg.
  // Se falhar (ex: edge sem pg), logamos warning e seguimos.
  try {
    const { bootstrapActions } = await import('@/core/actions/bootstrap');
    await bootstrapActions();
  } catch (err) {
    console.warn(
      '[synkroo:boot] bootstrapActions skipped:',
      err instanceof Error ? err.message : String(err),
    );
  }

  // Detecção de runtime (apenas logging — não gating)
  if (typeof EdgeRuntime !== 'undefined') {
    console.warn('[synkroo:boot] Workers runtime (EdgeRuntime)');
  } else if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.warn('[synkroo:boot] Node.js runtime (NEXT_RUNTIME)');
  } else {
    console.warn('[synkroo:boot] Unknown runtime');
  }
}
