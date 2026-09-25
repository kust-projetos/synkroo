#!/usr/bin/env node
/**
 * Restore do Postgres a partir de dump gerado por scripts/db-backup.mjs.
 *
 * SEGURANÇA:
 * - DRY-RUN POR PADRÃO: sem --yes nada é executado — só imprime o plano.
 * - Com --yes, o alvo (host/db) é exibido antes de executar.
 * - NUNCA restaura sem confirmação explícita; nunca imprime connection string
 *   (só o rótulo `host/dbname`); o modo remoto lê SOMENTE $DATABASE_URL do
 *   processo (a forma `--url <conn>` foi removida — senha em argv vaza).
 *
 * Exemplos (dry-run — nada é alterado):
 *   node scripts/db-restore.mjs ./backups/synkroo-20260101-020000.dump.gz --local
 *   DATABASE_URL="..." node scripts/db-restore.mjs ./backups/synkroo-20260101-020000.dump.gz --url
 *
 * Restore real (destrutivo no banco-alvo):
 *   node scripts/db-restore.mjs ./backups/<arquivo>.dump.gz --local --yes
 *
 * Verificação pós-restore: contagem de linhas das tabelas core
 * (clinics, users, patients, appointments).
 *
 * Exit codes: 0 = ok (dry-run incluso) · 1 = erro operacional · 2 = uso inválido.
 */
import { createRequire } from 'module';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, statSync, fstatSync, unlinkSync, chmodSync, createReadStream, createWriteStream, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';

function normalizePath(path) {
  const normalized = path.replaceAll("\\", "/");
  return normalized.startsWith("/") && /^[A-Za-z]:/.test(normalized.slice(1))
    ? normalized.slice(1)
    : normalized;
}

export function isCliInvocation(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return normalizePath(new URL(moduleUrl).pathname) === normalizePath(argvPath);
}

const require = createRequire(import.meta.url);
try { require('dotenv').config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local') }); } catch { /* ignore */ }
try { require('dotenv').config(); } catch { /* ignore */ }

const CORE_TABLES = ['clinics', 'users', 'patients', 'appointments'];

/**
 * Rótulo seguro do alvo remoto: SÓ `host/dbname` extraídos da URL.
 * A connection string (ou qualquer forma "redigida" dela) NUNCA é impressa.
 */
export function safeTargetLabel(url) {
  try {
    const u = new URL(String(url ?? ''));
    const raw = (u.pathname || '/').replace(/^\//, '') || '(sem-db)';
    // SYNK-FIX-5 FIX3: o componente derivado da URL também passa por
    // maskArg — pathname com 'password=x' (ou similar) nunca aparece cru.
    const db = maskArg(raw);
    return `${u.hostname}/${db}`;
  } catch {
    return '<alvo inválido>';
  }
}

/**
 * Higieniza texto externo (stderr de pg_restore/psql etc.): mascara userinfo
 * e senhas em query string sem nunca reproduzir a connection string.
 */
export function sanitizeOutput(text) {
  return String(text ?? '')
    .replace(/\/\/[^/@\s]*@/g, '//***@')
    .replace(/([?&](?:password|passwd|pwd|secret|token)=)[^&\s]*/gi, '$1***')
    .replace(/\b(password|passwd|pwd|secret|token)\s*=\s*[^&\s]+/gi, '$1=***');
}

/** Permissão restrita (0600) em arquivo temporário; best-effort (ex.: Windows). */
export function restrictTempMode(path) {
  try { chmodSync(path, 0o600); } catch { /* best-effort */ }
}

/**
 * Cria o temporário ANTES da escrita com modo restrito (0600), fail-closed:
 * usa openSync(path,'wx') exclusivo e ABORTA (throw) em QUALQUER falha
 * (EEXIST, symlink race, permissão) — nunca prossegue com path existente.
 * O caller gera nome imprevisível (`path + '.' + randomBytes(8).hex`) e
 * registra o handle retornado para limpeza APÓS a criação bem-sucedida.
 *
 * Retorna `{ path, fd }` com o fd ABERTO em modo exclusivo. A descompactação
 * (gunzipTo) escreve VIA fd (sem reabertura por path — fecha a janela
 * TOCTOU de swap/symlink entre criar e escrever).
 */
export function createRestrictedTemp(path) {
  const fd = openSync(path, 'wx', 0o600);
  restrictTempMode(path);
  const handle = { path, fd };
  try {
    const st = fstatSync(fd);
    handle.ino = st.ino;
    handle.dev = st.dev;
  } catch { /* best-effort: sem identidade capturada o cleanup falha fechado */ }
  return handle;
}

/**
 * Limpeza de temporário com posse comprovada (FIX1 + SYNK-FIX-5 FIX2): só
 * remove o path que NÓS criamos (`handle` retornado por createRestrictedTemp).
 * `null`/`undefined` (criação falhou ou ainda não ocorreu) é no-op — nunca
 * faz unlink de arquivo alheio. Fecha o fd best-effort antes do unlink
 * (ordem exigida no Windows).
 *
 * SYNK-FIX-5 FIX2 — verificação de identidade best-effort ANTES do unlink:
 * `fstatSync(handle.fd).ino === statSync(handle.path).ino`. Qualquer
 * divergência (swap/symlink/unlink+recreate entre criação e finally), erro,
 * ou identidade indeterminável (ino undefined/0 — ex.: plataforma sem ino)
 * → pula o unlink (fail-closed: não apaga alheio), apenas fecha o fd.
 * Quando o fd já foi consumido pelo fluxo legítimo (fd null) mas a
 * identidade foi capturada na criação (`handle.ino`), compara o ino
 * armazenado com o stat atual do path — mesma regra fail-closed.
 *
 * SYNK-FIX-6 — fd fechado pela falha do stream (EBADF): em falha de
 * pipeline o stream fecha o fd mas `handle.fd` conserva o número, de modo
 * que `fstatSync(fd)` lança e o catch antigo pulava o unlink — deixando o
 * dump parcial sensível no disco. Ordem de verificação: (1) fstat OK →
 * compara ino/dev como antes; (2) fstat FALHA → recorre à identidade
 * CAPTURADA na criação (`handle.ino`/`handle.dev`): `statSync(path).ino
 * === handle.ino` (e dev se conhecido) → unlink seguro; divergência, erro
 * ou stat falho → pula o unlink (fail-closed p/ arquivo alheio);
 * (3) sem identidade nenhuma → pula o unlink.
 */
export function cleanupOwnedTemp(handle) {
  if (!handle) return;
  const inoKnown = (v) => typeof v === 'number' && v !== 0;
  const devMatches = (a, b) =>
    typeof a !== 'number' || typeof b !== 'number' || a === 0 || b === 0 || a === b;
  const fdOpen = handle.fd !== null && handle.fd !== undefined;
  if (fdOpen) {
    let owned = false;
    try {
      const fdSt = fstatSync(handle.fd);
      const pathSt = statSync(handle.path);
      if (inoKnown(fdSt.ino) && inoKnown(pathSt.ino)) {
        owned = fdSt.ino === pathSt.ino && devMatches(fdSt.dev, pathSt.dev);
      } else if (inoKnown(handle.ino)) {
        owned = inoKnown(pathSt.ino) && pathSt.ino === handle.ino && devMatches(handle.dev, pathSt.dev);
      } else {
        owned = false;
      }
    } catch {
      // SYNK-FIX-6: fstat falhou (ex.: EBADF — stream fechou o fd na falha
      // de pipeline mas handle.fd conserva o número). Recorre à identidade
      // capturada na criação; sem ela, fail-closed.
      try {
        if (!inoKnown(handle.ino)) {
          owned = false;
        } else {
          const pathSt = statSync(handle.path);
          owned = inoKnown(pathSt.ino) && pathSt.ino === handle.ino && devMatches(handle.dev, pathSt.dev);
        }
      } catch {
        owned = false;
      }
    }
    try { closeSync(handle.fd); } catch { /* best-effort (stream pode já ter fechado) */ }
    handle.fd = null;
    if (!owned) return;
  } else if (inoKnown(handle.ino)) {
    try {
      const pathSt = statSync(handle.path);
      if (!inoKnown(pathSt.ino)) return;
      if (pathSt.ino !== handle.ino || !devMatches(handle.dev, pathSt.dev)) return;
    } catch {
      return;
    }
  } else {
    // Sem fd aberto e sem identidade capturada: nada prova a posse —
    // fail-closed (não remove por path).
    return;
  }
  try { unlinkSync(handle.path); } catch { /* ignore */ }
}

/**
 * Versão mascarada de argv para mensagens de erro: nunca ecoa segredo.
 * Se parece conter segredo ('://', '@' ou password/passwd/pwd/secret/token),
 * imprime placeholder. Trunca valores longos.
 */
export function maskArg(a) {
  const s = String(a ?? '');
  if (s.includes('://') || s.includes('@') || /password|passwd|pwd|secret|token/i.test(s)) return '<arg com segredo potencial>';
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
}

/** Gera nome temporário imprevisível a partir de uma base. */
export function uniqueTempPath(basePath) {
  return `${basePath}.${randomBytes(8).toString('hex')}`;
}

/**
 * DSN sem credenciais para argv de pg_restore/psql: sem userinfo e com
 * ALLOWLIST explícita de query params seguros (sslmode, sslcert, sslkey,
 * sslrootcert, connect_timeout, application_name, options). Todo o resto é
 * removido — ex.: token/secret/password arbitrários nunca chegam ao argv.
 */
const DSN_SAFE_PARAMS = new Set([
  'sslmode',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'connect_timeout',
  'application_name',
  'options',
]);

export function buildDsnNoPass(url) {
  const u = new URL(String(url));
  u.password = '';
  u.username = '';
  for (const k of [...u.searchParams.keys()]) {
    if (!DSN_SAFE_PARAMS.has(k.toLowerCase())) u.searchParams.delete(k);
  }
  return u.toString();
}

function usage() {
  console.log(`Uso:
  node scripts/db-restore.mjs <arquivo.dump.gz|arquivo.dump> [--local|--url] [--yes] [opções]

Sem --yes: DRY-RUN (só mostra o que faria, exit 0). Com --yes: executa + verifica.

Modos (padrão: --local):
  --local                 restore via docker exec no container local
  --url                   restore via pg_restore/psql direto (VPS/staging); lê SOMENTE $DATABASE_URL do processo
                          (a connection string nunca é aceita via argv nem exibida)

Opções:
  --file <path>           alternativa ao posicional
  --yes                   confirma o restore real no alvo (obrigatório para executar)
  --dry-run               força dry-run mesmo com --yes presente (precedência segura)
  --clean                 adiciona --clean --if-exists ao pg_restore (derruba objetos antes)
  --container <nome>      container Postgres local (padrão: synkroo-db; só --local)
  --db <nome>             database alvo (padrão: $POSTGRES_DB ou 'synkroo'; só --local)
  --user <nome>           usuário (padrão: $POSTGRES_USER ou 'synkroo'; só --local)
  -h, --help              esta ajuda`);
}

function parseArgs(argv) {
  const opts = { file: null, mode: 'local', url: null, yes: false, dryRun: false, clean: false, container: 'synkroo-db', db: null, user: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--local') opts.mode = 'local';
    else if (a === '--url' || a === '--database-url') {
      // Modo remoto lê SOMENTE $DATABASE_URL do processo: `--url` nunca
      // consome valor (a forma `--url <conn>` foi removida — senha em argv vaza).
      opts.mode = 'url';
    }
    else if (a.startsWith('--url=') || a.startsWith('--database-url=')) {
      console.error('❌ A forma `--url=<conn>` foi removida: o modo remoto lê SOMENTE $DATABASE_URL do processo.');
      process.exit(2);
    }
    else if (a === '--file') {
      const v = argv[++i];
      if (v && v.includes('://')) {
        console.error('❌ `--file` recebeu algo com formato de URL — connection strings nunca são aceitas via argv (use $DATABASE_URL com --url).');
        process.exit(2);
      }
      opts.file = v;
    }
    else if (a.startsWith('--file=')) {
      const v = a.slice('--file='.length);
      if (v.includes('://')) {
        console.error('❌ `--file` recebeu algo com formato de URL — connection strings nunca são aceitas via argv (use $DATABASE_URL com --url).');
        process.exit(2);
      }
      opts.file = v;
    }
    else if (a === '--yes') opts.yes = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--clean') opts.clean = true;
    else if (a === '--container') opts.container = argv[++i];
    else if (a.startsWith('--container=')) opts.container = a.slice('--container='.length);
    else if (a === '--db') opts.db = argv[++i];
    else if (a.startsWith('--db=')) opts.db = a.slice('--db='.length);
    else if (a === '--user') opts.user = argv[++i];
    else if (a.startsWith('--user=')) opts.user = a.slice('--user='.length);
    else if (a.startsWith('--')) { console.error(`❌ Flag desconhecida: ${maskArg(a)}\n`); usage(); process.exit(2); }
    else if (!opts.file) {
      // Guarda anti-vazamento: uma connection string passada por engano como
      // posicional (forma `--url <conn>` removida) nunca é ecoada nem usada
      // como caminho — recuse com orientação.
      if (a.includes('://')) {
        console.error('❌ A forma `--url <conn>` foi removida: o modo remoto lê SOMENTE $DATABASE_URL do processo (valor nunca exibido).\n   Rode como: DATABASE_URL="..." node scripts/db-restore.mjs <arquivo> --url');
        process.exit(2);
      }
      opts.file = a;
    }
    else { console.error(`❌ Argumento posicional duplicado: ${maskArg(a)}\n`); usage(); process.exit(2); }
  }
  if (!opts.file) { console.error('❌ Informe o arquivo de dump: node scripts/db-restore.mjs <arquivo.dump.gz> [--local|--url] \n'); usage(); process.exit(2); }
  opts.file = resolve(opts.file);
  if (!existsSync(opts.file)) { console.error(`❌ Arquivo não encontrado: ${maskArg(opts.file)}`); process.exit(2); }
  if (!/\.dump(\.gz)?$/.test(opts.file)) { console.error('❌ Extensão inesperada — esperado .dump ou .dump.gz (gerado por scripts/db-backup.mjs).'); process.exit(2); }
  if (opts.mode === 'url') {
    if (process.env.DATABASE_URL) opts.url = process.env.DATABASE_URL;
    else { console.error('❌ Modo --url exige $DATABASE_URL no ambiente (valor nunca é exibido nem aceito via argv).'); process.exit(2); }
  }
  opts.db ||= process.env.POSTGRES_DB || 'synkroo';
  opts.user ||= process.env.POSTGRES_USER || 'synkroo';
  return opts;
}

function run(cmd, args, { env } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: env ?? process.env });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ?? null };
}

function countQuery(table) {
  return `SELECT count(*) AS ${table} FROM ${table};`;
}

function targetLabel(opts) {
  return opts.mode === 'local'
    ? `container=${maskArg(opts.container)} db=${maskArg(opts.db)} user=${maskArg(opts.user)}`
    : `alvo=${safeTargetLabel(opts.url)}`;
}

function printPlan(opts, dumpForRestore) {
  console.log(`🔍 DRY-RUN — nada será alterado. Para executar: acrescente --yes.
   arquivo : ${maskArg(opts.file)}
   modo    : ${opts.mode}
   alvo    : ${targetLabel(opts)}
   pg_restore ${opts.clean ? '--clean --if-exists ' : ''}--no-owner -d <alvo> ${maskArg(dumpForRestore)}`);
  console.log('   passos que seriam executados:');
  if (opts.mode === 'local') {
    console.log(`     1. gunzip -c (se .gz) → dump temporário`);
    console.log(`     2. docker cp <dump> ${maskArg(opts.container)}:/tmp/synkroo-restore-<pid>.dump`);
    console.log(`     3. docker exec ${maskArg(opts.container)} pg_restore -U ${maskArg(opts.user)} -d ${maskArg(opts.db)} --no-owner${opts.clean ? ' --clean --if-exists' : ''} /tmp/synkroo-restore-<pid>.dump`);
    console.log(`     4. verificação pós-restore (psql no container):`);
  } else {
    console.log('     1. gunzip -c (se .gz) → dump temporário');
    console.log(`     2. pg_restore --no-owner${opts.clean ? ' --clean --if-exists' : ''} -d <DATABASE_URL oculta> <dump>`);
    console.log('     3. verificação pós-restore (psql contra o mesmo alvo):');
  }
  for (const t of CORE_TABLES) console.log(`        - ${countQuery(t)}`);
}

/**
 * Descompacta src no destino pré-criado via createRestrictedTemp, escrevendo
 * VIA fd exclusivo (createWriteStream com `fd` — o path NÃO é reaberto, de
 * modo que um swap/symlink do path entre criar e escrever não desvia a
 * escrita). O stream assume e fecha o fd.
 */
export async function gunzipTo(src, destPath, destFd) {
  if (typeof destFd !== 'number') throw new Error('gunzipTo exige fd exclusivo de createRestrictedTemp');
  mkdirSync(dirname(destPath), { recursive: true });
  await pipeline(createReadStream(src), createGunzip(), createWriteStream(destPath, { fd: destFd, mode: 0o600 }));
}

function verifyLocal({ container, db, user }) {
  const counts = {};
  for (const t of CORE_TABLES) {
    const r = run('docker', ['exec', container, 'psql', '-U', user, '-d', db, '-tAc', `SELECT count(*) FROM ${t};`]);
    if (r.code !== 0) return { ok: false, hint: `verificação falhou na tabela "${t}" (container=${maskArg(container)} db=${maskArg(db)}). Tabela pode não existir (migrations pendentes?) ou restore incompleto.\n${sanitizeOutput(r.stderr).trim()}` };
    counts[t] = r.stdout.trim();
  }
  return { ok: true, counts };
}

function verifyUrl(url, label) {
  const probe = run('psql', ['--version']);
  if (probe.code !== 0) return { ok: false, hint: 'psql não encontrado no PATH deste host (necessário p/ verificação). Instale o cliente PostgreSQL 17.' };
  let u;
  try { u = new URL(url); } catch { return { ok: false, hint: `Connection string inválida para o alvo ${label}.` }; }
  const password = decodeURIComponent(u.password || '');
  const dsnNoPass = buildDsnNoPass(url);
  const env = { ...process.env };
  if (password) env.PGPASSWORD = password;
  const counts = {};
  for (const t of CORE_TABLES) {
    const r = run('psql', [dsnNoPass, '-tAc', `SELECT count(*) FROM ${t};`], { env });
    if (r.code !== 0) return { ok: false, hint: `verificação falhou na tabela "${t}" contra ${label}.\n${sanitizeOutput(r.stderr).trim()}` };
    counts[t] = r.stdout.trim();
  }
  return { ok: true, counts };
}

async function main() {
  // parseArgs/dry-run saem com exit 0/2 ANTES de qualquer temporário existir.
  const opts = parseArgs(process.argv.slice(2));
  const isGz = opts.file.endsWith('.gz');

  if (!opts.yes || opts.dryRun) {
    printPlan(opts, isGz ? '<dump descompactado em tmp>' : opts.file);
    process.exit(0);
  }

  const label = targetLabel(opts);
  console.log(`⚠️  RESTORE REAL confirmado (--yes) — alvo: ${label}`);

  // Ponto único de saída: NENHUM process.exit dentro do try — erros são
  // propagados (throw) até o catch, e o finally SEMPRE limpa o temporário
  // local + o artefato dentro do container (best-effort); o exit code é
  // aplicado só após a limpeza.
  const remote = `/tmp/synkroo-restore-${process.pid}-${randomBytes(4).toString('hex')}.dump`;
  let dumpPath = opts.file;
  let tmpHandle = null;
  let exitCode = 0;
  try {
    // 1. Descompactar (se .gz) para arquivo temporário imprevisível.
    // Posse: tmpHandle registrado SÓ após criação bem-sucedida (se
    // createRestrictedTemp lançar, segue null e o finally não toca em nada).
    if (isGz) {
      tmpHandle = createRestrictedTemp(uniqueTempPath(resolve(tmpdir(), `synkroo-restore-${process.pid}.dump`)));
      try { await gunzipTo(opts.file, tmpHandle.path, tmpHandle.fd); }
      catch (err) { throw new Error(`Falha ao descompactar ${maskArg(opts.file)}: ${sanitizeOutput(err.message)}`); }
      tmpHandle.fd = null; // fd assumido/fechado pelo stream de escrita
      restrictTempMode(tmpHandle.path);
      dumpPath = tmpHandle.path;
    }

    // 2. pg_restore.
    if (opts.mode === 'local') {
      let r = run('docker', ['cp', dumpPath, `${opts.container}:${remote}`]);
      if (r.code !== 0) throw new Error(`docker cp falhou (container=${maskArg(opts.container)} no ar? \`npm run db:up\`).\n${sanitizeOutput(r.stderr).trim()}`);
      const restoreArgs = ['exec', opts.container, 'pg_restore', '-U', opts.user, '-d', opts.db, '--no-owner'];
      if (opts.clean) restoreArgs.push('--clean', '--if-exists');
      restoreArgs.push(remote);
      r = run('docker', restoreArgs);
      if (r.code !== 0) throw new Error(`pg_restore falhou no container ${maskArg(opts.container)}.\n${sanitizeOutput(r.stderr).trim()}`);
    } else {
      const probe = run('pg_restore', ['--version']);
      if (probe.code !== 0) throw new Error('pg_restore não encontrado no PATH deste host. Instale o cliente PostgreSQL 17.');
      let u;
      try { u = new URL(opts.url); } catch { throw new Error(`Connection string inválida para o alvo ${label}.`); }
      const password = decodeURIComponent(u.password || '');
      const dsnNoPass = buildDsnNoPass(opts.url);
      const env = { ...process.env };
      if (password) env.PGPASSWORD = password;
      const restoreArgs = ['--no-owner'];
      if (opts.clean) restoreArgs.push('--clean', '--if-exists');
      restoreArgs.push('-d', dsnNoPass, dumpPath);
      const r = run('pg_restore', restoreArgs, { env });
      if (r.code !== 0) throw new Error(`pg_restore falhou contra ${label}.\n${sanitizeOutput(r.stderr).trim()}`);
    }
    console.log('✅ pg_restore concluído sem erro.');

    // 3. Verificação pós-restore (contagem das tabelas core).
    const v = opts.mode === 'local' ? verifyLocal(opts) : verifyUrl(opts.url, label);
    if (!v.ok) throw new Error(`Restore aplicado, MAS a verificação pós-restore falhou:\n   ${sanitizeOutput(v.hint)}`);
    console.log('✅ Verificação pós-restore (contagem de linhas):');
    for (const t of CORE_TABLES) console.log(`   - ${t}: ${v.counts[t]}`);
  } catch (err) {
    console.error(`❌ ${sanitizeOutput(err.message)}`);
    exitCode = 1;
  } finally {
    // FIX1: limpa SOMENTE o temporário criado por nós (handle !== null).
    cleanupOwnedTemp(tmpHandle);
    if (opts.mode === 'local') {
      // Best-effort: artefato temporário dentro do container.
      try { run('docker', ['exec', opts.container, 'rm', '-f', remote]); } catch { /* ignore */ }
    }
  }
  process.exitCode = exitCode;
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  main();
}
