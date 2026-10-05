/**
 * scripts/update-hyperdrive.ts
 *
 * Updates Cloudflare Hyperdrive configurations for staging and production
 * to point to the VPS PostgreSQL 17 instance.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * The Wrangler CLI is executed as an explicit argv through
 * `execFileSync(process.execPath, argv)` — no shell, so a password containing
 * spaces, quotes, `;`, `$(…)` or backticks cannot start a second command or
 * split an argument (see scripts/lib/wrangler-cli.mjs).
 */

import {
  buildHyperdriveUpdateArgv,
  redactSecrets,
  resolveWranglerEntry,
  runWranglerCli,
} from './lib/wrangler-cli.mjs';
import { loadVpsEnv, readVpsSetting, vpsEnvSourceHint } from './lib/vps-env.mjs';

const STAGING_HYPERDRIVE_ID = 'e0033a75f4e2449084b00b41e22e49a6';
const PROD_HYPERDRIVE_ID = 'be5a789a003e4f08a94a82dffbb091be';

async function main() {
  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  const host = readVpsSetting('VPS_IP', { values });
  if (!host) {
    throw new Error(`VPS_IP is missing: set it in process.env or ${hint}`);
  }
  const port = readVpsSetting('VPS_PG_PORT', { values });
  if (!port) {
    throw new Error(`VPS_PG_PORT is missing: set it in process.env or ${hint}`);
  }
  const prodPassword = readVpsSetting('VPS_POSTGRES_PASSWORD', { values });
  if (!prodPassword) {
    throw new Error(`VPS_POSTGRES_PASSWORD is missing: set it in process.env or ${hint}`);
  }
  // Strict credential separation: staging is never backfilled from production.
  const stagingPassword = readVpsSetting('VPS_STAGING_PASSWORD', { values });
  if (!stagingPassword) {
    throw new Error(`VPS_STAGING_PASSWORD is missing: set it in process.env or ${hint}`);
  }

  const entry = resolveWranglerEntry();
  const secrets = [stagingPassword, prodPassword];

  console.log('1. Updating Staging Hyperdrive:', STAGING_HYPERDRIVE_ID);
  runWranglerCli({
    label: `Staging Hyperdrive ${STAGING_HYPERDRIVE_ID}`,
    argv: buildHyperdriveUpdateArgv({
      entry,
      id: STAGING_HYPERDRIVE_ID,
      host,
      port,
      database: 'synkroo_staging',
      user: 'synkroo_staging',
      password: stagingPassword,
    }),
    secrets,
  });
  console.log('Staging Hyperdrive updated successfully.\n');

  console.log('2. Updating Production Hyperdrive:', PROD_HYPERDRIVE_ID);
  runWranglerCli({
    label: `Production Hyperdrive ${PROD_HYPERDRIVE_ID}`,
    argv: buildHyperdriveUpdateArgv({
      entry,
      id: PROD_HYPERDRIVE_ID,
      host,
      port,
      database: 'synkroo',
      user: 'synkroo',
      password: prodPassword,
    }),
    secrets,
  });
  console.log('Production Hyperdrive updated successfully.\n');
}

main().catch((err) => {
  // Log the message string only (already redacted at throw sites, redacted
  // again defensively): never log the raw error object, which may carry the
  // argv, stdout/stderr buffers, or other internals.
  const message = err instanceof Error ? redactSecrets(err.message) : 'unknown error';
  console.error('Failed to update Hyperdrive:', message);
  process.exit(1);
});