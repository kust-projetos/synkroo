/**
 * scripts/lib/wrangler-cli.mjs
 *
 * Builds and runs the local Wrangler CLI with an explicit argv and no shell.
 *
 * Security contract:
 *   - The password is a single argv element, never interpolated into a shell
 *     command string. A password containing spaces, quotes, `;`, `$(…)`, or
 *     backticks cannot start a second command or split an argument.
 *   - `execFileSync` (not `execSync`) — no `/bin/sh` is involved at all.
 *   - Child output and error text pass through `redactSecrets` before any byte
 *     reaches the terminal, because the driver's failure message echoes argv.
 *
 * The CLI is invoked as `node <node_modules/wrangler/bin/wrangler.js> …` so no
 * network download or `npx` resolution is involved.
 */

import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const WRANGLER_PACKAGE_ENTRY = 'wrangler/bin/wrangler.js';

/**
 * Resolves the locally installed Wrangler JS entry.
 *
 * @param {{cwd?: string, entry?: string, existsSync?: (p: string) => boolean}} [options]
 * @returns {string} absolute path to the Wrangler entry point
 */
export function resolveWranglerEntry(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const entry = options.entry ?? WRANGLER_PACKAGE_ENTRY;
  const exists = options.existsSync ?? fs.existsSync;
  const resolved = path.resolve(cwd, 'node_modules', ...entry.split('/'));
  if (!exists(resolved)) {
    throw new Error(
      `Local Wrangler entry not found at "${resolved}". ` +
        `Install dependencies (npm ci) before running this script.`,
    );
  }
  return resolved;
}

/**
 * Builds the argv for `wrangler hyperdrive update`. Each flag is its own argv
 * element: hostile characters inside `password` stay inside that element.
 *
 * @param {{entry: string, id: string, host: string, port: string|number, database: string, user: string, password: string, sslmode?: string}} params
 * @returns {string[]}
 */
export function buildHyperdriveUpdateArgv(params) {
  const {
    entry,
    id,
    host,
    port,
    database,
    user,
    password,
    sslmode = 'require',
  } = params;
  return [
    entry,
    'hyperdrive',
    'update',
    id,
    `--host=${host}`,
    `--port=${port}`,
    '--scheme=postgres',
    `--database=${database}`,
    `--user=${user}`,
    `--password=${password}`,
    `--sslmode=${sslmode}`,
  ];
}

/**
 * Redacts an interpolated `--password=<value>` and any known secret value from
 * log/error text.
 *
 * Exact values are scrubbed FIRST and longest-first: a partial
 * `--password=\S+` match would mangle a password containing whitespace and
 * leave the remainder readable. The generic pattern then catches any
 * `--password=` occurrence whose value is unknown to the caller.
 *
 * @param {string} text
 * @param {string[]} [secrets]
 * @returns {string}
 */
export function redactSecrets(text, secrets = []) {
  let redacted = String(text ?? '');
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    redacted = redacted.split(secret).join('[REDACTED]');
  }
  return redacted.replace(/--password=\S+/g, '--password=[REDACTED]');
}

/** @param {unknown} output @returns {string} */
export function toText(output) {
  if (typeof output === 'string') return output;
  if (Buffer.isBuffer(output)) return output.toString('utf8');
  return '';
}

/**
 * Runs the Wrangler CLI with no shell and returns its redacted stdout.
 * Throws with redacted stdout/stderr attached.
 *
 * @param {{label: string, argv: string[], secrets?: string[], execPath?: string, execFile?: typeof execFileSync, log?: (text: string) => void}} params
 * @returns {string}
 */
export function runWranglerCli({ label, argv, secrets = [], execPath, execFile, log }) {
  const exec = execFile ?? execFileSync;
  const emit = log ?? ((text) => console.log(text));
  const node = execPath ?? process.execPath;
  try {
    // Piped (never inherited): child output is captured so every printed byte
    // passes through redactSecrets before reaching the terminal or logs.
    const stdout = exec(node, argv, { stdio: 'pipe', encoding: 'utf8' });
    const text = redactSecrets(toText(stdout), secrets).trimEnd();
    if (text) emit(text);
    return text;
  } catch (err) {
    const parts = [err instanceof Error ? err.message : 'unknown error'];
    if (err !== null && typeof err === 'object') {
      const childStdout = toText(err.stdout);
      const childStderr = toText(err.stderr);
      if (childStdout) parts.push(`stdout: ${childStdout}`);
      if (childStderr) parts.push(`stderr: ${childStderr}`);
    }
    const redacted = redactSecrets(parts.join('\n'), secrets);
    const wrapped = new Error(`Failed to update ${label}: ${redacted}`);
    if (err instanceof Error && typeof err.code === 'string') wrapped.code = err.code;
    throw wrapped;
  }
}