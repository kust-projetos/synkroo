/**
 * W4.5: Bootstrap do runtime — inicializado uma vez no boot do Worker/Node.
 * Chama bootstrapActions() (W3.4) via dynamic import para evitar que o build
 * do Workers resolva `next-auth/crypto` estaticamente (edge: crypto é global).
 *
 * Idempotente: bootstrapActions já tem flag `done` interno.
 * Edge-compatible: sem APIs Node (Buffer/fs). Apenas console + import dinâmico.
 */
export async function register() {
  // Dynamic import: evita que o webpack resolva next-auth → crypto na bundle do Workers
  const { bootstrapActions } = await import('@/core/actions/bootstrap');
  bootstrapActions();

  // Detecção de runtime (apenas logging — não gating)
  if (typeof EdgeRuntime !== 'undefined') {
    console.log('[synkroo:boot] Workers runtime (EdgeRuntime)');
  } else if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('[synkroo:boot] Node.js runtime (NEXT_RUNTIME)');
  } else {
    console.log('[synkroo:boot] Unknown runtime');
  }
}
