import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)))
const read = (path) => readFileSync(resolve(root, path), 'utf8')

const ci = read('.github/workflows/ci.yml')
const scheduled = read('.github/workflows/gitleaks-scheduled.yml')
const suppressions = read('.gitleaksignore')
const inventory = read('docs/security/credential-inventory.md')
const config = read('.gitleaks.toml')

for (const [name, workflow] of [['ci', ci], ['scheduled', scheduled]]) {
  test(`${name} gitleaks scans full history and redacts output`, () => {
    assert.match(workflow, /fetch-depth:\s*0/)
    assert.match(workflow, /gitleaks detect --source \. --log-opts="--all"/)
    assert.match(workflow, /--redact/)
    assert.doesNotMatch(workflow, /continue-on-error:\s*true/)
  })
}

test('suppression file is fingerprint inventory, not a broad allowlist', () => {
  const entries = suppressions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  assert.equal(entries.length, 83)
  assert.ok(entries.every((entry) => entry.includes(':')))
  assert.ok(!entries.some((entry) => entry === '*' || entry === '.*' || entry.includes('**/')))
})

test('credential inventory classifies owner action without storing secret values', () => {
  assert.match(inventory, /confirmed-owner-action/)
  assert.match(inventory, /Revogação e rotação/)
  assert.match(inventory, /BLOCKED — ação externa/)
  assert.doesNotMatch(inventory, /-----BEGIN [A-Z ]+PRIVATE KEY-----/)
  assert.doesNotMatch(inventory, /Bearer\s+[A-Za-z0-9._~+/-]{24,}/)
  assert.doesNotMatch(inventory, /(?:AUTH_SECRET|JWT_SECRET|DATABASE_URL|OPENAI_API_KEY)\s*=\s*[^\s<{][^\s]{7,}/)
})

test('toml allowlist is restricted to named development artifact paths', () => {
  assert.match(config, /useDefault\s*=\s*true/)
  assert.match(config, /\\\.next\//)
  assert.match(config, /\\\.open-next\//)
  assert.doesNotMatch(config, /paths\s*=\s*\[[\s\S]*['"]\.[*]/)
})
