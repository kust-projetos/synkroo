#!/usr/bin/env bash
# apply-d3-firewall.sh — (re)cria a contenção D3 do PostgreSQL de produção.
#
# Topologia medida no target em 2026-10-12 (somente versionada aqui, sem SSH):
#   DOCKER-USER -d <container-ip> --dport 5432 -j SYNKROO-D3    (IPv4, com -d)
#   DOCKER-USER --dport 5432 -j SYNKROO-D3-V6                   (IPv6, sem -d:
#     -d com IPv4 é rejeitado pelo ip6tables com "host/network not found")
#   SYNKROO-D3    = 15 ACCEPTs (egresso Cloudflare) + DROP final
#   SYNKROO-D3-V6 = DROP final
# Todas as regras carregam o comentário `synkroo-d3-20261012`.
#
# DECISÃO DOCUMENTADA — manter os 15 ranges Cloudflare (não estreitar para os
# 3 observados): o egresso Cloudflare rotaciona entre todos os ranges
# publicados; estreitar para os 3 com tráfego observado arrisca outage quando
# o egresso mudar. Evidência (contadores 2026-10-12): 104.16.0.0/13 ~49k pkts,
# 162.158.0.0/15 ~12.8k, 172.64.0.0/13 ~5.3k, demais ranges 0, DROP 11.
#
# Uso:
#   CONTAINER_IP=<ip-do-container> ./apply-d3-firewall.sh
#   DRY_RUN=1 CONTAINER_IP=<ip> ./apply-d3-firewall.sh   # só imprime, sem iptables
#
# EnvironmentFile do systemd (/root/.secrets/synkroo-d3.env) — formato:
#   CONTAINER_IP=172.18.0.2
# Só CONTAINER_IP e nada sensível (IP não é segredo; o arquivo vive fora do
# repo com modo 0600 por convenção de host).
#
# Idempotente: usa `iptables -C`/`ip6tables -C` antes de `-A` (regras
# internas) ou `-I <chain> 1` (saltos DOCKER-USER, topo — ver abaixo);
# re-execução é no-op. Nunca adivinha CONTAINER_IP — sem ele, falha
# fechado (exit 2). Caminho normal nunca usa `-F`/`-X` em nenhuma chain
# (flush criaria janela de exposição).
#
# REMOÇÃO SEGURA (somente manual, nunca automática — sem SSH/commit/push
# por este script):
#   1. `systemctl disable --now synkroo-d3-firewall.service` (para a
#      reaplicação no boot antes de remover as regras);
#   2. Remover os 2 saltos com `-D` exato (mesma spec do `-I` de inserção,
#      trocando `-I <chain> 1` por `-D <chain>`);
#   3. Somente então `-F` e `-X` APENAS das chains próprias `SYNKROO-D3`
#      (iptables) e `SYNKROO-D3-V6` (ip6tables) — nunca flush global de
#      `DOCKER-USER`;
#   4. Verificar com `iptables -S DOCKER-USER` / `ip6tables -S DOCKER-USER`
#      (saltos removidos) e `-S SYNKROO-D3` / `-S SYNKROO-D3-V6` (chains
#      ausentes após `-X`).
set -euo pipefail

MARKER='synkroo-d3-20261012'

if [ -z "${CONTAINER_IP:-}" ]; then
  echo "ERRO: CONTAINER_IP obrigatório (ex.: CONTAINER_IP=172.18.0.2 $0)" >&2
  exit 2
fi

# 15 ranges de egresso Cloudflare (IPv4), ordem publicada.
CF_RANGES=(
  173.245.48.0/20
  103.21.244.0/22
  103.22.200.0/22
  103.31.4.0/22
  141.101.64.0/18
  108.162.192.0/18
  190.93.240.0/20
  188.114.96.0/20
  197.234.240.0/22
  198.41.128.0/17
  162.158.0.0/15
  104.16.0.0/13
  104.24.0.0/14
  172.64.0.0/13
  131.0.72.0/22
)

IPT="${IPTABLES_BIN:-iptables}"
IPT6="${IP6TABLES_BIN:-ip6tables}"

run() {
  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '+ %s\n' "$*"
  else
    "$@"
  fi
}

# Adiciona a regra apenas se ainda não existir (idempotência real).
ensure() {
  local bin="$1"; shift
  local check_bin="$1"; shift
  if [ "${DRY_RUN:-0}" = "1" ]; then
    run "$bin" "$@"
    return 0
  fi
  if "$check_bin" -C "$@" 2>/dev/null; then
    return 0
  fi
  run "$bin" -A "$@"
}

# Como `ensure`, mas insere no TOPO (`-I <chain> 1`) em vez de anexar.
# Porquê: a chain DOCKER-USER do Docker termina com regras `RETURN`
# terminais — um salto anexado com `-A` cairia DEPOIS do RETURN e nunca
# seria alcançado. O `-C` de existência vem antes, com a spec exata (sem
# a posição `1`, que o `-C` não aceita); ausente, insere na posição 1.
ensure_top() {
  local bin="$1"; shift
  local check_bin="$1"; shift
  local chain="$1"; shift
  if [ "${DRY_RUN:-0}" = "1" ]; then
    run "$bin" -I "$chain" 1 "$@"
    return 0
  fi
  if "$check_bin" -C "$chain" "$@" 2>/dev/null; then
    return 0
  fi
  run "$bin" -I "$chain" 1 "$@"
}

ensure_chain() {
  local bin="$1"; shift
  local chain="$1"; shift
  if [ "${DRY_RUN:-0}" = "1" ]; then
    run "$bin" -N "$chain"
    return 0
  fi
  if ! "$bin" -L "$chain" -n >/dev/null 2>&1; then
    run "$bin" -N "$chain"
  fi
}

# --- Ordem fill-before-jump (por família: bloco v4 completo, depois v6) ---
# Cada bloco segue: criar chain → preencher ACCEPTs+DROPs → instalar o
# salto DOCKER-USER POR ÚLTIMO. Porquê: chain vazia retorna ao chamador
# (RETURN implícito no fim da chain) — um salto instalado antes do
# preenchimento apontaria para chain vazia/incompleta e, em falha parcial
# (script interrompido entre salto e fills/DROP), exporia o Postgres sem o
# DROP final. Preencher primeiro e instalar o salto por último fecha essa
# janela: sem salto, nada alcança a chain incompleta.
#
# === Bloco v4 completo: chain → fills → salto (por último) ===
ensure_chain "$IPT" SYNKROO-D3

# --- Guarda de troca de IP (fail-closed, sem rotação automática) ---
# Se SYNKROO-D3 já contém regras com `-d <outro-ip>` diferente de
# CONTAINER_IP, o container foi recriado com IP novo e ABORTA (exit 3):
# remover automaticamente as regras do IP antigo abriria a contenção.
# Rotação é MANUAL via comandos iptables explícitos (NUNCA "pelo próprio
# script atualizado" — este script aborta por desenho ao detectar IP
# divergente, antes de alterar qualquer regra):
#   1. Adicionar os ACCEPTs do IP novo com `iptables -A` explícito
#      (mesma spec dos ACCEPTs abaixo, com `-d <ip-novo>`);
#   2. Verificar os contadores (`iptables -L SYNKROO-D3 -v -n`) até o
#      tráfego migrar para as regras do IP novo;
#   3. Remover os ACCEPTs do IP antigo um a um com `-D` exato;
#   4. Atualizar o EnvironmentFile (/root/.secrets/synkroo-d3.env) com o
#      IP novo;
#   5. Re-executar este script, que converge os saltos DOCKER-USER para o
#      IP novo (idempotente via `-C`).
# Monitoramento recomendado: checar periodicamente se o IP do container
# (`docker inspect`) == EnvironmentFile e se os contadores das regras
# (`iptables -L SYNKROO-D3 -v -n`) seguem crescendo.
if [ "${DRY_RUN:-0}" != "1" ]; then
  stale_ips="$("$IPT" -S SYNKROO-D3 2>/dev/null | grep -oE '\-d [0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | awk '{print $2}' | sort -u || true)"
  for ip in ${stale_ips:-}; do
    if [ -n "$ip" ] && [ "$ip" != "${CONTAINER_IP}" ]; then
      echo "ERRO: SYNKROO-D3 contém regras com -d ${ip}, diferente de CONTAINER_IP=${CONTAINER_IP}." >&2
      echo "Rotação de IP detectada — nenhuma regra foi alterada (fail-closed)." >&2
      echo "Rotação MANUAL: adicionar os ACCEPTs do IP novo com iptables -A explícito, verificar os contadores, remover os do IP antigo um a um com -D exato, atualizar o EnvironmentFile (/root/.secrets/synkroo-d3.env) e re-executar este script (ele aborta por desenho com IP divergente, nunca rotaciona sozinho)." >&2
      exit 3
    fi
  done
fi

# --- SYNKROO-D3 (v4): 15 ACCEPTs Cloudflare + DROP final (fills) ---
# Fidelidade byte-a-byte ao vivo (iptables -S, 2026-10-12): o DROP v4 vivo é
# `-A SYNKROO-D3 -m comment --comment synkroo-d3-20261012 -j DROP`, SEM
# -p/--dport. A idempotência via `-C` exige match exato — emitir o DROP com
# -p/--dport não casa no `-C` e anexa um DROP duplicado inalcançável.
for range in "${CF_RANGES[@]}"; do
  ensure "$IPT" "$IPT" SYNKROO-D3 -s "$range" -d "${CONTAINER_IP}" -p tcp --dport 5432 -m comment --comment "$MARKER" -j ACCEPT
done
ensure "$IPT" "$IPT" SYNKROO-D3 -m comment --comment "$MARKER" -j DROP

# --- DOCKER-USER salto v4 (POR ÚLTIMO no bloco v4: fill-before-jump) ---
# Topo (`-I ... 1`): a chain DOCKER-USER do Docker termina com RETURNs
# terminais; `-A` deixaria o salto inalcançável (ver `ensure_top`).
ensure_top "$IPT" "$IPT" DOCKER-USER -d "${CONTAINER_IP}" -p tcp --dport 5432 -m comment --comment "$MARKER" -j SYNKROO-D3

# === Bloco v6 completo: chain → fill → salto (por último) ===
ensure_chain "$IPT6" SYNKROO-D3-V6

# --- SYNKROO-D3-V6 (v6): DROP final (fill) ---
ensure "$IPT6" "$IPT6" SYNKROO-D3-V6 -p tcp --dport 5432 -m comment --comment "$MARKER" -j DROP

# --- DOCKER-USER salto v6 (POR ÚLTIMO no bloco v6: fill-before-jump) ---
ensure_top "$IPT6" "$IPT6" DOCKER-USER -p tcp --dport 5432 -m comment --comment "$MARKER" -j SYNKROO-D3-V6

echo "D3 aplicado (CONTAINER_IP=${CONTAINER_IP}, DRY_RUN=${DRY_RUN:-0})."
