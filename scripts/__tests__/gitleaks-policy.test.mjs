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
const preCommitConfig = read('.pre-commit-config.yaml')
const preCommitHook = read('.githooks/pre-commit')

for (const [name, workflow] of [['ci', ci], ['scheduled', scheduled]]) {
  test(`${name} gitleaks scans full history and redacts output`, () => {
    assert.match(workflow, /fetch-depth:\s*0/)
    assert.match(workflow, /gitleaks detect --source \. --log-opts="--all"/)
    assert.match(workflow, /--redact/)
    assert.doesNotMatch(workflow, /continue-on-error:\s*true/)
  })
}

test('pre-commit hook and configuration enforce staged gitleaks scanning', () => {
  assert.match(preCommitConfig, /gitleaks/)
  assert.match(preCommitHook, /git diff --cached/)
  assert.match(preCommitHook, /gitleaks detect --source/)
})

test('suppression file is fingerprint inventory, not a broad allowlist', () => {
  const entries = suppressions
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  // 19 = 5 false-positivos de docs + 14 fixtures de teste (pós reescrita de
  // histórico de 2026-09-25, que eliminou as suppressions por hash de commit).
  assert.equal(entries.length, 19)
  assert.ok(entries.every((entry) => entry.includes(':')))
  assert.ok(!entries.some((entry) => entry === '*' || entry === '.*' || entry.includes('**/')))

  for (const entry of entries) {
    const parts = entry.split(':')
    assert.ok(parts.length === 3 || parts.length === 4, `Invalid suppression structure: ${entry}`)
    const lineNum = Number(parts[parts.length - 1])
    assert.ok(Number.isInteger(lineNum) && lineNum > 0, `Invalid line number in suppression: ${entry}`)
  }
})

test('rejection of false or broad suppressions (RED validation)', () => {
  const validateSuppression = (line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return true
    if (trimmed === '*' || trimmed === '.*' || trimmed.includes('**/')) return false
    const parts = trimmed.split(':')
    if (parts.length < 3 || parts.length > 4) return false
    const lineNum = Number(parts[parts.length - 1])
    return Number.isInteger(lineNum) && lineNum > 0
  }

  assert.equal(validateSuppression('src/components/app.tsx:generic-api-key:10'), true)
  assert.equal(validateSuppression('d6138f853e156981eb2d25afb107a28bc7825928:docs/CONFIGURACAO.md:curl-auth-header:62'), true)
  assert.equal(validateSuppression('src/**'), false)
  assert.equal(validateSuppression('*'), false)
  assert.equal(validateSuppression('src/components/app.tsx'), false)
  assert.equal(validateSuppression('src/components/app.tsx:generic-api-key:not-a-number'), false)
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
