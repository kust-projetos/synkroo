/**
 * scripts/update-hyperdrive.ts
 *
 * Updates Cloudflare Hyperdrive configurations for staging and production
 * to point to ONE VPS PostgreSQL 17 instance (both databases live on that host).
 *
 * Transport: official Cloudflare API, individual PATCH per config —
 *   PATCH https://api.cloudflare.com/client/v4/accounts/{account_id}/hyperdrive/configs/{hyperdrive_id}
 *   { origin: { host, port, database, user, scheme, password } }   (partial: name/caching/mtls/limits kept)
 * A total PUT is never used. The database password travels ONLY inside the
 * HTTPS JSON body — never in argv, never in the URL, never in a log line
 * (see scripts/lib/hyperdrive-api.mjs). There is no Wrangler CLI call here.
 *
 * Usage:
 *   npx tsx scripts/update-hyperdrive.ts --side=source
 *   npx tsx scripts/update-hyperdrive.ts --side=target --target=prod
 *   npx tsx scripts/update-hyperdrive.ts --side=source --target=both
 *   npx tsx scripts/update-hyperdrive.ts --side=source --dry-run   # plan only, no API calls
 *
 *   --side (REQUIRED) source = the current VPS, target = the destination VPS.
 *          There is no default: a missing or invalid side aborts.
 *   --target staging | prod | both (default staging). Orthogonal to --side:
 *          --side selects WHICH VPS the configs point at, --target selects
 *          WHICH Hyperdrive config(s) are updated. The default is staging-only,
 *          so a staging run can never touch production as a side effect.
 *   --timeout-ms API budget per request (default 15000, range 1000-120000).
 *   --account-id Cloudflare account id (or CLOUDFLARE_ACCOUNT_ID in process.env).
 *   CLOUDFLARE_API_TOKEN (Hyperdrive Write scope) must be set in process.env:
 *          it is never accepted via argv, so it can never leak into process
 *          listings or shell history.
 *
 * Env file resolution (provider-neutral, see scripts/lib/vps-env.mjs):
 *   1. SYNKROO_VPS_ENV (explicit path; invalid values abort — no fallback)
 *   2. legacy ../vps-hostinger/.env (temporary, warns)
 *
 * Connection values come from VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD},
 * each falling back to its deprecated generic VPS_* alias with a warning.
 * Only the passwords required by --target are demanded (staging-only runs do
 * not require the production password). Cloudflare authority
 * (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN) comes exclusively from
 * process.env or the flags above — never from the VPS .env file.
 *
 * Each run snapshots the pre-update origin (safe fields only) via GET, PATCHes,
 * then reconciles via GET + compare. Re-running the same command is safe
 * (idempotent PATCH). Rollback = re-PATCH with the previous side's values:
 * re-run with --side=<previous side> for the failed --target.
 */

import {
  CF_RESPONSE_ERROR_CODE,
  applyHyperdriveTargets,
  planHyperdriveUpdates,
  redactApiSecrets,
  resolveCloudflareAuth,
  resolveHyperdriveTargetKeys,
  normalizeTimeoutMs,
  safeOriginText,
} from './lib/hyperdrive-api.mjs';
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
  '  npx tsx scripts/update-hyperdrive.ts --side=source|target [--target=staging|prod|both] [--dry-run]',
  '',
  '  --side REQUIRED. source = current VPS, target = destination VPS.',
  '  --target staging (default), prod, or both. staging-only by default: production',
  '           is never touched unless explicitly requested.',
  '  --dry-run plan only: print the PATCH plan without calling the API.',
  '  --timeout-ms API budget per request in ms (default 15000).',
  '  --account-id Cloudflare account id (or CLOUDFLARE_ACCOUNT_ID in process.env).',
  '  CLOUDFLARE_API_TOKEN must be set in process.env (Hyperdrive Write); never via argv.',
].join('\n');

// Module-scope redaction values for the terminal catch: main() assigns the
// resolved database passwords and the API token here so the catch can redact
// without touching argv or logging raw values.
let cachedRedactionValues: string[] = [];

interface TargetSpec {
  key: string;
  label: string;
  hyperdriveId: string;
  database: string;
  user: string;
  password: string;
}

async function main() {
  const args = process.argv.slice(2);
  // Plan-only mode: print the PATCH plan without calling the API.
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

  let targetKeys: 'staging' | 'prod' | 'both';
  try {
    targetKeys = resolveHyperdriveTargetKeys(readCliFlag(args, 'target'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'unknown error');
    console.error(USAGE);
    process.exit(1);
  }

  const { values, path: envPath, source } = loadVpsEnv();
  const hint = vpsEnvSourceHint({ path: envPath, source });
  // Only the passwords required by --target are demanded: a staging-only run
  // never requires the production password. All connection values come
  // exclusively from process.env or the resolved private env file.
  const requiredFields =
    targetKeys === 'staging'
      ? ['IP', 'PG_PORT', 'STAGING_PASSWORD']
      : targetKeys === 'prod'
        ? ['IP', 'PG_PORT', 'POSTGRES_PASSWORD']
        : undefined;
  const settings = resolveVpsSideSettings(side, {
    values,
    hint,
    ...(requiredFields === undefined ? {} : { require: requiredFields }),
    warn: (message: string) => console.warn(message),
  });
  const host = requireVpsSideSetting(settings, 'ip', hint) as string;
  const port = requireVpsSideSetting(settings, 'pgPort', hint) as number;
  const stagingDbPassword =
    targetKeys === 'prod' ? '' : (requireVpsSideSetting(settings, 'stagingPassword', hint) as string);
  const prodDbPassword =
    targetKeys === 'staging' ? '' : (requireVpsSideSetting(settings, 'postgresPassword', hint) as string);

  let accountId: string;
  let apiToken: string;
  try {
    ({ accountId, apiToken } = resolveCloudflareAuth({
      accountId: readCliFlag(args, 'account-id'),
    }));
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'unknown error');
    process.exit(1);
  }

  let timeoutMs: number;
  try {
    timeoutMs = normalizeTimeoutMs(readCliFlag(args, 'timeout-ms'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'unknown error');
    console.error(USAGE);
    process.exit(1);
  }

  console.log(`side=${side} host=${host}:${port} target=${targetKeys} source_env=${hint}${dryRun ? ' [dry-run: no changes]' : ''}`);
  if (settings.usedLegacyKeys.length > 0) {
    console.warn(
      `[deprecated] side="${side}" ainda lê as chaves genéricas ` +
        `${settings.usedLegacyKeys.join(', ')} — renomeie para as chaves ` +
        `VPS_${side.toUpperCase()}_* no .env`,
    );
  }

  const wanted: TargetSpec[] =
    targetKeys === 'both'
      ? [
          {
            key: 'staging',
            label: 'Staging Hyperdrive',
            hyperdriveId: STAGING_HYPERDRIVE_ID,
            database: 'synkroo_staging',
            user: 'synkroo_staging',
            password: stagingDbPassword,
          },
          {
            key: 'prod',
            label: 'Production Hyperdrive',
            hyperdriveId: PROD_HYPERDRIVE_ID,
            database: 'synkroo',
            user: 'synkroo',
            password: prodDbPassword,
          },
        ]
      : targetKeys === 'prod'
        ? [
            {
              key: 'prod',
              label: 'Production Hyperdrive',
              hyperdriveId: PROD_HYPERDRIVE_ID,
              database: 'synkroo',
              user: 'synkroo',
              password: prodDbPassword,
            },
          ]
        : [
            {
              key: 'staging',
              label: 'Staging Hyperdrive',
              hyperdriveId: STAGING_HYPERDRIVE_ID,
              database: 'synkroo_staging',
              user: 'synkroo_staging',
              password: stagingDbPassword,
            },
          ];

  const hidden = [stagingDbPassword, prodDbPassword, apiToken].filter(Boolean);
  cachedRedactionValues = hidden;

  // Dry-run minimum: the plan carries no password, no token and no fetch —
  // redaction is structural (those values are never plan inputs).
  if (dryRun) {
    for (const line of planHyperdriveUpdates({ targets: wanted, side, host, port, accountId })) {
      console.log(line);
    }
    console.log('Dry-run complete: no Hyperdrive configuration changed.');
    return;
  }

  const fetchImpl = (url: string, init: RequestInit) => fetch(url, init);
  const outcome = await applyHyperdriveTargets({
    fetchImpl,
    accountId,
    apiToken,
    targets: wanted,
    host,
    port,
    timeoutMs,
  });

  const priorSide = side === 'target' ? 'source' : 'target';
  for (const result of outcome.results) {
    if (result.status === 'ok') {
      const snapshotText = safeOriginText(result.snapshot.origin);
      console.log(`Updated ${result.label} (${result.hyperdriveId}): reconciled match.`);
      console.log(`  pre-update snapshot (safe fields): ${snapshotText}`);
    } else {
      console.error(
        `Failed ${result.label} (${result.hyperdriveId}): ${redactApiSecrets(result.error, hidden)}`,
      );
      const maybeReconcile = result as { code?: string; diffs?: string[] };
      if (maybeReconcile.code === CF_RESPONSE_ERROR_CODE && Array.isArray(maybeReconcile.diffs)) {
        console.error(
          `  reconciliation failed (fields differ: ${maybeReconcile.diffs.join(', ')}): ` +
            'the PATCH was applied but the API state does not match. ' +
            `Re-run this command (idempotent) or roll back with --side=${priorSide} --target=${result.key}.`,
        );
      }
    }
  }

  if (!outcome.allOk) {
    const failed = outcome.results.filter((result) => result.status === 'failed');
    const succeeded = outcome.results.filter((result) => result.status === 'ok');
    if (outcome.partial) {
      console.error(
        `Partial update: ${succeeded.map((result) => result.key).join(', ')} applied, ` +
          `${failed.map((result) => result.key).join(', ')} failed. ` +
          `Reconcile by re-running this command (idempotent) for the failed target, ` +
          `or roll back with --side=${priorSide} --target=${failed.map((result) => result.key).join(',')}.`,
      );
    } else {
      console.error(
        `No Hyperdrive configuration changed (${failed.map((result) => result.key).join(', ')} failed). ` +
          `Fix the reported error and re-run (idempotent).`,
      );
    }
    process.exit(1);
  }

  console.log('Hyperdrive update complete: all requested configs reconciled.');
}

main().catch((err) => {
  // Log the message string only (already redacted at throw sites, redacted
  // again defensively): never log the raw error object, which may carry
  // request internals.
  const message = err instanceof Error ? redactApiSecrets(err.message, cachedRedactionValues) : 'unknown error';
  console.error('Failed to update Hyperdrive:', message);
  process.exit(1);
});
