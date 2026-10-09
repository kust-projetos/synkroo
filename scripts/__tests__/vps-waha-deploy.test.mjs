import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const script = readFileSync(resolve(root, 'ops/vps/waha/deploy-waha.sh'), 'utf8');

describe('WAHA target deploy script (gated, digest-verified, dry-run default)', () => {
  test('fails closed from the start (strict mode, lock, 0600)', () => {
    assert.match(script, /set -euo pipefail/);
    assert.match(script, /flock -n 9/);
    assert.match(script, /stat -c '%a'|stat -f '%Lp'/);
    assert.match(script, /\[\s*"\$ENV_MODE"\s*=\s*"600"\s*\]/);
  });

  test('validates required settings by name without printing values', () => {
    for (const key of ['WAHA_IMAGE_DIGEST', 'WAHA_ENGINE', 'WAHA_API_KEY_HASH', 'WAHA_SWAGGER_USERNAME', 'WAHA_SWAGGER_PASSWORD', 'WAHA_WEBHOOK_HMAC_KEY']) {
      assert.match(script, new RegExp(`\\b${key}\\b`), `${key} must be validated`);
    }
    assert.match(script, /\^sha512:\[0-9a-fA-F\]\{128\}\$/);
    assert.match(script, /\^\(WEBJS\|GOWS\|NOWEB\)\$/);
    assert.match(script, /WAHA_SWAGGER_USERNAME must be 1-64 chars/);
    assert.doesNotMatch(script, /echo[^|\n;]*\$WAHA_(API_KEY_HASH|SWAGGER_PASSWORD|WEBHOOK_HMAC_KEY|IMAGE_DIGEST)([^_A-Z]|$)/);
  });

  test('env file is parsed declaratively and never sourced or evaluated', () => {
    // Review blocker: `set -a; . "$ENV_FILE"` executed the file contents and
    // accepted INHERITED values for a "missing" key.
    assert.doesNotMatch(script, /^\s*\.\s+"\$ENV_FILE"/m);
    assert.doesNotMatch(script, /\bsource\s+"\$ENV_FILE"/);
    // No `eval`/`set -a` invocation (comments may mention the word).
    assert.doesNotMatch(script, /^\s*eval\s/m);
    assert.doesNotMatch(script, /^\s*set\s+-a\s*;\s*\./m);
    assert.match(script, /while IFS= read -r _line/);
    assert.match(script, /inherited \$_k is set in this shell/);
    assert.match(script, /ENV_ALLOWED_KEYS=/);
    assert.match(script, /\*\[!A-Za-z0-9\._:\/-\]\*\)/);
  });

  test('dry-run is the default; mutations require --apply', () => {
    assert.match(script, /--apply/);
    assert.match(script, /dry-run complete/);
  });

  test('pulls the immutable digest and aborts on RepoDigest mismatch before up', () => {
    assert.match(script, /docker pull "\$PINNED_IMAGE"/);
    assert.match(script, /PINNED_IMAGE="\$IMAGE_REPO@sha256:\$WAHA_IMAGE_DIGEST"/);
    assert.match(script, /docker image inspect "\$PINNED_IMAGE" --format '\{\{index \.RepoDigests 0\}\}'/);
    assert.match(script, /RepoDigest mismatch/);
    assert.match(script, /refusing to start/);
    assert.match(script, /WAHA_INSTALL_DIR:-\/opt\/synkroo\/waha/);
  });

  test('contains no hardcoded digest and no public binding', () => {
    assert.doesNotMatch(script, /sha256:[0-9a-f]{64}/);
    assert.doesNotMatch(script, /0\.0\.0\.0:3000/);
    assert.match(script, /127\.0\.0\.1:3000\/health/);
  });

  test('webhook URL and HMAC rules are the strict canonical ones (no divergent Bash rule)', () => {
    // E4 review: the loose `^https://[^?#]*/api/whatsapp/waha$` accepted
    // `/extra/api/whatsapp/waha` and a credentialed authority, and the
    // length-only HMAC check accepted values preflight.mjs rejects by charset.
    assert.doesNotMatch(script, /\^https:\/\[\^?#\]\*\\\/api\/whatsapp\/waha\$/);
    assert.doesNotMatch(script, /"\$\{#WAHA_WEBHOOK_HMAC_KEY\}" -ge 32/);
    // Structural URL parity with `validateWahaConfig`: exact route, host and
    // bounded port, no credentials — no `node` prerequisite on the target.
    assert.match(script, /validate_waha_webhook_url/);
    assert.match(script, /\[ "\$path" = "\/api\/whatsapp\/waha" \]/);
    assert.match(script, /\[Hh\]\[Tt\]\[Tt\]\[Pp\]\[Ss\]:\/\//);
    // HMAC: same charset AND length rule as the canonical validator.
    assert.match(script, /\^\[A-Za-z0-9_-\]\{32,\}\$/);
  });

  test('hex-number final label rule refuses the zero-hex-digit form too', () => {
    // E4 reviewer edge: `^0[xX][0-9a-fA-F]+$` let the bare final label `0x` /
    // `0X` through as an ordinary DNS label, while WHATWG reads it as the
    // number 0 (`0x` → `0.0.0.0`) and fails the whole authority for
    // `example.0x`. The shared rule therefore uses `*`, not `+`.
    assert.match(script, /hex_label_re='\^0\[xX\]\[0-9a-fA-F\]\*\$'/);
    assert.doesNotMatch(script, /hex_label_re='\^0\[xX\]\[0-9a-fA-F\]\+\$'/);
    // A DNS-legal label such as `0xapp` must keep being accepted (not final).
    assert.match(script, /0xapp\.example\.com/);
  });

  test('waits for healthy and smokes loopback /health after up', () => {
    assert.match(script, /State\.Health\.Status/);
    assert.match(script, /curl -sf --max-time/);
    assert.match(script, /compose.*up -d/);
  });
});
