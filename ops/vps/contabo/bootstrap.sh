#!/usr/bin/env bash
#
# Synkroo — bootstrap e hardening idempotente do host Contabo (fase P2, §4).
#
# Runbook: docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md
#          §4 "Contabo foundation" (itens Host e Redes).
#
# Uso (executar como root em host NOVO Ubuntu 24.04):
#   1) dry-run (default — imprime o plano inteiro e não muta nada):
#        ./bootstrap.sh --ssh-key-file /root/.ssh/synkroo.pub
#   2) aplicar sem mexer no firewall, em UMA sessão root:
#        ./bootstrap.sh --ssh-key-file /root/.ssh/synkroo.pub --yes
#   3) COM A MESMA sessão root AINDA ABERTA, testar o login por chave do usuário
#      operacional num SEGUNDO terminal (root por senha já está bloqueado e o
#      script não instala chave de root). Sem isso você pode perder o acesso.
#   4) só então, DA MESMA sessão root ainda aberta, aplicar o firewall:
#        ./bootstrap.sh --ssh-key-file /root/.ssh/synkroo.pub --yes --apply-firewall
#
# Gates (lockout é o critério de aceite):
#   --yes             aplica as mudanças; SEM ele o script é dry-run e sai 0.
#                     Com --yes, --ssh-key-file passa a ser OBRIGATÓRIO: sem uma
#                     chave pública válida não há por onde entrar depois do
#                     hardening (aborta com exit 2 antes de qualquer mutação).
#   --apply-firewall  gate separado para a fase ufw (combinável com --yes).
#   --skip-docker     pula a fase Docker.
#
# NÃO implementado aqui (decisão do operador / fora do escopo do script):
#   - logs/monitoramento;
#   - backup off-host;
#   - qualquer regra pública para o PostgreSQL/5432 (runbook §4 Rede: o acesso
#     do Hyperdrive deve vir por túnel/rota validado, não por exposição global).

set -euo pipefail

# ─── Configuração (flags + defaults) ────────────────────────────────────────

ADMIN_USER='synkroo'
SSH_KEY_FILE=''
TIMEZONE='America/Sao_Paulo'
APPLY=0
APPLY_FIREWALL=0
SKIP_DOCKER=0

LOG_FILE='/var/log/synkroo-bootstrap.log'
LOG_READY=0

SSHD_DROPIN='/etc/ssh/sshd_config.d/00-synkroo-hardening.conf'
APP_DIR='/opt/synkroo'
BACKUP_DIR='/var/backups/synkroo'

usage() {
  cat <<'USAGE'
uso: bootstrap.sh [--admin-user <nome>] [--ssh-key-file <arquivo.pub>]
                  [--timezone <Area/Cidade>] [--yes] [--apply-firewall]
                  [--skip-docker] [-h|--help]

  --admin-user     usuário operacional a criar (default: synkroo)
  --ssh-key-file   arquivo com a(s) chave(s) pública(s) em formato authorized_keys
  --timezone       timezone do host (default: America/Sao_Paulo)
  --yes            aplica as mudanças (sem isso: dry-run, nada é mutado)
  --apply-firewall  aplica a fase ufw (default-deny); exige --yes
  --skip-docker    pula a instalação do Docker
USAGE
}

die() {
  printf '[bootstrap] ERRO: %s\n' "$*" >&2
  exit 2
}

log() {
  printf '[bootstrap] %s\n' "$*"
}

# Emite a linha de log e, quando estamos aplicando, também persiste no arquivo
# de log do host (auditoria pós-mudança).
emit() {
  printf '[bootstrap] %s\n' "$*"
  if [ "$APPLY" -eq 1 ] && [ "$LOG_READY" -eq 1 ]; then
    printf '[bootstrap] %s\n' "$*" >>"$LOG_FILE"
  fi
}

# run: executa um comando com argv (mostra o que faria no dry-run).
run() {
  emit "exec: $*"
  if [ "$APPLY" -eq 1 ]; then
    "$@"
  fi
}

# run_sh: executa um trecho de shell (mostra o que faria no dry-run).
run_sh() {
  emit "sh: $1"
  if [ "$APPLY" -eq 1 ]; then
    sh -c "$1"
  fi
}

# ─── Argumentos ─────────────────────────────────────────────────────────────

while [ "$#" -gt 0 ]; do
  case "$1" in
  --admin-user)
    [ "$#" -ge 2 ] || die '--admin-user exige um valor'
    ADMIN_USER="$2"
    shift 2
    ;;
  --ssh-key-file)
    [ "$#" -ge 2 ] || die '--ssh-key-file exige um valor'
    SSH_KEY_FILE="$2"
    shift 2
    ;;
  --timezone)
    [ "$#" -ge 2 ] || die '--timezone exige um valor'
    TIMEZONE="$2"
    shift 2
    ;;
  --yes)
    APPLY=1
    shift
    ;;
  --apply-firewall)
    APPLY_FIREWALL=1
    shift
    ;;
  --skip-docker)
    SKIP_DOCKER=1
    shift
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    die "argumento desconhecido: $1"
    ;;
  esac
done

# ─── Validação de entrada (roda em qualquer modo) ───────────────────────────

case "$ADMIN_USER" in
'' | *[!a-z_]*) die "nome de usuário inválido: $ADMIN_USER (use apenas [a-z_])" ;;
esac

if [ "$APPLY_FIREWALL" -eq 1 ] && [ "$APPLY" -ne 1 ]; then
  die '--apply-firewall exige --yes (dry-run não altera o firewall)'
fi

KEY_LINES=''
KEY_COUNT=0

# Hardening com zero chave utilizável = lockout garantido (o root por senha pode
# já estar bloqueado). Fail-closed ANTES de qualquer mutação e antes da checagem
# de root, para que a causa seja a flag ausente e não "não sou root".
if [ "$APPLY" -eq 1 ] && [ -z "$SSH_KEY_FILE" ]; then
  die 'modo --yes exige --ssh-key-file: sem uma chave pública o hardening de SSH deixa o host sem porta de entrada'
fi

if [ -n "$SSH_KEY_FILE" ]; then
  [ -f "$SSH_KEY_FILE" ] || die "--ssh-key-file não encontrado: $SSH_KEY_FILE"
  [ -r "$SSH_KEY_FILE" ] || die "--ssh-key-file ilegível: $SSH_KEY_FILE"
  KEY_LINES="$(grep -v '^[[:space:]]*$' "$SSH_KEY_FILE" || true)"
  [ -n "$KEY_LINES" ] || die "--ssh-key-file não contém nenhuma linha: $SSH_KEY_FILE"
  command -v ssh-keygen >/dev/null 2>&1 || die 'ssh-keygen não encontrado (instale openssh-client)'
fi

# Valida cada linha como chave pública real (nunca imprime a chave).
if [ -n "$KEY_LINES" ]; then
  KEY_TMP="$(mktemp)"
  # shellcheck disable=SC2064
  trap "rm -f '$KEY_TMP'" EXIT
  OLDIFS="$IFS"
  IFS='
'
  for key_line in $KEY_LINES; do
    [ -n "$key_line" ] || continue
    case "$key_line" in \#*) continue ;; esac
    printf '%s\n' "$key_line" >"$KEY_TMP"
    if ! ssh-keygen -l -f "$KEY_TMP" >/dev/null 2>&1; then
      IFS="$OLDIFS"
      die "linha inválida em --ssh-key-file (não é chave pública OpenSSH válida)"
    fi
    KEY_COUNT=$((KEY_COUNT + 1))
  done
  IFS="$OLDIFS"
  log "chave pública validada via ssh-keygen -l -f ($KEY_COUNT linha(s))"
fi

# Comentários e linhas vazias passam no grep acima mas não autenticam ninguém:
# em modo --yes isso seria travar o operador fora do host.
if [ "$APPLY" -eq 1 ] && [ "$KEY_COUNT" -eq 0 ]; then
  die 'modo --yes exige ao menos uma chave pública VÁLIDA em --ssh-key-file (o arquivo só tinha comentários ou linhas vazias)'
fi

if [ "$APPLY" -eq 1 ] && [ "$(id -u)" -ne 0 ]; then
  die 'modo --yes exige execução como root'
fi

# ─── Cabeçalho do plano ─────────────────────────────────────────────────────

CODENAME='bookworm'
if [ -r /etc/os-release ]; then
  # shellcheck disable=SC1091
  . /etc/os-release 2>/dev/null || true
  CODENAME="${VERSION_CODENAME:-bookworm}"
  [ -n "$CODENAME" ] || CODENAME='bookworm'
fi

if [ "$APPLY" -eq 1 ]; then
  : >>"$LOG_FILE"
  chmod 0640 "$LOG_FILE"
  LOG_READY=1
  log '=== início (modo aplicar) ==='
else
  log '=== início (modo dry-run — NENHUMA mudança será feita) ==='
fi

log "usuário operacional: $ADMIN_USER | timezone: $TIMEZONE | codename: $CODENAME"
log "firewall: $([ "$APPLY_FIREWALL" -eq 1 ] && printf 'APLICAR (default-deny)' || printf 'não aplicado nesta execução')"
log "docker: $([ "$SKIP_DOCKER" -eq 1 ] && printf 'ignorado (--skip-docker)' || printf 'a instalar')"
log ''

# ─── Fase 1: atualização do sistema + pacotes base ──────────────────────────

log 'FASE 1 — atualizar sistema e instalar pacotes base'
export DEBIAN_FRONTEND=noninteractive
run_sh 'DEBIAN_FRONTEND=noninteractive apt-get update'
run_sh 'DEBIAN_FRONTEND=noninteractive apt-get -y upgrade'
# fail2ban NÃO entra: não está no runbook §4.
run_sh 'DEBIAN_FRONTEND=noninteractive apt-get -y install ca-certificates curl gnupg ufw'

# ─── Fase 2: timezone e NTP ─────────────────────────────────────────────────

log 'FASE 2 — timezone e NTP'
if [ "$(timedatectl show -p Timezone --value 2>/dev/null || true)" = "$TIMEZONE" ]; then
  emit "timezone já é $TIMEZONE (sem mudança)"
else
  run timedatectl set-timezone "$TIMEZONE"
fi
if [ "$(timedatectl show -p NTP --value 2>/dev/null || true)" = 'yes' ]; then
  emit 'NTP já habilitado (sem mudança)'
else
  run timedatectl set-ntp true
fi

# ─── Fase 3: usuário operacional e acesso por chave ────────────────────────

log 'FASE 3 — usuário operacional + SSH por chave'
if id -u "$ADMIN_USER" >/dev/null 2>&1; then
  emit "usuário $ADMIN_USER já existe (sem criação)"
else
  run useradd --create-home --shell /bin/bash "$ADMIN_USER"
fi
if id -nG "$ADMIN_USER" 2>/dev/null | tr ' ' '\n' | grep -qx sudo; then
  emit "grupo sudo já aplicado a $ADMIN_USER (sem mudança)"
else
  run usermod -aG sudo "$ADMIN_USER"
fi

AUTH_KEYS="/home/$ADMIN_USER/.ssh/authorized_keys"
run install -d -m 0700 -o "$ADMIN_USER" -g "$ADMIN_USER" "/home/$ADMIN_USER/.ssh"

if [ -z "$KEY_LINES" ]; then
  emit "ATENÇÃO: --ssh-key-file ausente — a pasta .ssh foi criada mas NENHUM acesso por chave foi configurado"
  emit "ATENÇÃO: configure a chave do operador antes de aplicar o hardening de SSH"
else
  if [ -f "$AUTH_KEYS" ]; then
    emit "authorized_keys existe em $AUTH_KEYS — as linhas abaixo serão apenas ACRESCENTADAS (nunca sobrescritas)"
  else
    run install -m 0600 -o "$ADMIN_USER" -g "$ADMIN_USER" /dev/null "$AUTH_KEYS"
  fi
  # Append-only: nada é sobrescrito, nada é duplicado.
  OLDIFS="$IFS"
  IFS='
'
  for key_line in $KEY_LINES; do
    [ -n "$key_line" ] || continue
    case "$key_line" in \#*) continue ;; esac
    KEY_TMP="$(mktemp)"
    printf '%s\n' "$key_line" >"$KEY_TMP"
    KEY_FP="$(ssh-keygen -l -f "$KEY_TMP" 2>/dev/null || true)"
    rm -f "$KEY_TMP"
    if [ -f "$AUTH_KEYS" ] && grep -qxF "$key_line" "$AUTH_KEYS"; then
      emit "authorized_keys: chave ${KEY_FP:-desconhecida} já presente (preservada)"
    else
      emit "authorized_keys: acrescentando chave ${KEY_FP:-desconhecida}"
      # A chave é pública; mesmo assim só o fingerprint é exibido no log.
      if [ "$APPLY" -eq 1 ]; then
        printf '%s\n' "$key_line" >>"$AUTH_KEYS"
        chown "$ADMIN_USER:$ADMIN_USER" "$AUTH_KEYS"
        chmod 0600 "$AUTH_KEYS"
      fi
    fi
  done
  IFS="$OLDIFS"
fi

# ─── Fase 4: hardening do SSHD (drop-in + validação antes do reload) ───────

log 'FASE 4 — hardening do SSHD (drop-in)'
run install -d -m 0755 /etc/ssh/sshd_config.d

SSHD_CONTENT='# Synkroo — hardening do host de produção (runbook §4, política aprovada).
# Prefixo 00- é obrigatório: o sshd usa o PRIMEIRO valor obtido e ubuntu/24.04
# pode trazer 50-cloud-init.conf com `PasswordAuthentication yes`; um drop-in
# 50- (ou 60-) seria ignorado. Ver sshd_config(5) e a checagem `sshd -T` abaixo.
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
X11Forwarding no'

if [ -f "$SSHD_DROPIN" ] && grep -qxF 'PasswordAuthentication no' "$SSHD_DROPIN" &&
  grep -qxF 'PermitRootLogin prohibit-password' "$SSHD_DROPIN"; then
  emit "drop-in $SSHD_DROPIN já contém o hardening esperado (sem mudança)"
else
  emit "sh: grava drop-in de hardening em $SSHD_DROPIN"
  if [ "$APPLY" -eq 1 ]; then
    printf '%s\n' "$SSHD_CONTENT" >"$SSHD_DROPIN"
  fi
  run chmod 0644 "$SSHD_DROPIN"
fi

# Valida a configuração ANTES de qualquer reload: um drop-in inválido derrubaria
# o sshd e o operador perderia o acesso remoto.
emit 'sh: /usr/sbin/sshd -t   (valida antes do reload — se falhar, nada é recarregado)'
if [ "$APPLY" -eq 1 ]; then
  /usr/sbin/sshd -t
fi
run systemctl reload ssh

# Gate pós-reload: confere a política EFETIVA, não o conteúdo do arquivo. Um
# drop-in anterior (ex.: 50-cloud-init.conf) com `PasswordAuthentication yes`
# vence o nosso por precedência e o host continua aceitando senha — daí o
# fail-closed: se `sshd -T` não rodar (sem contexto de host, sem host key, sem
# permissão) ou devolver um valor diferente do pretendido, ABORTA com exit != 0.
emit 'sh: /usr/sbin/sshd -T   (política EFETIVA: fail-closed se não bater)'
emit '   esperado: passwordauthentication no | kbdinteractiveauthentication no | permitrootlogin prohibit-password|without-password'
if [ "$APPLY" -eq 1 ]; then
  SSHD_EFFECTIVE="$(/usr/sbin/sshd -T 2>/dev/null || true)"
  if [ -z "$SSHD_EFFECTIVE" ]; then
    printf '[bootstrap] ERRO: `sshd -T` não devolveu a política efetiva — impossível provar o hardening (fail-closed, exit 3).\n' >&2
    printf '[bootstrap]   Rode como root para diagnosticar: /usr/sbin/sshd -T\n' >&2
    printf '[bootstrap]   Se precisar de contexto de host: /usr/sbin/sshd -T -C user=root,host="$(hostname)",addr=127.0.0.1\n' >&2
    exit 3
  fi
  for expected in 'passwordauthentication no' 'kbdinteractiveauthentication no' 'permitrootlogin prohibit-password|without-password'; do
    sshd_key="${expected%% *}"
    sshd_want_variants="${expected#* }"
    sshd_line="$(printf '%s\n' "$SSHD_EFFECTIVE" | grep -i "^${sshd_key} " | head -n1 || true)"
    sshd_got="${sshd_line#* }"
    # `prohibit-password` e `without-password` são o MESMO valor para o sshd
    # (PERMIT_NO_PASSWD); versões do OpenSSH formatam o dump `sshd -T` com um
    # ou outro alias. A política está correta se o efetivo for qualquer um deles.
    sshd_ok=""
    sshd_want_display=""
    IFS='|' read -r -a sshd_variants <<< "$sshd_want_variants"
    for sshd_v in "${sshd_variants[@]}"; do
      sshd_want_display="${sshd_want_display:+$sshd_want_display|}$sshd_v"
      if [ "${sshd_got,,}" = "$sshd_v" ]; then
        sshd_ok="$sshd_v"
      fi
    done
    if [ -z "$sshd_ok" ]; then
      printf '[bootstrap] ERRO: política sshd EFETIVA diverge — %s="%s" (esperado "%s").\n' "$sshd_key" "${sshd_got:-<ausente>}" "$sshd_want_display" >&2
      printf '[bootstrap]   Valores efetivos agora: %s\n' "$(printf '%s\n' "$SSHD_EFFECTIVE" | grep -iE '^(passwordauthentication|kbdinteractiveauthentication|permitrootlogin) ' | tr '\n' ' ')" >&2
      printf '[bootstrap]   O sshd usa o PRIMEIRO valor obtido: um drop-in que ordena antes do nosso está vencendo (ex.: 50-cloud-init.conf).\n' >&2
      printf '[bootstrap]   Diagnóstico: sshd -T | grep -iE "password|kbdinteractive|permitroot"\n' >&2
      printf '[bootstrap]   Remova/renomeie o drop-in conflitante e rode o script de novo. ABORTADO (exit 3).\n' >&2
      exit 3
    fi
    emit "sshd -T: ${sshd_key}=${sshd_got} (efetivo — bate com a política)"
  done
fi

emit '################################################################'
emit '# ATENÇÃO: login por senha e root-senha foram desabilitados.'
emit '# ABRA UM SEGUNDO TERMINAL AGORA e valide o login por chave:'
emit "#   ssh ${ADMIN_USER}@<ip-do-host>"
emit '# NÃO feche esta sessão root: ela é o caminho para (a) corrigir o'
emit '# authorized_keys e (b) rodar --apply-firewall depois (root por senha já'
emit '# está bloqueado e o script não instala chave de root).'
emit '# Se o login por chave NÃO funcionar, você vai ficar fora do host.'
emit '# Recuperação: console do painel Contabo (ver ops/vps/contabo/README.md).'
emit '################################################################'

# ─── Fase 5: firewall default-deny (gate explícito) ─────────────────────────

log 'FASE 5 — firewall default-deny (ufw)'
if [ "$APPLY_FIREWALL" -ne 1 ]; then
  emit 'PULADA: --apply-firewall não informado (regra deliberada — rode só depois de validar o login por chave)'
else
  # Ordem obrigatória: default-deny -> allow OpenSSH -> só então habilitar.
  # Habilitar o ufw sem a regra do SSH tranca o operador para fora.
  run_sh 'ufw default deny incoming'
  run_sh 'ufw default allow outgoing'
  run_sh 'ufw allow OpenSSH'
  run_sh 'ufw --force enable'
  run_sh 'ufw status verbose'
  emit 'PostgreSQL (5432) NÃO recebe regra pública aqui — o Hyperdrive deve chegar por túnel/rota validado à parte (runbook §4 Rede).'
  emit 'Não repita a regra de firewall que já quebrou o Hyperdrive antes sem identificar a origem real do tráfego.'
fi

# ─── Fase 6: Docker + Compose ───────────────────────────────────────────────

log 'FASE 6 — Docker + Compose'
if [ "$SKIP_DOCKER" -eq 1 ]; then
  emit 'PULADA: --skip-docker informado'
else
  if dpkg -s docker-ce >/dev/null 2>&1; then
    emit 'docker-ce já instalado (repositório/apt ignorados)'
  else
    run install -m 0755 -d /etc/apt/keyrings
    run_sh 'curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc'
    run chmod a+r /etc/apt/keyrings/docker.asc
    run_sh "echo \"deb [arch=\$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable\" > /etc/apt/sources.list.d/docker.list"
    run_sh 'DEBIAN_FRONTEND=noninteractive apt-get update'
    run_sh 'DEBIAN_FRONTEND=noninteractive apt-get -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin'
    run systemctl enable --now docker
  fi
  if id -nG "$ADMIN_USER" 2>/dev/null | tr ' ' '\n' | grep -qx docker; then
    emit "grupo docker já aplicado a $ADMIN_USER (sem mudança)"
  else
    run usermod -aG docker "$ADMIN_USER"
    emit "RISCO: o grupo docker equivale a root — $ADMIN_USER passa a ter poder total no host."
    emit 'Reautentique a sessão (re-login) para o grupo docker ter efeito.'
  fi
fi

# ─── Fase 7: diretórios da aplicação e de backup ────────────────────────────

log 'FASE 7 — diretórios /opt/synkroo e /var/backups/synkroo'
for target_dir in "$APP_DIR" "$BACKUP_DIR"; do
  if [ -d "$target_dir" ]; then
    emit "$target_dir já existe (sem mudança)"
  else
    run install -d -o "$ADMIN_USER" -g "$ADMIN_USER" -m 0750 "$target_dir"
  fi
done

# ─── Fase 8: resumo e pendências ────────────────────────────────────────────

log ''
log '=== RESUMO ==='
if [ "$APPLY" -eq 1 ]; then
  log 'modo: aplicar — as fases acima foram executadas (idempotentes)'
  log "log da execução: $LOG_FILE"
else
  log 'modo: dry-run — NADA foi alterado neste host'
  log 'para aplicar: reexecute com --yes (e --apply-firewall só após validar o login por chave)'
fi
log ''
log 'PENDÊNCIAS (decisão do operador — NÃO implementadas por este script):'
log '  [TODO] logs/monitoramento (runbook §4 "configurar logs/monitoramento") — definir stack e alertas.'
log '  [TODO] backup off-host (runbook §4 "configurar backup off-host") — destino, credencial e retenção.'
log '  [TODO] espaço e inode (runbook §4 "garantir espaço e inode") — verificar: df -h / && df -i /'
log '  [TODO] validar `ssh '"$ADMIN_USER"'@<host>` a partir de um segundo terminal.'
log '  [TODO] origem real do tráfego do Hyperdrive antes de qualquer regra de rede (§4 Rede).'
log ''
log 'PRÓXIMOS PASSOS: runbook §5 (migração PostgreSQL). Nada de dado é movido por este script.'

exit 0
