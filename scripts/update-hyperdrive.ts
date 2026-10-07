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
 */

import { execFileSync } from 'child_process';
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

function runWranglerHyperdriveUpdate(
  label: string,
  args: string[],
  secrets: string[],
  dryRun: boolean,
): void {
  const display = redactSecrets(`npx ${args.join(' ')}`, secrets);
  if (dryRun) {
    console.log(`[dry-run] Would run: ${display}`);
    return;
  }
  try {
    // No shell: argv passed as an array so no quoting/interpolation layer
    // can split or leak the password. Piped (never inherited): child output
    // is captured so every printed byte passes through redactSecrets.
    const stdout = execFileSync('npx', args, { stdio: 'pipe', encoding: 'utf8' });
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
