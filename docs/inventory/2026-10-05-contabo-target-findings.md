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

## 5. PG do Synkroo no target + Rehearsal §5.3 (2026-10-05)

### Deploy

- `synkroo-prod-postgres` (pgvector/pgvector:pg17) **healthy** em `/opt/synkroo/synkroo-prod-postgres/`:
  volume nomeado, configs bind-mounted (mesmos `postgresql.conf`/`pg_hba.conf` do repo), TLS self-signed gerado no host (key 999:999 0600), TZ fixa `GMT` no compose, **sem porta pública** (apenas `127.0.0.1:15433` para debug — mesmo modelo tunnel-only da source).
- O serviço `cloudflared` do compose do repo **foi deliberadamente omitido**: mover/criar rota na Cloudflare é decisão do owner (§4 Rede).
- Senha do cluster gerada no próprio host, em `/opt/synkroo/synkroo-prod-postgres/.env` (0600) — nunca transitou por sessão/repo.

### Rehearsal §5.3 — GREEN

| Gate | Resultado |
|---|---|
| Transfer do dump (186 KB) + SHA-256 no destino | `1b6394e0…8ac002` local = remoto ✅ |
| DB isolado `synkroo_rehearsal` + extensões | `vector` + `btree_gist` ✅ |
| `pg_restore --no-owner --role=synkroo` | exit 0 ✅ |
| Migration ledger | `drizzle.__drizzle_migrations` = **33** ✅ |
| Smoke (9 tabelas-chave) | 8/9 presentes e consistentes; `contacts` não existe no schema (desvio documentado: CRM = patients+leads) ✅ |
| Constraints | 528 ✅ |
| Tamanho pós-restore | 11 MB (espelha a source) ✅ |
| Perfil de dados | `clinics=1`, `users=1`, demais=0 — **confirma pré-piloto; owner deve ratificar** |

O DB `synkroo_rehearsal` foi mantido no target como evidência até o go do cutover.

### Backup off-host — implementado e validado

- `ops/vps/contabo/backup/backup-synkroo.sh` (versionado no repo, instalado em `/opt/synkroo/backup/`, 0750): dump lógico prod + staging condicional, tar do volume físico, configs (inclui `.env` — mesmo padrão da source), manifest SHA-256, retenção 14 dias.
- `rclone.conf` replicado da source (GDrive) — copiado source→target por SSH, sem passar por sessão/repo. **Execução real moviu o tar.gz para `gdrive:synkroo-contabo-backups/`** ✅ (primeira execução 2026-10-05 22:44 UTC).
- Cron `deploy`: `30 5 * * *` (= 03:30 UTC, mesmo horário da source, sem colidir com `backup-pi` às 03:30 CEST).
- Monitoramento (ping healthchecks): pendente UUID do target — o script já suporta via `BACKUP_HC_PING_URL` em `/opt/synkroo/backup/.env`.

### Higiene

- `cloud-init-main.service` (Contabo NoCloud, falha de módulo final no boot de 2026-10-02): desabilitado via `/etc/cloud/cloud-init.disabled`, `reset-failed` aplicado — `systemctl --failed` = **0 unidades**.

## 6. Cutover §5.4 — EXECUTADO (2026-10-05 21:04 UTC)

Evidências (runbook §14):

| Passo §5.4 | Evidência |
|---|---|
| Final sync | dump fresco da source `synkroo-source-final-<ts>.dump` (186.306 B, SHA-256 `b9d94e1f…a08dc95` verificado no destino) |
| Restore no target | DB `synkroo` recriado + `pg_restore` exit 0 |
| Smoke pré-flip | 68 tabelas, ledger 33, 528 constraints, extensões ok, perfil test-only (1/1) ratificado pelo owner |
| Exposição de rede | `0.0.0.0:15433` publicada; ufw **só ranges Cloudflare** (15 regras v4, `sslmode require`); regra temporária do operador adicionada/removida para validação |
| Staging no target | `setup-staging-db.ts --side=target` (role+DB+extensões+senha persistida) + `migrate-vps.ts --side=target --target=staging` (68 tabelas) |
| **Flip Hyperdrive** | `update-hyperdrive.ts --side=target` — staging `e0033a75…` e produção `be5a789a…` → `213.199.37.252:15433` (`modified_on` 2026-10-05T21:04Z) |
| Smoke pós-flip | `smoke-deploy.mjs`: **produção exit 0** e **staging exit 0** (liveness/auth-pipeline/db/middleware ok) |

**Rollback (1 comando)**, se necessário durante a janela de observação:

```bash
$env:SYNKROO_VPS_ENV = 'D:\projetos\vps-hostinger\.env'
npx tsx scripts/update-hyperdrive.ts --side=source
```

Hostinger segue **intacta e acessível** (rollback window aberta; decommission só após §12/observação).

## 7. Pendências para o fechamento do P2 (fim da migração)

1. Janela de observação pós-cutover (24–48h: erros de app, latência, no-show de queries).
2. `setup-staging-db`/runbooks futuros dependem do TCP CF-only — o acesso do operador continua sendo via `docker exec` SSH (rota canônica) ou regra temporária.
3. **Remoção do fallback legado** `../vps-hostinger/.env` (vps-access.md §Fonte) — agora com `.env` próprio do target (`D:\projetos\vps-contabo\.env`).
4. Monitoramento do backup do target: opcional `BACKUP_HC_PING_URL` em `/opt/synkroo/backup/.env`.
5. §12 Cleanup da Hostinger — SOMENTE após a janela de observação e backup final.
6. P3 (WAHA): decidir provider real (WAHA já ativo na source sem volume de sessão vs. config Evolution do app).
