<#
.SYNOPSIS
  Consume the Synkroo staging password from OpenBao and inject it into the
  process environment of setup-staging-db.ts. This wrapper itself never writes
  the secret anywhere; see .NOTES for the persistence done by the child.

.DESCRIPTION
  Reads secret/synkroo/staging/postgres (field "password") from OpenBao via the
  bao CLI, ALWAYS opens a dedicated SSH tunnel (ephemeral loopback port) to
  contabo-prod:8200 (stopped again in finally), and spawns
  scripts/setup-staging-db.ts with VPS_TARGET_STAGING_PASSWORD set in the
  process environment. The wrapper only serves the staging TARGET side: it
  forces exactly one --side=target and refuses any other --side or duplicates. The secret value is never printed or logged by this
  wrapper and the wrapper writes nothing to disk; only a length is reported.
  Requires PowerShell 7+ (checked before any secret is read).

  The remaining target settings (VPS_TARGET_IP, VPS_TARGET_PG_PORT,
  VPS_TARGET_POSTGRES_PASSWORD) MUST be provided by the caller via process env
  or the private .env file. They are NOT read from OpenBao by this script; the
  admin password should be migrated separately if desired.

.PARAMETER SideArgs
  Extra arguments forwarded to setup-staging-db.ts (e.g. --dry-run).
  --side=target is always passed (added when omitted). Any other --side value
  (e.g. --side=source), the space form (--side target) or a duplicate is refused.

.PARAMETER ProbeOnly
  Only verify that the secret can be read (report length); do not spawn the
  setup script.

.PARAMETER Path
  OpenBao KV path (default: synkroo/staging/postgres). Must be relative
  segments of [A-Za-z0-9_.-] separated by a single "/", each starting with a
  letter, digit or underscore (strict to end of string: a trailing newline is
  refused), so it can never look like a CLI option ("-x"),
  be absolute or contain ".." traversal.

.EXAMPLE
  $env:OPENBAO_TOKEN = '...'
  $env:VPS_TARGET_IP = '...'
  $env:VPS_TARGET_PG_PORT = '5432'
  $env:VPS_TARGET_POSTGRES_PASSWORD = '...'
  .\scripts\consume-openbao-staging.ps1 --side=target --dry-run

.NOTES
  Security / persistence: this wrapper does not write any file and does not
  persist the secret. In a real (non --dry-run) run, however, the spawned
  scripts/setup-staging-db.ts MAY persist the staging credentials into the
  private .env (atomic write; mode 0600 is guaranteed on POSIX, while on
  Windows access depends on the ACLs of the path/directory) through its own
  existing behavior; that logic is unchanged and out of scope here. Before any
  database mutation the child may persist BOTH effective credentials there: the
  staging credential and, when it diverges from the file, the PostgreSQL/admin
  credential (VPS_TARGET_POSTGRES_PASSWORD). The only operational destination
  is that private file outside the repository: the operator must point
  SYNKROO_VPS_ENV at a private .env outside the repo (this wrapper does not
  validate that). With --dry-run no mutation is expected. Never copy that .env
  into the repository.
  Environment isolation: the OpenBao CLI call, the SSH tunnel, the curl health
  check and the setup-staging-db.ts child never inherit BAO_* / VAULT_* /
  OPENBAO_* / CH03_* or HTTP_PROXY / HTTPS_PROXY / ALL_PROXY / NO_PROXY. Only
  the bao call receives BAO_ADDR, BAO_TOKEN and BAO_DISABLE_REDIRECTS. The
  caller's exact environment is restored in finally (also on failure). curl
  runs with -q so a local .curlrc is ignored. Rollback: stop using the wrapper
  and use the private .env fallback.
#>
#Requires -Version 7.0
param(
    [Parameter(ValueFromRemainingArguments = $true)][string[]]$SideArgs,
    [switch]$ProbeOnly,
    [string]$Path = 'synkroo/staging/postgres'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

# Guard before any secret is read: ProcessStartInfo.ArgumentList needs PowerShell 7+.
if ($PSVersionTable.PSVersion.Major -lt 7) {
    throw 'PowerShell 7 or newer is required (ProcessStartInfo.ArgumentList); aborting before reading any secret'
}

# Forwarded args: this wrapper only serves the staging TARGET side. Exactly one
# --side=target is forced; any other --side form or a duplicate is refused.
function Resolve-SideArgs([string[]]$Arguments) {
    $out = [System.Collections.Generic.List[string]]::new()
    $sideCount = 0
    foreach ($a in @($Arguments)) {
        if ($null -eq $a) { continue }
        if ($a -imatch '^--?side($|=)') {
            $sideCount++
            if ($a -cne '--side=target') { throw "Refused: only '--side=target' is allowed by this wrapper" }
            if ($sideCount -gt 1) { throw 'Refused: duplicate --side=target' }
            continue
        }
        $out.Add($a)
    }
    $out.Insert(0, '--side=target')
    return ,$out.ToArray()
}

# KV path must never be parsable as a bao option and cannot be absolute or traverse.
function Assert-ValidKvPath([string]$Value) {
    if ([string]::IsNullOrEmpty($Value) -or $Value -cnotmatch '^[A-Za-z0-9_][A-Za-z0-9_.-]*(/[A-Za-z0-9_][A-Za-z0-9_.-]*)*\z') {
        throw 'Invalid -Path: use relative segments of [A-Za-z0-9_.-] separated by "/", each starting with a letter, digit or underscore'
    }
    if (($Value -split '/') -contains '..') { throw 'Invalid -Path: ".." is not allowed' }
}

$SideArgs = Resolve-SideArgs $SideArgs
Assert-ValidKvPath $Path

$base = $null
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

# PowerShell coerces $null to '' for the .NET string parameter, which leaves an empty
# variable behind instead of removing it. Remove explicitly so unset stays unset.
function Set-ProcessEnv([string]$Name, $Value) {
    if ($null -eq $Value) {
        Remove-Item -LiteralPath "Env:$Name" -ErrorAction SilentlyContinue
    } else {
        [Environment]::SetEnvironmentVariable($Name, [string]$Value, 'Process')
    }
}

# Variables that can redirect the destination, context or proxying of the bao CLI,
# the SSH tunnel, curl or the setup child. BAO_* is the documented prefix
# (https://openbao.org/docs/commands/); VAULT_* is its documented fallback prefix;
# OPENBAO_* / CH03_* hold wrapper tokens. Names are matched case-insensitively.
function Test-IsolatedEnvName([string]$Name) {
    $extra = @('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY')
    return ($Name -imatch '^(BAO_|VAULT_|OPENBAO_|CH03_)' -or $extra -contains $Name)
}

function Get-BaoIsolatedEnvNames {
    $names = foreach ($key in [Environment]::GetEnvironmentVariables('Process').Keys) {
        if (Test-IsolatedEnvName ([string]$key)) { [string]$key }
    }
    return @($names | Sort-Object -Unique)
}

# Run $Action with every isolated variable removed; restore the caller's exact
# values afterwards (also when $Action throws).
function Invoke-WithoutIsolatedEnv([scriptblock]$Action) {
    $saved = @{}
    foreach ($name in (Get-BaoIsolatedEnvNames)) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        Set-ProcessEnv $name $null
    }
    try { & $Action } finally {
        foreach ($name in (Get-BaoIsolatedEnvNames)) { Set-ProcessEnv $name $null }
        foreach ($name in $saved.Keys) { Set-ProcessEnv $name $saved[$name] }
    }
}

# Child start info with a fully filtered environment (nothing isolated is inherited).
function New-ChildStartInfo([string]$Node, [string]$Tsx, [string]$Entrypoint, [string]$RepoRoot, [string[]]$Arguments, [System.Collections.IDictionary]$Environment) {
    $psi = [System.Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $Node
    $psi.WorkingDirectory = $RepoRoot
    $psi.UseShellExecute = $false
    [void]$psi.ArgumentList.Add($Tsx)
    [void]$psi.ArgumentList.Add($Entrypoint)
    foreach ($arg in $Arguments) { [void]$psi.ArgumentList.Add($arg) }
    $psi.EnvironmentVariables.Clear()
    foreach ($k in $Environment.Keys) {
        if (Test-IsolatedEnvName ([string]$k)) { continue }
        $psi.EnvironmentVariables[[string]$k] = [string]$Environment[$k]
    }
    return $psi
}

# Child environment with ordinal case-insensitive keys (Windows semantics): any
# pre-existing variant of $Name (e.g. vps_target_staging_password) is dropped so the
# value received from OpenBao is the only one and always wins.
function New-ChildEnvironment([System.Collections.IDictionary]$Base, [string]$Name, [string]$Value) {
    $env2 = [System.Collections.Generic.Dictionary[string,string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($k in $Base.Keys) {
        if ([string]::Equals([string]$k, $Name, [System.StringComparison]::OrdinalIgnoreCase)) { continue }
        $env2[[string]$k] = [string]$Base[$k]
    }
    $env2[$Name] = $Value
    return $env2
}

# Stop the SSH tunnel started by this script only; idempotent and failure-tolerant.
function Stop-OwnedTunnel($Tunnel) {
    if ($Tunnel -and -not $Tunnel.HasExited) {
        try { Stop-Process -Id $Tunnel.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
}

function Invoke-Bao([string[]]$Arguments) {
    $saved = @{}
    foreach ($name in (Get-BaoIsolatedEnvNames)) {
        $saved[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        Set-ProcessEnv $name $null
    }
    Set-ProcessEnv 'BAO_ADDR' $base
    Set-ProcessEnv 'BAO_TOKEN' $token
    Set-ProcessEnv 'BAO_DISABLE_REDIRECTS' 'true'
    try {
        $result = & $script:bao @Arguments 2>$null
        $exit = $LASTEXITCODE
    } finally {
        # Drop everything set for this call, then restore the caller's exact values.
        foreach ($name in (Get-BaoIsolatedEnvNames)) {
            Set-ProcessEnv $name $null
        }
        foreach ($name in $saved.Keys) {
            Set-ProcessEnv $name $saved[$name]
        }
    }
    if ($exit -ne 0) { throw "OpenBao command failed (exit $exit)" }
    return ($result -join "`n")
}

function Assert-StartedTunnelOwnsListener([int]$Port, [System.Diagnostics.Process]$Tunnel) {
    if ($Tunnel.HasExited) { throw 'OpenBao SSH tunnel exited before secret read' }
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) { throw 'OpenBao tunnel listener disappeared' }
    if (@($listeners | Where-Object { $_.OwningProcess -ne $Tunnel.Id }).Count -gt 0) {
        throw 'OpenBao tunnel port is owned by an unexpected process'
    }
}

$startedTunnel = $null
$previousEnv = @{}
foreach ($name in @('BAO_ADDR','BAO_TOKEN','OPENBAO_TOKEN','CH03_BAO_TOKEN','VPS_TARGET_STAGING_PASSWORD')) {
    $previousEnv[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
try {
    # Reserve an ephemeral loopback port; never reuse an unrelated local service.
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $localPort = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    $listener.Stop()
    $listener = $null
    $base = "http://127.0.0.1:$localPort"

    $startedTunnel = Invoke-WithoutIsolatedEnv {
        Start-Process ssh -ArgumentList @(
            '-N', '-o', 'ExitOnForwardFailure=yes', '-o', 'BatchMode=yes',
            '-o', 'ConnectTimeout=10', '-L', "127.0.0.1:${localPort}:127.0.0.1:8200", 'contabo-prod'
        ) -PassThru -WindowStyle Hidden
    }
    # Health check via curl.exe (avoids Invoke-WebRequest null-ref in this runspace).
    # The explicit bounded readiness window is the only wait; fail immediately if SSH exits.
    $code = $null
    for ($i = 0; $i -lt 30; $i++) {
        if ($startedTunnel.HasExited) { throw 'OpenBao SSH tunnel exited before becoming ready' }
        $connections = @(Get-NetTCPConnection -LocalPort $localPort -State Listen -ErrorAction SilentlyContinue)
        if ($connections.Count -eq 0) { Start-Sleep -Seconds 1; continue }
        if (@($connections | Where-Object { $_.OwningProcess -ne $startedTunnel.Id }).Count -gt 0) {
            throw 'OpenBao tunnel port is owned by an unexpected process'
        }
        $code = Invoke-WithoutIsolatedEnv { & curl.exe -q -s --noproxy '*' --connect-timeout 2 --max-time 5 -o NUL -w "%{http_code}" "$base/v1/sys/health" 2>$null }
        if ($code -eq '200') {
            Assert-StartedTunnelOwnsListener -Port $localPort -Tunnel $startedTunnel
            break
        }
        Start-Sleep -Seconds 1
    }
    if ($code -ne '200') { throw 'OpenBao tunnel/health check failed' }

    # Read the secret value in-process; never echo it.
    Assert-StartedTunnelOwnsListener -Port $localPort -Tunnel $startedTunnel
    $value = Invoke-Bao @('kv','get','-mount=secret','-field=password',$Path)
    # The secret is read: close the tunnel now, before the child / ProbeOnly. The child
    # does not use OpenBao; finally below remains the fallback if anything fails earlier.
    Stop-OwnedTunnel $startedTunnel
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

    $childEnv = New-ChildEnvironment -Base ([System.Environment]::GetEnvironmentVariables()) -Name 'VPS_TARGET_STAGING_PASSWORD' -Value $valueForChild
    $valueForChild = $null

    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $node = (Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue).Source
    $tsx = Join-Path $repoRoot 'node_modules/tsx/dist/cli.mjs'
    $entrypoint = Join-Path $repoRoot 'scripts/setup-staging-db.ts'
    if (-not $node -or -not (Test-Path -LiteralPath $tsx -PathType Leaf) -or -not (Test-Path -LiteralPath $entrypoint -PathType Leaf)) {
        throw 'Local node.exe, tsx entrypoint, or setup script is missing; refusing network fallback'
    }
    # New-ChildStartInfo clears the inherited copy and applies only the filtered environment.
    $psi = New-ChildStartInfo -Node $node -Tsx $tsx -Entrypoint $entrypoint -RepoRoot $repoRoot -Arguments $SideArgs -Environment $childEnv

    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.WaitForExit()
    $exit = $proc.ExitCode
    $proc.Dispose()

    if ($exit -ne 0) { throw "setup-staging-db.ts exited with code $exit" }
    Write-Output 'consume-openbao: child completed'
} finally {
    # Cleanup tunnel created by this script only.
    Stop-OwnedTunnel $startedTunnel
    # Restore caller environment; only values set by this wrapper are changed.
    foreach ($name in $previousEnv.Keys) {
        if ($null -eq $previousEnv[$name]) {
            Set-ProcessEnv $name $null
        } else {
            Set-ProcessEnv $name $previousEnv[$name]
        }
    }
}
