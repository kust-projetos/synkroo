/**
 * scripts/update-hyperdrive.ts
 *
 * Updates Cloudflare Hyperdrive configurations for staging and production
 * to point to the VPS PostgreSQL 17 instance.
 *
 * Config: SYNKROO_VPS_ENV (canonical) > legacy fallback (deprecated,
 * see scripts/lib/load-vps-env.ts) > process.env only.
 *
 * Usage:
 *   npx tsx scripts/update-hyperdrive.ts
 *   npx tsx scripts/update-hyperdrive.ts --dry-run   # plan only, no wrangler calls
 *
 * Secret handling: the DB password is passed as a discrete argv element via
 * execFileSync (no shell string interpolation). It is still visible in the
 * local process table while wrangler runs — a documented limitation (P2:
 * move to a stdin/env-based secret handoff if wrangler supports one). Every
 * output/error surface passes through redactSecrets before logging.
 *
 * Windows: wrangler runs via `process.execPath` + `bin/wrangler.js`
 * (no `npx` shim — `npx.cmd` fails under execFileSync without shell).
 * Dry-run prints the resolved node command without executing (works even
 * when wrangler is not installed).
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import {
  describeOrigin,
  isDryRun,
  loadVpsEnv,
  redactSecrets,
  requireVpsValue,
  type LoadedVpsEnv,
} from './lib/load-vps-env';

function toText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Buffer.isBuffer(output)) return output.toString('utf8');
  return '';
}

/**
 * Resolve o entrypoint JS do Wrangler para execução via `process.execPath`.
 *
 * Por que não `npx wrangler`: no Windows o launcher é `npx.cmd` e
 * `execFileSync('npx', ...)` falha com ENOENT fora de shell (P1 WINDOWS).
 * Executar `bin/wrangler.js` com o node atual elimina a dependência de
 * shell/shim em qualquer OS, mantendo argv separado (sem interpolação).
 */
export function resolveWranglerEntry(): string {
  try {
    const require = createRequire(path.join(process.cwd(), 'package.json'));
    return require.resolve('wrangler/bin/wrangler.js');
  } catch {
    const fallback = path.resolve(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
    if (existsSync(fallback)) return fallback;
    throw new Error(
      'Wrangler entrypoint not found: install the `wrangler` devDependency ' +
        '(expected `wrangler/bin/wrangler.js` under node_modules).',
    );
  }
}

function runWranglerHyperdriveUpdate(
  label: string,
  args: string[],
  secrets: string[],
  dryRun: boolean,
): void {
  // Chamadas chegam como ['wrangler', 'hyperdrive', ...] (legado npx);
  // o 'wrangler' inicial é o bin, não argumento.
  const wranglerArgs = args[0] === 'wrangler' ? args.slice(1) : args;
  let entry: string;
  try {
    entry = resolveWranglerEntry();
  } catch {
    // Dry-run é plano apenas: nunca falha por wrangler ausente.
    entry = '<wrangler-entrypoint>';
  }
  const display = redactSecrets(`node ${entry} ${wranglerArgs.join(' ')}`, secrets);
  if (dryRun) {
    console.log(`[dry-run] Would run: ${display}`);
    return;
  }
  // Resolução real (lança se wrangler ausente) só no caminho de execução.
  entry = resolveWranglerEntry();
  try {
    // No shell: argv passado como array via node atual (Windows-safe:
    // sem npx.cmd/shim). Piped (nunca herdado): saída capturada passa
    // por redactSecrets antes de qualquer log.
    const stdout = execFileSync(process.execPath, [entry, ...wranglerArgs], { stdio: 'pipe', encoding: 'utf8' });
    const text = redactSecrets(toText(stdout), secrets).trimEnd();
    if (text) console.log(text);
  } catch (err) {
    const parts = [err instanceof Error ? err.message : 'unknown error'];
    if (err !== null && typeof err === 'object') {
      const childStdout = toText((err as { stdout?: unknown }).stdout);
      const childStderr = toText((err as { stderr?: unknown }).stderr);
      if (childStdout) parts.push(`stdout: ${childStdout}`);
      if (childStderr) parts.push(`stderr: ${childStderr}`);
    }
    throw new Error(`Failed to update ${label}: ${redactSecrets(parts.join('\n'), secrets)}`);
  }
}

async function main() {
  const vpsEnv: LoadedVpsEnv = loadVpsEnv({
    requiredKeys: [
      'VPS_IP',
      'VPS_PG_PORT',
      'VPS_POSTGRES_PASSWORD',
      'VPS_STAGING_PASSWORD',
    ],
  });
  const dryRun = isDryRun();
  // All connection values come exclusively from process.env or the
  // loader-resolved VPS config file. No credentials, hosts, or ports are
  // hardcoded in this file.
  const host = requireVpsValue(vpsEnv, 'VPS_IP');
  const port = requireVpsValue(vpsEnv, 'VPS_PG_PORT');
  const prodPassword = requireVpsValue(vpsEnv, 'VPS_POSTGRES_PASSWORD');
  const stagingPassword = requireVpsValue(vpsEnv, 'VPS_STAGING_PASSWORD');

  const STAGING_HYPERDRIVE_ID = 'e0033a75f4e2449084b00b41e22e49a6';
  const PROD_HYPERDRIVE_ID = 'be5a789a003e4f08a94a82dffbb091be';

  console.log(`Config: ${describeOrigin(vpsEnv)}${dryRun ? ' [dry-run: no changes]' : ''}`);

  console.log('1. Updating Staging Hyperdrive:', STAGING_HYPERDRIVE_ID);
  runWranglerHyperdriveUpdate(
    `Staging Hyperdrive ${STAGING_HYPERDRIVE_ID}`,
    [
      'wrangler',
      'hyperdrive',
      'update',
      STAGING_HYPERDRIVE_ID,
      `--host=${host}`,
      `--port=${port}`,
      '--scheme=postgres',
      '--database=synkroo_staging',
      '--user=synkroo_staging',
      `--password=${stagingPassword}`,
      '--sslmode=require',
    ],
    [stagingPassword, prodPassword],
    dryRun,
  );
  console.log('Staging Hyperdrive updated successfully.\n');

  console.log('2. Updating Production Hyperdrive:', PROD_HYPERDRIVE_ID);
  runWranglerHyperdriveUpdate(
    `Production Hyperdrive ${PROD_HYPERDRIVE_ID}`,
    [
      'wrangler',
      'hyperdrive',
      'update',
      PROD_HYPERDRIVE_ID,
      `--host=${host}`,
      `--port=${port}`,
      '--scheme=postgres',
      '--database=synkroo',
      '--user=synkroo',
      `--password=${prodPassword}`,
      '--sslmode=require',
    ],
    [stagingPassword, prodPassword],
    dryRun,
  );
  console.log(
    dryRun
      ? 'Dry-run complete: no Hyperdrive configuration changed.'
      : 'Production Hyperdrive updated successfully.\n',
  );
}

main().catch((err) => {
  // Log the message string only (already redacted at throw sites, redacted
  // again defensively): never log the raw error object, which may carry the
  // interpolated command line, stdout/stderr buffers, or other internals.
  const message = err instanceof Error ? redactSecrets(err.message) : 'unknown error';
  console.error('Failed to update Hyperdrive:', message);
  process.exit(1);
});
