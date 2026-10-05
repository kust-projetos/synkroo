/**
 * scripts/__tests__/backup-vps-restore-vps.test.mjs
 *
 * Contract tests for the Hostinger → Contabo DB DUMP/RESTORE operator scripts
 * (runbook §5.2 / §5.3): scripts/backup-vps-db.ts and scripts/restore-vps-db.ts.
 *
 * Local-only: no VPS, no database and no dump is ever touched. The two suites
 * are (a) static source assertions locking the secrets contract, and (b) pure
 * helper unit tests (composeDsn, verifyChecksum, metadata) over files created
 * in a temp dir. The spawn cases only exercise the early-exit paths (usage
 * errors and the checksum gate), which abort BEFORE any connection — plus one
 * dry-run plan rendering against a throwaway env file, which by contract opens
 * no socket.
 *
 * The .ts entrypoints are imported directly (Node strips the types): their pure
 * helpers are exported and main() is guarded by isCliInvocation, so importing
 * them cannot trigger a backup/restore.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, test } from 'node:test';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const read = (name) => readFileSync(join(root, 'scripts', name), 'utf8');
const SCRIPTS = [['backup-vps-db.ts', read('backup-vps-db.ts')], ['restore-vps-db.ts', read('restore-vps-db.ts')]];
const backupSrc = SCRIPTS[0][1];
const restoreSrc = SCRIPTS[1][1];

/** Lines that reach the operator: none of them may carry a credential. */
function logLines(src) {
  return src.split(/\r?\n/).filter((line) => /console\.(log|warn|error|info)\(/.test(line));
}

/** Strips block and line comments so prose in the header cannot pass as code. */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('*') && !line.trimStart().startsWith('//'))
    .join('\n');
}

/** True when the occurrence of DATABASE_URL on `line` sits inside a comment. */
function mentionIsComment(line) {
  const at = line.indexOf('DATABASE_URL');
  const slash = line.indexOf('//');
  return line.trimStart().startsWith('*') || (slash !== -1 && slash < at);
}

const backupModule = await import(pathToFileURL(join(root, 'scripts', 'backup-vps-db.ts')).href);
const restoreModule = await import(pathToFileURL(join(root, 'scripts', 'restore-vps-db.ts')).href);

// ─── Contrato source/target e módulo compartilhado ─────────────────────────

describe('contrato source/target dos scripts de dump/restore', () => {
  for (const [name, src] of SCRIPTS) {
    test(`${name}: resolve a configuração pelo side explícito`, () => {
      assert.match(src, /from '\.\/lib\/vps-env\.mjs'/, `${name} deve importar o módulo compartilhado`);
      assert.match(src, /resolveVpsSideSettings\(/, `${name} deve usar o resolver por side`);
      assert.match(src, /readCliFlag\(/, `${name} deve ler --side via argv`);
      assert.match(src, /VPS_SIDES\.includes\(side\)/, `${name} deve validar contra a lista de lados`);
      assert.match(src, /VPS_SIDE_INVALID_CODE/, `${name} deve citar o code de side inválido`);
      assert.match(src, /--side is required/, `${name} deve explicar que --side é obrigatório`);
      assert.match(src, /--side="\$\{side\}" is not a valid side/, `${name} deve rejeitar side inválido`);
      assert.match(src, /process\.exit\(1\)/, `${name} deve sair com código 1`);
      assert.ok(
        !/VPS_IP'|VPS_PG_PORT'|VPS_POSTGRES_PASSWORD'|VPS_STAGING_PASSWORD'/.test(src),
        `${name} ainda fixa uma chave genérica em vez das prefixadas por side`,
      );
      assert.match(
        src,
        /\[deprecated\] side="\$\{side\}" ainda lê as chaves genéricas/,
        `${name} deve avisar sobre as chaves genéricas em uso`,
      );
      assert.match(src, /usedLegacyKeys\.length > 0/, `${name} só avisa quando há alias em uso`);
    });

    test(`${name}: nenhum log carrega credencial nem o identificador dsn`, () => {
      const lines = logLines(src);
      assert.ok(lines.length > 0, `${name} deve manter ao menos um log`);
      const forbidden = /postgresPassword|stagingPassword|prodPassword|\bdsn\b|host=\$\{host\}/;
      for (const line of lines) {
        assert.ok(
          !forbidden.test(line),
          `${name}: log não pode referenciar credencial — ${line.trim()}`,
        );
      }
    });

    test(`${name}: o host resolvido não é impresso (rotulado pelo side)`, () => {
      assert.match(src, /host=<\$\{side\}>/, `${name} deve identificar o alvo como host=<side>`);
    });

    test(`${name}: compõe a DSN com a senha URL-encoded`, () => {
      assert.match(src, /encodeURIComponent\(password\)/);
      assert.match(src, /sslmode=/);
    });
  }
});

// ─── Segredos: DATABASE_URL só na composição do env do filho ───────────────

describe('secrets — DATABASE_URL nunca é logado', () => {
  for (const [name, src] of SCRIPTS) {
    test(`${name}: nenhum console.* referencia DATABASE_URL`, () => {
      for (const line of logLines(src)) {
        assert.ok(
          !line.includes('DATABASE_URL'),
          `${name}: log não pode citar o valor de DATABASE_URL — ${line.trim()}`,
        );
      }
    });

    test(`${name}: DATABASE_URL aparece só na composição do env do processo filho`, () => {
      const code = stripComments(src);
      const occurrences = code
        .split(/\r?\n/)
        .filter((line) => line.includes('DATABASE_URL') && !mentionIsComment(line));
      assert.equal(occurrences.length, 1, `${name}: DATABASE_URL deve ter uma única ocorrência em código`);
      assert.match(
        occurrences[0],
        /env: \{ \.\.\.process\.env, DATABASE_URL: dsn(, PGUSER: DB_ROLE)? \}/,
        `${name}: a DSN deve entrar apenas via env do filho, nunca em argv`,
      );
    });

    test(`${name}: o argv do engine nunca recebe a DSN`, () => {
      const code = stripComments(src);
      const calls = code.split(/spawnSync\(/).slice(1);
      assert.ok(calls.length > 0, `${name} deve spawnar o engine`);
      for (const tail of calls) {
        // A chamada vai até o fechamento `);` no nível do spawn.
        const call = tail.split(/\r?\n\);/)[0];
        for (const line of call.split(/\r?\n/)) {
          if (!/\bdsn\b/.test(line)) continue;
          assert.ok(
            line.includes('DATABASE_URL: dsn'),
            `${name}: a DSN só pode entrar via env, nunca em argv — ${line.trim()}`,
          );
        }
      }
    });
  }
});

// ─── PGUSER: o restore precisa exportar o usuário que o engine apaga ────────

describe('PGUSER — o restore não pode herdar o usuário do shell', () => {
  test('db-restore.mjs apaga o usuário da DSN e chama pg_restore/psql sem -U', () => {
    // A evidência de que o fix é necessário: o engine remove o userinfo da DSN
    // antes de montar o argv, então o libpq cairia no usuário do SO.
    const engine = read('db-restore.mjs');
    assert.match(engine, /u\.username = '';/, 'db-restore.mjs deveria remover o usuário da DSN');
    assert.ok(!/PGUSER/.test(engine), 'o engine não define PGUSER: o wrapper precisa fornecer');
    // E o argv de pg_restore/psql realmente não carrega -U.
    assert.match(engine, /restoreArgs\.push\('-d', dsnNoPass, dumpPath\)/);
    assert.match(engine, /run\('psql', \[dsnNoPass, '-tAc'/);
  });

  test('restore-vps-db.ts exporta PGUSER com o papel resolvido para o env do filho', () => {
    assert.equal(restoreModule.DB_ROLE, 'synkroo');
    assert.match(
      restoreSrc,
      /env: \{ \.\.\.process\.env, DATABASE_URL: dsn, PGUSER: DB_ROLE \}/,
      'PGUSER deve entrar no env do filho junto da DSN',
    );
    // O valor é o MESMO usado para compor a DSN e para o `pg` Client — uma
    // única fonte de verdade, sem literal duplicado.
    assert.match(restoreSrc, /composeDsn\(\{ host, port, password, database, user: DB_ROLE \}\)/);
  });

  test('backup-vps-db.ts não precisa de PGUSER: o engine passa -U ao pg_dump', () => {
    // Verificado em scripts/db-backup.mjs: o -U vem do userinfo da DSN, então
    // exportar PGUSER aqui seria redundante.
    const engine = read('db-backup.mjs');
    assert.match(engine, /'-h', host, '-p', port, '-U', dbUser, '-d', dsnNoPass/);
    assert.match(backupSrc, /env: \{ \.\.\.process\.env, DATABASE_URL: dsn \}/);
  });
});

// ─── Gate de flag sem valor (fail-closed antes de tudo) ────────────────────

describe('flag sem valor não degrada para o default', () => {
  test('findValuelessFlags separa token solto de flag ausente', () => {
    const restore = restoreModule;
    assert.deepEqual(restore.findValuelessFlags([], restore.VALUE_REQUIRED_FLAGS), []);
    assert.deepEqual(restore.findValuelessFlags(['--side=source'], restore.VALUE_REQUIRED_FLAGS), []);
    assert.deepEqual(
      restore.findValuelessFlags(['--from', 'x.dump.gz', '--create-db', 'r1'], restore.VALUE_REQUIRED_FLAGS),
      [],
    );
    // `--create-db --yes` → o próximo token é outra flag: readCliFlag devolve
    // undefined e a flag é (erroneamente) tratada como ausente.
    assert.deepEqual(
      restore.findValuelessFlags(['--create-db', '--yes'], restore.VALUE_REQUIRED_FLAGS),
      ['--create-db'],
    );
    assert.deepEqual(restore.findValuelessFlags(['--db', '--yes'], restore.VALUE_REQUIRED_FLAGS), ['--db']);
    assert.deepEqual(restore.findValuelessFlags(['--side'], restore.VALUE_REQUIRED_FLAGS), ['--side']);
    assert.deepEqual(restore.findValuelessFlags(['--from'], restore.VALUE_REQUIRED_FLAGS), ['--from']);
    // A forma inline com valor não é sinalizada (nem vazia: essa cai no
    // validador de nome/valor mais abaixo).
    assert.deepEqual(restore.findValuelessFlags(['--db=synkroo'], restore.VALUE_REQUIRED_FLAGS), []);

    const backup = backupModule;
    assert.deepEqual(backup.findValuelessFlags(['--keep', '14'], backup.VALUE_REQUIRED_FLAGS), []);
    assert.deepEqual(backup.findValuelessFlags(['--keep', '--yes'], backup.VALUE_REQUIRED_FLAGS), ['--keep']);
    assert.deepEqual(backup.findValuelessFlags(['--out-dir'], backup.VALUE_REQUIRED_FLAGS), ['--out-dir']);
    assert.deepEqual(backup.findValuelessFlags(['--db', '--keep', '7'], backup.VALUE_REQUIRED_FLAGS), ['--db']);

    // As duas implementações cobrem exatamente as flags documentadas.
    assert.deepEqual([...restore.VALUE_REQUIRED_FLAGS], ['--side', '--from', '--create-db', '--db']);
    assert.deepEqual([...backup.VALUE_REQUIRED_FLAGS], ['--side', '--db', '--out-dir', '--keep']);
  });

  test('o guard roda antes do gate de checksum e da resolução de credenciais', () => {
    const guardIdx = restoreSrc.indexOf('assertNoValuelessFlags(argv');
    const checksumIdx = restoreSrc.indexOf('verifyChecksum({ dumpPath');
    assert.ok(guardIdx > 0 && checksumIdx > 0);
    assert.ok(guardIdx < checksumIdx, 'a flag sem valor precisa abortar antes do checksum');
  });
});

// ─── Gate de checksum (fail-closed) ───────────────────────────────────────

describe('restore: gate de checksum fecha a execução', () => {
  test('divergência tem código próprio e nunca é sobreponível', () => {
    assert.match(restoreSrc, /SYNKROO_RESTORE_CHECKSUM_MISMATCH/);
    assert.match(restoreSrc, /nunca é sobreponível/);
    // A flag só treat a AUSÊNCIA do sidecar, não a divergência.
    assert.match(restoreSrc, /allowMissingSidecar = argv\.includes\('--allow-missing-checksum'\)/);
    assert.match(restoreSrc, /SYNKROO_RESTORE_CHECKSUM_MISSING/);
    assert.match(restoreSrc, /SYNKROO_RESTORE_CHECKSUM_UNREADABLE/);
    assert.match(restoreSrc, /SYNKROO_RESTORE_DUMP_MISSING/);
  });

  test('o gate roda antes de qualquer DDL ou conexão', () => {
    const gateIdx = restoreSrc.indexOf('verifyChecksum({ dumpPath');
    const ddlIdx = restoreSrc.indexOf('preflightRehearsalDatabase({');
    assert.ok(gateIdx > 0, 'verifyChecksum deve ser chamado');
    assert.ok(ddlIdx > 0, 'preflightRehearsalDatabase deve ser chamado');
    assert.ok(gateIdx < ddlIdx, 'o checksum precisa fechar ANTES do DDL');
  });

  test('sidecar corrompido não é "verificado" silenciosamente', () => {
    assert.equal(restoreModule.parseChecksumSidecar('nao-e-hex'), null);
    assert.equal(restoreModule.parseChecksumSidecar(''), null);
    assert.equal(restoreModule.parseChecksumSidecar(`${'a'.repeat(63)}  x.dump.gz`), null);
    assert.equal(restoreModule.parseChecksumSidecar(`${'A'.repeat(64)}  x.dump.gz`), 'a'.repeat(64));
  });

  test('caminho do sidecar segue a convenção do engine (.gz → .sha256)', () => {
    assert.equal(
      restoreModule.checksumSidecarPathFor('/b/synkroo-20261005-120000.dump.gz'),
      '/b/synkroo-20261005-120000.dump.sha256',
    );
    assert.equal(restoreModule.checksumSidecarPathFor('/b/plain.dump'), '/b/plain.dump.sha256');
    // backup-vps-db.ts descobre o sidecar do engine pela MESMA regra.
    assert.equal(
      backupModule.checksumSidecarPathFor('/b/x.dump.gz'),
      restoreModule.checksumSidecarPathFor('/b/x.dump.gz'),
    );
    assert.equal(
      backupModule.metadataSidecarPathFor('/b/synkroo-20261005-120000.dump.gz'),
      '/b/synkroo-20261005-120000.dump.meta.json',
    );
  });
});

// ─── Extensões e ledger (pré-requisitos do rehearsal) ──────────────────────

describe('restore: pré-requisitos do rehearsal', () => {
  test('instala vector e btree_gist antes do pg_restore', () => {
    assert.deepEqual([...restoreModule.REQUIRED_EXTENSIONS], ['vector', 'btree_gist']);
    assert.match(restoreSrc, /CREATE EXTENSION IF NOT EXISTS \$\{quotePgIdentifier\(extension\)\}/);
    assert.match(restoreSrc, /REQUIRED_EXTENSIONS\.join\(', '\)/);
  });

  test('o ledger de migrations do Drizzle é contado no smoke', () => {
    assert.equal(restoreModule.LEDGER_TABLE, 'drizzle.__drizzle_migrations');
    assert.match(restoreSrc, /__drizzle_migrations/);
    assert.match(restoreSrc, /SYNKROO_RESTORE_SMOKE_LEDGER_FAILED/);
  });

  test('o smoke usa os nomes REAIS das tabelas do schema', () => {
    const tables = [...restoreModule.SMOKE_TABLES];
    for (const table of ['clinics', 'users', 'patients', 'appointments', 'budgets', 'payments', 'leads']) {
      assert.ok(tables.includes(table), `smoke deveria cobrir ${table}`);
    }
    // `installments`/`contacts` não existem no schema (ver src/lib/db/schema);
    // os equivalentes reais são budget_installments e patients+leads.
    assert.ok(tables.includes('budget_installments'), 'installments reais: budget_installments');
    assert.ok(!tables.includes('installments'), 'tabela inexistente não pode entrar no smoke');
    assert.ok(!tables.includes('contacts'), 'tabela inexistente não pode entrar no smoke');
  });

  test('falha no smoke nomeia a tabela e nunca linhas de dados', () => {
    assert.match(restoreSrc, /smoke pós-restore falhou na tabela "\$\{table\}"/);
    assert.match(restoreSrc, /SYNKROO_RESTORE_SMOKE_TABLE_FAILED/);
  });
});

// ─── composeDsn (helper puro, idêntico nos dois scripts) ──────────────────

describe('composeDsn — senha URL-encoded', () => {
  const HOSTILE = "p@ss:w rd#$'&/\\x";
  const host = '10.11.12.13';
  const params = { host, port: 5432, password: HOSTILE, database: 'synkroo' };
  const expected =
    `postgresql://synkroo:${encodeURIComponent(HOSTILE)}@${host}:5432/synkroo?sslmode=require`;

  for (const [name, mod] of [['backup-vps-db.ts', backupModule], ['restore-vps-db.ts', restoreModule]]) {
    test(`${name}: produz a URL esperada com metacaracteres escapados`, () => {
      assert.equal(mod.composeDsn(params), expected);
    });

    test(`${name}: a senha volta intacta ao decodificar o userinfo`, () => {
      const parsed = new URL(mod.composeDsn(params));
      assert.equal(decodeURIComponent(parsed.password), HOSTILE);
      assert.equal(parsed.username, 'synkroo');
      assert.equal(parsed.hostname, host);
      assert.equal(parsed.port, '5432');
      assert.equal(parsed.pathname, '/synkroo');
      assert.equal(parsed.searchParams.get('sslmode'), 'require');
      // Metacaracteres de query/fragmento não escaparam para a URL.
      assert.ok(!mod.composeDsn(params).includes('#'), 'a senha não pode forjar um fragmento');
    });
  }

  test('as duas implementações permanecem idênticas (contrato travado)', () => {
    for (const port of ['5432', 15432]) {
      const args = { ...params, port };
      assert.equal(backupModule.composeDsn(args), restoreModule.composeDsn(args));
    }
    assert.equal(backupModule.composeDsn(params), restoreModule.composeDsn(params));
  });
});

// ─── metadata redatada ────────────────────────────────────────────────────

describe('buildDumpMetadata — metadata sem segredo', () => {
  const PASSWORD = 'segredo-super-nao-vazar';
  const IP = '203.0.113.9';

  test('leva side, database, hash, timestamp e runbook', () => {
    const meta = backupModule.buildDumpMetadata({
      side: 'source',
      database: 'synkroo',
      port: 5432,
      dumpFile: 'synkroo-20261005-120000.dump.gz',
      sha256: 'a'.repeat(64),
      sizeBytes: 4242,
      createdAt: new Date('2026-10-05T12:00:00.000Z'),
    });
    assert.equal(meta.generator, 'backup-vps-db.ts');
    assert.equal(meta.side, 'source');
    assert.equal(meta.database, 'synkroo');
    assert.equal(meta.hostLabel, '<source>');
    assert.equal(meta.dumpFile, 'synkroo-20261005-120000.dump.gz');
    assert.equal(meta.checksumFile, 'synkroo-20261005-120000.dump.sha256');
    assert.equal(meta.sha256, 'a'.repeat(64));
    assert.equal(meta.sizeBytes, 4242);
    assert.equal(meta.createdAtUtc, '2026-10-05T12:00:00.000Z');
    assert.match(meta.runbook, /2026-10-05-hostinger-to-contabo-and-waha-migration\.md §5\.2/);
  });

  test('não contém host, senha nem DSN', () => {
    const meta = backupModule.buildDumpMetadata({
      side: 'target',
      database: 'synkroo',
      port: 5432,
      dumpFile: 'synkroo-20261005-120000.dump.gz',
      sha256: 'b'.repeat(64),
      sizeBytes: 1,
    });
    const serialized = JSON.stringify(meta);
    assert.ok(!serialized.includes(IP));
    assert.ok(!serialized.includes(PASSWORD));
    assert.ok(!serialized.includes('postgresql://'));
    assert.ok(!/password/i.test(serialized), `metadata não pode citar password: ${serialized}`);
    assert.ok(!serialized.includes(IP));
  });
});

// ─── newestDumpArtifact ───────────────────────────────────────────────────

describe('newestDumpArtifact — só artefato desta execução', () => {
  test('ignora dump antigo, escolhe o mais novo e não confunde o sidecar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-artifact-'));
    writeFileSync(join(dir, 'synkroo-20200101-000000.dump.gz'), 'antigo');
    writeFileSync(join(dir, 'synkroo-20261005-120000.dump.gz'), 'novo');
    writeFileSync(join(dir, 'synkroo-20261005-120000.dump.sha256'), 'sidecar');
    const now = Date.now();

    // Lower bound antes dos dois: vence o mtime mais novo (o dump, não o sidecar).
    assert.equal(backupModule.newestDumpArtifact(dir, now - 3_600_000)?.name, 'synkroo-20261005-120000.dump.gz');
    // Lower bound depois de tudo: nada desta execução → fail-closed.
    assert.equal(backupModule.newestDumpArtifact(dir, now + 3_600_000), null);
    // Diretório inexistente é null, não exceção.
    assert.equal(backupModule.newestDumpArtifact(join(dir, 'inexistente')), null);
  });

  test('a janela é [início, fim]: dump com mtime no FUTURO não é adotado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-artifact-window-'));
    const written = join(dir, 'synkroo-20261005-120000.dump.gz');
    writeFileSync(written, 'desta execucao');
    const start = Date.now() - 1_000;
    const end = Date.now();

    // Dentro da janela: o artefato é aceito (o engine terminou antes do fim).
    assert.equal(backupModule.newestDumpArtifact(dir, start, end)?.name, 'synkroo-20261005-120000.dump.gz');
    // Fora pela frente (mtime > fim + tolerância): pre-existente com relógio
    // adiantado não pode virar "o dump desta execução".
    assert.equal(backupModule.newestDumpArtifact(dir, start, end - 3_600_000), null);
    // A tolerância de skew existe: um mtime até MTIME_SKEW_TOLERANCE_MS depois
    // do fim ainda é aceito (granularidade de mtime/relogio).
    assert.ok(backupModule.MTIME_SKEW_TOLERANCE_MS >= 2_000);
    assert.equal(backupModule.newestDumpArtifact(dir, start, end)?.name, 'synkroo-20261005-120000.dump.gz');
  });

  test('o wrapper fecha a janela: fim capturado logo após o engine sair', () => {
    const started = backupSrc.indexOf('const startedAtMs = Date.now();');
    const finished = backupSrc.indexOf('const finishedAtMs = Date.now();');
    const errorCheck = backupSrc.indexOf('if (engineRun.error)');
    const selected = backupSrc.indexOf('newestDumpArtifact(outDir, startedAtMs, finishedAtMs)');
    assert.ok(started > 0, 'início da janela não capturado');
    assert.ok(finished > 0, 'fim da janela não capturado');
    assert.ok(
      finished < errorCheck,
      'o fim da janela deve ser capturado logo após o filho sair, antes de tratar o erro',
    );
    assert.ok(selected > errorCheck, 'a seleção deve usar a janela fechada');
  });
});

// ─── verifyChecksum (helper puro, fail-closed) ────────────────────────────

describe('verifyChecksum — gate fail-closed sobre arquivos reais', () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-checksum-'));
    const dump = join(dir, 'synkroo-20261005-120000.dump.gz');
    const sidecar = join(dir, 'synkroo-20261005-120000.dump.sha256');
    writeFileSync(dump, 'conteudo-do-dump');
    const digest = createHash('sha256').update(readFileSync(dump)).digest('hex');
    return { dir, dump, sidecar, digest };
  };

  test('sidecar correspondente → verificado', () => {
    const { dump, sidecar, digest } = setup();
    writeFileSync(sidecar, `${digest}  synkroo-20261005-120000.dump.gz\n`);
    const result = restoreModule.verifyChecksum({ dumpPath: dump });
    assert.equal(result.sha256, digest);
    assert.equal(result.sidecarVerified, true);
    assert.equal(result.sidecarPath, sidecar);
  });

  test('divergência → lança com code próprio, nomeia só arquivos e não é sobreponível', () => {
    const { dump, sidecar } = setup();
    writeFileSync(sidecar, `${'0'.repeat(64)}  synkroo-20261005-120000.dump.gz\n`);
    const mismatch = () => restoreModule.verifyChecksum({ dumpPath: dump });
    assert.throws(mismatch, (err) => {
      assert.equal(err.code, 'SYNKROO_RESTORE_CHECKSUM_MISMATCH');
      assert.match(err.message, /synkroo-20261005-120000\.dump\.gz/);
      assert.match(err.message, /synkroo-20261005-120000\.dump\.sha256/);
      assert.ok(!err.message.includes('0'.repeat(64)), 'a mensagem não ecoa o digest divergente');
      return true;
    });
    // A flag de sidecar ausente NÃO sobrepõe divergência.
    assert.throws(() => restoreModule.verifyChecksum({ dumpPath: dump, allowMissingSidecar: true }), /divergente|diverg/i);
  });

  test('sidecar ausente → code distinto, liberável só com --allow-missing-checksum', () => {
    const { dump, digest } = setup();
    assert.throws(() => restoreModule.verifyChecksum({ dumpPath: dump }), (err) => {
      assert.equal(err.code, 'SYNKROO_RESTORE_CHECKSUM_MISSING');
      assert.match(err.message, /--allow-missing-checksum/);
      return true;
    });
    const allowed = restoreModule.verifyChecksum({ dumpPath: dump, allowMissingSidecar: true });
    assert.equal(allowed.sidecarVerified, false);
    assert.equal(allowed.sidecarPath, null);
    assert.equal(allowed.sha256, digest);
  });

  test('sidecar ilegível → code distinto e nunca liberado', () => {
    const { dump, sidecar } = setup();
    writeFileSync(sidecar, 'lixo que não é sha256sum\n');
    for (const allowMissingSidecar of [false, true]) {
      assert.throws(
        () => restoreModule.verifyChecksum({ dumpPath: dump, allowMissingSidecar }),
        (err) => {
          assert.equal(err.code, 'SYNKROO_RESTORE_CHECKSUM_UNREADABLE');
          assert.match(err.message, /synkroo-20261005-120000\.dump\.sha256/);
          return true;
        },
      );
    }
  });

  test('dump inexistente → code próprio, sem tocar em sidecar', () => {
    const { dir } = setup();
    const missing = join(dir, 'synkroo-99999999-999999.dump.gz');
    assert.throws(() => restoreModule.verifyChecksum({ dumpPath: missing, allowMissingSidecar: true }), (err) => {
      assert.equal(err.code, 'SYNKROO_RESTORE_DUMP_MISSING');
      assert.match(err.message, /synkroo-99999999-999999\.dump\.gz/);
      return true;
    });
  });
});

// ─── buildRestorePlan (dry-run puro) ──────────────────────────────────────

describe('buildRestorePlan — plano do dry-run', () => {
  const base = {
    side: 'target',
    port: 5432,
    database: 'synkroo_rehearsal',
    dumpPath: join('/b', 'synkroo-20261005-120000.dump.gz'),
    checksum: {
      dumpPath: '/b/synkroo-20261005-120000.dump.gz',
      sidecarPath: '/b/synkroo-20261005-120000.dump.sha256',
      sha256: 'c'.repeat(64),
      sidecarVerified: true,
    },
  };

  test('rehearsal descreve CREATE DATABASE + extensões + smoke', () => {
    const plan = restoreModule.buildRestorePlan({ ...base, isRehearsal: true }).join('\n');
    assert.match(plan, /DRY-RUN/);
    assert.match(plan, /host=<target>:5432/);
    assert.match(plan, /CREATE DATABASE "synkroo_rehearsal" OWNER "synkroo"/);
    assert.match(plan, /CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS btree_gist/);
    assert.match(plan, /scripts\/db-restore\.mjs <dump> --url --yes/);
    assert.match(plan, /verificado \(sha256 cccccccccccc/);
    assert.match(plan, /drizzle\.__drizzle_migrations/);
  });

  test('sem --create-db não promete DDL', () => {
    const plan = restoreModule
      .buildRestorePlan({ ...base, database: 'synkroo', isRehearsal: false })
      .join('\n');
    assert.ok(!plan.includes('CREATE DATABASE'), 'não deve prometer DDL');
    assert.match(plan, /sem DDL/);
  });

  test('checksum não verificado é declarado no plano', () => {
    const plan = restoreModule
      .buildRestorePlan({
        ...base,
        isRehearsal: true,
        checksum: { ...base.checksum, sidecarPath: null, sidecarVerified: false },
      })
      .join('\n');
    assert.match(plan, /NÃO verificado/);
  });
});

// ─── CLI real: early-exit (antes de qualquer conexão) ─────────────────────

/** Runs an operator script through tsx exactly as the docs tell operators to. */
function runScript(script, args, extraEnv = {}) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', join(root, 'scripts', script), ...args],
    { cwd: root, encoding: 'utf8', env: { ...process.env, ...extraEnv }, timeout: 30_000 },
  );
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/** A dump file that exists but has NO sidecar: proves which gate fired first. */
function dumpWithoutSidecar(label) {
  const dir = mkdtempSync(join(tmpdir(), label));
  const dump = join(dir, 'synkroo-20261005-120000.dump.gz');
  writeFileSync(dump, 'conteudo');
  return dump;
}

describe('backup-vps-db.ts — saída de uso', () => {
  test('sem --side sai 1 com o usage', () => {
    const r = runScript('backup-vps-db.ts', []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--side is required/);
    assert.match(r.stderr, /Usage:/);
    // Prova de que a validação de flags precede a resolução de credenciais.
    assert.ok(!r.output.includes('is missing:'), `não deveria tocar no env: ${r.output}`);
  });

  test('--side inválido sai 1 nomeando os lados aceitos', () => {
    const r = runScript('backup-vps-db.ts', ['--side=bogus']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--side="bogus" is not a valid side/);
    assert.match(r.stderr, /source or target/);
  });

  test('--keep não inteiro sai 1 sem executar o engine', () => {
    const r = runScript('backup-vps-db.ts', ['--side=source', '--keep', 'abc']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--keep deve ser um inteiro/);
    assert.ok(!r.output.includes('db-backup.mjs (modo'), 'engine não pode ser executado');
  });

  test('--keep sem valor sai 1 antes de resolver credenciais', () => {
    const r = runScript('backup-vps-db.ts', ['--side=source', '--keep', '--yes']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--keep sem valor/);
    assert.ok(!r.output.includes('is missing:'), `não deveria tocar no env: ${r.output}`);
    assert.ok(!r.output.includes('db-backup.mjs (modo'), 'engine não pode ser executado');
  });

  test('--out-dir sem valor não cai silenciosamente em ./backups', () => {
    const r = runScript('backup-vps-db.ts', ['--side=source', '--out-dir']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--out-dir sem valor/);
    assert.ok(!r.output.includes('is missing:'), `não deveria tocar no env: ${r.output}`);
  });
});

describe('restore-vps-db.ts — saída de uso e gate de checksum', () => {
  test('sem --side sai 1 com o usage', () => {
    const r = runScript('restore-vps-db.ts', []);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--side is required/);
    assert.match(r.stderr, /Usage:/);
  });

  test('sem --from sai 1 antes de resolver credenciais', () => {
    const r = runScript('restore-vps-db.ts', ['--side=source']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /--from é obrigatório/);
    assert.ok(!r.output.includes('is missing:'), `não deveria tocar no env: ${r.output}`);
  });

  test('--create-db com --db é recusado', () => {
    const r = runScript('restore-vps-db.ts', ['--side=source', '--from', 'x.dump.gz', '--create-db', 'r1', '--db', 'synkroo']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /mutuamente exclusivos/);
  });

  test('checksum divergente aborta antes de qualquer conexão', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-cli-mismatch-'));
    const dump = join(dir, 'synkroo-20261005-120000.dump.gz');
    writeFileSync(dump, 'conteudo');
    writeFileSync(`${dump.slice(0, -'.gz'.length)}.sha256`, `${'0'.repeat(64)}  x.dump.gz\n`);
    const r = runScript('restore-vps-db.ts', ['--side=target', '--from', dump, '--create-db', 'rehearsal', '--yes']);
    assert.equal(r.status, 1);
    assert.match(r.output, /SYNKROO_RESTORE_CHECKSUM_MISMATCH|divergente/i);
    assert.ok(!r.output.includes('postgresql://'), 'nenhuma conexão/DSN deve aparecer');
  });

  test('sidecar ausente aborta sem --allow-missing-checksum', () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-cli-nosidecar-'));
    const dump = join(dir, 'synkroo-20261005-120000.dump.gz');
    writeFileSync(dump, 'conteudo');
    const r = runScript('restore-vps-db.ts', ['--side=target', '--from', dump, '--create-db', 'rehearsal']);
    assert.equal(r.status, 1);
    assert.match(r.output, /--allow-missing-checksum/);
  });

  // ── Footgun: `--create-db --yes` é indistinguível de `--create-db` ausente ──
  test('--create-db sem valor sai 1 sem conectar (não vira a base de produção)', () => {
    // Dump SEM sidecar de propósito: se o gate de checksum falasse primeiro, o
    // stderr seria o do sidecar ausente, não o da flag.
    const dump = dumpWithoutSidecar('synkroo-cli-valueless-createdb-');
    const r = runScript('restore-vps-db.ts', ['--side=target', '--from', dump, '--create-db', '--yes']);
    assert.equal(r.status, 1, r.output);
    assert.match(r.stderr, /--create-db sem valor/);
    assert.ok(
      !/sidecar SHA-256 ausente|SYNKROO_RESTORE_CHECKSUM_MISSING/.test(r.output),
      `o gate de flag precisa vir antes do checksum: ${r.output}`,
    );
    assert.ok(!r.output.includes('postgresql://'), 'nenhuma conexão/DSN deve aparecer');
    assert.ok(!r.output.includes('is missing:'), `não deveria resolver credenciais: ${r.output}`);
  });

  test('--db sem valor sai 1 sem conectar (não vira a base padrão synkroo)', () => {
    const dump = dumpWithoutSidecar('synkroo-cli-valueless-db-');
    const r = runScript('restore-vps-db.ts', ['--side=target', '--from', dump, '--db', '--yes']);
    assert.equal(r.status, 1, r.output);
    assert.match(r.stderr, /--db sem valor/);
    assert.ok(
      !/sidecar SHA-256 ausente|SYNKROO_RESTORE_CHECKSUM_MISSING/.test(r.output),
      `o gate de flag precisa vir antes do checksum: ${r.output}`,
    );
    assert.ok(!r.output.includes('postgresql://'), 'nenhuma conexão/DSN deve aparecer');
  });
});

describe('restore-vps-db.ts — dry-run não abre conexão', () => {
  const PASSWORD = 'senha-de-teste-nunca-impressa';
  const IP = '198.51.100.7';

  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-cli-dryrun-'));
    const dump = join(dir, 'synkroo-20261005-120000.dump.gz');
    writeFileSync(dump, 'conteudo');
    const digest = createHash('sha256').update(readFileSync(dump)).digest('hex');
    writeFileSync(`${dump.slice(0, -'.gz'.length)}.sha256`, `${digest}  synkroo-20261005-120000.dump.gz\n`);
    const envFile = join(dir, 'vps.env');
    writeFileSync(
      envFile,
      [`VPS_TARGET_IP=${IP}`, 'VPS_TARGET_PG_PORT=5432', `VPS_TARGET_POSTGRES_PASSWORD='${PASSWORD}'`].join('\n'),
    );
    return { dump, envFile };
  };

  test('imprime o plano, sai 0 e não expõe host nem senha', () => {
    const { dump, envFile } = setup();
    const r = runScript(
      'restore-vps-db.ts',
      ['--side=target', '--from', dump, '--create-db', 'synkroo_rehearsal'],
      { SYNKROO_VPS_ENV: envFile },
    );
    assert.equal(r.status, 0, r.output);
    assert.match(r.stdout, /DRY-RUN/);
    assert.match(r.stdout, /host=<target>:5432/);
    assert.match(r.stdout, /rehearsal — será criada/);
    assert.match(r.stdout, /CREATE DATABASE "synkroo_rehearsal" OWNER "synkroo"/);
    assert.match(r.stdout, /CREATE EXTENSION IF NOT EXISTS vector/);
    assert.match(r.stdout, /btree_gist/);
    assert.match(r.stdout, /drizzle\.__drizzle_migrations/);
    assert.match(r.stdout, /--yes$/m);
    assert.ok(!r.output.includes(PASSWORD), `senha vazou: ${r.output}`);
    assert.ok(!r.output.includes(IP), `host vazou: ${r.output}`);
    assert.ok(!r.output.includes('postgresql://'), 'DSN não pode aparecer');
    // O plano não executa o engine.
    assert.ok(!r.output.includes('pg_restore --no-owner'));
  });

  test('--yes --dry-run mantém a precedência segura (dry-run)', () => {
    const { dump, envFile } = setup();
    const r = runScript(
      'restore-vps-db.ts',
      ['--side=target', '--from', dump, '--db', 'synkroo', '--yes', '--dry-run'],
      { SYNKROO_VPS_ENV: envFile },
    );
    assert.equal(r.status, 0, r.output);
    assert.match(r.stdout, /DRY-RUN/);
    assert.match(r.stdout, /sem DDL/);
    assert.ok(!r.output.includes('RESTORE REAL confirmado'));
  });
});