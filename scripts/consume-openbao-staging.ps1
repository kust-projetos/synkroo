<#
.SYNOPSIS
  Consume the Synkroo staging password from OpenBao and inject it into the
  process environment of setup-staging-db.ts WITHOUT persisting it to .env.

.DESCRIPTION
  Reads secret/synkroo/staging/postgres (field "password") from OpenBao via the
  bao CLI, opens an SSH tunnel to contabo-prod:8200 if needed, and spawns
  scripts/setup-staging-db.ts with VPS_TARGET_STAGING_PASSWORD set in the
  process environment. The secret value is never printed, logged, or written to
  disk; only a length is reported.

  The remaining target settings (VPS_TARGET_IP, VPS_TARGET_PG_PORT,
  VPS_TARGET_POSTGRES_PASSWORD) MUST be provided by the caller via process env
  or the private .env file. They are NOT read from OpenBao by this script; the
  admin password should be migrated separately if desired.

.PARAMETER SideArgs
  Extra arguments forwarded to setup-staging-db.ts (e.g. --dry-run).

.PARAMETER ProbeOnly
  Only verify that the secret can be read (report length); do not spawn the
  setup script.

.PARAMETER Path
  OpenBao KV path (default: synkroo/staging/postgres).

.EXAMPLE
  $env:OPENBAO_TOKEN = '...'
  $env:VPS_TARGET_IP = '...'
  $env:VPS_TARGET_PG_PORT = '5432'
  $env:VPS_TARGET_POSTGRES_PASSWORD = '...'
  .\scripts\consume-openbao-staging.ps1 --dry-run

.NOTES
  Security: the secret is held only in process memory of the spawned child.
  No .env write is performed by this script. Rollback: stop using the wrapper
  and revert to the private .env fallback.
#>
param(
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$SideArgs,
    [switch]$ProbeOnly,
    [string]$Path = 'synkroo/staging/postgres'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$base = 'http://127.0.0.1:8200'
$token = $env:OPENBAO_TOKEN
if (-not $token) { $token = $env:CH03_BAO_TOKEN }
if (-not $token) { throw 'Set OPENBAO_TOKEN (or CH03_BAO_TOKEN); token is never printed' }

$stableBao = Join-Path $env:LOCALAPPDATA 'OpenBao\bin\bao.exe'
$script:bao = $null
if ($env:OPENBAO_CLI) {
    if (-not (Test-Path -LiteralPath $env:OPENBAO_CLI -PathType Leaf)) { throw 'OPENBAO_CLI does not name an existing file' }
    $script:bao = (Resolve-Path -LiteralPath $env:OPENBAO_CLI).Path
} elseif (Get-Command bao -CommandType Application -ErrorAction SilentlyContinue) {
    $script:bao = (Get-Command bao -CommandType Application).Source
} elseif (Test-Path -LiteralPath $stableBao -PathType Leaf) {
    $script:bao = $stableBao
} else {
    throw 'OpenBao CLI (bao) not found; install under stable user location or add to PATH'
}

function Invoke-Bao([string[]]$Arguments) {
    $env:BAO_ADDR = $base
    $env:BAO_TOKEN = $token
    $result = & $script:bao @Arguments 2>$null
    $exit = $LASTEXITCODE
    if ($exit -ne 0) { throw "OpenBao command failed (exit $exit)" }
    return ($result -join "`n")
}

$startedTunnel = $null
$health = $null
try { $health = Invoke-WebRequest "$base/v1/sys/health" -TimeoutSec 2 -SkipHttpErrorCheck } catch {}
if (-not $health) {
    $startedTunnel = Start-Process ssh -ArgumentList @('-N','-L','8200:127.0.0.1:8200','contabo-prod') -PassThru -WindowStyle Hidden
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 1
        try { $health = Invoke-WebRequest "$base/v1/sys/health" -TimeoutSec 2 -SkipHttpErrorCheck; break } catch {}
    }
}
if (-not $health -or [int]$health.StatusCode -ne 200) { throw 'OpenBao tunnel/health check failed' }

# Read the secret value in-process; never echo it.
$value = Invoke-Bao @('kv','get','-mount=secret','-field=password',$Path)
if ([string]::IsNullOrEmpty($value)) { throw 'Consumed credential is empty' }
$length = [Text.Encoding]::UTF8.GetByteCount($value)
$valueForChild = $value
$value = $null

Write-Output "consume-openbao: read-ok path=$Path length=$length"

if ($ProbeOnly) {
    $valueForChild = $null
    Write-Output 'probe-only: no child spawned'
    return
}

# Required target settings must come from the environment (never from this script).
foreach ($k in @('VPS_TARGET_IP','VPS_TARGET_PG_PORT','VPS_TARGET_POSTGRES_PASSWORD')) {
    if (-not (Test-Path "Env:$k") -or [string]::IsNullOrEmpty((Get-Item "Env:$k").Value)) {
        throw "Missing required env $k (provide via process env or private .env; not from OpenBao)"
    }
}

$childEnv = [System.Collections.Hashtable]::new([System.Environment]::GetEnvironmentVariables())
$childEnv['VPS_TARGET_STAGING_PASSWORD'] = $valueForChild
$valueForChild = $null

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'npx'
$psi.Arguments = ('tsx scripts/setup-staging-db.ts ' + ($SideArgs -join ' '))
$psi.WorkingDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$psi.UseShellExecute = $false
foreach ($k in $childEnv.Keys) { $psi.EnvironmentVariables[$k] = [string]$childEnv[$k] }

$proc = [System.Diagnostics.Process]::Start($psi)
$proc.WaitForExit()
$exit = $proc.ExitCode
$proc.Dispose()

if ($exit -ne 0) { throw "setup-staging-db.ts exited with code $exit" }
Write-Output 'consume-openbao: child completed'
finally {
    Remove-Item Env:BAO_TOKEN -ErrorAction SilentlyContinue
    if ($startedTunnel -and -not $startedTunnel.HasExited) { Stop-Process -Id $startedTunnel.Id -Force }
}