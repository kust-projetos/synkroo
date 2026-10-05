# Contabo target — Findings (vNext P2)

**Data:** 2026-10-05
**Fase:** P2 — Hostinger → Contabo (runbook §3/§4)
**Método:** `ops/vps/inventory/collect-inventory.sh --side=target` + sondas read-only (ufw/sshd -T/timedatectl) via SSH
**Docs-irmãos:** `2026-10-05-contabo-target.txt` (raw redatado) · `2026-10-05-hostinger-findings.md` (source)

## 1. Estado do host

| Item | Valor |
|---|---|
| Hostname | `vmi3630510` |
| SO/kernel | Ubuntu, kernel 7.0.0-38-generic (imagem recente) |
| Disco | 96G total, 13G usados (14%) — 84G livres |
| RAM | 7.8Gi (900Mi usados) — o dobro da source |
| Timezone | `Europe/Berlin` (CEST) — **mantida de propósito**: o host já serve outras stacks; o TZ do PostgreSQL é config própria do banco (`GMT` na source) e é definido no compose do target |
| NTP | sincronizado via `chronyd` (não systemd-timesyncd) |
| Usuário operacional | `deploy` (pré-existente, login por chave funcionando, sudo disponível) |

## 2. Checklist §4 — já satisfeito pelo hardening existente

O host **não é uma box nova**: já roda `traefik` (80/443), `pi-finance-api` + `pi-finance-postgres` (postgres:15) e `ai-memory-preflight`. O hardening §4 foi verificado como **já aplicado**:

| Item §4 | Status | Evidência (2026-10-05) |
|---|---|---|
| SSH key-only | ✅ | login por chave em uso; `sshd -T`: `passwordauthentication no`, `kbdinteractiveauthentication no` |
| Usuário admin não-root | ✅ | `deploy` pré-existente (padrão também na source) |
| Firewall default-deny | ✅ | `ufw` **ativo**: default deny incoming / allow outgoing; regras: OpenSSH, 80/tcp, 443/tcp (v4+v6). **PostgreSQL sem regra** — correto |
| Docker + Compose | ✅ | Docker 29.1.3 + Compose 2.40.3 (pacotes Ubuntu) |
| NTP | ✅ | `chronyd`, clock synchronized |
| Timezone | ⚠️ | `Europe/Berlin` — decisão deliberada de **não** alterar (não perturbar as stacks existentes); TZ do banco fixa no compose |
| Diretórios app/backups | ✅ | `/opt/synkroo` e `/var/backups/synkroo` criados em 2026-10-05 (`deploy:deploy`, 0750) |
| Monitoramento | ⬜ | decisão do owner (fonte: qual stack? healthchecks.io já é usado pela source) |
| Backup off-host | ⬜ | decisão do owner (a `backup-pi.sh` existente cobre só pi-finance) |

SSHD: a política efetiva vem de `/etc/ssh/sshd_config.d/10-hardening.conf` (`PermitRootLogin no`, `PasswordAuthentication no`), que vence corretamente o `50-cloud-init.conf` (`PasswordAuthentication yes`) pela regra do primeiro-valor — exatamente o cenário que o gate `sshd -T` do bootstrap protege. **O bootstrap fresh-host não é necessário nesta box.**

## 3. Pendências de higiene

- `cloud-init-main.service` em **failed** (`systemctl --failed`) — inofensivo em runtime, mas deve ser diagnosticado/mascarado para não poluir o gate de Go/No-Go (§13 exige DB health verde; unidade falha não bloqueia, porém suja o inventário).
- Inventário não distinguiu qual branch do `sudo -n ss || ss` rodou — irrelevante para as conclusões.

## 4. Implicações para o P2

1. **§5.3 restore rehearsal** é o próximo passo de verdade: requer subir o Postgres do Synkroo na Contabo (`ops/vps/synkroo-prod-postgres/`) — container novo, sem afetar pi-finance.
2. **Rota de acesso**: na source, o TCP direto ao PG é bloqueado na borda (tunnel-only). O target precisa da decisão de rota Hyperdrive **antes** do cutover (§4 Rede do runbook: identificar a origem real do tráfego). Esta é a principal decisão de rede pendente.
3. **Portas no target**: Postgres do Synkroo não deve publicar porta de host; acesso pelo compose network + túnel/rota validada, reproduzindo o modelo da source.
4. **TZ no compose do target**: fixar explicitamente (a source roda GMT; o host está em CEST) para não herdar TZ do host por acidente.
5. `cloudflared`: o tunnel da source (`synkroo-prod-db-tunnel`) é credenciado na Cloudflare — mover/criar rota é mudança no lado Cloudflare, decisão visível ao owner.
