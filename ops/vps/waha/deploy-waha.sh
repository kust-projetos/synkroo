#!/bin/bash
# Deploy WAHA on the Contabo target (loopback-only, pinned digest).
#
# Versioned here; at deploy time the operator copies this file plus
# `docker-compose.yml` to /opt/synkroo/waha/ on the target and runs it there
# over SSH. It NEVER runs from a developer workstation against production.
#
# Usage (run ON the target, with no inherited WAHA_* value — see gate 1):
#   env -u WAHA_IMAGE_DIGEST -u WAHA_ENGINE -u WAHA_API_KEY_HASH \
#     -u WAHA_SWAGGER_USERNAME -u WAHA_SWAGGER_PASSWORD \
#     -u WAHA_WEBHOOK_HMAC_KEY -u WAHA_WEBHOOK_URL \
#     ./deploy-waha.sh /opt/synkroo/waha/.env            # dry-run: validate + plan only
#     ./deploy-waha.sh /opt/synkroo/waha/.env --apply    # pull pinned image + up
#
# Gates (fail closed, in order):
#   1. env file exists and is mode 0600 (no group/other/special bits), and no
#      allowlisted WAHA_* value is inherited from the shell;
#   2. declarative parse of the env file (never sourced/evaluated/expanded);
#   3. single execution (flock);
#   4. required settings present and well-formed (names only in output);
#   5. (--apply only) pull by immutable RepoDigest, then verify the pulled
#      RepoDigest EQUALS the pinned value — any mismatch aborts before `up`;
#   6. (--apply only) compose up, wait for healthy, loopback /health smoke.
#
# Secret handling: values are never printed. The compose file receives only
# the API-key HASH (sha512:...); the raw key lives in server-side app secrets.
# The env file is DATA, never code: it is parsed line by line below and never
# sourced, evaluated or expanded, so no command substitution or interpolation
# can run and no INHERITED shell variable can satisfy a missing key.
#
# Session backup is intentionally NOT part of this script: no session exists
# until QR pairing (canary window). P3.4 defines confidentiality/encryption/
# retention/restore before a real session is used. Never copy an Evolution or
# Hostinger session into the session volume.

set -euo pipefail

IMAGE_REPO="devlikeapro/waha"
INSTALL_DIR="${WAHA_INSTALL_DIR:-/opt/synkroo/waha}"
COMPOSE_FILE="${WAHA_COMPOSE_FILE:-$INSTALL_DIR/docker-compose.yml}"
LOCKFILE="$INSTALL_DIR/.deploy.lock"
CONTAINER="synkroo-waha-candidate"
HEALTH_URL="http://127.0.0.1:3000/health"
HEALTH_TIMEOUT_SEC="${WAHA_HEALTH_TIMEOUT_SEC:-180}"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
fail() { log "DEPLOY FAILED: $1"; exit 1; }

# ─── Webhook URL: paridade estrutural com preflight.mjs (E4 review) ──────────
# Regra canônica (`validateWahaConfig` em ops/vps/waha/preflight.mjs): UMA
# regra, DUAS implementações — o alvo não tem runtime Node, então este script
# reimplementa a mesma regra em Bash puro e a suíte de paridade compara os dois
# veredictos caso a caso:
#   1. forma crua `https://<host>[:<port>]/api/whatsapp/waha`, com o PATH EXATO
#      na string crua. O parser WHATWG sozinho não é prova: ele COLAPSA
#      segmentos de ponto (`/x/../api/whatsapp/waha` vira a rota), aceita porta
#      com zeros à esquerda (`:000443` vira `443`) e troca o host de um
#      authority separado por `\`;
#   2. host: um único ponto final é aceito (`example.com.`). Se o ÚLTIMO rótulo
#      for numérico, o host precisa ser um quad IPv4 canônico — 4 octetos, sem
#      zeros à esquerda, cada um 0-255. O WHATWG ainda aceitaria `1.2.3`,
#      `2130706433` e `0x7f.1` e rejeita `999.999.999.999`; nenhuma dessas
#      formas é expressável aqui, então AMBOS rejeitam. Um rótulo FINAL na
#      sintaxe de número hexadecimal do WHATWG (`0x7f`, `1.2.3.0xff`,
#      `example.0xff`) é rejeitado pelas duas pontas: o WHATWG renormalizaria
#      o host (`0x7f` → `0.0.0.127`, `1.2.3.0xff` → `1.2.3.255`) ou rejeitaria
#      o authority inteiro (`example.0xff`), e o host canônico tem de ser
#      byte-idêntico ao que foi escrito. As formas SEM dígito hexa (`0x`, `0X`)
#      valem o mesmo: o WHATWG lê `0x` como o número 0 (host `0.0.0.0`) e
#      rejeita `example.0x` inteiro — por isso o quantificador é `*` e não `+`
#      (com `+`, o rótulo `0x` passava como DNS comum). Tradeoff deliberado:
#      um rótulo final legal em DNS puro (`0xff`) é recusado mesmo assim. Só o
#      ÚLTIMO rótulo é verificado, então `0xapp.example.com` — e um `0xapp`
#      final — continuam sendo host DNS válido.
#      Senão o host é DNS-like: rótulos separados por ponto, alfanuméricos com
#      hífen interno (sem underscore, sem hífen na borda);
#   3. porta: 1-5 dígitos, 0-65535 e SEM zeros à esquerda — `:000443` é
#      rejeitado pelos dois lados em vez de normalizado (`10#` força base 10:
#      `080000` não pode ser lido como octal);
#   4. scheme case-insensitive, como o WHATWG normaliza; o PATH continua
#      case-sensitive;
#   5. sem credenciais, sem query e sem fragmento.
# `?` e `#` nunca chegam aqui: o gate de charset do parser declarativo do env
# file já rejeita ambos, exatamente como o parser de linha do preflight.mjs.
# Portas vazias (`https://host:/...`) são aceitas porque o WHATWG também as
# aceita.
validate_waha_webhook_url() {
  local url="$1" rest hostport host port path quad_re dns_re hex_label_re o1 o2 o3 o4
  [[ "$url" =~ ^[Hh][Tt][Tt][Pp][Ss]://(.*)$ ]] || return 1
  rest="${BASH_REMATCH[1]}"
  [ -n "$rest" ] || return 1
  case "$rest" in
    */*) hostport="${rest%%/*}"; path="/${rest#*/}" ;;
    *)   hostport="$rest";       path="" ;;
  esac
  [ -n "$hostport" ] || return 1
  case "$hostport" in
    *@*) return 1 ;;
  esac
  host="$hostport"
  port=""
  case "$hostport" in
    *:*) host="${hostport%%:*}"; port="${hostport#*:}" ;;
  esac
  [ -n "$host" ] || return 1
  if [ -n "$port" ]; then
    # Sem zeros à esquerda: `:000443` e `:00443` falham nos DOIS validadores.
    [[ "$port" =~ ^(0|[1-9][0-9]{0,4})$ ]] || return 1
    [ "$((10#$port))" -le 65535 ] || return 1
  fi
  [ "$path" = "/api/whatsapp/waha" ] || return 1
  # Host: charset restrito, um ponto final opcional e limite de porte DNS.
  case "$host" in
    *[!A-Za-z0-9.-]*) return 1 ;;
  esac
  host="${host%.}"
  [ -n "$host" ] || return 1
  [ "${#host}" -le 253 ] || return 1
  quad_re='^(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})\.(0|[1-9][0-9]{0,2})$'
  dns_re='^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$'
  hex_label_re='^0[xX][0-9a-fA-F]*$'
  # Último rótulo numérico ⇒, como no WHATWG, só um quad canônico passa.
  case "${host##*.}" in
    ''|*[!0-9]*)
      # Rótulo FINAL hexadecimal do WHATWG (`0x7f`, `1.2.3.0xff`, `example.0xff`)
      # e sua forma SEM dígito hexa (`0x`, `0X`): o parser renormalizaria o host
      # (`0x7f` → `0.0.0.127`, `0x` → `0.0.0.0`) ou rejeitaria o authority
      # (`example.0xff`, `example.0x`). Mesma regra do preflight.mjs: recusa o
      # rótulo (tradeoff deliberado — DNS puro o aceitaria) e só olha o ÚLTIMO
      # rótulo, então `0xapp.example.com` e um `0xapp` final continuam válidos.
      if [[ "${host##*.}" =~ $hex_label_re ]]; then return 1; fi
      [[ "$host" =~ $dns_re ]]
      return $?
      ;;
  esac
  [[ "$host" =~ $quad_re ]] || return 1
  IFS='.' read -r o1 o2 o3 o4 <<< "$host"
  [ "$((10#$o1))" -le 255 ] && [ "$((10#$o2))" -le 255 ] && \
    [ "$((10#$o3))" -le 255 ] && [ "$((10#$o4))" -le 255 ]
}

ENV_FILE="${1:?usage: $0 /path/to/private/waha/.env [--apply]}"
APPLY="no"
if [ "${2:-}" = "--apply" ]; then APPLY="yes"; fi

[ -f "$ENV_FILE" ] || fail "private env file not found"
ENV_MODE="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo "?")"
[ "$ENV_MODE" = "600" ] || fail "private env file must be mode 0600 (saw $ENV_MODE)"

# ─── Env file: declarative parse, never executed (E4 fix) ────────────────────
# Sourcing the file (`set -a; . "$ENV_FILE"`) was rejected in review: it runs
# whatever shell the 0600 file contains AND accepts INHERITED values, so a
# missing key passed validation with a stray ambient variable — and the same
# key could later resolve differently at `docker compose` time. The parser
# below is fail-closed and matches `preflight.mjs` exactly:
#   1. any INHERITED value of an allowlisted key aborts — unset it before
#      running, so only the file can satisfy a key;
#   2. lines are read WITHOUT expansion — no source/eval/`$`/backticks;
#   3. only unquoted `KEY=value` with key `[A-Z][A-Z0-9_]*` and value from
#      `[A-Za-z0-9._:/-]` is accepted (quotes, spaces, `$`, interpolation,
#      inline comments and `=` inside values are hard failures);
#   4. duplicate and unknown keys abort; only key names are ever printed.
ENV_ALLOWED_KEYS='WAHA_IMAGE_DIGEST WAHA_ENGINE WAHA_API_KEY_HASH WAHA_SWAGGER_USERNAME WAHA_SWAGGER_PASSWORD WAHA_WEBHOOK_HMAC_KEY WAHA_WEBHOOK_URL'

for _k in $ENV_ALLOWED_KEYS; do
  if [ -n "${!_k+set}" ]; then
    fail "inherited $_k is set in this shell; unset it before running (the env file is the only source of truth)"
  fi
done

_env_line_no=0
while IFS= read -r _line || [ -n "$_line" ]; do
  _env_line_no=$((_env_line_no + 1))
  _line="${_line%$'\r'}"
  _trimmed="${_line#"${_line%%[![:space:]]*}"}"
  # Blank and comment lines carry no assignment (same rule as preflight.mjs).
  case "$_trimmed" in
    ''|'#'*) continue ;;
  esac
  case "$_line" in
    *=*) ;;
    *) fail "env file line $_env_line_no is not KEY=value" ;;
  esac
  _key="${_line%%=*}"
  _value="${_line#*=}"
  case "$_key" in
    [A-Z]*) ;;
    *) fail "env file line $_env_line_no has an invalid key name" ;;
  esac
  case "$_key" in
    *[!A-Z0-9_]*) fail "env file line $_env_line_no has an invalid key name" ;;
  esac
  case " $ENV_ALLOWED_KEYS " in
    *" $_key "*) ;;
    *) fail "$_key is not an allowed setting" ;;
  esac
  # Duplicate key: last-wins would hide a mistyped earlier value.
  if [ -n "${!_key+set}" ]; then fail "$_key is duplicated"; fi
  # Empty is legitimate (WAHA_WEBHOOK_URL=); anything outside the safe charset
  # is rejected BEFORE it is ever assigned.
  case "$_value" in
    *[!A-Za-z0-9._:/-]*)
      fail "$_key has an unsupported value: use unquoted [A-Za-z0-9._:/-] only (no spaces, quotes, \$, interpolation or comments)"
      ;;
  esac
  # Assignment from an already-validated name/charset — not `eval`, not `source`.
  printf -v "$_key" '%s' "$_value"
done < "$ENV_FILE"

# Validation of every compose-required field happens BEFORE any mutation,
# pull or container start (gates 4/5 run only after this point).
[ -n "${WAHA_IMAGE_DIGEST:-}" ] || fail "WAHA_IMAGE_DIGEST is unset"
[[ "$WAHA_IMAGE_DIGEST" =~ ^[0-9a-f]{64}$ ]] || fail "WAHA_IMAGE_DIGEST must be 64-hex"
[ -n "${WAHA_ENGINE:-}" ] || fail "WAHA_ENGINE is unset"
[[ "$WAHA_ENGINE" =~ ^(WEBJS|GOWS|NOWEB)$ ]] || fail "WAHA_ENGINE must be WEBJS, GOWS or NOWEB"
[ -n "${WAHA_API_KEY_HASH:-}" ] || fail "WAHA_API_KEY_HASH is unset"
[[ "$WAHA_API_KEY_HASH" =~ ^sha512:[0-9a-fA-F]{128}$ ]] || fail "WAHA_API_KEY_HASH must be sha512:<128 hex>"
[ -n "${WAHA_SWAGGER_USERNAME:-}" ] || fail "WAHA_SWAGGER_USERNAME is unset"
[[ "$WAHA_SWAGGER_USERNAME" =~ ^[A-Za-z0-9._-]{1,64}$ ]] || fail "WAHA_SWAGGER_USERNAME must be 1-64 chars of letters, digits, dot, underscore or hyphen"
# NOTE: `${#VAR:-default}` is invalid bash ("bad substitution"): presence is
# checked first, then the length — never combined.
[ -n "${WAHA_SWAGGER_PASSWORD:-}" ] || fail "WAHA_SWAGGER_PASSWORD is unset"
[ "${#WAHA_SWAGGER_PASSWORD}" -ge 24 ] || fail "WAHA_SWAGGER_PASSWORD must be at least 24 chars"
[ -n "${WAHA_WEBHOOK_HMAC_KEY:-}" ] || fail "WAHA_WEBHOOK_HMAC_KEY is unset"
# Charset EXATO da regra canônica (`^[A-Za-z0-9_-]{32,}$`): só o tamanho não
# basta — um valor de 32+ chars com `.` ou `/` passava aqui e era rejeitado
# pelo preflight.mjs, deixando os dois validados em desacordo.
[[ "$WAHA_WEBHOOK_HMAC_KEY" =~ ^[A-Za-z0-9_-]{32,}$ ]] || fail "WAHA_WEBHOOK_HMAC_KEY must be high entropy and at least 32 chars of letters, digits, underscore or hyphen"
if [ -n "${WAHA_WEBHOOK_URL:-}" ]; then
  validate_waha_webhook_url "$WAHA_WEBHOOK_URL" \
    || fail "WAHA_WEBHOOK_URL must be an https URL with no credentials, query or fragment, a canonical host, a port without leading zeros and the exact path /api/whatsapp/waha"
fi

PINNED_IMAGE="$IMAGE_REPO@sha256:$WAHA_IMAGE_DIGEST"
log "preflight passed (engine=$WAHA_ENGINE, webhook_url_set=$([ -n "${WAHA_WEBHOOK_URL:-}" ] && echo yes || echo no))"
log "plan: pull $IMAGE_REPO@sha256:<pinned-64hex> | verify RepoDigest | compose up loopback-only | health smoke"

if [ "$APPLY" != "yes" ]; then
  log "dry-run complete: no image pulled, no container started. Re-run with --apply."
  exit 0
fi

# Single-writer cutover authority: from here on this process owns the WAHA
# deploy. Filesystem mutations (install dir, lock) happen ONLY on the apply
# path — dry-run never touches the disk beyond reading the env file.
mkdir -p "$INSTALL_DIR"
exec 9>"$LOCKFILE"
flock -n 9 || fail "another deploy is already running"
command -v docker >/dev/null 2>&1 || fail "docker not found"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found at $COMPOSE_FILE"

log "pulling pinned image"
docker pull "$PINNED_IMAGE" || fail "docker pull failed"

log "verifying pulled RepoDigest equals pinned value"
PULLED_REF="$(docker image inspect "$PINNED_IMAGE" --format '{{index .RepoDigests 0}}' 2>/dev/null || true)"
[ -n "$PULLED_REF" ] || fail "could not read pulled RepoDigest"
[ "$PULLED_REF" = "$PINNED_IMAGE" ] || fail "RepoDigest mismatch: pulled image is NOT the pinned one; refusing to start"

log "starting loopback-only stack"
WAHA_IMAGE_DIGEST="$WAHA_IMAGE_DIGEST" docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d || fail "compose up failed"

log "waiting for healthy (up to ${HEALTH_TIMEOUT_SEC}s)"
READY="no"
for _ in $(seq 1 "$HEALTH_TIMEOUT_SEC"); do
  STATUS="$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER" 2>/dev/null || echo "unknown")"
  if [ "$STATUS" = "healthy" ]; then READY="yes"; break; fi
  sleep 1
done
[ "$READY" = "yes" ] || fail "container did not become healthy"

log "loopback health smoke"
curl -sf --max-time 10 "$HEALTH_URL" >/dev/null || fail "loopback /health smoke failed"

ENGINE_LIVE="$(docker exec "$CONTAINER" printenv WHATSAPP_DEFAULT_ENGINE 2>/dev/null || echo "?")"
log "deploy complete (engine=$ENGINE_LIVE, RepoDigest verified, loopback-only, webhook_url pending installation mapping)"
