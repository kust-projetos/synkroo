/**
 * scripts/update-hyperdrive.ts
 *
 * Updates Cloudflare Hyperdrive configurations for staging and production
 * to point to ONE VPS PostgreSQL 17 instance (both databases live on that host).
 *
 * Usage:
 *   npx tsx scripts/update-hyperdrive.ts --side=source
 *   npx tsx scripts/update-hyperdrive.ts --side=target
 *   npx tsx scripts/update-hyperdrive.ts --side=source --dry-run   # plan only, no wrangler calls
 *
 *   --side (REQUIRED) source = the current VPS, target = the destination VPS.
 *          There is no default: a missing or invalid side aborts. Both
 *          Hyperdrive configs (staging + production) are updated per run.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Connection values come from VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD},
 * each falling back to its deprecated generic VPS_* alias with a warning.
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
import {
  VPS_SIDE_INVALID_CODE,
  VPS_SIDES,
  loadVpsEnv,
  readCliFlag,
  requireVpsSideSetting,
  resolveVpsSideSettings,
  vpsEnvSourceHint,
} from './lib/vps-env.mjs';

const STAGING_HYPERDRIVE_ID = 'e0033a75f4e2449084b00b41e22e49a6';
const PROD_HYPERDRIVE_ID = 'be5a789a003e4f08a94a82dffbb091be';

const USAGE = [
  'Usage:',
  '  npx tsx scripts/update-hyperdrive.ts --side=source|target [--dry-run]',
  '',
  '  --side REQUIRED. source = current VPS, target = destination VPS.',
  '  --dry-run plan only: print the wrangler commands without executing.',
].join('\n');

async function main() {
  const args = process.argv.slice(2);
  // Plan-only mode: print the wrangler commands without executing.
  // wrangler-cli.mjs has no dry-run support, so the bare flag is read here.
  const dryRun = args.includes('--dry-run');
  const side = readCliFlag(args, 'side');
  if (side === undefined || !VPS_SIDES.includes(side)) {
    console.error(
      side === undefined
        ? `--side is required (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`
        : `--side="${side}" is not a valid side (${VPS_SIDE_INVALID_CODE}): expected ${VPS_SIDES.join(' or ')}.`,
    );
    console.error(USAGE);
    process.exit(1);
  }

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // All connection values come exclusively from process.env or the resolved
  // private env file. No credentials, hosts, or ports are hardcoded in this file.
  const settings = resolveVpsSideSettings(side, {
    values,
    hint,
    warn: (message: string) => console.warn(message),
  });
  // This script drives both Hyperdrive configs in one run, so every field is
  // required: `requireVpsSideSetting` narrows them for the driver without
  // widening the resolver's optional-field contract.
  const host = requireVpsSideSetting(settings, 'ip', hint) as string;
  const port = requireVpsSideSetting(settings, 'pgPort', hint) as number;
  const prodPassword = requireVpsSideSetting(settings, 'postgresPassword', hint) as string;
  const stagingPassword = requireVpsSideSetting(settings, 'stagingPassword', hint) as string;



  console.log(`side=${side} host=${host}:${port} source_env=${hint}${dryRun ? ' [dry-run: no changes]' : ''}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }

  let entry: string;
  try {
    entry = resolveWranglerEntry();
  } catch (resolveErr) {
    if (!dryRun) throw resolveErr;
    // Plan-only mode never fails for a missing wrangler install.
    entry = '<wrangler-entrypoint>';
  }
  const secrets = [stagingPassword, prodPassword];

  const stagingArgv = buildHyperdriveUpdateArgv({
    entry,
    id: STAGING_HYPERDRIVE_ID,
    host,
    port,
    database: 'synkroo_staging',
    user: 'synkroo_staging',
    password: stagingPassword,
  });
  const prodArgv = buildHyperdriveUpdateArgv({
    entry,
    id: PROD_HYPERDRIVE_ID,
    host,
    port,
    database: 'synkroo',
    user: 'synkroo',
    password: prodPassword,
  });
  // Dry-run minimum: wrangler-cli.mjs has no dry-run support, so the
  // resolved node commands are printed (redacted) without executing. The
  // display strings are precomputed off the console.* lines because the
  // hardening suite forbids credential-like tokens on log lines.
  const stagingDisplay = redactSecrets(`node ${stagingArgv.join(' ')}`, secrets);
  const prodDisplay = redactSecrets(`node ${prodArgv.join(' ')}`, secrets);
  if (dryRun) {
    console.log(`[dry-run] Would run: ${stagingDisplay}`);
    console.log(`[dry-run] Would run: ${prodDisplay}`);
    console.log('Dry-run complete: no Hyperdrive configuration changed.');
    return;
  }

  console.log(`1. Updating Staging Hyperdrive (side=${side}):`, STAGING_HYPERDRIVE_ID);
  runWranglerCli({
    label: `Staging Hyperdrive ${STAGING_HYPERDRIVE_ID}`,
    argv: stagingArgv,
    secrets,
  });
  console.log('Staging Hyperdrive updated successfully.\n');

  console.log(`2. Updating Production Hyperdrive (side=${side}):`, PROD_HYPERDRIVE_ID);
  runWranglerCli({
    label: `Production Hyperdrive ${PROD_HYPERDRIVE_ID}`,
    argv: prodArgv,
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
