#!/usr/bin/env node
/**
 * Backup lógico do Postgres (pg_dump custom format + gzip + sha256).
 *
 * Modos:
 *   --local            dump via `docker exec` no container local (pg_dump roda
 *                      DENTRO do container — não exige pg_dump no host).
 *   --url              dump via pg_dump direto contra $DATABASE_URL do processo
 *                      (uso VPS/staging). A connection string NUNCA é aceita via
 *                      argv (não aparece em `ps`/shell history) e NUNCA é
 *                      impressa em logs ou erros — logs mostram só `host/dbname`.
 *
 * Exemplos:
 *   node scripts/db-backup.mjs --local
 *   node scripts/db-backup.mjs --local --out-dir ./backups --keep 7
 *   DATABASE_URL="..." node scripts/db-backup.mjs --url --out-dir /var/backups/synkroo
 *
 * Segurança: a connection string NUNCA é impressa em logs ou erros
 * (só o rótulo seguro `host/dbname`; stderr externo passa por sanitize()).
 *
 * Exit codes: 0 = ok · 1 = erro operacional · 2 = uso inválido.
 */
import { createRequire } from 'module';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, statSync, fstatSync, unlinkSync, chmodSync, createReadStream, createWriteStream, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
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
 * Higieniza texto externo (stderr de pg_dump etc.): mascara userinfo e
 * senhas em query string sem nunca reproduzir a connection string.
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
 * Retorna `{ path, fd }` com o fd ABERTO em modo exclusivo. O caller decide:
 * escrita Node interna (gzip) mantém o fd e escreve VIA fd (sem reabertura
 * por path — fecha a janela TOCTOU); escrita por processo externo fecha o
 * fd de imediato (o O_EXCL já garantiu que o path é nosso).
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
 * DSN sem credenciais para argv de pg_dump: sem userinfo e com ALLOWLIST
 * explícita de query params seguros (sslmode, sslcert, sslkey, sslrootcert,
 * connect_timeout, application_name, options). Todo o resto é removido —
 * ex.: token/secret/password arbitrários nunca chegam ao argv.
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
  node scripts/db-backup.mjs [--local|--url] [opções]

Modos (padrão: --local):
  --local                 dump via docker exec no container local
  --url                   dump via pg_dump direto (VPS/staging); lê SOMENTE $DATABASE_URL do processo
                          (a connection string nunca é aceita via argv nem exibida)

Opções:
  --out-dir <dir>         destino dos dumps (padrão: ./backups)
  --keep <dias>           retenção em dias (padrão: 7; arquivos synkroo-*.dump.gz mais antigos são removidos)
  --container <nome>      container Postgres local (padrão: synkroo-db; só --local)
  --db <nome>             database (padrão: $POSTGRES_DB ou 'synkroo'; só --local)
  --user <nome>           usuário (padrão: $POSTGRES_USER ou 'synkroo'; só --local)
  -h, --help              esta ajuda

Saída: <out-dir>/synkroo-YYYYMMDD-HHMMSS.dump.gz + .sha256`);
}

function parseArgs(argv) {
  const opts = { mode: 'local', url: null, outDir: './backups', keep: 7, container: 'synkroo-db', db: null, user: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (a === '--local') opts.mode = 'local';
    else if (a === '--url' || a === '--database-url') {
      // Modo remoto lê SOMENTE $DATABASE_URL do processo: a forma
      // `--url <conn>` foi removida (senha em argv vaza em `ps`/history).
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        console.error('❌ A forma `--url <conn>` foi removida: o modo remoto lê SOMENTE $DATABASE_URL do processo.\n   Rode como: DATABASE_URL="..." node scripts/db-backup.mjs --url');
        process.exit(2);
      }
      opts.mode = 'url';
    }
    else if (a.startsWith('--url=') || a.startsWith('--database-url=')) {
      console.error('❌ A forma `--url=<conn>` foi removida: o modo remoto lê SOMENTE $DATABASE_URL do processo.');
      process.exit(2);
    }
    else if (a === '--out-dir') opts.outDir = argv[++i];
    else if (a.startsWith('--out-dir=')) opts.outDir = a.slice('--out-dir='.length);
    else if (a === '--keep') opts.keep = Number(argv[++i]);
    else if (a.startsWith('--keep=')) opts.keep = Number(a.slice('--keep='.length));
    else if (a === '--container') opts.container = argv[++i];
    else if (a.startsWith('--container=')) opts.container = a.slice('--container='.length);
    else if (a === '--db') opts.db = argv[++i];
    else if (a.startsWith('--db=')) opts.db = a.slice('--db='.length);
    else if (a === '--user') opts.user = argv[++i];
    else if (a.startsWith('--user=')) opts.user = a.slice('--user='.length);
    else { console.error(`❌ Argumento desconhecido: ${maskArg(a)}\n`); usage(); process.exit(2); }
  }
  if (opts.mode === 'url') {
    if (process.env.DATABASE_URL) opts.url = process.env.DATABASE_URL;
    else { console.error('❌ Modo --url exige $DATABASE_URL no ambiente (valor nunca é exibido nem aceito via argv).'); process.exit(2); }
  }
  if (!Number.isInteger(opts.keep) || opts.keep < 0) { console.error('❌ --keep deve ser inteiro >= 0.'); process.exit(2); }
  opts.db ||= process.env.POSTGRES_DB || 'synkroo';
  opts.user ||= process.env.POSTGRES_USER || 'synkroo';
  return opts;
}

function run(cmd, args, { env } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: env ?? process.env });
  return { code: r.status ?? 1, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error ?? null };
}

function utcStamp(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

/** pg_dump --local: roda dentro do container; traz o .dump via docker cp. */
function dumpLocal({ container, db, user }, tmpDump, remote) {
  let r = run('docker', ['exec', container, 'pg_dump', '-U', user, '-d', db, '-Fc', '-f', remote]);
  if (r.code !== 0) {
    // Best-effort: remove artefato temporário parcial dentro do container.
    run('docker', ['exec', container, 'rm', '-f', remote]);
    return { ok: false, hint: `docker exec pg_dump falhou (container=${maskArg(container)} db=${maskArg(db)} user=${maskArg(user)}). Verifique se o container está no ar: \`docker ps --filter name=${maskArg(container)}\` ou suba com \`npm run db:up\`.\n${sanitizeOutput(r.stderr).trim()}` };
  }
  r = run('docker', ['cp', `${container}:${remote}`, tmpDump]);
  // Limpeza do artefato temporário dentro do container — SEMPRE (best-effort).
  run('docker', ['exec', container, 'rm', '-f', remote]);
  if (r.code !== 0) return { ok: false, hint: `docker cp falhou: ${sanitizeOutput(r.stderr).trim()}` };
  return { ok: true };
}

/** pg_dump --url: pg_dump no host; senha via PGPASSWORD (nunca via argv/log). */
function dumpUrl(url, tmpDump, label) {
  const probe = run('pg_dump', ['--version']);
  if (probe.code !== 0) {
    return { ok: false, hint: 'pg_dump não encontrado no PATH deste host. Instale o cliente PostgreSQL 17 (ex.: `apt install postgresql-client`) e tente de novo.' };
  }
  let u;
  try { u = new URL(url); } catch { return { ok: false, hint: `Connection string inválida para o alvo ${label}.` }; }
  const password = decodeURIComponent(u.password || '');
  const dbUser = decodeURIComponent(u.username || 'postgres');
  const dsnNoPass = buildDsnNoPass(url);
  // Re-parse só para host/porta (nunca logar a DSN, nem mesmo sem senha).
  const host = u.hostname;
  const port = u.port || '5432';
  const args = ['-h', host, '-p', port, '-U', dbUser, '-d', dsnNoPass, '-Fc', '-f', tmpDump];
  const env = { ...process.env };
  if (password) env.PGPASSWORD = password;
  const r = run('pg_dump', args, { env });
  if (r.code !== 0) {
    return { ok: false, hint: `pg_dump falhou contra ${label}. Causas comuns: host/porta inacessível, usuário sem permissão, senha incorreta.\n${sanitizeOutput(r.stderr).trim()}` };
  }
  return { ok: true };
}

/**
 * Comprime src no destino pré-criado via createRestrictedTemp, escrevendo
 * VIA fd exclusivo (createWriteStream com `fd` — o path NÃO é reaberto, de
 * modo que um swap/symlink do path entre criar e escrever não desvia a
 * escrita). O stream assume e fecha o fd.
 */
export async function gzipFile(src, destPath, destFd) {
  if (typeof destFd !== 'number') throw new Error('gzipFile exige fd exclusivo de createRestrictedTemp');
  await pipeline(createReadStream(src), createGzip({ level: 6 }), createWriteStream(destPath, { fd: destFd, mode: 0o600 }));
}

async function sha256Of(path) {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}

/**
 * Remove backups ANTERIORES ao cutoff (retenção em dias).
 *
 * SYNK-FIX-5 FIX1 — semântica de `--keep 0`: "manter apenas o backup desta
 * execução, apagar os mais antigos". O artefato da execução atual (gz +
 * `.sha256`) é passado em `keepPaths` e NUNCA é removido pelo prune — mesmo
 * quando o cutoff == agora (caso em que o mtime do arquivo recém-criado
 * seria `< cutoff` e o prune antigo apagava a própria saída e reportava
 * sucesso). Sem `keepPaths`, o comportamento é o legado (corte por mtime).
 */
export function pruneRetention(outDir, keepDays, keepPaths = []) {
  const cutoff = Date.now() - keepDays * 86400_000;
  const keepSet = new Set((keepPaths ?? []).map((p) => resolve(String(p))));
  let removed = 0;
  for (const name of readdirSync(outDir)) {
    if (!/^synkroo-.*\.dump\.gz$/.test(name)) continue;
    const full = join(outDir, name);
    // FIX1: o artefato desta execução nunca entra no prune.
    if (keepSet.has(resolve(full))) continue;
    let mtime = 0;
    try { mtime = statSync(full).mtimeMs; } catch { continue; }
    if (mtime < cutoff) {
      try {
        unlinkSync(full);
        const sidecar = `${full.slice(0, -'.gz'.length)}.sha256`;
        if (existsSync(sidecar)) unlinkSync(sidecar);
        console.log(`🧹 Retenção (--keep ${keepDays}d): removido ${maskArg(name)}`);
        removed++;
      } catch (err) { console.error(`⚠️  Não foi possível remover ${maskArg(name)}: ${sanitizeOutput(err.message)}`); }
    }
  }
  return removed;
}

async function main() {
  // parseArgs/usage saem com exit 0/2 ANTES de qualquer temporário existir.
  const opts = parseArgs(process.argv.slice(2));
  const outDir = resolve(opts.outDir);
  mkdirSync(outDir, { recursive: true });

  const stamp = utcStamp();
  const base = `synkroo-${stamp}`;
  const finalGz = join(outDir, `${base}.dump.gz`);
  const tmpDump = uniqueTempPath(join(tmpdir(), `${base}-${process.pid}.dump`));
  const remoteTmp = `/tmp/synkroo-backup-${process.pid}-${randomBytes(4).toString('hex')}.dump`;
  const label = opts.mode === 'local'
    ? `container=${maskArg(opts.container)} db=${maskArg(opts.db)} user=${maskArg(opts.user)}`
    : safeTargetLabel(opts.url);

  // Ponto único de saída: NENHUM process.exit dentro do try — erros são
  // propagados (throw) até o catch, e o finally SEMPRE limpa os temporários
  // criados POR NÓS (posse via handle; exit code aplicado só após a limpeza).
  let exitCode = 0;
  let tmpHandle = null;
  let finalHandle = null;
  try {
    console.log(`📦 Backup Postgres — modo=${opts.mode} destino=${maskArg(finalGz)}`);
    if (opts.mode === 'local') console.log(`   ${label}`);
    else console.log(`   alvo=${label} (connection string nunca exibida)`);

    // Posse do temporário local: handle registrado SÓ após criação
    // bem-sucedida (se createRestrictedTemp lançar, tmpHandle segue null e
    // o finally não toca em nada). O fd é fechado de imediato porque a
    // escrita é feita por processo externo (docker cp / pg_dump -f) via path.
    tmpHandle = createRestrictedTemp(tmpDump);
    try { closeSync(tmpHandle.fd); } catch { /* ignore */ }
    tmpHandle.fd = null;

    const res = opts.mode === 'local'
      ? dumpLocal(opts, tmpDump, remoteTmp)
      : dumpUrl(opts.url, tmpDump, label);
    if (!res.ok) throw new Error(`Backup falhou.\n   ${res.hint}`);

    restrictTempMode(tmpDump);
    // Saída final criada com O_EXCL e escrita VIA fd (sem reabertura por
    // path — fecha a janela TOCTOU de swap/symlink entre criar e escrever).
    finalHandle = createRestrictedTemp(finalGz);
    await gzipFile(tmpDump, finalGz, finalHandle.fd);
    finalHandle.fd = null; // fd assumido/fechado pelo stream de escrita
    const { size } = statSync(finalGz);
    const hash = await sha256Of(finalGz);
    const shaPath = `${finalGz.slice(0, -'.gz'.length)}.sha256`;
    writeFileSync(shaPath, `${hash}  ${base}.dump.gz\n`);
    // SYNK-FIX-5 FIX1: exclui o artefato desta execução do prune
    // (--keep 0 = manter só o de hoje, apagar os mais antigos).
    const pruned = pruneRetention(outDir, opts.keep, [finalGz, shaPath]);
    console.log(`✅ Backup concluído: ${maskArg(finalGz)} (${(size / 1024).toFixed(1)} KiB, sha256 ${hash.slice(0, 12)}…, retenção removeu ${pruned})`);
    console.log(`   Tabelas core cobertas pelo dump: ${CORE_TABLES.join(', ')} (verificação de contagem no restore: node scripts/db-restore.mjs)`);
    finalHandle = null; // sucesso: saída final pertence ao usuário — finally não remove
  } catch (err) {
    console.error(`❌ ${sanitizeOutput(err.message)}`);
    exitCode = 1;
  } finally {
    // FIX1: limpa SOMENTE o que nós criamos (handle !== null). Em falha,
    // remove também a saída parcial (só se fomos nós que a criamos).
    cleanupOwnedTemp(tmpHandle);
    if (exitCode !== 0) cleanupOwnedTemp(finalHandle);
    if (opts.mode === 'local') {
      // Best-effort: artefato temporário dentro do container.
      try { run('docker', ['exec', opts.container, 'rm', '-f', remoteTmp]); } catch { /* ignore */ }
    }
  }
  process.exitCode = exitCode;
}

if (isCliInvocation(import.meta.url, process.argv[1])) {
  main();
}
