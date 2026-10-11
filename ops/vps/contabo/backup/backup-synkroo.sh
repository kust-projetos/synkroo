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
#
# Retenção local: itens com mais de RETENTION (14) dias são podados LOGO APÓS a
# criação do archive local e ANTES do gate off-host — inclusive nos caminhos de
# falha. Antes a retenção só existia no caminho de sucesso: com rclone fora do
# ar, cada execução criava um archive local e saía por fail() antes de podar,
# acumulando archives sem limite. Risco residual aceito e registrado em log:
# sem cópia off-host, os únicos pontos de recuperação são locais e expiram
# após 14 dias; o status off-host continua fail-closed (exit 1, ping /fail,
# nunca ping de sucesso nem "backup concluido").

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

# Falha off-host: fail-closed (exit != 0, ping /fail, sem sucesso). A retenção
# local JÁ rodou, então registra no log que a retenção foi aplicada com o
# off-host indisponível e qual o risco residual da falta de cópia off-host.
fail_offhost() {
  log "off-host indisponível — retenção local aplicada; risco residual: sem cópia off-host, pontos de recuperação only-local expiram após ${RETENTION} dias"
  fail "$1"
}

# Retenção local: poda apenas archives/manifests com mais de RETENTION dias.
# É chamada depois de o archive atual existir (mtime agora nunca é podado) e
# antes do gate off-host, para que falhas repetidas de off-host (rclone fora)
# não acumulem archives locais indefinidamente.
#
# Erros do find são propagados EXPLICITAMENTE (`|| return 1`): o trap ERR do
# topo não é herdado por funções sem `set -E` (errtrace), então um find que
# falhasse aqui sairia por set -e sem log, sem ping /fail e sem cleanup. O
# caller trata a falha com fail() (contrato fail-closed).
prune_local_backups() {
  find "$BACKUP_DIR" -name 'synkroo-backup-*.tar.gz' -mtime +"$RETENTION" -delete || return 1
  find "$BACKUP_DIR" -name 'manifest-*.sha256' -mtime +"$RETENTION" -delete || return 1
}

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

# Retenção local antes do gate off-host (doc no topo): o archive atual e o
# manifest adjacente acabaram de nascer e nunca são podados aqui; apenas itens
# com mais de RETENTION dias saem. Roda também quando o off-host falha abaixo.
#
# Falha na retenção é fail-closed: find (ex.: permissão/IO em BACKUP_DIR)
# propagada pela função e tratada aqui com fail() — exit 1, FALHOU, ping /fail,
# sem sucesso. Nada de depender do trap ERR, que não vale dentro de função.
if ! prune_local_backups; then
  fail "retenção local falhou — find não podou em $BACKUP_DIR (backup local preservado)"
fi

# Off-host faz parte do contrato do backup: sem rclone configurado ou com falha
# no move, o backup NÃO está completo. A falha preserva o arquivo local, loga,
# pinga /fail e encerra com código != 0 — nunca pinga sucesso nem registra
# "concluido". A retenção local já rodou (prune_local_backups); fail_offhost
# registra o risco residual de só existirem pontos de recuperação locais.
if [ ! -f "$SCRIPT_DIR/rclone.conf" ]; then
  fail_offhost "rclone não configurado — $SCRIPT_DIR/rclone.conf ausente (backup local preservado)"
fi
if ! command -v rclone >/dev/null 2>&1; then
  fail_offhost "rclone não instalado — backup off-host indisponível (backup local preservado)"
fi
if ! rclone move "$BACKUP_DIR/synkroo-backup-$TS.tar.gz" "gdrive:synkroo-contabo-backups/" \
     --config "$SCRIPT_DIR/rclone.conf" >> "$BACKUP_DIR/backup.log" 2>&1; then
  fail_offhost "rclone move falhou (backup local preservado)"
fi

# Retenção local já aplicada acima (prune_local_backups), antes do gate.
log "backup concluido: synkroo-backup-$TS.tar.gz"
[ -n "${BACKUP_HC_PING_URL:-}" ] && curl -fsS -m 10 --retry 3 "${BACKUP_HC_PING_URL:-}" >/dev/null 2>&1 || true
