#!/bin/bash
# Backup diário do stack Synkroo na VPS target (Contabo).
# Espelha o padrão do backup.sh da source (/home/deploy/infra/backup/):
# dump lógico + volume físico + configs, com retenção e off-host (rclone).
#
# Instalação: /opt/synkroo/backup/backup-synkroo.sh (0750, deploy)
# Cron (deploy): 30 5 * * * /opt/synkroo/backup/backup-synkroo.sh >> /opt/synkroo/backup/cron.log 2>&1
# (= 03:30 UTC, mesmo horário do backup da source, sem colidir com o backup-pi às 03:30 CEST)
#
# Ping de monitoramento: se /opt/synkroo/backup/.env definir BACKUP_HC_PING_URL,
# sucesso/falha são pingados (padrão healthchecks.io). Sem a variável, apenas loga.

set -euo pipefail

# PATH explícito: cron roda com ambiente mínimo.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# Artefatos contêm credenciais (tar inclui o .env) — nenhum arquivo legível por outros.
umask 077

BACKUP_DIR=/var/backups/synkroo
CONF_DIR=/opt/synkroo/synkroo-prod-postgres
SCRIPT_DIR=/opt/synkroo/backup
TS=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
RETENTION=14
CONTAINER=synkroo-prod-postgres
LOCKFILE=/var/backups/synkroo/.backup.lock

[ -f "$SCRIPT_DIR/.env" ] && set -a && . "$SCRIPT_DIR/.env" && set +a

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$BACKUP_DIR/backup.log"; }
cleanup() { rm -rf "$WORK" 2>/dev/null || true; }
fail() {
  log "FALHOU: $*"
  cleanup
  [ -n "${BACKUP_HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${BACKUP_HC_PING_URL}/fail" -d "$*" >/dev/null 2>&1 || true
  exit 1
}
trap 'fail "erro inesperado na linha $LINENO"' ERR

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Uma execução por vez (execuções manuais + cron não podem sobrepor).
exec 9>"$LOCKFILE"
flock -n 9 || fail "outra execução de backup já está em curso"

log "iniciando backup synkroo"

# Configs (inclui .env com credenciais — necessário para restore standalone;
# arquivo 0600 e destino off-host privado, mesmo padrão da source).
sudo tar -czf "$WORK/synkroo-configs.tar.gz" -C /opt/synkroo synkroo-prod-postgres
sudo chown "$(id -u):$(id -g)" "$WORK/synkroo-configs.tar.gz"

# Dump lógico (rota canônica docker exec — unix socket, sem rede).
# É o artefato canônico do runbook §5.2; NÃO é feito tar físico do datadir
# (cópia a quente via tar não é consistente e pode abortar com
# "file changed as we read it").
docker exec "$CONTAINER" pg_dump -U synkroo -d synkroo -Fc > "$WORK/synkroo-$TS.dump"

# A staging nasce só quando o setup-staging-db rodar (depende da rota TCP/tunnel
# no target). A query é checada separadamente: falha de conexão/execução ABORTA;
# só a resposta vazia (banco realmente ausente) pula o dump de staging.
if ! staging_row=$(docker exec "$CONTAINER" psql -U synkroo -d postgres -At -c \
     "SELECT 1 FROM pg_database WHERE datname = 'synkroo_staging'"); then
  fail "query de existência da staging falhou"
fi
if [ "$staging_row" = "1" ]; then
  docker exec "$CONTAINER" pg_dump -U synkroo -d synkroo_staging -Fc > "$WORK/synkroo_staging-$TS.dump"
else
  log "aviso: synkroo_staging ainda não existe no target — dump de staging pulado"
fi

sha256sum "$WORK"/* > "$BACKUP_DIR/manifest-$TS.sha256"
tar -czf "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" -C "$WORK" .
chmod 600 "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" "$BACKUP_DIR/manifest-$TS.sha256"
cleanup

# Off-host: move para o Google Drive se rclone estiver configurado; sem isso o
# local é preservado (a pendência "backup off-host" só fecha com o rclone ok).
if [ -f "$SCRIPT_DIR/rclone.conf" ] && command -v rclone >/dev/null 2>&1; then
  rclone move "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" "gdrive:synkroo-contabo-backups/" \
    --config "$SCRIPT_DIR/rclone.conf" >> "$BACKUP_DIR/backup.log" 2>&1 \
    || log "aviso: rclone falhou (backup local preservado)"
else
  log "aviso: rclone não configurado — backup apenas local"
fi

# Retenção local.
find "$BACKUP_DIR" -name 'synkroo-backup-*.tar.gz' -mtime +"$RETENTION" -delete
find "$BACKUP_DIR" -name 'manifest-*.sha256' -mtime +"$RETENTION" -delete

log "backup concluido: synkroo-backup-$TS.tar.gz"
[ -n "${BACKUP_HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${BACKUP_HC_PING_URL:-}" >/dev/null 2>&1 || true
