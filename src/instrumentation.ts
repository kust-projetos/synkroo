/**
 * W4.8: Runtime bootstrap — injetado uma vez no boot do Worker (Workers) ou Node.js.
 *
 * Responsabilidades:
 *   1. Hyperdrive (Workers): injeta connection string do binding HYPERDRIVE em
 *      globalThis.pg (injetado pelo script post-build em .open-next/worker.js).
 *   2. DATABASE_URL: lido normalmente via process.env (Node.js local / fallback).
 *
 * Edge-compatible: apenas globals (EdgeRuntime, process.env) + dynamic import.
 */
import { getCloudflareContext } from '@opennextjs/cloudflare/cloudflare-context';

/** Injeta connection string do Hyperdrive no cliente DB antes de qualquer запрос. */
async function injectHyperdrive() {
  try {
    // env.HYPERDRIVE só existe no runtime Workers (wrangler/wrangler dev)
    const ctx = getCloudflareContext() as unknown as { env?: Record<string, { connectionString?: string }> };
    if (ctx?.env?.HYPERDRIVE?.connectionString) {
      const { setDbConnectionString } = await import('@/lib/db/client');
      setDbConnectionString(ctx.env.HYPERDRIVE.connectionString);
    }
  } catch {
    // Ignora: getCloudflareContext não existe em Node.js, throw é esperado
  }
}

export async function register() {
  await injectHyperdrive();
}
