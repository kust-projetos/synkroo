/**
 * Contract tests for the provider-neutral VPS env-file resolution used by
 * scripts/migrate-vps.ts, scripts/update-hyperdrive.ts and
 * scripts/setup-staging-db.ts (shared implementation in scripts/lib/vps-env.mjs).
 *
 * Local-only: every case runs against temporary directories under os.tmpdir
 * and synthetic credentials. No VPS, SSH, wrangler or database is touched.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, before, describe, test } from 'node:test';

import {
  applyEnvFileWrites,
  assertEnvFileWritable,
  CREDENTIAL_FILE_MODE,
  encodeEnvValue,
  ENV_SOURCE_EXPLICIT,
  ENV_SOURCE_LEGACY,
  ENV_SOURCE_NONE,
  ENV_VALUE_UNREPRESENTABLE_CODE,
  SETTING_ORIGIN_FILE,
  SETTING_ORIGIN_PROCESS,
  VPS_ENV_PATH_VAR,
  loadVpsEnv,
  parseVpsEnvContent,
  planEnvFileWrites,
  readVpsSetting,
  readVpsSettingWithOrigin,
  resolveVpsEnvPath,
  upsertEnvValue,
} from '../lib/vps-env.mjs';

/** Built at runtime so no raw NUL byte ends up in this source file. */
const NUL = String.fromCharCode(0);

const root = resolve(import.meta.dirname, '..', '..');
const libSrc = readFileSync(resolve(root, 'scripts', 'lib', 'vps-env.mjs'), 'utf8');

const sandbox = mkdtempSync(join(tmpdir(), 'synkroo-vps-env-'));
const repoDir = join(sandbox, 'repo');
const scriptsDir = join(repoDir, 'scripts', 'lib');
const legacyDir = join(sandbox, 'vps-hostinger');
const legacyEnvPath = join(legacyDir, '.env');
// Repo root with NO legacy sibling, for the "nothing resolved" cases.
const isolatedRoot = join(sandbox, 'isolated', 'repo');

before(() => {
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(legacyDir, { recursive: true });
  mkdirSync(join(isolatedRoot, 'scripts', 'lib'), { recursive: true });
  writeFileSync(
    legacyEnvPath,
    ['VPS_IP=10.9.9.9', 'VPS_PG_PORT=15432', 'VPS_STAGING_PASSWORD=segredo-staging-legado', ''].join('\n'),
    'utf8',
  );
});

after(() => {
  rmSync(sandbox, { recursive: true, force: true });
});

/** Repo-root resolution is derived from the module URL, not from process.cwd(). */
function moduleUrlInRepo() {
  return pathToFileURL(join(scriptsDir, 'vps-env.mjs')).href;
}

function writeEnvFile(name, content) {
  const target = join(sandbox, name);
  writeFileSync(target, content, 'utf8');
  return target;
}

describe('parseVpsEnvContent', () => {
  const LF_LINES = [
    '# comentario de cabecalho',
    '',
    'VPS_IP=10.0.0.1',
    'VPS_PG_PORT=5432',
    'VPS_POSTGRES_PASSWORD="segredo-producao"',
    "VPS_STAGING_PASSWORD='segredo-staging'",
    '  SPACED_KEY  =  com espacos  ',
    '',
  ];
  const EXPECTED = {
    VPS_IP: '10.0.0.1',
    VPS_PG_PORT: '5432',
    VPS_POSTGRES_PASSWORD: 'segredo-producao',
    VPS_STAGING_PASSWORD: 'segredo-staging',
    SPACED_KEY: 'com espacos',
  };

  test('parseia conteudo LF (baseline)', () => {
    assert.deepEqual(parseVpsEnvContent(LF_LINES.join('\n')), EXPECTED);
  });

  test('parseia conteudo CRLF identico ao LF (regressao: VPS_IP is missing)', () => {
    const crlf = LF_LINES.join('\r\n');
    assert.deepEqual(parseVpsEnvContent(crlf), EXPECTED);
    assert.deepEqual(parseVpsEnvContent(crlf), parseVpsEnvContent(LF_LINES.join('\n')));
  });

  test('nenhuma chave/valor carrega \\r', () => {
    for (const content of [LF_LINES.join('\n'), LF_LINES.join('\r\n')]) {
      for (const [k, v] of Object.entries(parseVpsEnvContent(content))) {
        assert.ok(!k.includes('\r'), `chave com \\r: ${JSON.stringify(k)}`);
        assert.ok(!v.includes('\r'), `valor com \\r em ${k}: ${JSON.stringify(v)}`);
      }
    }
  });

  test('fonte tolera CRLF no split (sem depender de trim incidental)', () => {
    assert.ok(
      libSrc.includes('split(/\\r?\\n/)'),
      'vps-env.mjs deve dividir as linhas com split(/\\r?\\n/)',
    );
  });
});

describe('resolveVpsEnvPath — precedência explícita', () => {
  test('SYNKROO_VPS_ENV tem precedência sobre o fallback legado', () => {
    const explicitPath = writeEnvFile('explicit.env', 'VPS_IP=10.1.1.1\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
    // The legacy file exists in this sandbox and must NOT be chosen.
    assert.notEqual(resolved.path, legacyEnvPath);
  });

  test('caminho relativo explícito é resolvido a partir do cwd informado', () => {
    const explicitPath = writeEnvFile('relative.env', 'VPS_IP=10.1.1.2\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: 'relative.env' },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
  });

  test('fallback legado é resolvido pelo repo root do módulo, não pelo cwd', () => {
    const resolved = resolveVpsEnvPath({
      env: {},
      cwd: tmpdir(),
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_LEGACY);
    assert.equal(resolved.path, legacyEnvPath);
  });

  test('sem variável e sem arquivo legado: source=none e path=null (sem exceção)', () => {
    const resolved = resolveVpsEnvPath({
      env: {},
      cwd: sandbox,
      moduleUrl: pathToFileURL(join(isolatedRoot, 'scripts', 'lib', 'vps-env.mjs')).href,
    });
    assert.deepEqual(resolved, { path: null, source: ENV_SOURCE_NONE });
  });
});

describe('resolveVpsEnvPath — fail closed', () => {
  test('SYNKROO_VPS_ENV apontando para arquivo inexistente aborta sem fallback', () => {
    assert.throws(
      () =>
        resolveVpsEnvPath({
          env: { [VPS_ENV_PATH_VAR]: join(sandbox, 'inexistente.env') },
          cwd: sandbox,
          moduleUrl: moduleUrlInRepo(),
        }),
      (err) => {
        assert.match(err.message, new RegExp(VPS_ENV_PATH_VAR));
        assert.match(err.message, /no file exists there/);
        return true;
      },
    );
  });

  test('SYNKROO_VPS_ENV apontando para diretório aborta', () => {
    assert.throws(
      () =>
        resolveVpsEnvPath({
          env: { [VPS_ENV_PATH_VAR]: sandbox },
          cwd: sandbox,
          moduleUrl: moduleUrlInRepo(),
        }),
      /is not a regular file/,
    );
  });

  test('arquivo legível explicitado resolve sem erro', () => {
    const explicitPath = writeEnvFile('readable.env', 'VPS_IP=10.7.7.7\n');
    const resolved = resolveVpsEnvPath({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
    });
    assert.equal(resolved.source, ENV_SOURCE_EXPLICIT);
    assert.equal(resolved.path, explicitPath);
  });
});

describe('loadVpsEnv', () => {
  test('lê valores do arquivo explícito e emite o caminho de origem', () => {
    const explicitPath = writeEnvFile('load-explicit.env', 'VPS_IP=10.2.2.2\nVPS_PG_PORT=15432\n');
    const loaded = loadVpsEnv({
      env: { [VPS_ENV_PATH_VAR]: explicitPath },
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
      warn: () => {},
    });
    assert.equal(loaded.source, ENV_SOURCE_EXPLICIT);
    assert.equal(loaded.path, explicitPath);
    assert.equal(loaded.values.VPS_IP, '10.2.2.2');
    assert.equal(loaded.values.VPS_PG_PORT, '15432');
  });

  test('fallback legado avisa com deprecation e sem vazar valores', () => {
    const warnings = [];
    const loaded = loadVpsEnv({
      env: {},
      cwd: sandbox,
      moduleUrl: moduleUrlInRepo(),
      warn: (message) => warnings.push(message),
    });
    assert.equal(loaded.source, ENV_SOURCE_LEGACY);
    assert.equal(loaded.values.VPS_STAGING_PASSWORD, 'segredo-staging-legado');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /\[deprecation\]/);
    assert.match(warnings[0], new RegExp(VPS_ENV_PATH_VAR));
    for (const value of Object.values(loaded.values)) {
      assert.ok(!warnings[0].includes(value), 'aviso nao pode conter valor de credencial');
    }
  });

  test('sem arquivo resolvido devolve valores vazios em vez de lançar', () => {
    const loaded = loadVpsEnv({
      env: {},
      cwd: sandbox,
      moduleUrl: pathToFileURL(join(isolatedRoot, 'scripts', 'lib', 'vps-env.mjs')).href,
      warn: () => {},
    });
    assert.deepEqual(loaded, { values: {}, path: null, source: ENV_SOURCE_NONE });
  });
});

describe('readVpsSetting — precedência process.env sobre arquivo', () => {
  test('process.env vence o arquivo', () => {
    assert.equal(
      readVpsSetting('VPS_IP', { env: { VPS_IP: '10.3.3.3' }, values: { VPS_IP: '10.4.4.4' } }),
      '10.3.3.3',
    );
  });

  test('valor vazio no env cai para o arquivo (compatível com `process.env.X || file.X`)', () => {
    assert.equal(
      readVpsSetting('VPS_IP', { env: { VPS_IP: '' }, values: { VPS_IP: '10.4.4.4' } }),
      '10.4.4.4',
    );
  });

  test('ausente em ambos retorna undefined', () => {
    assert.equal(readVpsSetting('VPS_IP', { env: {}, values: {} }), undefined);
  });

  test('credencial de staging nunca é preenchida com a de produção', () => {
    const values = { VPS_POSTGRES_PASSWORD: 'segredo-producao' };
    const read = readVpsSetting('VPS_STAGING_PASSWORD', { env: {}, values });
    assert.equal(read, undefined);
  });
});

describe('persistência de credenciais geradas/overridden', () => {
  test('sem arquivo de env, senha de staging gerada aborta (fail closed)', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'segredo-gerado', required: true } },
        }),
      (err) => {
        assert.match(err.message, /Cannot persist generated VPS_STAGING_PASSWORD/);
        assert.match(err.message, new RegExp(VPS_ENV_PATH_VAR));
        assert.ok(!err.message.includes('segredo-gerado'), 'mensagem nao pode conter o segredo');
        return true;
      },
    );
  });

  test('assertEnvFileWritable recusa caminho inexistente antes de qualquer escrita', () => {
    assert.throws(
      () =>
        assertEnvFileWritable({
          envPath: join(sandbox, 'ausente', '.env'),
          writes: { VPS_STAGING_PASSWORD: 'segredo' },
        }),
      /does not exist/,
    );
  });

  test('assertEnvFileWritable recusa diretório', () => {
    assert.throws(
      () => assertEnvFileWritable({ envPath: sandbox, writes: { VPS_STAGING_PASSWORD: 'segredo' } }),
      /is not a regular file/,
    );
  });

  test('assertEnvFileWritable é no-op quando não há nada a persistir', () => {
    assert.equal(assertEnvFileWritable({ envPath: null, writes: {} }), null);
    assert.equal(assertEnvFileWritable({ envPath: sandbox, writes: {} }), null);
  });

  test('applyEnvFileWrites faz upsert atômico e não deixa temporário', () => {
    const target = writeEnvFile('write.env', 'VPS_IP=10.5.5.5\nVPS_POSTGRES_PASSWORD=antigo\n');
    const applied = applyEnvFileWrites(target, {
      VPS_POSTGRES_PASSWORD: 'novo-producao',
      VPS_STAGING_PASSWORD: 'novo-staging',
    });
    assert.equal(applied, true);
    const content = readFileSync(target, 'utf8');
    assert.match(content, /^VPS_IP=10\.5\.5\.5$/m);
    // valores persistidos ficam entre aspas simples POSIX
    assert.match(content, /^VPS_POSTGRES_PASSWORD='novo-producao'$/m);
    assert.match(content, /^VPS_STAGING_PASSWORD='novo-staging'$/m);
    assert.ok(!content.includes('antigo'));
    assert.deepEqual(
      readdirSync(sandbox).filter((name) => name.includes('synkroo-tmp')),
      [],
    );
    assert.deepEqual(parseVpsEnvContent(content), {
      VPS_IP: '10.5.5.5',
      VPS_POSTGRES_PASSWORD: 'novo-producao',
      VPS_STAGING_PASSWORD: 'novo-staging',
    });
  });

  test('applyEnvFileWrites é no-op sem writes', () => {
    const target = writeEnvFile('noop.env', 'VPS_IP=10.6.6.6\n');
    assert.equal(applyEnvFileWrites(target, {}), false);
    assert.equal(readFileSync(target, 'utf8'), 'VPS_IP=10.6.6.6\n');
  });

  test('upsertEnvValue anexa e substitui preservando o restante', () => {
    const base = 'A=1\nB=2\n';
    assert.equal(upsertEnvValue(base, 'B', 'novo'), "A=1\nB='novo'\n");
    assert.equal(upsertEnvValue(base, 'C', 'novo'), "A=1\nB=2\nC='novo'\n");
    assert.equal(upsertEnvValue('', 'C', 'novo'), "C='novo'\n");
  });

  test('chave com metacaractere de regex é escapada no upsert', () => {
    // Sem escape, `X.Y` casaria `XaY=1` e sobrescreveria a linha errada.
    const out = upsertEnvValue('XaY=1\n', 'X.Y', '2');
    assert.equal(out, "XaY=1\nX.Y='2'\n");
  });
});

describe('duplicatas de chave — last-wins nunca deixa credencial obsoleta', () => {
  test('upsert reescreve TODAS as ocorrências', () => {
    const base = [
      'VPS_STAGING_PASSWORD=antigo1',
      '# comentario no meio',
      '  VPS_STAGING_PASSWORD  =antigo2',
      "VPS_STAGING_PASSWORD='antigo3'",
      'VPS_IP=1.2.3.4',
      '',
    ].join('\n');
    const out = upsertEnvValue(base, 'VPS_STAGING_PASSWORD', 'novo');
    assert.equal(
      out,
      [
        "VPS_STAGING_PASSWORD='novo'",
        '# comentario no meio',
        "VPS_STAGING_PASSWORD='novo'",
        "VPS_STAGING_PASSWORD='novo'",
        'VPS_IP=1.2.3.4',
        '',
      ].join('\n'),
    );
    assert.ok(!out.includes('antigo'));
  });

  test('nenhuma ocorrência obsoleta sobrevive ao parse (last-wins)', () => {
    const base = ['VPS_STAGING_PASSWORD=antigo1', "VPS_STAGING_PASSWORD='antigo2'", ''].join('\n');
    const parsed = parseVpsEnvContent(upsertEnvValue(base, 'VPS_STAGING_PASSWORD', 'novo'));
    assert.equal(parsed.VPS_STAGING_PASSWORD, 'novo');
  });

  test('sem escrita, o parse continua last-wins (comportamento preexistente)', () => {
    const parsed = parseVpsEnvContent('K=um\nK=dois\n');
    assert.equal(parsed.K, 'dois');
  });
});

describe('serialização reversível de valores', () => {
  const HOSTILE = ["$&", '$$', "$'", '$`', 'a$&b$$c$d\'e$f`g'].join('|');

  test('aspas simples são escapadas com o idiom POSIX', () => {
    assert.equal(encodeEnvValue('a'), "'a'");
    assert.equal(encodeEnvValue(''), "''");
    assert.equal(encodeEnvValue("a'b"), "'a'\\''b'");
    // valor que começa com aspa: segmento vazio + escape + conteúdo
    assert.equal(encodeEnvValue("'a'"), "''\\''a'\\'''");
    assert.equal(encodeEnvValue("a\"b"), '\'a"b\'');
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'a'")}`).K, "'a'");
  });

  test('NUL, CR e LF são rejeitados antes de qualquer escrita', () => {
    for (const bad of [`a${NUL}b`, 'a\rb', 'a\nb']) {
      assert.throws(() => encodeEnvValue(bad, 'VPS_STAGING_PASSWORD'), (err) => {
        assert.equal(err.code, ENV_VALUE_UNREPRESENTABLE_CODE);
        assert.match(err.message, /VPS_STAGING_PASSWORD/);
        return true;
      });
    }
    // a falha acontece no upsert (portão de escrita), sem tocar o arquivo
    const target = writeEnvFile('nul.env', 'K=ok\n');
    assert.throws(
      () => applyEnvFileWrites(target, { K: `x${NUL}y` }),
      /cannot represent/,
    );
    assert.equal(readFileSync(target, 'utf8'), 'K=ok\n', 'arquivo deve ficar intacto');
  });

  test('round-trip exato: espaços nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('  padded  ')}`).K, '  padded  ');
  });

  test('round-trip exato: aspas simples nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'lead'")}`).K, "'lead'");
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("'")}`).K, "'");
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue("''")}`).K, "''");
  });

  test('round-trip exato: aspas duplas nas bordas', () => {
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('"lead"')}`).K, '"lead"');
    assert.equal(parseVpsEnvContent(`K=${encodeEnvValue('"')}`).K, '"');
  });

  test('round-trip exato: apóstrofos, barras e metacaracteres de shell', () => {
    for (const value of [
      "it's",
      "'''",
      "a'b'c'd",
      'a\\b',
      'a\\\\b',
      '; rm -rf /',
      '$(id)',
      '`id`',
      'a b\tc',
      '~home $HOME *glob',
    ]) {
      assert.equal(parseVpsEnvContent(`K=${encodeEnvValue(value)}`).K, value, value);
    }
  });

  test('round-trip exato: padrões $&, $$, $\' e $`', () => {
    for (const value of ['$&', '$$', "$'", '$`', HOSTILE, 'a$&\nb$$c']) {
      if (/[\n]/.test(value)) continue;
      assert.equal(parseVpsEnvContent(`K=${encodeEnvValue(value)}`).K, value, value);
    }
  });

  test('round-trip completo por arquivo: valor-hostil sobrevive ao write+read', () => {
    const target = writeEnvFile('hostile.env', 'VPS_IP=9.9.9.9\n');
    for (const value of ['  lead e trail  ', "'quoted'", '"dq"', 'a$b`c;d\\e', HOSTILE]) {
      applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: value });
      const parsed = parseVpsEnvContent(readFileSync(target, 'utf8'));
      assert.equal(parsed.VPS_STAGING_PASSWORD, value, value);
      assert.equal(parsed.VPS_IP, '9.9.9.9', 'chave vizinha preservada');
    }
  });

  test('formato gravado é fonteável pelo shell POSIX (sem evaluating)', () => {
    const value = '  sp ace  ; rm -rf / $(id) `id` $HOME ';
    const line = `K=${encodeEnvValue(value)}`;
    // Nenhum byte fora das aspas simples: um valor com espaço/metacaractere
    // nunca pode sair de dentro do literal.
    assert.equal(line.slice(2, -1).includes("'"), true, 'aspas internas escapadas');
    assert.deepEqual(parseVpsEnvContent(line), { K: value });
  });

  test('valores legados continuam legíveis', () => {
    assert.deepEqual(parseVpsEnvContent('A=bare\nB="dq"\nC=\'sq\'\nD=  padded  \n'), {
      A: 'bare',
      B: 'dq',
      C: 'sq',
      D: 'padded',
    });
  });

  test('persistência mantém o comportamento fail-closed do segredo gerado', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'gerada', required: true } },
        }),
      /Cannot persist generated VPS_STAGING_PASSWORD/,
    );
    // segredo vindo de process.env sem arquivo: não há o que persistir, então
    // não aborta (fonte externa)
    assert.deepEqual(
      planEnvFileWrites({
        envPath: null,
        fileValues: {},
        overrides: { VPS_STAGING_PASSWORD: { value: 'do-env', required: false } },
      }).writes,
      {},
    );
  });
});

describe('upsertEnvValue — padrões de substituição $', () => {
  // Com replacement string, `$&`/`$$`/`$'`/``$` `` são expandidos e a
  // credencial persistida fica corrompida. O callback impede a expansão.
  const HOSTILE = ["$&", '$$', "$'", '$`', 'a$&b$$c$d\'e$f`g'].join('|');

  test('substituição preserva $&, $$, $\' e $` literalmente', () => {
    const replaced = upsertEnvValue('VPS_STAGING_PASSWORD=antigo\n', 'VPS_STAGING_PASSWORD', HOSTILE);
    assert.equal(replaced, `VPS_STAGING_PASSWORD=${encodeEnvValue(HOSTILE)}\n`);
    assert.equal(parseVpsEnvContent(replaced).VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('append também preserva os padrões literalmente', () => {
    const appended = upsertEnvValue('VPS_IP=1.2.3.4\n', 'VPS_STAGING_PASSWORD', HOSTILE);
    assert.equal(appended, `VPS_IP=1.2.3.4\nVPS_STAGING_PASSWORD=${encodeEnvValue(HOSTILE)}\n`);
    assert.equal(parseVpsEnvContent(appended).VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('round-trip: gravar e reler devolve exatamente a mesma senha', () => {
    const target = writeEnvFile('roundtrip.env', 'VPS_STAGING_PASSWORD=antigo\n');
    applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: HOSTILE });
    const reloaded = parseVpsEnvContent(readFileSync(target, 'utf8'));
    assert.equal(reloaded.VPS_STAGING_PASSWORD, HOSTILE);
  });

  test('round-trip de senha com aspas e espaços sobrevive ao arquivo', () => {
    const messy = `p'w "x" com espaco \\ back`;
    const target = writeEnvFile('roundtrip-messy.env', '');
    applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: messy });
    assert.equal(parseVpsEnvContent(readFileSync(target, 'utf8')).VPS_STAGING_PASSWORD, messy);
  });
});

describe('modo do arquivo de credenciais', () => {
  test('a constante de modo é 0600 (owner-only)', () => {
    assert.equal(CREDENTIAL_FILE_MODE, 0o600);
  });

  test('applyEnvFileWrites grava sempre com 0600 e não reaproveita o modo antigo', () => {
    const src = readFileSync(resolve(root, 'scripts', 'lib', 'vps-env.mjs'), 'utf8');
    assert.match(src, /writeFileSync\(tempPath, next, \{ encoding: 'utf8', mode: CREDENTIAL_FILE_MODE \}\)/);
    assert.ok(!/existingMode/.test(src), 'não deve reaproveitar a permissão anterior do arquivo');
  });

  test(
    'a substituição usa 0600 e não preserva permissão group/world-readable (POSIX)',
    { skip: process.platform === 'win32' ? 'POSIX modes only' : false },
    () => {
      const target = writeEnvFile('mode.env', 'VPS_STAGING_PASSWORD=antigo\n');
      chmodSync(target, 0o644);
      assert.equal(statSync(target).mode & 0o777, 0o644);
      applyEnvFileWrites(target, { VPS_STAGING_PASSWORD: 'novo' });
      assert.equal(statSync(target).mode & 0o777, CREDENTIAL_FILE_MODE);
      assert.equal(statSync(target).mode & 0o077, 0, 'nenhum bit de grupo/outro');
    },
  );
});

describe('persistência da senha de staging efetiva', () => {
  test('senha gerada é required: aborta sem arquivo de env', () => {
    assert.throws(
      () =>
        planEnvFileWrites({
          envPath: null,
          fileValues: {},
          overrides: { VPS_STAGING_PASSWORD: { value: 'gerada', required: true } },
        }),
      /Cannot persist generated VPS_STAGING_PASSWORD/,
    );
  });

  test('override de process.env divergente sincroniza o arquivo existente', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: { VPS_STAGING_PASSWORD: 'antigo-do-arquivo' },
      overrides: { VPS_STAGING_PASSWORD: { value: 'novo-do-env', required: false } },
    });
    assert.deepEqual(writes, { VPS_STAGING_PASSWORD: 'novo-do-env' });
  });

  test('override de process.env igual ao arquivo não gera escrita', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: { VPS_STAGING_PASSWORD: 'mesma' },
      overrides: { VPS_STAGING_PASSWORD: { value: 'mesma', required: false } },
    });
    assert.deepEqual(writes, {});
  });

  test('chave ausente no arquivo é sincronizada pelo valor efetivo', () => {
    const { writes } = planEnvFileWrites({
      envPath: '/tmp/.env',
      fileValues: {},
      overrides: { VPS_STAGING_PASSWORD: { value: 'novo-do-env', required: false } },
    });
    assert.deepEqual(writes, { VPS_STAGING_PASSWORD: 'novo-do-env' });
  });

  test('readVpsSettingWithOrigin distingue process.env de arquivo', () => {
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', {
        env: { VPS_STAGING_PASSWORD: 'do-env' },
        values: { VPS_STAGING_PASSWORD: 'do-arquivo' },
      }),
      { value: 'do-env', origin: SETTING_ORIGIN_PROCESS },
    );
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', {
        env: {},
        values: { VPS_STAGING_PASSWORD: 'do-arquivo' },
      }),
      { value: 'do-arquivo', origin: SETTING_ORIGIN_FILE },
    );
    assert.deepEqual(
      readVpsSettingWithOrigin('VPS_STAGING_PASSWORD', { env: {}, values: {} }),
      { value: undefined, origin: undefined },
    );
  });

  test('setup-staging-db planeja as duas chaves e escreve antes do connect', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    assert.match(src, /VPS_STAGING_PASSWORD: \{ value: stagingPassword, required: stagingGenerated \}/);
    assert.match(src, /VPS_POSTGRES_PASSWORD: \{ value: prodPassword, required: false \}/);
    const writeIndex = src.indexOf('applyEnvFileWrites(target, writes)');
    const connectIndex = src.indexOf('adminClient.connect()');
    assert.ok(writeIndex > 0 && connectIndex > 0 && writeIndex < connectIndex);
  });
});

describe('os três scripts consomem o módulo compartilhado', () => {
  const scripts = ['migrate-vps.ts', 'update-hyperdrive.ts', 'setup-staging-db.ts'];

  for (const name of scripts) {
    test(`${name} usa o resolver compartilhado e não fixa ../vps-hostinger em código`, () => {
      const src = readFileSync(resolve(root, 'scripts', name), 'utf8');
      assert.match(src, /from '\.\/lib\/vps-env\.mjs'/);
      assert.ok(
        !src.includes("'..', 'vps-hostinger'"),
        `${name} ainda fixa o caminho legado provider-specific`,
      );
      assert.ok(!src.includes('vps-contabo'), `${name} não deve introduzir literal de provider alvo`);
    });
  }

  test('as mensagens de erro apontam para SYNKROO_VPS_ENV, não para o caminho legado', () => {
    for (const name of scripts) {
      const src = readFileSync(resolve(root, 'scripts', name), 'utf8');
      assert.ok(
        !/process\.env or \.\.\/vps-hostinger/.test(src),
        `${name} ainda referencia o caminho legado nas mensagens`,
      );
      assert.ok(!src.includes('from ../vps-hostinger/.env'), `${name} referencia caminho legado em log`);
    }
  });

  test('setup-staging-db valida a persistência antes de conectar ao banco', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    const assertIndex = src.indexOf('assertEnvFileWritable(');
    const connectIndex = src.indexOf('adminClient.connect()');
    assert.ok(assertIndex > 0 && connectIndex > 0);
    assert.ok(
      assertIndex < connectIndex,
      'assertEnvFileWritable deve rodar antes de qualquer mutação no banco',
    );
  });

  test('setup-staging-db mantém a separação staging/produção', () => {
    const src = readFileSync(resolve(root, 'scripts', 'setup-staging-db.ts'), 'utf8');
    assert.match(src, /readVpsSettingWithOrigin\('VPS_STAGING_PASSWORD', \{ values \}\)/);
    assert.match(src, /readVpsSetting\('VPS_POSTGRES_PASSWORD', \{ values \}\)/);
  });
});

describe('fonte do módulo', () => {
  test('o módulo compartilhado não embute literal de provider alvo', () => {
    assert.ok(!libSrc.includes('vps-contabo'));
  });

  test('o módulo não usa process.cwd() para derivar o caminho legado', () => {
    const legacyFn = libSrc.slice(libSrc.indexOf('export function legacyVpsEnvPathFrom'));
    assert.ok(
      !legacyFn.slice(0, legacyFn.indexOf('}')).includes('process.cwd()'),
      'o fallback legado não pode depender de process.cwd()',
    );
  });
});
