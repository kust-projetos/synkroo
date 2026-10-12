#!/usr/bin/env bash
# =============================================================================
# ops/vps/inventory/collect-inventory.sh
#
# Coleta o INVENTÁRIO de metadados de uma VPS Synkroo (source ou target) para a
# migração de infraestrutura. Gera UM arquivo de texto com o output das
# comandos listados no runbook de migração, seção §3 ("Inventário obrigatório"),
# e aplica uma camada de REDAÇÃO antes de gravar o arquivo em disco.
#
# Finalidade
#   - Levantar, antes de qualquer dump/cópia, o que existe no host: containers,
#     imagens, redes, volumes, timers, cron, portas em escuta, espaço e memória.
#   - Servir de insumo para o checklist "Descobrir" da fase P2.
#   - Nada além de METADADOS: o script não copia dump, volume, log nem config.
#
# Referência
#   docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md §3
#   §3 exige: "Nunca copiar output contendo secret para issue/commit."
#
# Uso (executa NA VPS de destino da coleta; o script não é provider-specific)
#   bash collect-inventory.sh --side=source
#   bash collect-inventory.sh --side=target --out /root/inventario
#   ssh user@host 'bash -s -- --side=source' < collect-inventory.sh
#
# Contrato
#   --side=source|target  OBRIGATÓRIO (fail-closed: ausente/inválido imprime o
#                         uso em stderr e sai com código 1, sem coletar nada).
#                         source = a VPS da qual os dados são COPIADOS;
#                         target = a VPS para a qual são copiados.
#   --out <dir>           Diretório de saída (default: diretório atual). O
#                         arquivo é inventory-<side>-<timestamp UTC>.txt.
#
# Garantias
#   - `set -u` e NÃO `set -e`: cada coleta é best-effort. Binário ausente ou
#     permissão negada vira a linha "[indisponível: <cmd>]" e a coleta segue.
#   - `sudo -n` (não interativo) com fallback para o comando sem sudo; nunca
#     abre prompt de senha (importante para execução via ssh/scp automatizado).
#   - Nenhuma chamada de rede. Nenhum valor de variável de ambiente é lido,
#     impresso ou gravado. Nenhuma escrita fora de --out.
#   - REDAÇÃO aplicada ao conteúdo montado ANTES de gravar: pares
#     chave=valor sensíveis (password|passwd|pwd|token|secret|api[_-]key|
#     apikey|authorization, case-insensitive) viram <redacted>; flags no estilo
#     --chave valor; userinfo de URL (protocolo://usuario:senha@host) vira
#     protocolo://usuario:<redacted>@host; blocos de chave privada PEM são
#     descartados (cabeçalho e corpo).
#   - A redação é Best-effort, NÃO é garantia de ausência de segredo: a seção
#     "crontab -l" pode conter segredos em formato que nenhum regex anticipate.
#     Por isso o arquivo carrega o aviso de revisão manual e o operador deve
#     revisar o arquivo antes de compartilhar, abrir issue ou versionar.
# =============================================================================

set -u

# shellcheck disable=SC2016

usage() {
  cat <<'USAGE'
uso: collect-inventory.sh --side=source|target [--out <dir>]

  --side=source|target  OBRIGATÓRIO. source = VPS de onde os dados saem;
                        target = VPS para onde os dados chegam. Ausente ou
                        inválido: imprime este uso em stderr e sai com 1.
  --out <dir>           Diretório onde gravar inventory-<side>-<timestamp>.txt
                        (default: diretório atual).
  -h, --help            Mostra este texto em stdout e sai com 0.

Referência: runbook de migração §3 (inventário obrigatório antes de copiar).
Saída: somente metadados redatados. Revise o arquivo antes de compartilhar.
USAGE
}

die_usage() {
  printf '%s\n' "[collect-inventory] erro de uso: $1" >&2
  usage >&2
  exit 1
}

# -----------------------------------------------------------------------------
# Argumentos (fail-closed, no mesmo espírito de scripts/lib/vps-env.mjs)
# -----------------------------------------------------------------------------
SIDE=""
OUT_DIR=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --side=*)
      SIDE="${1#--side=}"
      ;;
    --side)
      [ "$#" -ge 2 ] || die_usage "--side exige um valor (source|target)"
      SIDE="$2"
      shift
      ;;
    --out=*)
      OUT_DIR="${1#--out=}"
      ;;
    --out)
      [ "$#" -ge 2 ] || die_usage "--out exige um valor (diretório)"
      OUT_DIR="$2"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die_usage "argumento desconhecido: $1"
      ;;
  esac
  shift
done

[ -n "$SIDE" ] || die_usage "--side é obrigatório (--side=source ou --side=target)"
case "$SIDE" in
  source|target) ;;
  *) die_usage "--side inválido: '$SIDE' (esperado: source ou target)" ;;
esac

[ -n "$OUT_DIR" ] || OUT_DIR="."

# -----------------------------------------------------------------------------
# Precondições: a redação é obrigatória, então sem awk o script falha fechado
# em vez de gravar um arquivo sem revisão de segredo (nunca gravar "crudo").
# -----------------------------------------------------------------------------
if ! command -v awk >/dev/null 2>&1; then
  printf '%s\n' "[collect-inventory] awk ausente: a redação não pode ser aplicada. Nada foi escrito." >&2
  exit 1
fi

if ! mkdir -p "$OUT_DIR" 2>/dev/null; then
  printf '%s\n' "[collect-inventory] não foi possível criar o diretório de saída: $OUT_DIR" >&2
  exit 1
fi
if [ ! -d "$OUT_DIR" ]; then
  printf '%s\n' "[collect-inventory] --out não é um diretório: $OUT_DIR" >&2
  exit 1
fi
if [ ! -w "$OUT_DIR" ]; then
  printf '%s\n' "[collect-inventory] --out não é gravável: $OUT_DIR" >&2
  exit 1
fi

# Arquivos temporários ficam dentro de --out e morrem no exit (trap).
# umask 077: o arquivo bruto (ainda não redigido) e o relatório final saem 0600.
umask 077

UTC_STAMP="$(date -u +%Y%m%dT%H%M%SZ 2>/dev/null)"
[ -n "$UTC_STAMP" ] || UTC_STAMP="sem-data"
HOST_NAME="$(hostname 2>/dev/null)"
[ -n "$HOST_NAME" ] || HOST_NAME="desconhecido"

OUT_FILE="$OUT_DIR/inventory-$SIDE-$UTC_STAMP.txt"
RAW_FILE="$OUT_DIR/.inventory-$SIDE-$UTC_STAMP.raw"

cleanup() {
  [ -n "${RAW_FILE:-}" ] && rm -f "$RAW_FILE" 2>/dev/null
  [ -n "${REDACTED_FILE:-}" ] && rm -f "$REDACTED_FILE" 2>/dev/null
  return 0
}
trap cleanup EXIT INT TERM

: > "$RAW_FILE" || {
  printf '%s\n' "[collect-inventory] não foi possível criar o arquivo temporário em: $OUT_DIR" >&2
  exit 1
}

# -----------------------------------------------------------------------------
# Helpers de coleta (best-effort: nunca abortam o inventário)
# -----------------------------------------------------------------------------

# run_cmd <mostrado no relatório> <comando> [args...]
# Executa o comando anexando stdout+stderr ao bruto. Se o binário não existir
# ou o comando falhar, registra "[indisponível: <mostrado>]".
run_cmd() {
  local shown="$1"
  shift
  if command -v "$1" >/dev/null 2>&1 && "$@" >>"$RAW_FILE" 2>&1; then
    return 0
  fi
  printf '[indisponível: %s]\n' "$shown" >>"$RAW_FILE"
}

# run_privileged <mostrado no relatório> <comando> [args...]
# Para comandos que o runbook §3 lista sob sudo: tenta `sudo -n` (não
# interativo, nunca pede senha) e cai para o comando sem privilégio, com stderr
# suprimido no fallback. Só grava o marcador quando as duas tentativas falham.
run_privileged() {
  local shown="$1"
  shift
  if command -v sudo >/dev/null 2>&1 && sudo -n "$@" >>"$RAW_FILE" 2>&1; then
    return 0
  fi
  if command -v "$1" >/dev/null 2>&1 && "$@" >>"$RAW_FILE" 2>/dev/null; then
    return 0
  fi
  printf '[indisponível: %s]\n' "$shown" >>"$RAW_FILE"
}

# section <título> <comando exibido>
section() {
  {
    printf '\n=== %s ===\n' "$1"
    printf '$ %s\n' "$2"
  } >>"$RAW_FILE"
}

# -----------------------------------------------------------------------------
# Coleta — exatamente a lista de comandos do runbook §3
# -----------------------------------------------------------------------------
section "hostname" "hostname"
run_cmd "hostname" hostname

section "uname -a" "uname -a"
run_cmd "uname -a" uname -a

section "df -h" "df -h"
run_cmd "df -h" df -h

section "free -h" "free -h"
run_cmd "free -h" free -h

section "docker ps" 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"'
run_cmd 'docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"' \
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'

section "docker compose ls" "docker compose ls"
run_cmd "docker compose ls" docker compose ls

section "docker network ls" "docker network ls"
run_cmd "docker network ls" docker network ls

section "docker volume ls" "docker volume ls"
run_cmd "docker volume ls" docker volume ls

section "systemctl --failed" "systemctl --failed"
run_cmd "systemctl --failed" systemctl --failed

section "systemctl list-timers --all" "systemctl list-timers --all"
run_cmd "systemctl list-timers --all" systemctl list-timers --all

section "crontab -l" "crontab -l"
run_cmd "crontab -l" crontab -l

section "ss -lntup" "sudo -n ss -lntup || ss -lntup"
run_privileged "sudo -n ss -lntup || ss -lntup" ss -lntup

# -----------------------------------------------------------------------------
# Redação (POSIX awk: funciona em mawk/gawk/BSD awk)
#   1. chave=valor / chave: valor onde a chave é password|passwd|pwd|token|
#      secret|api_key|api-key|apikey|authorization (case-insensitive) -> <redacted>
#   2. flag --chave valor -> --chave <redacted>
#   3. protocolo://usuario:senha@host -> protocolo://usuario:<redacted>@host
#   4. bloco de chave privada PEM (cabeçalho + corpo) -> linhas mascaradas
# -----------------------------------------------------------------------------
AWK_PROGRAM="$(cat <<'SYNKROO_INVENTORY_AWK_PROG'
function is_alnum(c) {
  return (c >= "0" && c <= "9") || (c >= "a" && c <= "z") || (c >= "A" && c <= "Z")
}
function is_space(c) {
  return (c == " " || c == "\t")
}
function is_quote(c) {
  return (c == "\"" || c == "'" || c == "`")
}
function is_url_stop(c) {
  return (c == " " || c == "\t" || c == "\"" || c == "'" || c == "," || c == ";" || c == ")" || c == "]")
}
# maior chave sensível que casa na posição i (evita "pwd" casando dentro de
# "password" e mascarando a chave errada)
function key_len_at(low, i,   j, k, kl, best) {
  best = 0
  for (j = 1; j <= nkeys; j++) {
    k = KEYS[j]
    kl = length(k)
    if (kl > best && substr(low, i, kl) == k) best = kl
  }
  return best
}
function redact_kv(line,   low, out, i, n, c, c2, kl, j, vend, dashed, skipped) {
  low = tolower(line)
  out = ""
  i = 1
  n = length(line)
  while (i <= n) {
    c = substr(line, i, 1)
    # a chave só vale se o caractere ANTERIOR não for alfanumérico: evita
    # "minhaSenhaVar" casar "senha"/"pwd" no meio de outro identificador.
    if (i == 1 || !is_alnum(substr(line, i - 1, 1))) {
      kl = key_len_at(low, i)
      if (kl > 0) {
        dashed = (i > 1 && substr(line, i - 1, 1) == "-")
        j = i + kl
        skipped = 0
        while (j <= n && is_space(substr(line, j, 1))) { j++; skipped = 1 }
        # (1) chave [espaços] (:|=) [espaços] valor. O valor é mascarado até o
        # fim da linha, uma aspa que feche o valor ou um "&" de query string —
        # cortar em aspa inicial vazaria "Bearer <token>" e afins.
        if (j <= n && (substr(line, j, 1) == "=" || substr(line, j, 1) == ":")) {
          out = out substr(line, i, kl) substr(line, j, 1)
          j++
          while (j <= n && is_space(substr(line, j, 1))) j++
          vend = j
          if (j <= n && is_quote(substr(line, j, 1))) {
            c2 = substr(line, j, 1)
            vend = j + 1
            while (vend <= n && substr(line, vend, 1) != c2) vend++
            if (vend <= n) vend++
          } else {
            while (vend <= n) {
              c2 = substr(line, vend, 1)
              if (is_quote(c2) || c2 == "&") break
              vend++
            }
          }
          if (vend > j) out = out "<redacted>"
          i = vend
          continue
        }
        # (2) flag estilo CLI: --chave valor (um único token)
        if (dashed && skipped && j <= n) {
          vend = j
          while (vend <= n && !is_space(substr(line, vend, 1)) && !is_quote(substr(line, vend, 1))) vend++
          if (vend > j) {
            out = out substr(line, i, kl) " <redacted>"
            i = vend
            continue
          }
        }
      }
    }
    out = out c
    i++
  }
  return out
}
function mask_urls(s,   out, rest, p, at, colon, ui, ch, i, len) {
  out = ""
  rest = s
  while ((p = index(rest, "://")) > 0) {
    out = out substr(rest, 1, p - 1)
    rest = substr(rest, p + 3)
    at = 0
    len = length(rest)
    for (i = 1; i <= len; i++) {
      ch = substr(rest, i, 1)
      if (ch == "@") { at = i; break }
      if (is_url_stop(ch)) break
    }
    ui = (at > 0) ? substr(rest, 1, at - 1) : ""
    colon = index(ui, ":")
    if (colon > 0) {
      out = out "://" substr(ui, 1, colon - 1) ":<redacted>@"
      rest = substr(rest, at + 1)
    } else {
      out = out "://"
    }
  }
  return out rest
}
BEGIN {
  nkeys = split("authorization apikey api_key api-key password passwd secret token pwd", KEYS, " ")
  inkey = 0
}
{
  # (4) chave privada PEM: descarta cabeçalho E corpo do bloco (o corpo em
  # base64 não tem nome de chave reconhecível — sem estado, ele vazaria).
  # Só entra no estado quando a linha é um cabeçalho PEM de verdade, para não
  # engolir o resto do inventário por causa de menção em comentário.
  if ($0 ~ /-----BEGIN[ \t].*PRIVATE[ \t]*KEY-----/) {
    inkey = 1
    print "[bloco de chave privada mascarado: linha " NR "]"
    next
  }
  if (inkey) {
    if ($0 ~ /-----END[ \t].*KEY-----/) { inkey = 0; print "[bloco de chave privada mascarado: linha " NR "]"; next }
    print "[linha mascarada: corpo de chave privada]"
    next
  }
  print mask_urls(redact_kv($0))
}
SYNKROO_INVENTORY_AWK_PROG
)"

REDACTED_FILE="$RAW_FILE.redacted"

awk "$AWK_PROGRAM" "$RAW_FILE" >"$REDACTED_FILE" 2>/dev/null
REDACTION_STATUS=$?

if [ "$REDACTION_STATUS" -ne 0 ] || [ ! -s "$REDACTED_FILE" ]; then
  printf '%s\n' "[collect-inventory] a redação falhou; nenhum relatório foi gravado (fail-closed)." >&2
  exit 1
fi

# -----------------------------------------------------------------------------
# Montagem final: cabeçalho + corpo já redigido + lembrete final
# -----------------------------------------------------------------------------
{
  printf '=== INVENTARIO VPS SYNKROO (metadados redatados) ===\n'
  printf 'side: %s\n' "$SIDE"
  printf 'timestamp-utc: %s\n' "$UTC_STAMP"
  printf 'hostname: %s\n' "$HOST_NAME"
  printf 'gerado-por: ops/vps/inventory/collect-inventory.sh\n'
  printf 'runbook: docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md secao 3\n'
  printf '\n'
  printf 'REVISAR ANTES DE COMPARTILHAR - crontab/configs podem conter segredos.\n'
  printf 'Nenhum dump, volume, log ou arquivo de configuracao e copiado por este script.\n'
  printf '\n'
} >"$OUT_FILE"

cat "$REDACTED_FILE" >>"$OUT_FILE"
rm -f "$REDACTED_FILE" 2>/dev/null

printf '\n%s\n' "Lembrete final: revise manualmente a secao \"crontab -l\" (e qualquer linha com marker de indisponibilidade) antes de compartilhar, abrir issue ou versionar este arquivo." >>"$OUT_FILE"

printf '%s\n' "[collect-inventory] inventário gravado: $OUT_FILE"
exit 0
