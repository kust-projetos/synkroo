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

test('R4 — services → modules: matriz de seams via boundaries/dependencies', async () => {
  const eslint = new ESLint({ cwd: root });
  // Path virtual ANINHADO sob src/services/** (folder mode: o elemento
  // `service` é o primeiro nível abaixo de src/services/).
  const filePath = resolve(root, 'src/services/r4probe/r4-probe.ts');
  const staticImport = (spec) => `import { x } from '${spec}';\nexport const y = x;\n`;
  const dynamicImport = (spec) =>
    `export async function f() { const m = await import('${spec}'); return m; }\n`;
  const cases = [
    // [nome, spec, esperado: 'allow' | 'error']
    ['seam raiz (barrel)', '@/modules/comercial', 'allow'],
    ['schema do módulo', '@/modules/operacional/schema', 'allow'],
    ['fundo repositories', '@/modules/operacional/repositories/appointments-repository', 'error'],
    ['fundo services', '@/modules/operacional/services/availability-service', 'error'],
  ];
  for (const [name, spec, expected] of cases) {
    for (const [kind, code] of [['static', staticImport(spec)], ['dynamic', dynamicImport(spec)]]) {
      const [res] = await eslint.lintText(code, { filePath });
      const hits = res.messages.filter((m) => m.ruleId === 'boundaries/dependencies');
      assert.equal(
        hits.length,
        expected === 'error' ? 1 : 0,
        `${name} [${kind}]: esperado ${expected}, obtido ${JSON.stringify(res.messages)}`,
      );
      if (expected === 'error') {
        assert.equal(hits[0].severity, 2);
        assert.match(hits[0].message, /seam público.*R4/);
      }
    }
  }
});

test('R4 — arquivo de teste com import de fundo é isento', async () => {
  const eslint = new ESLint({ cwd: root });
  const specs = [
    "import { x } from '@/modules/operacional/services/availability-service';\nexport const y = x;\n",
    "export async function f() { const m = await import('@/modules/operacional/repositories/appointments-repository'); return m; }\n",
  ];
  for (const variants of [
    resolve(root, 'src/services/r4probe/__tests__/probe.test.ts'),
    resolve(root, 'src/services/appointments/__tests__/availability.integration.test.ts'),
  ]) {
    for (const code of specs) {
      const [res] = await eslint.lintText(code, { filePath: variants });
      assert.deepEqual(
        res.messages.filter((m) => m.ruleId === 'boundaries/dependencies'),
        [],
        `isenção esperada em ${variants}`,
      );
    }
  }
});
