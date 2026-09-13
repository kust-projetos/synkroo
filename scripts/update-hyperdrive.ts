/**
 * scripts/update-hyperdrive.ts
 *
 * Updates Cloudflare Hyperdrive configurations for staging and production
 * to point to the VPS PostgreSQL 17 instance.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function loadVpsEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(process.cwd(), '..', 'vps-hostinger', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^['"]|['"]$/g, '');
        env[key] = val;
      }
    }
  }
  return env;
}

/**
 * Redact any interpolated `--password=<value>` argument from log/error text.
 * execSync failures embed the full command line in Error.message, so every
 * error surface in this script must pass through here before logging.
 * Exact secret values are additionally scrubbed when provided via `secrets`.
 */
function redactSecrets(text: string, secrets: string[] = []): string {
  let redacted = text.replace(/--password=\S+/g, '--password=[REDACTED]');
  for (const secret of secrets) {
    if (secret) redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted;
}

function toText(output: unknown): string {
  if (typeof output === 'string') return output;
  if (Buffer.isBuffer(output)) return output.toString('utf8');
  return '';
}

function runWranglerHyperdriveUpdate(label: string, command: string, secrets: string[]): void {
  try {
    // Piped (never inherited): child output is captured so every printed byte
    // passes through redactSecrets before reaching the terminal or logs.
    const stdout = execSync(command, { stdio: 'pipe', encoding: 'utf8' });
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
  const vpsEnv = loadVpsEnv();
  // All connection values come exclusively from process.env or ../vps-hostinger/.env.
  // No credentials, hosts, or ports are hardcoded in this file.
  const host = process.env.VPS_IP || vpsEnv.VPS_IP;
  if (!host) {
    throw new Error('VPS_IP is missing: set it in process.env or ../vps-hostinger/.env');
  }
  const port = process.env.VPS_PG_PORT || vpsEnv.VPS_PG_PORT;
  if (!port) {
    throw new Error('VPS_PG_PORT is missing: set it in process.env or ../vps-hostinger/.env');
  }
  const prodPassword = process.env.VPS_POSTGRES_PASSWORD || vpsEnv.VPS_POSTGRES_PASSWORD;
  if (!prodPassword) {
    throw new Error('VPS_POSTGRES_PASSWORD is missing: set it in process.env or ../vps-hostinger/.env');
  }
  const stagingPassword = process.env.VPS_STAGING_PASSWORD || vpsEnv.VPS_STAGING_PASSWORD;

  if (!stagingPassword) {
    throw new Error('VPS_STAGING_PASSWORD is missing from ../vps-hostinger/.env');
  }

  const STAGING_HYPERDRIVE_ID = 'e0033a75f4e2449084b00b41e22e49a6';
  const PROD_HYPERDRIVE_ID = 'be5a789a003e4f08a94a82dffbb091be';

  console.log('1. Updating Staging Hyperdrive:', STAGING_HYPERDRIVE_ID);
  runWranglerHyperdriveUpdate(
    `Staging Hyperdrive ${STAGING_HYPERDRIVE_ID}`,
    `npx wrangler hyperdrive update ${STAGING_HYPERDRIVE_ID} --host=${host} --port=${port} --scheme=postgres --database=synkroo_staging --user=synkroo_staging --password=${stagingPassword} --sslmode=require`,
    [stagingPassword, prodPassword],
  );
  console.log('Staging Hyperdrive updated successfully.\n');

  console.log('2. Updating Production Hyperdrive:', PROD_HYPERDRIVE_ID);
  runWranglerHyperdriveUpdate(
    `Production Hyperdrive ${PROD_HYPERDRIVE_ID}`,
    `npx wrangler hyperdrive update ${PROD_HYPERDRIVE_ID} --host=${host} --port=${port} --scheme=postgres --database=synkroo --user=synkroo --password=${prodPassword} --sslmode=require`,
    [stagingPassword, prodPassword],
  );
  console.log('Production Hyperdrive updated successfully.\n');
}

main().catch((err) => {
  // Log the message string only (already redacted at throw sites, redacted
  // again defensively): never log the raw error object, which may carry the
  // interpolated command line, stdout/stderr buffers, or other internals.
  const message = err instanceof Error ? redactSecrets(err.message) : 'unknown error';
  console.error('Failed to update Hyperdrive:', message);
  process.exit(1);
});
