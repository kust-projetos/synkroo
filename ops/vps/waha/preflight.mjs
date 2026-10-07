#!/usr/bin/env node
/** Read-only WAHA candidate env validation. Values are never printed. */
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ALLOWED_KEYS = new Set([
  'WAHA_IMAGE_DIGEST',
  'WAHA_ENGINE',
  'WAHA_API_KEY_HASH',
  'WAHA_SWAGGER_USERNAME',
  'WAHA_SWAGGER_PASSWORD',
  'WAHA_WEBHOOK_HMAC_KEY',
  'WAHA_WEBHOOK_URL',
]);

/**
 * Parse the deliberately small dotenv subset used by Compose here. Quoting,
 * interpolation, whitespace, inline comments, duplicate keys and unknown
 * assignments are rejected so validation cannot see a different value than
 * Docker Compose. Comments and blank lines are allowed.
 */
export function parseWahaEnvContent(content) {
  const values = Object.create(null);
  const lines = String(content ?? '').split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = line.match(/^([A-Z][A-Z0-9_]*)=([A-Za-z0-9._:/-]*)$/);
    if (!match) throw new Error(`line ${index + 1} is malformed or uses unsupported dotenv syntax`);

    const [, key, value] = match;
    if (!ALLOWED_KEYS.has(key)) throw new Error(`${key} is not an allowed setting`);
    if (Object.hasOwn(values, key)) throw new Error(`${key} is duplicated`);
    values[key] = value;
  }

  return values;
}

export function findInheritedWahaOverrides(environment = process.env) {
  return [...ALLOWED_KEYS].filter((key) => Object.hasOwn(environment, key));
}

export function validateWahaConfig(values) {
  const errors = [];
  const addIf = (condition, key, reason) => {
    if (condition) errors.push(`${key} ${reason}`);
  };

  addIf(!/^[0-9a-f]{64}$/.test(values.WAHA_IMAGE_DIGEST ?? ''), 'WAHA_IMAGE_DIGEST', 'must be an approved 64-hex image digest');
  addIf(!['WEBJS', 'GOWS', 'NOWEB'].includes(values.WAHA_ENGINE ?? ''), 'WAHA_ENGINE', 'must be chosen after P3.5 compatibility tests');
  addIf(!/^sha512:[0-9a-fA-F]{128}$/.test(values.WAHA_API_KEY_HASH ?? ''), 'WAHA_API_KEY_HASH', 'must use sha512:<128 hex chars>');
  addIf(!/^[A-Za-z0-9._-]{1,64}$/.test(values.WAHA_SWAGGER_USERNAME ?? ''), 'WAHA_SWAGGER_USERNAME', 'has an invalid format');
  addIf((values.WAHA_SWAGGER_PASSWORD ?? '').length < 24, 'WAHA_SWAGGER_PASSWORD', 'must be at least 24 characters');
  addIf(!/^[A-Za-z0-9_-]{32,}$/.test(values.WAHA_WEBHOOK_HMAC_KEY ?? ''), 'WAHA_WEBHOOK_HMAC_KEY', 'must be high entropy and at least 32 chars');

  const webhookUrl = (values.WAHA_WEBHOOK_URL ?? '').trim();
  if (webhookUrl) {
    let parsed;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      errors.push('WAHA_WEBHOOK_URL must be a valid HTTPS URL');
    }
    if (parsed && (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash ||
      parsed.pathname !== '/api/whatsapp/waha'
    )) {
      errors.push('WAHA_WEBHOOK_URL must be HTTPS and end exactly at /api/whatsapp/waha');
    }
  }

  return errors;
}

function readPrivateEnvFile(envPath) {
  const stat = statSync(envPath);
  if (!stat.isFile()) throw new Error();
  accessSync(envPath, constants.R_OK);
  if (!isPrivateFileMode(stat.mode, process.platform)) throw new Error();
  return parseWahaEnvContent(readFileSync(envPath, 'utf8'));
}

/**
 * Owner-only mode check: exactly `0600` on POSIX. `0400`/`0700`/group/other
 * bits are all rejected — "readable only by me" is not the same as "the mode
 * the deploy contract requires". On Windows the mode bits are emulated and
 * carry no ACL meaning, so the check is a documented no-op there: the file
 * must live in a user-private directory instead.
 */
export function isPrivateFileMode(mode, platform = process.platform) {
  if (platform === 'win32') return true;
  // Full 0o7777: setuid/setgid/sticky bits (0o4600/0o2600/0o1600) must fail too.
  return (mode & 0o7777) === 0o600;
}

function main() {
  const envPath = process.argv[2];
  if (!envPath) {
    console.error('usage: node ops/vps/waha/preflight.mjs <private-env-file>');
    process.exitCode = 2;
    return;
  }

  let values;
  try {
    const inherited = findInheritedWahaOverrides();
    if (inherited.length > 0) {
      console.error(`WAHA preflight failed: unset inherited ${inherited.join(', ')} before validation.`);
      process.exitCode = 1;
      return;
    }
    values = readPrivateEnvFile(envPath);
  } catch {
    console.error('WAHA preflight failed: private env file is missing, unreadable, or not owner-only.');
    process.exitCode = 1;
    return;
  }

  const errors = validateWahaConfig(values);
  if (errors.length > 0) {
    console.error(`WAHA preflight failed: ${errors.join('; ')}`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write('WAHA preflight passed; secret values were not printed.\n');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main();
