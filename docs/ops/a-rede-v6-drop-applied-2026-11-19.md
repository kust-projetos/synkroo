# A-REDE — regra IPv6 DROP aplicada na 15434 (2026-11-19)

Tarefa V12-A-REDE-APPLY-V6-DROP. Autorização do owner: política "v6 DROP-only", "A-REDE primeiro". Gates: ver `a-rede-gates-evidence-2026-11-19.md`.
Host: `contabo-prod` (vmi3630510), acesso por SSH por chave (alias do operador).

> **Aviso: a regra é EFÊMERA.** Foi inserida apenas em memória (`ip6tables -I`); **não persiste após reboot/restart do serviço de firewall**. Persistência está fora de escopo desta tarefa.

## Alteração (única)

- Aplicada às ~15:33:5xZ (checagem de estado às 15:34:35Z).
- Comando EXATO: `sudo ip6tables -I INPUT -p tcp --dport 15434 -j DROP`
- Posição resultante: **1** da chain INPUT (antes de `ufw6-before-logging-input`).
- Estado depois: `-P INPUT DROP`, `-A INPUT -p tcp -m tcp --dport 15434 -j DROP`, seguido das 6 regras ufw6 originais.
- **Nada mais foi alterado:** `SYNKROO-D3-V6`, DOCKER-USER (v4/v6), ufw, `dbcentral-hml-firewall.service`, containers, roles/credenciais/banco, arquivos.

## Snapshot (pré-mudança)

`/home/deploy/firewall-snapshots/ip6tables-INPUT-pre-v6drop-20261119T153303Z.txt` (modo 0600, diretório 0700, 18 linhas, SHA-256 `28884f5eb60d96279f3159d3455288319875b0c2bb08f4d55ec80b7e3076f5b1`). Contém `ip6tables -S INPUT` e `ip6tables -L INPUT -nv --line-numbers`. Estado anterior: `-P INPUT DROP` + 6 regras `ufw6-*`, nenhuma menção à 15434.

## Validação

| Verificação | Antes | Depois |
|---|---|---|
| `GET /api/health` | 200 | 200 (duas vezes) |
| `GET /api/health/db` | 200, `complete`, 40/40 | 200, `complete`, 40/40 (duas vezes) |
| `pg_stat_activity` (client backend, origens distintas) | não capturado (primeira tentativa falhou por quoting; sem impacto no host) | 10 origens, todas IPv4: Hyperdrive prod (172.70.245.{14,37,38,119,178}), Hyperdrive staging (104.22.123.{136,140}, 162.158.85.166), iptv (172.31.0.4/.6, rede docker). Coerente com as origens da evidência de gates; nenhuma origem nova ou perdida |
| DOCKER-USER v4/v6 | — | regra `synkroo-d3-20261012 → SYNKROO-D3-V6` presente e inalterada |

### Teste IPv6 externo — INCONCLUSIVO (limitação)

- Esta estação tem IPv6 global (`curl -6` funciona para a internet) e o host tem `2a02:c207:2363:510::1/64`.
- `curl -6 --connect-timeout 5 http://[2a02:c207:2363:510::1]:15434/` → timeout (exit 28); `Test-NetConnection` → `TcpTestSucceeded=False`.
- **Controle** (porta 22 v6 no mesmo host): também timeout. O contador da nova regra permaneceu em `0 pkts` após os testes, ou seja, os SYNs não chegaram ao INPUT do host por esse caminho (filtro anterior ou rota v6 estação→host). Portanto o timeout **não prova** que a regra bloqueia; só mostra que a 15434 não está acessível por v6 a partir daqui.
- Contexto: a política padrão de INPUT v6 já era DROP e o docker-proxy escuta em `[::]:15434` (`ss -tln`); a regra explícita torna o bloqueio independente das regras ufw6. Validar o contador (`pkts`) com tráfego v6 que chegue ao host é a prova pendente.

## Rollback (NÃO executado)

```
sudo ip6tables -D INPUT -p tcp --dport 15434 -j DROP
```

Confirmar restauração: `sudo ip6tables -S INPUT` deve ser idêntico ao bloco `-S INPUT` do snapshot (`-P INPUT DROP` + 6 regras `ufw6-*`, sem regra com 15434); por exemplo `diff <(sudo ip6tables -S INPUT) <(sed -n '2,8p' /home/deploy/firewall-snapshots/ip6tables-INPUT-pre-v6drop-20261119T153303Z.txt)`.
Critério de abort: `/api/health` ≠ 200 ou conexão IPv4 afetada → executar o rollback imediatamente. Não foi necessário.
