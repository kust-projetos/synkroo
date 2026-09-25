import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, statSync, fstatSync, unlinkSync, existsSync, symlinkSync, renameSync, utimesSync, closeSync, writeSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isCliInvocation as isBackupCli,
  safeTargetLabel as backupLabel,
  sanitizeOutput as backupSanitize,
  restrictTempMode as backupRestrict,
  buildDsnNoPass as backupDsn,
  maskArg as backupMask,
  createRestrictedTemp as backupMkTemp,
  cleanupOwnedTemp as backupCleanup,
  gzipFile as backupGzip,
  uniqueTempPath as backupUniqueTemp,
  pruneRetention as backupPrune,
} from '../db-backup.mjs';
import {
  isCliInvocation as isRestoreCli,
  safeTargetLabel as restoreLabel,
  sanitizeOutput as restoreSanitize,
  restrictTempMode as restoreRestrict,
  buildDsnNoPass as restoreDsn,
  maskArg as restoreMask,
  createRestrictedTemp as restoreMkTemp,
  cleanupOwnedTemp as restoreCleanup,
  gunzipTo as restoreGunzip,
  uniqueTempPath as restoreUniqueTemp,
} from '../db-restore.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const backupSrc = readFileSync(join(here, '..', 'db-backup.mjs'), 'utf8');
const restoreSrc = readFileSync(join(here, '..', 'db-restore.mjs'), 'utf8');

// ─── Rótulo seguro: só host/dbname, nunca credencial ─────────────────────────

for (const [name, label] of [['backup', backupLabel], ['restore', restoreLabel]]) {
  test(`${name}: safeTargetLabel expõe só host/dbname`, () => {
    assert.equal(label('postgres://user:s3cr3t@db.internal:5432/synkroo'), 'db.internal/synkroo');
    assert.equal(label('postgres://user@db.internal/synkroo'), 'db.internal/synkroo');
  });
  test(`${name}: safeTargetLabel nunca vaza senha em query string`, () => {
    const out = label('postgres://user:s3cr3t@db.internal/synkroo?sslmode=require&password=s3cr3t');
    assert.ok(!out.includes('s3cr3t'), `vazou segredo: ${out}`);
    assert.ok(out.startsWith('db.internal/'));
  });
  test(`${name}: safeTargetLabel com URL inválida não quebra nem ecoa`, () => {
    const out = label('não-é-url');
    assert.equal(out, '<alvo inválido>');
  });
  test(`${name}: sanitizeOutput mascara userinfo e senhas`, () => {
    const dirty = 'connect to postgres://admin:s3cr3t@host/db failed; detail password=s3cr3t&x=1';
    const clean = label === backupLabel ? backupSanitize(dirty) : restoreSanitize(dirty);
    assert.ok(!clean.includes('s3cr3t'), `vazou segredo: ${clean}`);
    assert.ok(clean.includes('//***@'));
    assert.ok(clean.includes('password=***'));
  });
}

// ─── Estrutural: sem exit dentro de try; sem URL impressa; sem --url inline ──

for (const [name, src] of [['db-backup.mjs', backupSrc], ['db-restore.mjs', restoreSrc]]) {
  test(`${name}: nenhum process.exit(1) dentro de main (finally sempre limpa)`, () => {
    const mainIdx = src.indexOf('async function main()');
    assert.ok(mainIdx > 0, 'main não encontrada');
    const before = src.slice(0, mainIdx);
    const after = src.slice(mainIdx);
    assert.ok(before.includes('process.exit('), 'parseArgs/usage devem manter exits de uso (0/2)');
    // Saídas 0/2 pré-temporários (help/uso/dry-run) são seguras; o exit de
    // FALHA (1) não pode existir em main — erro propaga via throw até o catch,
    // o finally limpa os temporários e só então process.exitCode é aplicado.
    assert.ok(!after.includes('process.exit(1)'), 'main não pode chamar process.exit(1) (usar throw + process.exitCode após o finally)');
    assert.ok(after.includes('finally'), 'main deve ter bloco finally de limpeza');
    assert.ok(after.includes('process.exitCode'), 'exit code aplicado após a limpeza');
  });
  test(`${name}: zero impressão de URL (nem redigida)`, () => {
    assert.ok(!src.includes('redact('), 'redact() removido — sem forma "redigida" de URL');
    assert.ok(!src.match(/\$\{(?:opts\.url|dsnNoPass|url)\}/), 'nenhuma interpolação de URL/DSN em logs');
  });
  test(`${name}: usage sem forma --url inline`, () => {
    assert.ok(!src.includes('--url "$DATABASE_URL"'), 'exemplo com senha em argv removido');
    assert.ok(!src.includes('--url [conn]'), 'forma --url [conn] removida do usage');
    assert.ok(src.includes('SOMENTE $DATABASE_URL'), 'usage documenta leitura exclusiva via env');
  });
}

// ─── Permissão restrita em temporários (best-effort) ──────────────────────────

for (const [name, restrict] of [['backup', backupRestrict], ['restore', restoreRestrict]]) {
  test(`${name}: restrictTempMode aplica 0600 (POSIX) e nunca quebra`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-perm-test-'));
    const f = join(dir, 'tmp.dump');
    writeFileSync(f, 'x');
    assert.doesNotThrow(() => restrict(f));
    if (process.platform !== 'win32') {
      assert.equal(statSync(f).mode & 0o777, 0o600);
    }
    unlinkSync(f);
    assert.doesNotThrow(() => restrict(join(dir, 'inexistente')));
  });
}

// ─── isCliInvocation (padrão do repo) ─────────────────────────────────────────

test('isCliInvocation detecta invocação direta (win32 + posix)', () => {
  for (const fn of [isBackupCli, isRestoreCli]) {
    assert.equal(fn('file:///D:/projetos/synkroo/scripts/db-backup.mjs', 'D:\\projetos\\synkroo\\scripts\\db-backup.mjs'), true);
    assert.equal(fn('file:///workspace/scripts/db-backup.mjs', '/workspace/scripts/db-backup.mjs'), true);
    assert.equal(fn('file:///workspace/scripts/db-backup.mjs', '/workspace/scripts/other.mjs'), false);
  }
});

// ─── FIX3: dsnNoPass sem userinfo e sem query sensível ───────────────────────

for (const [name, dsn] of [['backup', backupDsn], ['restore', restoreDsn]]) {
  test(`${name}: dsnNoPass sem query password e sem userinfo (preserva sslcert/sslkey)`, () => {
    const dsnOut = dsn('postgres://user:s3cr3t@db.internal:5432/synkroo?sslmode=require&password=s3cr3t&pgpassfile=/tmp/x&sslcert=/tmp/c.pem&sslkey=/tmp/k.pem');
    assert.ok(!dsnOut.includes('s3cr3t'), `vazou senha: ${dsnOut}`);
    assert.ok(!dsnOut.includes('user@'), `vazou userinfo: ${dsnOut}`);
    assert.ok(!dsnOut.includes('password='), `query sensível preservada: ${dsnOut}`);
    assert.ok(!dsnOut.includes('pgpassfile'), `query sensível preservada: ${dsnOut}`);
    // Não-segredos preservados para o driver.
    assert.ok(dsnOut.includes('sslmode=require'), `perdeu param não-sensível: ${dsnOut}`);
    assert.ok(dsnOut.includes('sslcert='), `perdeu sslcert: ${dsnOut}`);
    assert.ok(dsnOut.includes('sslkey='), `perdeu sslkey: ${dsnOut}`);
  });
  test(`${name}: maskArg mascara segredo potencial e preserva flag curta`, () => {
    assert.equal(dsn === backupDsn ? backupMask('postgres://u:p@h/db') : restoreMask('postgres://u:p@h/db'), '<arg com segredo potencial>');
    assert.equal(dsn === backupDsn ? backupMask('--nope') : restoreMask('--nope'), '--nope');
    assert.equal(dsn === backupDsn ? backupMask('--x=password') : restoreMask('--x=password'), '<arg com segredo potencial>');
  });
  test(`${name}: temp restrito pré-criado antes da escrita (wx 0600 + fd exclusivo)`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-precreate-'));
    const f = join(dir, 'pre.dump');
    const mk = dsn === backupDsn ? backupMkTemp : restoreMkTemp;
    const cleanup = dsn === backupDsn ? backupCleanup : restoreCleanup;
    let h = null;
    assert.doesNotThrow(() => { h = mk(f); });
    assert.ok(h && typeof h.fd === 'number', 'createRestrictedTemp retorna { path, fd }');
    assert.equal(h.path, f);
    assert.ok(existsSync(f));
    if (process.platform !== 'win32') {
      assert.equal(statSync(f).mode & 0o777, 0o600);
    }
    cleanup(h); // fecha o fd antes do unlink (ordem exigida no Windows)
    assert.ok(!existsSync(f));
  });
}

// ─── FIX3: erros de argv nunca ecoam segredo (via CLI real) ─────────────────

test('backup: mensagem de erro de arg não reconhecido não contém a URL', () => {
  const secret = 'postgres://evil:s3cr3t-backup@db.internal/synkroo';
  const r = spawnSync(process.execPath, [join(here, '..', 'db-backup.mjs'), secret], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  assert.ok(!out.includes('s3cr3t-backup'), `vazou segredo em erro de argv: ${out}`);
  assert.ok(!out.includes(secret), `ecoou URL bruta: ${out}`);
});

test('restore: mensagem de erro de arg não reconhecido não contém a URL', () => {
  const secret = 'postgres://evil:s3cr3t-restore@db.internal/synkroo';
  const r = spawnSync(process.execPath, [join(here, '..', 'db-restore.mjs'), '--flag-inexistente', secret], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  assert.ok(!out.includes('s3cr3t-restore'), `vazou segredo em erro de argv: ${out}`);
  assert.ok(!out.includes(secret), `ecoou URL bruta: ${out}`);
});

test('restore: posicional duplicado com URL não vaza segredo', () => {
  const secret = 'postgres://evil:s3cr3t-dup@db.internal/synkroo';
  const r = spawnSync(process.execPath, [join(here, '..', 'db-restore.mjs'), './dummy.dump', secret], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  assert.ok(!out.includes('s3cr3t-dup'), `vazou segredo em posicional duplicado: ${out}`);
  assert.ok(!out.includes(secret), `ecoou URL bruta: ${out}`);
});

// ─── SYNK-FIX-3: temp fail-closed, DSN allowlist, eco em --file ─────────────

for (const [name, mk] of [['backup', backupMkTemp], ['restore', restoreMkTemp]]) {
  test(`${name}: FIX1 createRestrictedTemp falha fechada em colisão (throw, sem escrita)`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-collision-'));
    const f = join(dir, 'collide.dump');
    const original = 'conteudo-original-sensivel';
    writeFileSync(f, original);
    assert.throws(() => mk(f));
    assert.equal(readFileSync(f, 'utf8'), original, 'colisão não pode truncar/sobrescrever o path existente');
    unlinkSync(f);
  });
  test(`${name}: FIX1 uniqueTempPath imprevisível (sufixo random distinto)`, () => {
    const uniq = name === 'backup' ? backupUniqueTemp : restoreUniqueTemp;
    const base = join(tmpdir(), 'synkroo-unique-base.dump');
    const a = uniq(base);
    const b = uniq(base);
    assert.ok(a.startsWith(`${base}.`), `sufixo imprevisível ausente: ${a}`);
    assert.notEqual(a, b, 'dois temporários da mesma base não podem colidir');
  });
}

for (const [name, dsn] of [['backup', backupDsn], ['restore', restoreDsn]]) {
  test(`${name}: FIX2 DSN allowlist — token removido, sslmode preservado`, () => {
    const out = dsn('postgres://user:s3cr3t@db.internal:5432/synkroo?token=segredo&sslmode=require');
    assert.ok(out.includes('sslmode=require'), `perdeu param allowlist: ${out}`);
    assert.ok(!out.includes('segredo'), `vazou token via argv: ${out}`);
    assert.ok(!out.includes('token='), `param fora da allowlist preservado: ${out}`);
    assert.ok(!out.includes('s3cr3t'), `vazou senha: ${out}`);
  });
  test(`${name}: FIX2 DSN allowlist — só params seguros sobrevivem`, () => {
    const out = dsn('postgres://u:p@h:5432/db?sslmode=require&sslcert=/c.pem&sslkey=/k.pem&sslrootcert=/r.pem&connect_timeout=10&application_name=synkroo&options=-c%20x%3D1&evil=1&secret=shh&token=t&password=p&pgpassfile=/x');
    for (const keep of ['sslmode=require', 'sslcert=', 'sslkey=', 'sslrootcert=', 'connect_timeout=10', 'application_name=synkroo', 'options=']) {
      assert.ok(out.includes(keep), `allowlist perdeu ${keep}: ${out}`);
    }
    for (const drop of ['evil=', 'secret=', 'token=', 'password=', 'pgpassfile=']) {
      assert.ok(!out.includes(drop), `param fora da allowlist preservado (${drop}): ${out}`);
    }
  });
}

test('restore: FIX3 --file inexistente com segredo não ecoa (maskArg)', () => {
  // NB: o placeholder '<arg com segredo potencial>' contém a substring
  // 'segredo', então o teste usa um valor distinto para evitar falso-positivo.
  const secretVal = 'S3cr3tFIX3-abc123';
  const r = spawnSync(process.execPath, [join(here, '..', 'db-restore.mjs'), '--file', `password=${secretVal}.dump`], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  const out = `${r.stderr ?? ''}${r.stdout ?? ''}`;
  assert.ok(!out.includes(secretVal), `ecoou segredo do --file: ${out}`);
  assert.ok(out.includes('<arg com segredo potencial>'), `--file sensível deveria ser mascarado: ${out}`);
});

// ─── SYNK-FIX-4 FIX1: finally só remove temp próprio (posse via handle) ──────
// Simula o fluxo de main: handle registrado SÓ após criação bem-sucedida;
// em colisão o handle segue null e o finally (cleanupOwnedTemp) é no-op.

for (const [name, mk, cleanup] of [['backup', backupMkTemp, backupCleanup], ['restore', restoreMkTemp, restoreCleanup]]) {
  test(`${name}: SYNK-FIX-4 FIX1 colisão não registra posse — arquivo alheio intacto após limpeza`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-owned-'));
    const victim = join(dir, 'alheio.dump');
    writeFileSync(victim, 'conteudo-alheio-sensivel');
    let h = null;
    assert.throws(() => { h = mk(victim); });
    assert.equal(h, null, 'falha na criação não pode registrar posse');
    cleanup(h); // finally de main com handle null
    assert.equal(readFileSync(victim, 'utf8'), 'conteudo-alheio-sensivel', 'limpeza sem posse apagaria arquivo alheio');
    // Contrapartida: temporário próprio É removido.
    const owned = join(dir, 'proprio.dump');
    const ho = mk(owned);
    assert.ok(existsSync(owned));
    cleanup(ho);
    assert.ok(!existsSync(owned), 'temporário próprio deve ser removido');
    unlinkSync(victim);
  });
  test(`${name}: SYNK-FIX-4 FIX1 cleanupOwnedTemp(null/undefined) é no-op`, () => {
    assert.doesNotThrow(() => { cleanup(null); cleanup(undefined); });
  });
  test(`${name}: SYNK-FIX-4 FIX1 main só limpa paths com posse (estático)`, () => {
    const src = name === 'backup' ? backupSrc : restoreSrc;
    const mainIdx = src.indexOf('async function main()');
    const after = src.slice(mainIdx);
    assert.ok(!after.includes('try { unlinkSync(tmp'), 'finally não pode ter unlink incondicional de tmp');
    assert.ok(after.includes('cleanupOwnedTemp('), 'limpeza deve passar pelo guard de posse');
  });
}

// ─── SYNK-FIX-4 FIX2: escrita VIA fd — imune a troca do path ────────────────

test('backup: SYNK-FIX-4 FIX2 gzipFile via fd escreve no inode, não no path trocado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-fd-'));
  const src = join(dir, 'a.txt');
  writeFileSync(src, 'ola-fd-backup');
  // Caso normal: conteúdo íntegro no path.
  const dest = join(dir, 'a.txt.gz');
  const h = backupMkTemp(dest);
  await backupGzip(src, dest, h.fd);
  h.fd = null; // fd assumido/fechado pelo stream
  assert.equal(gunzipSync(readFileSync(dest)).toString(), 'ola-fd-backup');
  // Swap entre create e write: path liberado e replantado com decoy.
  const dest2 = join(dir, 'b.txt.gz');
  const h2 = backupMkTemp(dest2);
  const fd2 = h2.fd;
  h2.fd = null; // cleanup não deve encostar no path trocado
  unlinkSync(dest2);
  writeFileSync(dest2, 'DECOY');
  await backupGzip(src, dest2, fd2);
  assert.equal(readFileSync(dest2, 'utf8'), 'DECOY', 'escrita via fd atingiu o path trocado (TOCTOU)');
  unlinkSync(dest);
  unlinkSync(dest2);
  unlinkSync(src);
});

test('restore: SYNK-FIX-4 FIX2 gunzipTo via fd escreve no inode, não no path trocado', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-fd-'));
  const srcGz = join(dir, 'a.txt.gz');
  writeFileSync(srcGz, gzipSync('ola-fd-restore'));
  // Caso normal: conteúdo íntegro no path.
  const dest = join(dir, 'a.txt');
  const h = restoreMkTemp(dest);
  await restoreGunzip(srcGz, dest, h.fd);
  h.fd = null; // fd assumido/fechado pelo stream
  assert.equal(readFileSync(dest, 'utf8'), 'ola-fd-restore');
  // Swap entre create e write: path liberado e replantado com decoy.
  const dest2 = join(dir, 'b.txt');
  const h2 = restoreMkTemp(dest2);
  const fd2 = h2.fd;
  h2.fd = null; // cleanup não deve encostar no path trocado
  unlinkSync(dest2);
  writeFileSync(dest2, 'DECOY');
  await restoreGunzip(srcGz, dest2, fd2);
  assert.equal(readFileSync(dest2, 'utf8'), 'DECOY', 'escrita via fd atingiu o path trocado (TOCTOU)');
  unlinkSync(dest);
  unlinkSync(dest2);
  unlinkSync(srcGz);
});

test('backup/restore: SYNK-FIX-4 FIX2 escrita via fd não segue symlink de substituição (POSIX)', async () => {
  if (process.platform === 'win32') return; // symlink exige privilégio no Windows
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-symlink-'));
  const src = join(dir, 'a.txt');
  writeFileSync(src, 'dado-real');
  const dest = join(dir, 'out.gz');
  const h = backupMkTemp(dest);
  const victim = join(dir, 'vitima.txt');
  writeFileSync(victim, 'VITIMA-INTACTA');
  unlinkSync(dest); // libera o path (fd segue apontando para o inode original)
  symlinkSync(victim, dest); // atacante aponta o path para a vítima
  await backupGzip(src, dest, h.fd);
  h.fd = null;
  assert.equal(readFileSync(victim, 'utf8'), 'VITIMA-INTACTA', 'escrita seguiu o symlink (TOCTOU)');
  unlinkSync(dest); // remove o symlink
  unlinkSync(victim);
  unlinkSync(src);
});

// ─── SYNK-FIX-4 FIX3: plano/status mascaram input suspeito, exibem normal ───

test('restore: SYNK-FIX-4 FIX3 dry-run mascara --file suspeito e exibe nome normal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-mask-'));
  const script = join(here, '..', 'db-restore.mjs');
  const normal = join(dir, 'synkroo-20260101-020000.dump.gz');
  writeFileSync(normal, 'x');
  let r = spawnSync(process.execPath, [script, normal, '--local'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  let out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.ok(out.includes('synkroo-20260101-020000.dump.gz'), `nome normal deve aparecer cru: ${out}`);
  const susp = join(dir, 'pwd=x.dump');
  writeFileSync(susp, 'x');
  r = spawnSync(process.execPath, [script, susp, '--local'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.ok(!out.includes('pwd=x.dump'), `--file suspeito cru na saída: ${out}`);
  assert.ok(!out.includes('x.dump'), `fragmento do nome suspeito cru na saída: ${out}`);
  assert.ok(out.includes('<arg com segredo potencial>'), `--file suspeito deveria ser mascarado: ${out}`);
});

test('backup: SYNK-FIX-4 FIX3 status mascara container suspeito e exibe normal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-bmask-'));
  const script = join(here, '..', 'db-backup.mjs');
  let r = spawnSync(process.execPath, [script, '--local', '--out-dir', dir], { encoding: 'utf8' });
  let out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.ok(out.includes('container=synkroo-db'), `container normal deve aparecer cru: ${out}`);
  r = spawnSync(process.execPath, [script, '--local', '--container', 'pwd=evil-xyz', '--out-dir', dir], { encoding: 'utf8' });
  out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  assert.ok(!out.includes('pwd=evil-xyz'), `container suspeito cru na saída: ${out}`);
  assert.ok(out.includes('<arg com segredo potencial>'), `container suspeito deveria ser mascarado: ${out}`);
});

// ─── SYNK-FIX-5 FIX1: prune nunca remove o artefato da execução atual ──────
// Semântica: --keep 0 = "manter apenas o backup de hoje, apagar os antigos".

test('backup: SYNK-FIX-5 FIX1 pruneRetention com keep 0 preserva atual (gz+sha256) e remove antigos', () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-prune-'));
  const old = new Date(Date.now() - 10 * 86400_000);
  const mkPair = (name, mtime) => {
    const gz = join(dir, name);
    const sha = `${gz.slice(0, -'.gz'.length)}.sha256`;
    writeFileSync(gz, `dump-${name}`);
    writeFileSync(sha, `hash  ${name}\n`);
    utimesSync(gz, mtime, mtime);
    utimesSync(sha, mtime, mtime);
    return { gz, sha };
  };
  const a = mkPair('synkroo-20200101-000000.dump.gz', old);
  const b = mkPair('synkroo-20200102-000000.dump.gz', old);
  const cur = mkPair('synkroo-20260925-000000.dump.gz', new Date());
  const removed = backupPrune(dir, 0, [cur.gz, cur.sha]);
  assert.equal(removed, 2, `prune deveria remover os 2 antigos, removeu ${removed}`);
  assert.ok(existsSync(cur.gz), 'artefato atual (gz) foi removido pelo prune');
  assert.ok(existsSync(cur.sha), 'sidecar atual (.sha256) foi removido pelo prune');
  assert.ok(!existsSync(a.gz) && !existsSync(a.sha), 'antigo A deveria ser removido (gz+sha256)');
  assert.ok(!existsSync(b.gz) && !existsSync(b.sha), 'antigo B deveria ser removido (gz+sha256)');
});

// ─── SYNK-FIX-5 FIX2: cleanup por identidade, não por path ─────────────────

for (const [name, mk, cleanup] of [['backup', backupMkTemp, backupCleanup], ['restore', restoreMkTemp, restoreCleanup]]) {
  test(`${name}: SYNK-FIX-5 FIX2 swap do path antes do cleanup deixa alvo do swap intacto`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-swap-'));
    const p = join(dir, 'alvo.dump');
    const h = mk(p);
    assert.ok(existsSync(p));
    // Atacante troca o path: renomeia o original e replanta um decoy.
    const orig = `${p}.orig`;
    renameSync(p, orig);
    writeFileSync(p, 'DECOY-ATACANTE');
    cleanup(h); // deve fechar o fd mas NÃO remover o path trocado
    assert.equal(readFileSync(p, 'utf8'), 'DECOY-ATACANTE', 'cleanup removeu o alvo do swap (posse por path)');
    assert.ok(existsSync(orig), 'inode original deveria sobreviver ao cleanup sem posse');
    unlinkSync(p);
    unlinkSync(orig);
  });
  test(`${name}: SYNK-FIX-5 FIX2 posse normal remove o temporário`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-own-'));
    const p = join(dir, 'proprio.dump');
    const h = mk(p);
    assert.ok(existsSync(p));
    cleanup(h);
    assert.ok(!existsSync(p), 'temporário próprio deveria ser removido');
  });
  test(`${name}: SYNK-FIX-5 FIX2 handle sem fd e sem identidade é fail-closed (não remove)`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-noid-'));
    const victim = join(dir, 'vitima.dump');
    writeFileSync(victim, 'VITIMA');
    cleanup({ path: victim, fd: null }); // sem ino capturado: nada prova posse
    assert.equal(readFileSync(victim, 'utf8'), 'VITIMA', 'cleanup sem identidade removeu arquivo alheio');
    unlinkSync(victim);
  });
}

// ─── SYNK-FIX-5 FIX3: safeTargetLabel mascara pathname ─────────────────────

for (const [name, label] of [['backup', backupLabel], ['restore', restoreLabel]]) {
  test(`${name}: SYNK-FIX-5 FIX3 pathname com password é mascarado`, () => {
    const out = label('postgres://db.internal/password=x');
    assert.ok(!out.includes('password=x'), `pathname cru no label: ${out}`);
    assert.ok(out.includes('<arg com segredo potencial>'), `pathname suspeito deveria ser mascarado: ${out}`);
    assert.ok(out.startsWith('db.internal/'), `host deveria ser preservado: ${out}`);
  });
  test(`${name}: SYNK-FIX-5 FIX3 pathname normal segue cru`, () => {
    assert.equal(label('postgres://db.internal:5432/synkroo'), 'db.internal/synkroo');
  });
}

// ─── SYNK-FIX-6: cleanup após falha de stream (fd fechado, EBADF) ─────────
// Em falha de pipeline o stream fecha o fd mas handle.fd conserva o número:
// fstatSync(fd) lança (EBADF) e o cleanup deve recorrer à identidade
// capturada na criação (handle.ino/handle.dev) — removendo o dump parcial
// próprio, sem tocar em decoy, e sem remover em divergência (fail-closed).

for (const [name, mk, cleanup] of [['backup', backupMkTemp, backupCleanup], ['restore', restoreMkTemp, restoreCleanup]]) {
  test(`${name}: SYNK-FIX-6 fd fechado (EBADF) remove temp próprio, preserva decoy`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-ebadf-'));
    const p = join(dir, 'parcial.dump');
    const h = mk(p);
    assert.ok(typeof h.ino === 'number' && h.ino !== 0, 'createRestrictedTemp deve capturar ino');
    // Simula dump parcial sensível escrito antes da falha.
    writeSync(h.fd, 'DUMP-PARCIAL-SENSIVEL');
    const decoy = join(dir, 'decoy.txt');
    writeFileSync(decoy, 'DECOY-INTACTO');
    // Simula o stream que fechou o fd na falha (handle.fd conserva o número).
    closeSync(h.fd);
    assert.throws(() => fstatSync(h.fd), 'fd deveria estar fechado (EBADF)');
    cleanup(h);
    assert.ok(!existsSync(p), 'temp próprio parcial deveria ser removido após falha de stream');
    assert.equal(readFileSync(decoy, 'utf8'), 'DECOY-INTACTO', 'decoy no mesmo dir não pode ser tocado');
    unlinkSync(decoy);
  });
  test(`${name}: SYNK-FIX-6 fd fechado (EBADF) com divergência não remove (fail-closed)`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-ebadf-div-'));
    const p = join(dir, 'alvo.dump');
    const h = mk(p);
    writeSync(h.fd, 'DUMP-PARCIAL-SENSIVEL');
    closeSync(h.fd); // EBADF, como na falha de pipeline
    // Swap após a falha: original renomeado, decoy replantado no path.
    const orig = `${p}.orig`;
    renameSync(p, orig);
    writeFileSync(p, 'DECOY-ATACANTE');
    cleanup(h);
    assert.equal(readFileSync(p, 'utf8'), 'DECOY-ATACANTE', 'cleanup removeu o alvo do swap (deveria ser fail-closed)');
    assert.ok(existsSync(orig), 'inode original deveria sobreviver ao cleanup sem posse');
    unlinkSync(p);
    unlinkSync(orig);
  });
  test(`${name}: SYNK-FIX-6 fd fechado (EBADF) sem identidade não remove (fail-closed)`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'synkroo-ebadf-noid-'));
    const victim = join(dir, 'vitima.dump');
    writeFileSync(victim, 'VITIMA');
    const h = mk(join(dir, 'outro.dump'));
    closeSync(h.fd); // EBADF
    delete h.ino;
    delete h.dev;
    h.path = victim; // path alheio + fd fechado + sem identidade
    cleanup(h);
    assert.equal(readFileSync(victim, 'utf8'), 'VITIMA', 'cleanup sem identidade removeu arquivo alheio');
    h.fd = null;
    try { unlinkSync(join(dir, 'outro.dump')); } catch { /* ignore */ }
    unlinkSync(victim);
  });
}

test('restore: SYNK-FIX-6 pipeline com gzip truncado remove temp parcial (decoy intacto)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'synkroo-trunc-'));
  // Payload grande: truncar em ~65% do .gz produz saída parcial real no
  // destino antes do gunzip falhar (prova de escrita parcial >0 bytes),
  // em vez de falhar só no header (10 bytes) sem escrever nada.
  const payload = Array.from(
    { length: 20000 },
    (_, i) => `linha-${String(i).padStart(5, '0')}-DUMP-REAL-PARCIAL-SENSIVEL-abcdefghijklmnopqrstuvwxyz0123456789\n`,
  ).join('');
  const full = gzipSync(payload);
  const truncLen = Math.floor(full.length * 0.65);
  const trunc = join(dir, 'trunc.dump.gz');
  writeFileSync(trunc, full.slice(0, truncLen)); // gzip truncado → gunzip falha após escrita parcial
  const dest = join(dir, 'saida.dump');
  const h = restoreMkTemp(dest);
  await assert.rejects(() => restoreGunzip(trunc, dest, h.fd), 'gunzip de gzip truncado deveria falhar');
  // Prova de escrita parcial: o destino EXISTE e contém >0 bytes após a falha.
  assert.ok(existsSync(dest), 'gunzip falho deveria deixar dump parcial no destino (sem prova de escrita parcial o teste não valida a limpeza)');
  const partialBytes = statSync(dest).size;
  assert.ok(partialBytes > 0, `dump parcial deveria ter >0 bytes, tinha ${partialBytes} (truncLen=${truncLen}/${full.length})`);
  // Estado pós-falha de main: handle.fd conserva o número (stream fechou o fd).
  const decoy = join(dir, 'decoy.txt');
  writeFileSync(decoy, 'DECOY-INTACTO');
  restoreCleanup(h);
  assert.ok(!existsSync(dest), 'temp parcial do gunzip falho deveria ser removido');
  assert.equal(readFileSync(decoy, 'utf8'), 'DECOY-INTACTO', 'decoy no mesmo dir não pode ser tocado');
  unlinkSync(decoy);
  unlinkSync(trunc);
});
