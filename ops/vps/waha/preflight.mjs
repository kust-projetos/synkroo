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

/**
 * WAHA_WEBHOOK_URL contract: ONE rule set, two implementations — this
 * validator and `validate_waha_webhook_url` in `ops/vps/waha/deploy-waha.sh`
 * (the target has no Node runtime, so the script reimplements it in pure Bash
 * and a parity suite compares both verdicts case by case):
 *
 *   1. raw shape `https://<host>[:<port>]/api/whatsapp/waha`, with the path
 *      EXACT in the raw string. WHATWG parsing alone is not proof: it collapses
 *      dot segments (`/x/../api/whatsapp/waha` normalizes into the route),
 *      accepts zero-padded ports (`:000443` becomes `443`) and re-hosts an
 *      authority written with a backslash separator;
 *   2. host: an optional single trailing dot is fine. When the LAST label is
 *      numeric the host must be a canonical IPv4 dotted quad — exactly four
 *      octets, no leading zeros, each 0-255. WHATWG additionally accepts
 *      `1.2.3`, `2130706433` and `0x7f.1`, and rejects `999.999.999.999`;
 *      neither form is expressible in the script's rule, so BOTH reject them.
 *      A FINAL label in WHATWG hexadecimal-number syntax (`0x7f`,
 *      `1.2.3.0xff`, `example.0xff`) is rejected outright by both: WHATWG
 *      would renormalize the host (`0x7f` → `0.0.0.127`, `1.2.3.0xff` →
 *      `1.2.3.255`) or reject the whole authority (`example.0xff`), and the
 *      canonical host must stay byte-identical to what the operator typed.
 *      The ZERO-hex-digit forms (`0x`, `0X`) behave the same way — `0x`
 *      normalizes to `0.0.0.0` and `example.0x` fails the whole authority —
 *      so they are refused too; only a `+` quantifier would have let them
 *      through as ordinary DNS labels.
 *      Deliberate tradeoff: a DNS-legal final label such as `0xff` is
 *      refused even though plain DNS allows it. Only the FINAL label is
 *      checked, so `0xapp.example.com` remains a valid DNS host.
 *      Otherwise the host is DNS-like: dot-separated labels of alphanumerics
 *      with inner hyphens (no underscore, no leading/trailing hyphen);
 *   3. port: 1-5 digits, 0-65535, NO leading zeros — `:000443` is rejected by
 *      both tools instead of being normalized;
 *   4. no credentials, no query and no fragment.
 */
const WEBHOOK_URL_SHAPE = /^(?<scheme>[Hh][Tt][Tt][Pp][Ss]):\/\/(?<host>[A-Za-z0-9.-]*)(?::(?<port>[0-9]*))?\/api\/whatsapp\/waha$/;
const DNS_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
const IPV4_OCTET = /^(?:0|[1-9][0-9]{0,2})$/;
const PORT = /^(?:0|[1-9][0-9]{0,4})$/;
/**
 * WHATWG hexadecimal-number host label (`0x7f`, `0XFF`, and the zero-hex-digit
 * forms `0x`/`0X`). A final label of this shape makes the WHATWG parser
 * renormalize the host or fail the whole authority, so the canonical contract
 * refuses it (see the contract comment above).
 *
 * The `*` quantifier is deliberate: `+` accepts the bare `0x`/`0X` label as an
 * ordinary DNS label, while WHATWG parses `0x` as the number 0 (host
 * `0.0.0.0`) and rejects `example.0x` outright — neither is byte-identical.
 * A DNS-legal label such as `0xapp` does not match (`p` is not a hex digit)
 * and stays valid.
 */
const HEX_NUMBER_LABEL = /^0[xX][0-9a-fA-F]*$/;

/** Host half of the shared rule (see the contract comment above). */
export function isWahaWebhookHost(host) {
  // A single trailing dot is a valid FQDN marker; anything else is rejected.
  const bare = host.endsWith('.') ? host.slice(0, -1) : host;
  if (bare.length === 0 || bare.length > 253) return false;

  const labels = bare.split('.');
  const lastLabel = labels[labels.length - 1];
  if (/^[0-9]+$/.test(lastLabel)) {
    // Ends in a number — WHATWG would run its IPv4 parser here, so only a
    // canonical dotted quad is acceptable.
    if (labels.length !== 4) return false;
    return labels.every((label) => IPV4_OCTET.test(label) && Number(label) <= 255);
  }
  // WHATWG hex-number FINAL label — with AND without hex digits: the parser
  // would renormalize the host (`0x7f` → `0.0.0.127`, `1.2.3.0xff` →
  // `1.2.3.255`, `0x` → `0.0.0.0`) or reject the whole authority
  // (`example.0x`, `example.0xff`). The label is refused even though plain
  // DNS considers `0xff` legal, so the canonical host stays byte-identical.
  // `*` covers the zero-digit forms: `+` let the bare `0x`/`0X` label pass as
  // an ordinary DNS label. Only the final label is checked — `0xapp.example.com`
  // (and a final `0xapp`) stay valid DNS.
  if (HEX_NUMBER_LABEL.test(lastLabel)) return false;
  return labels.every((label) => DNS_LABEL.test(label));
}

/** Full WAHA_WEBHOOK_URL rule: raw shape first, WHATWG parse as a cross-check. */
export function isWahaWebhookUrl(raw) {
  const match = WEBHOOK_URL_SHAPE.exec(raw);
  if (!match) return false;

  const { host } = match.groups;
  const port = match.groups.port ?? '';
  if (port !== '' && (!PORT.test(port) || Number(port) > 65535)) return false;
  if (!isWahaWebhookHost(host)) return false;

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return false; // e.g. WHATWG rejects a malformed dotted-decimal IPv4 host
  }
  return (
    parsed.protocol === 'https:' &&
    !parsed.username &&
    !parsed.password &&
    !parsed.search &&
    !parsed.hash &&
    parsed.pathname === '/api/whatsapp/waha'
  );
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
  if (webhookUrl && !isWahaWebhookUrl(webhookUrl)) {
    errors.push('WAHA_WEBHOOK_URL must be an https URL with no credentials, query or fragment, a canonical host, a port without leading zeros and the exact path /api/whatsapp/waha');
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
