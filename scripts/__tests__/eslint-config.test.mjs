import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { ESLint } from 'eslint';

const root = resolve(import.meta.dirname, '..', '..');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

test('uses flat ESLint CLI with boundary rules', () => {
  assert.equal(packageJson.scripts.lint, 'eslint . --max-warnings=0');
  assert.equal(existsSync(resolve(root, 'eslint.config.mjs')), true);
  const rules = readFileSync(resolve(root, 'eslint.rules.json'), 'utf8');
  assert.match(rules, /"boundaries\/dependencies"/);
});

test('globally ignores generated Next type entrypoint', async () => {
  const eslint = new ESLint({ cwd: root });

  assert.equal(
    await eslint.isPathIgnored(resolve(root, 'next-env.d.ts')),
    true,
  );
});

test('R3 — services não importam fundo de módulos', async () => {
  const eslint = new ESLint({ cwd: root });
  // Path virtual sob src/services/** para ativar o override de files.
  // NOTA: cobre import estático; dynamic import() não é avaliado pelo
  // no-restricted-imports (verificado no ESLint 9.39) — blind spot registrado
  // nos RISKS do commit R3 para hardening futuro.
  const filePath = resolve(root, 'src/services/r3-negative-probe.ts');
  const [res] = await eslint.lintText(
    "import { x } from '@/modules/atendimento/services/foo';\nexport const y = x;\n",
    { filePath },
  );
  const hits = res.messages.filter((m) => m.ruleId === 'no-restricted-imports');
  assert.equal(hits.length, 1, `esperado 1 erro no-restricted-imports, obtido ${JSON.stringify(res.messages)}`);
  assert.equal(hits[0].severity, 2);
  assert.match(hits[0].message, /seam público.*R3/);
});

test('R3 — seam público do módulo (barrel) continua permitido em services', async () => {
  const eslint = new ESLint({ cwd: root });
  const filePath = resolve(root, 'src/services/r3-negative-probe.ts');
  const [res] = await eslint.lintText(
    "import { x } from '@/modules/atendimento';\nexport const y = x;\n",
    { filePath },
  );
  assert.deepEqual(
    res.messages.filter((m) => m.ruleId === 'no-restricted-imports'),
    [],
  );
});
