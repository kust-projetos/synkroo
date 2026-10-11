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

# Paths com default de produção; overrides servem só ao harness de teste local
# (scripts/__tests__/contabo-backup-synkroo.test.mjs) — sem override, o
# comportamento em produção é idêntico ao original.
BACKUP_DIR="${BACKUP_DIR:-/var/backups/synkroo}"
CONF_DIR="${CONF_DIR:-/opt/synkroo/synkroo-prod-postgres}"
SCRIPT_DIR="${SCRIPT_DIR:-/opt/synkroo/backup}"
TS=$(date +%Y%m%d-%H%M%S)
WORK=$(mktemp -d)
RETENTION=14
CONTAINER=synkroo-prod-postgres
LOCKFILE="$BACKUP_DIR/.backup.lock"

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
# -C/basename derivados de CONF_DIR: com o default produzem exatamente
# `-C /opt/synkroo synkroo-prod-postgres`.
sudo tar -czf "$WORK/synkroo-configs.tar.gz" -C "$(dirname "$CONF_DIR")" "$(basename "$CONF_DIR")"
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

# Manifest portátil: checksums com nomes RELATIVOS — exatamente os membros do
# tar ("-C $WORK .") — e gerado DENTRO de $WORK antes do tar, para viajar no
# archive: o tar é o único artefato movido para off-host, então sem o manifest
# embutido a verificação do restore não teria fonte. O manifest não se auto-
# hasheia (o glob é expandido antes do redirecionamento criá-lo). A cópia em
# BACKUP_DIR é adjacente, para conferir o arquivo local antes do move.
(cd "$WORK" && sha256sum ./* > "manifest-$TS.sha256")
cp "$WORK/manifest-$TS.sha256" "$BACKUP_DIR/manifest-$TS.sha256"
tar -czf "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" -C "$WORK" .
chmod 600 "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" "$BACKUP_DIR/manifest-$TS.sha256"
cleanup

# Off-host faz parte do contrato do backup: sem rclone configurado ou com falha
# no move, o backup NÃO está completo. A falha preserva o arquivo local, loga,
# pinga /fail e encerra com código != 0 — nunca pinga sucesso nem registra
# "concluido".
if [ ! -f "$SCRIPT_DIR/rclone.conf" ]; then
  fail "rclone não configurado — $SCRIPT_DIR/rclone.conf ausente (backup local preservado)"
fi
if ! command -v rclone >/dev/null 2>&1; then
  fail "rclone não instalado — backup off-host indisponível (backup local preservado)"
fi
if ! rclone move "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" "gdrive:synkroo-contabo-backups/" \
     --config "$SCRIPT_DIR/rclone.conf" >> "$BACKUP_DIR/backup.log" 2>&1; then
  fail "rclone move falhou (backup local preservado)"
fi

# Retenção local.
find "$BACKUP_DIR" -name 'synkroo-backup-*.tar.gz' -mtime +"$RETENTION" -delete
find "$BACKUP_DIR" -name 'manifest-*.sha256' -mtime +"$RETENTION" -delete

log "backup concluido: synkroo-backup-$TS.tar.gz"
[ -n "${BACKUP_HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${BACKUP_HC_PING_URL:-}" >/dev/null 2>&1 || true
