// Testes focados de consume-openbao-staging.ps1. Sem rede, sem .env real, sem bao/ssh/curl reais:
// verificações estáticas do script + harness que extrai funções via AST e usa um bao falso.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(import.meta.dirname, '..', 'consume-openbao-staging.ps1');
const src = readFileSync(script, 'utf8');
const q = (p) => p.replace(/'/g, "''");

const FN_NAMES = [
  'Set-ProcessEnv',
  'Test-IsolatedEnvName',
  'Get-BaoIsolatedEnvNames',
  'Invoke-WithoutIsolatedEnv',
  'New-ChildStartInfo',
  'New-ChildEnvironment',
  'Stop-OwnedTunnel',
  'Invoke-Bao',
  'Resolve-SideArgs',
  'Assert-ValidKvPath',
]
  .map((n) => `'${n}'`)
  .join(',');

// Carrega apenas as funções alvo do script real (sem executar o corpo do wrapper).
const loadFns = (fakeBao = 'unused') => `$ErrorActionPreference='Stop'
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${q(script)}', [ref]$null, [ref]$null)
$fns = $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -in ${FN_NAMES} }, $true)
foreach ($f in $fns) { . ([scriptblock]::Create($f.Extent.Text)) }
$script:bao = '${q(fakeBao)}'
$base = 'http://127.0.0.1:1'; $token = 'tok-fake'
`;

const runPwsh = (file, env) =>
  spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', file], { env, encoding: 'utf8' });

// Executa um harness PowerShell num diretório temporário e devolve { r, dir } para inspeção.
const withDir = (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'consume-bao-test-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
const runHarness = (dir, body, env = process.env, fakeBao) => {
  const harness = join(dir, 'harness.ps1');
  writeFileSync(harness, loadFns(fakeBao) + body);
  const r = runPwsh(harness, env);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return JSON.parse(r.stdout);
};

const ISOLATED = {
  BAO_ADDR: 'http://evil.example:8200',
  BAO_TOKEN: 'inherited-token',
  BAO_NAMESPACE: 'other-ns',
  BAO_PROXY_ADDR: 'http://proxy.example:3128',
  VAULT_ADDR: 'http://evil2.example',
  VAULT_TOKEN: 'inherited-vault',
  OPENBAO_TOKEN: 'ob-tok',
  OPENBAO_CLI_EXTRA: 'ob-extra',
  CH03_BAO_TOKEN: 'ch03-tok',
  CH03_OTHER: 'ch03-other',
  HTTP_PROXY: 'http://p1',
  HTTPS_PROXY: 'http://p2',
  ALL_PROXY: 'http://p3',
  NO_PROXY: 'localhost',
};
const isolatedNames = Object.keys(ISOLATED);

test('guard: exige PowerShell 7 antes de ler qualquer segredo', () => {
  assert.match(src, /^#Requires -Version 7\.0/m);
  const guard = src.indexOf('$PSVersionTable.PSVersion.Major -lt 7');
  const tokenRead = src.indexOf('$token = $env:OPENBAO_TOKEN');
  assert.ok(guard > 0 && tokenRead > 0 && guard < tokenRead, 'guard deve preceder a leitura do token');
  assert.match(src, /ArgumentList/);
});

test('validação de side e path ocorre antes da leitura do token', () => {
  const tokenRead = src.indexOf('$token = $env:OPENBAO_TOKEN');
  const side = src.indexOf('$SideArgs = Resolve-SideArgs $SideArgs');
  const path = src.indexOf('Assert-ValidKvPath $Path');
  assert.ok(side > 0 && path > 0 && side < tokenRead && path < tokenRead);
});

test('curl health check: -q primeiro, connect-timeout, max-time e ignora proxy', () => {
  const line = src.split('\n').find((l) => l.includes('& curl.exe'));
  assert.ok(line, 'chamada curl.exe presente');
  assert.match(line, /& curl\.exe -q -s /, '-q deve ser o primeiro argumento do curl');
  assert.match(line, /--connect-timeout \d+/);
  assert.match(line, /--max-time \d+/);
  assert.match(line, /--noproxy '\*'/);
  assert.ok(Number(/--max-time (\d+)/.exec(line)[1]) <= 10);
});

test('ssh e curl rodam dentro do isolamento de ambiente', () => {
  assert.doesNotMatch(src, /withoutBaoInputs/);
  assert.match(src, /Invoke-WithoutIsolatedEnv \{\s*Start-Process ssh/);
  assert.match(src, /Invoke-WithoutIsolatedEnv \{ & curl\.exe/);
  assert.match(src, /New-ChildStartInfo -Node/);
});

test('documentação: persistência do child (staging + admin), túnel sempre iniciado, side e exemplo', () => {
  assert.doesNotMatch(src, /WITHOUT persisting/i);
  assert.doesNotMatch(src, /written to\s+disk/i);
  assert.doesNotMatch(src, /No \.env write is performed/i);
  assert.match(src, /MAY persist the staging credentials into the\s+private \.env/);
  assert.match(src, /atomic write; mode 0600 is guaranteed on POSIX, while on\s+Windows access depends on the ACLs of the path\/directory/);
  assert.doesNotMatch(src, /atomic write, mode 0600\)/);
  assert.match(src, /operator must point\s+SYNKROO_VPS_ENV at a private \.env outside the repo \(this wrapper does not\s+validate that\)/);
  assert.match(src, /BAO_DISABLE_REDIRECTS/);
  // M2: ambas as credenciais efetivas, antes da mutação, só em arquivo privado fora do repo.
  assert.match(src, /Before any\s+database mutation the child may persist BOTH effective credentials/);
  assert.match(src, /PostgreSQL\/admin\s+credential/);
  assert.match(src, /private file outside the repository/);
  // (c) o túnel é sempre iniciado.
  assert.doesNotMatch(src, /if needed/i);
  assert.match(src, /ALWAYS opens a dedicated SSH tunnel/);
  // (a) exemplo inclui o side e doc declara a regra.
  assert.match(src, /\.\\scripts\\consume-openbao-staging\.ps1 --side=target --dry-run/);
  assert.match(src, /forces exactly one --side=target/);
  // M1: doc do isolamento ampliado.
  assert.match(src, /OPENBAO_\* \/ CH03_\*/);
  assert.match(src, /curl\s+runs with -q/);
});

test('Resolve-SideArgs: força --side=target e recusa source/duplicatas/formas alternativas', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `function Try-Side($a) { try { , @{ ok = $true; v = (Resolve-SideArgs $a) } } catch { , @{ ok = $false; v = $_.Exception.Message } } }
$o = [ordered]@{
  none = (Try-Side @())
  nullArgs = (Try-Side $null)
  dry = (Try-Side @('--dry-run'))
  explicit = (Try-Side @('--side=target','--dry-run'))
  source = (Try-Side @('--side=source'))
  dup = (Try-Side @('--side=target','--side=target'))
  mixed = (Try-Side @('--side=target','--side=source'))
  spaced = (Try-Side @('--side','target'))
  upper = (Try-Side @('--side=Target'))
  empty = (Try-Side @('--side='))
  single = (Try-Side @('-side=target'))
}
$o | ConvertTo-Json -Depth 5`,
    );
    assert.deepEqual(res.none, { ok: true, v: ['--side=target'] });
    assert.deepEqual(res.nullArgs, { ok: true, v: ['--side=target'] });
    assert.deepEqual(res.dry, { ok: true, v: ['--side=target', '--dry-run'] });
    assert.deepEqual(res.explicit, { ok: true, v: ['--side=target', '--dry-run'] });
    for (const k of ['source', 'dup', 'mixed', 'spaced', 'upper', 'empty', 'single']) {
      assert.equal(res[k].ok, false, `${k} deve ser recusado`);
      assert.match(res[k].v, /Refused/);
    }
  });
});

test('Assert-ValidKvPath: aceita caminho KV relativo e recusa opções, absolutos e traversal', () => {
  withDir((dir) => {
    const good = ['synkroo/staging/postgres', 'a', 'team_1/app.v2/db-main'];
    const bad = [
      '', '-x', '--help', '-format=json', '/abs/path', 'a//b', 'a/', '../x', 'a/../b', 'a/..', '.hidden',
      'a/-b', 'a b', 'a;b', 'a\\b', 'a/b\nc',
      'synkroo/staging/postgres\n', 'a\n',
    ];
    const res = runHarness(
      dir,
      `function Ok($p) { try { Assert-ValidKvPath $p; $true } catch { $false } }
$good = @('${JSON.stringify(good)}' | ConvertFrom-Json)
$bad = @('${JSON.stringify(bad)}' | ConvertFrom-Json)
@{ good = @($good | ForEach-Object { Ok $_ }); bad = @($bad | ForEach-Object { Ok $_ }) } | ConvertTo-Json`,
    );
    assert.deepEqual(res.good, good.map(() => true));
    assert.deepEqual(res.bad, bad.map(() => false), JSON.stringify(res.bad));
  });
});

test('Invoke-WithoutIsolatedEnv: ssh/curl não herdam o ambiente e o original é restaurado (sucesso)', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `$names = ${isolatedNames.map((n) => `'${n}'`).join(',')}
$before = @{}; foreach ($n in $names) { $before[$n] = [Environment]::GetEnvironmentVariable($n,'Process') }
$seen = Invoke-WithoutIsolatedEnv { @(Get-BaoIsolatedEnvNames) + @($env:KEEP_ME) }
$after = @{}; foreach ($n in $names) { $after[$n] = [Environment]::GetEnvironmentVariable($n,'Process') }
@{ seen = @($seen); before = $before; after = $after } | ConvertTo-Json -Depth 4`,
      { ...process.env, ...ISOLATED, KEEP_ME: 'kept' },
    );
    // Dentro do bloco: nenhum nome isolado visível; variável comum preservada.
    assert.deepEqual(res.seen, ['kept']);
    assert.deepEqual(res.after, res.before);
    for (const [k, v] of Object.entries(ISOLATED)) assert.equal(res.after[k], v, k);
  });
});

test('Invoke-WithoutIsolatedEnv: restaura exatamente o ambiente quando a ação falha', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `$names = ${isolatedNames.map((n) => `'${n}'`).join(',')}
$msg = ''
try { Invoke-WithoutIsolatedEnv { [Environment]::SetEnvironmentVariable('BAO_ADDR','set-inside','Process'); [Environment]::SetEnvironmentVariable('VAULT_NEW','x','Process'); throw 'boom' } } catch { $msg = $_.Exception.Message }
$after = @{}; foreach ($n in $names) { $after[$n] = [Environment]::GetEnvironmentVariable($n,'Process') }
@{ msg = $msg; after = $after; vaultNew = [Environment]::GetEnvironmentVariable('VAULT_NEW','Process') } | ConvertTo-Json -Depth 4`,
      { ...process.env, ...ISOLATED },
    );
    assert.equal(res.msg, 'boom');
    assert.deepEqual(res.after, ISOLATED);
    assert.equal(res.vaultNew, null, 'variável criada dentro do bloco não deve vazar');
  });
});

test('New-ChildStartInfo: child não herda BAO_/VAULT_/OPENBAO_/CH03_/proxy e recebe side=target', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `$childEnv = [System.Collections.Hashtable]::new([System.Environment]::GetEnvironmentVariables())
$childEnv['VPS_TARGET_STAGING_PASSWORD'] = 'fake-staging'
$childEnv['bao_lower'] = 'lower-case-leak'
$childEnv['Http_Proxy'] = 'mixed-case-leak'
$args2 = Resolve-SideArgs @('--dry-run')
$psi = New-ChildStartInfo -Node 'C:\\fake\\node.exe' -Tsx 'C:\\fake\\tsx.mjs' -Entrypoint 'C:\\fake\\setup.ts' -RepoRoot 'C:\\fake' -Arguments $args2 -Environment $childEnv
$keys = @($psi.EnvironmentVariables.Keys | ForEach-Object { [string]$_ })
@{ keys = $keys; args = @($psi.ArgumentList); staging = $psi.EnvironmentVariables['VPS_TARGET_STAGING_PASSWORD']; keep = $psi.EnvironmentVariables['KEEP_ME']; file = $psi.FileName } | ConvertTo-Json -Depth 4`,
      { ...process.env, ...ISOLATED, KEEP_ME: 'kept' },
    );
    const up = res.keys.map((k) => k.toUpperCase());
    for (const n of isolatedNames) assert.ok(!up.includes(n), `${n} vazou para o child`);
    assert.ok(!up.includes('BAO_LOWER') && !up.includes('HTTP_PROXY'), 'variações de caixa vazaram');
    assert.ok(!up.some((k) => /^(BAO_|VAULT_|OPENBAO_|CH03_)/.test(k)));
    assert.equal(res.staging, 'fake-staging');
    assert.equal(res.keep, 'kept');
    assert.deepEqual(res.args, ['C:\\fake\\tsx.mjs', 'C:\\fake\\setup.ts', '--side=target', '--dry-run']);
  });
});

test('Invoke-Bao: isola ambiente do bao e restaura o original (bao falso)', () => {
  withDir((dir) => {
    const fakeBao = join(dir, 'fake-bao.ps1');
    const seen = join(dir, 'seen.json');
    writeFileSync(
      fakeBao,
      [
        '$o = @{}',
        "foreach ($k in [Environment]::GetEnvironmentVariables('Process').Keys) { if ($k -match '^(BAO_|VAULT_|OPENBAO_|CH03_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)') { $o[$k] = [Environment]::GetEnvironmentVariable($k,'Process') } }",
        "$o['__args'] = ($args -join ' ')",
        '$o | ConvertTo-Json | Set-Content -LiteralPath $env:FAKE_OUT',
        "'fake-value'",
        '$global:LASTEXITCODE = 0',
      ].join('\n'),
    );
    const names = [...isolatedNames, 'BAO_DISABLE_REDIRECTS'].map((n) => `'${n}'`).join(',');
    const res = runHarness(
      dir,
      `$names = ${names}
$before = @{}; foreach ($n in $names) { $before[$n] = [Environment]::GetEnvironmentVariable($n,'Process') }
$out = Invoke-Bao @('kv','get')
$after = @{}; foreach ($n in $names) { $after[$n] = [Environment]::GetEnvironmentVariable($n,'Process') }
@{ out = $out; before = $before; after = $after } | ConvertTo-Json -Depth 4`,
      { ...process.env, ...ISOLATED, FAKE_OUT: seen },
      fakeBao,
    );
    const during = JSON.parse(readFileSync(seen, 'utf8').replace(/^﻿/, ''));

    assert.equal(res.out, 'fake-value');
    const keys = Object.keys(during).filter((k) => k !== '__args').map((k) => k.toUpperCase()).sort();
    assert.deepEqual(keys, ['BAO_ADDR', 'BAO_DISABLE_REDIRECTS', 'BAO_TOKEN']);
    assert.equal(during.BAO_ADDR, 'http://127.0.0.1:1');
    assert.equal(during.BAO_TOKEN, 'tok-fake');
    assert.equal(during.BAO_DISABLE_REDIRECTS, 'true');
    assert.equal(during.__args, 'kv get');
    assert.deepEqual(res.after, res.before);
    assert.equal(res.after.BAO_ADDR, 'http://evil.example:8200');
    assert.equal(res.after.BAO_DISABLE_REDIRECTS, null);
  });
});

test('Invoke-Bao: restaura ambiente mesmo quando o bao falha', () => {
  withDir((dir) => {
    const fakeBao = join(dir, 'fake-bao.ps1');
    writeFileSync(fakeBao, '$global:LASTEXITCODE = 3');
    const res = runHarness(
      dir,
      `$msg = ''
try { Invoke-Bao @('kv','get') | Out-Null } catch { $msg = $_.Exception.Message }
@{ msg = $msg; addr = $env:BAO_ADDR; tok = $env:BAO_TOKEN; vt = $env:VAULT_TOKEN; ob = $env:OPENBAO_TOKEN; ch = $env:CH03_OTHER; np = $env:NO_PROXY; red = $env:BAO_DISABLE_REDIRECTS } | ConvertTo-Json`,
      { ...process.env, BAO_ADDR: 'orig-addr', VAULT_TOKEN: 'orig-vt', OPENBAO_TOKEN: 'orig-ob', CH03_OTHER: 'orig-ch', NO_PROXY: 'orig-np' },
      fakeBao,
    );
    assert.match(res.msg, /OpenBao command failed \(exit 3\)/);
    assert.equal(res.addr, 'orig-addr');
    assert.equal(res.tok, null);
    assert.equal(res.vt, 'orig-vt');
    assert.equal(res.ob, 'orig-ob');
    assert.equal(res.ch, 'orig-ch');
    assert.equal(res.np, 'orig-np');
    assert.equal(res.red, null);
  });
});

test('New-ChildEnvironment: VPS_TARGET_STAGING_PASSWORD do OpenBao vence qualquer variante de caixa', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `$base = [System.Collections.Hashtable]::new()
$base['vps_target_staging_password'] = 'stale-lower'
$base['Vps_Target_Staging_Password'] = 'stale-mixed'
$base['VPS_TARGET_STAGING_PASSWORD'] = 'stale-upper'
$base['KEEP_ME'] = 'kept'
$base['bao_lower'] = 'leak'
$ce = New-ChildEnvironment -Base $base -Name 'VPS_TARGET_STAGING_PASSWORD' -Value 'from-openbao'
$psi = New-ChildStartInfo -Node 'C:\fake\node.exe' -Tsx 'C:\fake\tsx.mjs' -Entrypoint 'C:\fake\setup.ts' -RepoRoot 'C:\fake' -Arguments @('--side=target') -Environment $ce
$stagingKeys = @($ce.Keys | Where-Object { $_ -ieq 'VPS_TARGET_STAGING_PASSWORD' })
$psiKeys = @($psi.EnvironmentVariables.Keys | ForEach-Object { [string]$_ } | Where-Object { $_ -ieq 'VPS_TARGET_STAGING_PASSWORD' })
@{ count = $stagingKeys.Count; value = $ce['vps_target_staging_password']; psiCount = $psiKeys.Count; psiValue = $psi.EnvironmentVariables['VPS_TARGET_STAGING_PASSWORD']; keep = $psi.EnvironmentVariables['KEEP_ME'] } | ConvertTo-Json`,
    );
    assert.equal(res.count, 1);
    assert.equal(res.value, 'from-openbao');
    assert.equal(res.psiCount, 1);
    assert.equal(res.psiValue, 'from-openbao');
    assert.equal(res.keep, 'kept');
  });
});

test('Assert-ValidKvPath: usa \\z (newline final recusado) e script monta o filho via New-ChildEnvironment', () => {
  assert.match(src, /\\z'\) \{\s*throw 'Invalid -Path/);
  assert.match(src, /New-ChildEnvironment -Base .*-Name 'VPS_TARGET_STAGING_PASSWORD'/);
  assert.doesNotMatch(src, /\$childEnv\['VPS_TARGET_STAGING_PASSWORD'\]\s*=/);
});

test('túnel: fechado logo após bao kv get, antes de ProbeOnly/filho; finally mantém fallback', () => {
  const kv = src.indexOf("$value = Invoke-Bao @('kv','get'");
  const stop = src.indexOf('Stop-OwnedTunnel $startedTunnel', kv);
  const probe = src.indexOf('if ($ProbeOnly)');
  const spawn = src.indexOf('[System.Diagnostics.Process]::Start($psi)');
  assert.ok(kv > 0 && stop > kv && stop < probe && probe < spawn, 'ordem: kv get < stop < ProbeOnly < spawn');
  const finallyIdx = src.indexOf('} finally {', spawn);
  assert.ok(src.indexOf('Stop-OwnedTunnel $startedTunnel', finallyIdx) > finallyIdx, 'fallback no finally');
  assert.doesNotMatch(src.slice(stop, spawn), /Stop-Process[^\n]*\$proc/);
});

test('Stop-OwnedTunnel: encerra só o processo informado, é idempotente e tolera null (sem SSH real)', () => {
  withDir((dir) => {
    const res = runHarness(
      dir,
      `$spArgs = @{ FilePath = 'pwsh'; ArgumentList = @('-NoProfile','-Command','Start-Sleep -Seconds 60'); PassThru = $true }
if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') { $spArgs['WindowStyle'] = 'Hidden' }
$p = Start-Process @spArgs
$other = Start-Process @spArgs
try {
  Start-Sleep -Milliseconds 500
  Stop-OwnedTunnel $null
  Stop-OwnedTunnel $p
  $p.WaitForExit(5000) | Out-Null
  Stop-OwnedTunnel $p
  @{ stopped = $p.HasExited; otherAlive = (-not $other.HasExited) } | ConvertTo-Json
} finally { if (-not $other.HasExited) { Stop-Process -Id $other.Id -Force }; if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force } }`,
    );
    assert.equal(res.stopped, true);
    assert.equal(res.otherAlive, true);
  });
});
