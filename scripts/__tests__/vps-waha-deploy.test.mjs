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
    for (const key of ['WAHA_IMAGE_DIGEST', 'WAHA_ENGINE', 'WAHA_API_KEY_HASH', 'WAHA_SWAGGER_PASSWORD', 'WAHA_WEBHOOK_HMAC_KEY']) {
      assert.match(script, new RegExp(`\\b${key}\\b`), `${key} must be validated`);
    }
    assert.match(script, /\^sha512:\[0-9a-fA-F\]\{128\}\$/);
    assert.match(script, /\^\(WEBJS\|GOWS\|NOWEB\)\$/);
    assert.doesNotMatch(script, /echo[^|\n;]*\$WAHA_(API_KEY_HASH|SWAGGER_PASSWORD|WEBHOOK_HMAC_KEY|IMAGE_DIGEST)([^_A-Z]|$)/);
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

  test('waits for healthy and smokes loopback /health after up', () => {
    assert.match(script, /State\.Health\.Status/);
    assert.match(script, /curl -sf --max-time/);
    assert.match(script, /compose.*up -d/);
  });
});
