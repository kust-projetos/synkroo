#!/bin/bash
# Deploy WAHA on the Contabo target (loopback-only, pinned digest).
#
# Versioned here; at deploy time the operator copies this file plus
# `docker-compose.yml` to /opt/synkroo/waha/ on the target and runs it there
# over SSH. It NEVER runs from a developer workstation against production.
#
# Usage:
#   ./deploy-waha.sh /opt/synkroo/waha/.env            # dry-run: validate + plan only
#   ./deploy-waha.sh /opt/synkroo/waha/.env --apply    # pull pinned image + up
#
# Gates (fail closed, in order):
#   1. env file exists and is mode 0600 (no group/other/special bits);
#   2. single execution (flock);
#   3. required settings present and well-formed (names only in output);
#   4. (--apply only) pull by immutable RepoDigest, then verify the pulled
#      RepoDigest EQUALS the pinned value — any mismatch aborts before `up`;
#   5. (--apply only) compose up, wait for healthy, loopback /health smoke.
#
# Secret handling: values are never printed. The compose file receives only
# the API-key HASH (sha512:...); the raw key lives in server-side app secrets.
# Passwords may contain any characters: the file is sourced (operator-written,
# 0600), never parsed with regexes that would mangle values.
#
# Session backup is intentionally NOT part of this script: no session exists
# until QR pairing (canary window). P3.4 defines confidentiality/encryption/
# retention/restore before a real session is used. Never copy an Evolution or
# Hostinger session into the session volume.

set -euo pipefail

IMAGE_REPO="devlikeapro/waha"
INSTALL_DIR="/opt/synkroo/waha"
COMPOSE_FILE="${WAHA_COMPOSE_FILE:-$INSTALL_DIR/docker-compose.yml}"
LOCKFILE="$INSTALL_DIR/.deploy.lock"
CONTAINER="synkroo-waha-candidate"
HEALTH_URL="http://127.0.0.1:3000/health"
HEALTH_TIMEOUT_SEC=180

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
fail() { log "DEPLOY FAILED: $1"; exit 1; }

ENV_FILE="${1:?usage: $0 /path/to/private/waha/.env [--apply]}"
APPLY="no"
if [ "${2:-}" = "--apply" ]; then APPLY="yes"; fi

[ -f "$ENV_FILE" ] || fail "private env file not found"
ENV_MODE="$(stat -c '%a' "$ENV_FILE" 2>/dev/null || stat -f '%Lp' "$ENV_FILE" 2>/dev/null || echo "?")"
[ "$ENV_MODE" = "600" ] || fail "private env file must be mode 0600 (saw $ENV_MODE)"

mkdir -p "$INSTALL_DIR"
exec 9>"$LOCKFILE"
flock -n 9 || fail "another deploy is already running"

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

[ -n "${WAHA_IMAGE_DIGEST:-}" ] || fail "WAHA_IMAGE_DIGEST is unset"
[[ "$WAHA_IMAGE_DIGEST" =~ ^[0-9a-f]{64}$ ]] || fail "WAHA_IMAGE_DIGEST must be 64-hex"
[ -n "${WAHA_ENGINE:-}" ] || fail "WAHA_ENGINE is unset"
[[ "$WAHA_ENGINE" =~ ^(WEBJS|GOWS|NOWEB)$ ]] || fail "WAHA_ENGINE must be WEBJS, GOWS or NOWEB"
[ -n "${WAHA_API_KEY_HASH:-}" ] || fail "WAHA_API_KEY_HASH is unset"
[[ "$WAHA_API_KEY_HASH" =~ ^sha512:[0-9a-fA-F]{128}$ ]] || fail "WAHA_API_KEY_HASH must be sha512:<128 hex>"
[ "${#WAHA_SWAGGER_PASSWORD:-}" -ge 24 ] || fail "WAHA_SWAGGER_PASSWORD must be at least 24 chars"
[ "${#WAHA_WEBHOOK_HMAC_KEY:-}" -ge 32 ] || fail "WAHA_WEBHOOK_HMAC_KEY must be at least 32 chars"
if [ -n "${WAHA_WEBHOOK_URL:-}" ]; then
  [[ "$WAHA_WEBHOOK_URL" =~ ^https://[^?#]*\/api/whatsapp/waha$ ]] || fail "WAHA_WEBHOOK_URL must be HTTPS ending at /api/whatsapp/waha"
fi

PINNED_IMAGE="$IMAGE_REPO@sha256:$WAHA_IMAGE_DIGEST"
log "preflight passed (engine=$WAHA_ENGINE, webhook_url_set=$([ -n "${WAHA_WEBHOOK_URL:-}" ] && echo yes || echo no))"
log "plan: pull $IMAGE_REPO@sha256:<pinned-64hex> | verify RepoDigest | compose up loopback-only | health smoke"

if [ "$APPLY" != "yes" ]; then
  log "dry-run complete: no image pulled, no container started. Re-run with --apply."
  exit 0
fi

# Single-writer cutover authority: from here on this process owns the WAHA deploy.
command -v docker >/dev/null 2>&1 || fail "docker not found"
[ -f "$COMPOSE_FILE" ] || fail "compose file not found at $COMPOSE_FILE"

log "pulling pinned image"
docker pull "$PINNED_IMAGE" || fail "docker pull failed"

log "verifying pulled RepoDigest equals pinned value"
PULLED_DIGEST="$(docker images --digests --format '{{.Repository}}:{{.Tag}} {{.Digest}}' 2>/dev/null | awk -v repo="$IMAGE_REPO" '$1==repo {print $2}' | head -1)"
[ -n "$PULLED_DIGEST" ] || fail "could not read pulled digest"
[ "$PULLED_DIGEST" = "sha256:$WAHA_IMAGE_DIGEST" ] || fail "RepoDigest mismatch: pulled image is NOT the pinned one; refusing to start"

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
