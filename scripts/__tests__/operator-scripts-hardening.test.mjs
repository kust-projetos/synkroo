/**
 * Hardening contract tests for the operator scripts (P1 VPS env remediation,
 * independent-review follow-ups).
 *
 * Local-only: every case is pure or uses a fake exec function. No VPS, SSH,
 * Wrangler or database is invoked, and the three operator scripts are never
 * executed.
 *
 * Covered: SQL literal quoting for the staging password (quotes / SQL
 * metacharacters / NUL), secrets-safe error summarisation, and shell-free
 * Wrangler argv construction.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, test } from 'node:test';

import {
  SAFE_DB_ERROR_MESSAGE,
  SqlLiteralError,
  alterRolePasswordDdl,
  createDatabaseOwnedByDdl,
  createRoleWithPasswordDdl,
  grantAllOnSchemaPublicDdl,
  quotePgIdentifier,
  quotePgLiteral,
  safeDbErrorSummary,
} from '../lib/pg-ddl.mjs';
import {
  WRANGLER_PACKAGE_ENTRY,
  buildHyperdriveUpdateArgv,
  redactSecrets,
  resolveWranglerEntry,
  runWranglerCli,
} from '../lib/wrangler-cli.mjs';

const root = resolve(import.meta.dirname, '..', '..');
const read = (name) => readFileSync(resolve(root, 'scripts', name), 'utf8');
const STAGING_PASSWORD = 'segredo-staging';
/** Built at runtime so no raw NUL byte ends up in this source file. */
const NUL = String.fromCharCode(0);

describe('quotePgLiteral — DDL injection e metacaracteres', () => {
  test('aspas simples são duplicadas, não fecham o literal', () => {
    assert.equal(quotePgLiteral("a'b"), "E'a''b'");
    assert.equal(quotePgLiteral("'; DROP ROLE synkroo; --"), "E'''; DROP ROLE synkroo; --'");
  });

  test('barras são escapadas (literal E independe de standard_conforming_strings)', () => {
    assert.equal(quotePgLiteral('a\\b'), "E'a\\\\b'");
    assert.equal(quotePgLiteral("a'b\\c"), "E'a''b\\\\c'");
  });

  test('metacaracteres SQL e newlines permanecem dentro do literal', () => {
    assert.equal(quotePgLiteral('--/*'), "E'--/*'");
    assert.equal(quotePgLiteral('a\nb'), "E'a\nb'");
    assert.equal(quotePgLiteral('x$(id)y'), "E'x$(id)y'");
    assert.equal(quotePgLiteral('x`id`y'), "E'x`id`y'");
  });

  test('NUL é rejeitado em vez de truncar silenciosamente', () => {
    assert.throws(() => quotePgLiteral(`abc${NUL}def`), SqlLiteralError);
    assert.throws(() => quotePgIdentifier(`abc${NUL}role`), SqlLiteralError);
    assert.equal(quotePgLiteral('sem nul'), "E'sem nul'");
  });

  test('identificadores são duplicados e delimitados', () => {
    assert.equal(quotePgIdentifier('synkroo_staging'), '"synkroo_staging"');
    assert.equal(quotePgIdentifier('ro"le'), '"ro""le"');
  });
});

describe('DDL do role synkroo_staging', () => {
  test('CREATE ROLE interpola a senha já quotada', () => {
    const ddl = createRoleWithPasswordDdl({ role: 'synkroo_staging', password: STAGING_PASSWORD });
    assert.match(ddl, /^CREATE ROLE "synkroo_staging" WITH LOGIN CREATEDB PASSWORD E'segredo-staging';$/);
    assert.ok(!ddl.includes("PASSWORD 'segredo-staging'"), 'não deve usar literal simples cru');
  });

  test('ALTER ROLE interpola a senha já quotada', () => {
    const ddl = alterRolePasswordDdl({ role: 'synkroo_staging', password: STAGING_PASSWORD });
    assert.match(ddl, /^ALTER ROLE "synkroo_staging" WITH CREATEDB PASSWORD E'segredo-staging';$/);
  });

  test('senha com aspas e metacaracteres não escapa do literal', () => {
    const hostile = "p'w; --";
    for (const ddl of [
      createRoleWithPasswordDdl({ role: 'synkroo_staging', password: hostile }),
      alterRolePasswordDdl({ role: 'synkroo_staging', password: hostile }),
    ]) {
      assert.match(ddl, /PASSWORD E'p''w; --';/);
      assert.equal(ddl.split("E'").length, 2, 'apenas um literal na declaração');
    }
  });

  test('senha com NUL não gera SQL', () => {
    assert.throws(
      () => createRoleWithPasswordDdl({ role: 'synkroo_staging', password: `x${NUL}y` }),
      SqlLiteralError,
    );
  });

  test('CREATE DATABASE usa owner quotado', () => {
    assert.equal(
      createDatabaseOwnedByDdl({ database: 'synkroo_staging', owner: 'synkroo_staging' }),
      'CREATE DATABASE "synkroo_staging" OWNER "synkroo_staging";',
    );
  });
});

describe('GRANT usa role como identificador, não literal', () => {
  test('GRANT ALL ON SCHEMA public TO "synkroo_staging";', () => {
    assert.equal(
      grantAllOnSchemaPublicDdl({ role: 'synkroo_staging' }),
      'GRANT ALL ON SCHEMA public TO "synkroo_staging";',
    );
  });

  test('nunca emite o role como literal de string (seria syntax error)', () => {
    const ddl = grantAllOnSchemaPublicDdl({ role: 'synkroo_staging' });
    assert.ok(
      !/TO\s+'/.test(ddl),
      'role em GRANT deve ser identificador entre aspas duplas, não literal',
    );
    assert.ok(ddl.includes(quotePgIdentifier('synkroo_staging')));
  });

  test('role com aspas é escapado como identificador', () => {
    assert.equal(
      grantAllOnSchemaPublicDdl({ role: 'ro"le' }),
      'GRANT ALL ON SCHEMA public TO "ro""le";',
    );
  });

  test('setup-staging-db usa o builder de GRANT, não quotePgLiteral após TO', () => {
    const src = read('setup-staging-db.ts');
    assert.match(src, /grantAllOnSchemaPublicDdl\(\{ role: STAGING_ROLE \}\)/);
    assert.ok(
      !/TO \$\{quotePgLiteral\(/.test(src),
      'GRANT não pode interpolar quotePgLiteral no slot do role',
    );
  });
});

describe('safeDbErrorSummary — saída sem segredo', () => {
  test('erro de driver nunca devolve a mensagem crua', () => {
    const secret = 'segredo-gerado-1234';
    const pgError = Object.assign(
      new Error(`permission denied to create role ... PASSWORD E'${secret}'`),
      { code: '42501' },
    );
    const summary = safeDbErrorSummary(pgError);
    assert.ok(!summary.includes(secret));
    assert.ok(!summary.includes('permission denied'));
    assert.equal(summary, 'database operation failed (code: 42501)');
  });

  test('código allowlisted de autenticação aparece sem texto livre', () => {
    assert.equal(
      safeDbErrorSummary(
        Object.assign(new Error('password authentication failed'), { code: '28P01' }),
      ),
      'database operation failed (code: 28P01)',
    );
    assert.equal(
      safeDbErrorSummary(
        Object.assign(new Error('connect ECONNREFUSED 1.2.3.4:5432'), { code: 'ECONNREFUSED' }),
      ),
      'database operation failed (code: ECONNREFUSED)',
    );
  });

  test('código desconhecido ou hostil não é ecoado', () => {
    const summary = safeDbErrorSummary(Object.assign(new Error('boom'), { code: 'X\nINJETADO: --' }));
    assert.equal(summary, SAFE_DB_ERROR_MESSAGE);
    assert.ok(!summary.includes('INJETADO'));
  });

  test('erro sem código vira a mensagem fixa', () => {
    assert.equal(safeDbErrorSummary(new Error('qualquer coisa')), SAFE_DB_ERROR_MESSAGE);
    assert.equal(safeDbErrorSummary('string'), SAFE_DB_ERROR_MESSAGE);
    assert.equal(safeDbErrorSummary(undefined), SAFE_DB_ERROR_MESSAGE);
  });

  test('preflight SYNKROO_* preserva a mensagem (só caminho/nome de chave)', () => {
    const summary = safeDbErrorSummary(
      Object.assign(new Error('VPS_IP is missing: set it in process.env or SYNKROO_VPS_ENV=/x/.env'), {
        code: 'SYNKROO_MISSING_SETTING',
      }),
    );
    assert.match(summary, /VPS_IP is missing/);
    assert.match(summary, /SYNKROO_VPS_ENV/);
  });

  test('setup-staging-db registra apenas o resumo seguro', () => {
    const src = read('setup-staging-db.ts');
    assert.match(src, /safeDbErrorSummary\(err\)/);
    assert.ok(!/err\.message/.test(src), 'setup-staging-db.ts não deve ler err.message para imprimir');
    assert.ok(!/,\s*err\s*\)/.test(src), 'setup-staging-db.ts não deve imprimir o erro cru');
  });

  test('setup-staging-db usa os builders de DDL, sem interpolação de senha', () => {
    const src = read('setup-staging-db.ts');
    assert.match(src, /createRoleWithPasswordDdl\(\{/);
    assert.match(src, /alterRolePasswordDdl\(\{/);
    assert.ok(!/PASSWORD '\$\{/.test(src), 'setup-staging-db.ts não deve interpolar a senha em SQL cru');
  });
});

describe('Wrangler argv — sem shell', () => {
  const HOSTILE = 'p w"; rm -rf /tmp/x #$(id)`id`\\';
  const entry = '/repo/node_modules/wrangler/bin/wrangler.js';

  test('cada flag é um elemento argv próprio, com a senha intacta', () => {
    const argv = buildHyperdriveUpdateArgv({
      entry,
      id: 'e0033a75',
      host: '1.2.3.4',
      port: '15432',
      database: 'synkroo_staging',
      user: 'synkroo_staging',
      password: HOSTILE,
    });
    assert.equal(argv[0], entry);
    assert.deepEqual(argv.slice(1, 4), ['hyperdrive', 'update', 'e0033a75']);
    const passwordArgs = argv.filter((arg) => arg.startsWith('--password='));
    assert.equal(passwordArgs.length, 1);
    assert.equal(passwordArgs[0], `--password=${HOSTILE}`);
    assert.ok(
      argv.every((arg) => typeof arg === 'string'),
      'nenhum elemento pode ser composed por shell',
    );
  });

  test('execFile recebe process.execPath e o argv, sem shell:true', () => {
    const calls = [];
    const execFile = (execPath, argv, options) => {
      calls.push({ execPath, argv, options });
      return Buffer.from('ok\n', 'utf8');
    };
    const argv = buildHyperdriveUpdateArgv({
      entry,
      id: 'e0033a75',
      host: '1.2.3.4',
      port: '15432',
      database: 'synkroo_staging',
      user: 'synkroo_staging',
      password: HOSTILE,
    });
    runWranglerCli({ label: 'Staging Hyperdrive e0033a75', argv, secrets: [HOSTILE], execFile });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].execPath, process.execPath);
    assert.deepEqual(calls[0].argv, argv);
    assert.notEqual(calls[0].options.shell, true);
  });

  test('stdout passa por redação antes de ser impresso', () => {
    const execFile = () => Buffer.from(`updated --password=${HOSTILE}\n`, 'utf8');
    const printed = [];
    runWranglerCli({
      label: 'x',
      argv: [`--password=${HOSTILE}`],
      secrets: [HOSTILE],
      execFile,
      log: (text) => printed.push(text),
    });
    assert.equal(printed.length, 1);
    assert.ok(!printed[0].includes(HOSTILE));
    assert.match(printed[0], /\[REDACTED\]/);
  });

  test('senha curta não sobrevive à redação genérica', () => {
    const printed = [];
    runWranglerCli({
      label: 'x',
      argv: ['--password=abc123'],
      secrets: ['outro-segredo'],
      execFile: () => Buffer.from('ok --password=abc123', 'utf8'),
      log: (text) => printed.push(text),
    });
    assert.ok(!printed[0].includes('abc123'));
  });

  test('falha propaga erro redigido, com stdout/stderr também redigidos', () => {
    const execFile = () => {
      throw Object.assign(new Error(`Command failed: node wrangler --password=${HOSTILE} --sslmode=require`), {
        code: 1,
        stdout: Buffer.from(`leak-out --password=${HOSTILE}`, 'utf8'),
        stderr: Buffer.from(`leak-err ${HOSTILE}`, 'utf8'),
      });
    };
    assert.throws(
      () =>
        runWranglerCli({
          label: 'Staging Hyperdrive e0033a75',
          argv: [`--password=${HOSTILE}`],
          secrets: [HOSTILE],
          execFile,
        }),
      (err) => {
        assert.match(err.message, /^Failed to update Staging Hyperdrive e0033a75:/);
        assert.ok(!err.message.includes(HOSTILE), 'a senha não pode sobreviver na mensagem');
        assert.match(err.message, /stdout: leak-out --password=\[REDACTED\]/);
        assert.match(err.message, /stderr: leak-err \[REDACTED\]/);
        return true;
      },
    );
  });

  test('redactSecrets cobre --password e valores exatos', () => {
    assert.equal(redactSecrets('a --password=abc b'), 'a --password=[REDACTED] b');
    assert.equal(redactSecrets('valor=segredo;', ['segredo']), 'valor=[REDACTED];');
    assert.equal(redactSecrets(undefined), '');
  });

  test('update-hyperdrive não usa shell nem execSync', () => {
    const src = read('update-hyperdrive.ts');
    assert.ok(!/execSync/.test(src), 'não deve importar execSync');
    assert.ok(!/\bshell\s*:/.test(src), 'não deve habilitar shell');
    assert.match(src, /runWranglerCli\(\{/);
    assert.match(src, /buildHyperdriveUpdateArgv\(\{/);
    assert.match(src, /resolveWranglerEntry\(\)/);
  });

  test('resolveWranglerEntry falha fechado quando o entry local não existe', () => {
    assert.throws(
      () => resolveWranglerEntry({ cwd: '/nao-existe/wrangler-root', existsSync: () => false }),
      /Local Wrangler entry not found/,
    );
    const expected = resolve('/repo', 'node_modules', ...WRANGLER_PACKAGE_ENTRY.split('/'));
    assert.equal(
      resolveWranglerEntry({ cwd: '/repo', existsSync: (target) => target === expected }),
      expected,
    );
  });
});