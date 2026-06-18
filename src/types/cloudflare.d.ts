/**
 * Cloudflare Workers globals — declarações de tipo para o runtime Workers.
 * W4.2: Hyperdrive binding para acesso a Postgres via pooler.
 */
declare const EdgeRuntime: string | undefined;

interface Hyperdrive {
  connectionString: string;
}
