# Acesso VPS — Synkroo

## Fonte de configuração

Execute comandos a partir da raiz deste projeto. Configuração privada fica em `../vps-hostinger/.env`.

Nunca copie senha, token, chave privada ou valor de `.env` para este repositório.

### Bash/Git Bash

```bash
VPS_ENV=../vps-hostinger/.env
set -a
. "$VPS_ENV"
set +a
: "${VPS_IP:?VPS_IP ausente}"
: "${VPS_SSH_USER:?VPS_SSH_USER ausente}"
: "${VPS_SSH_KEY_PATH:?VPS_SSH_KEY_PATH ausente}"
```

### PowerShell

```powershell
$envFile = Resolve-Path ..\vps-hostinger\.env
$values = Get-Content $envFile |
  Where-Object { $_ -match '^\s*[^#\s][^=]*=' } |
  ConvertFrom-StringData
$VPS_IP = $values.VPS_IP
$VPS_SSH_USER = $values.VPS_SSH_USER
$VPS_SSH_KEY_PATH = $values.VPS_SSH_KEY_PATH
```

## Conexão

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP"
```

Valide identidade antes de alterar qualquer coisa:

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP" \
  'hostname; uptime; docker ps; docker compose ls; systemctl --failed'
```

## Administração

Acesso administrativo amplo está disponível via usuário SSH e `sudo`, conforme permissões da VPS. Não presuma diretório, container ou unit: descubra o serviço antes de agir.

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP" 'pwd; docker ps --format "table {{.Names}}\t{{.Status}}"; systemctl list-units --type=service --state=running --no-pager'
```

- Docker: inspecione compose, volumes e saúde antes de `up`, restart ou migração.
- systemd: confira `systemctl status <unit>` e `journalctl -u <unit> -n 100 --no-pager`.
- PM2: confira `pm2 list` e `pm2 logs --lines 100`.
- Logs: nunca reproduza tokens, cookies, senhas, URLs de banco ou chaves.
- Deploy/rollback: identifique release, faça backup, execute uma mudança e valide healthcheck.

## Topologia conhecida

O runtime de produção documentado do Synkroo é Cloudflare Workers/OpenNext. Não há diretório de serviço VPS confirmado nos documentos do projeto; faça descoberta remota antes de deploy ou restart.

## Operações destrutivas

Exigem confirmação explícita e backup verificado: `rm -rf`, drop/reset de banco, remoção de volume, rotação de credencial, alteração de firewall e encerramento amplo de processos.

SSH por chave é obrigatório; senha não é necessária.

## Firewall do Postgres (2026-09-25)

Autorização explícita do owner nesta sessão (task FW-15432-HARDEN-01).
Sem IP/hostname da VPS e sem segredos neste arquivo.

- **Alvo:** `15432/tcp` (container `synkroo-prod-postgres`,
  `0.0.0.0:15432->5432/tcp` + `[::]:15432->5432/tcp`). Gerenciador ativo:
  **ufw** (backend iptables-nft; `firewalld` ausente). Snapshot pré-mudança
  na VPS: `/root/firewall-backup-20260925-123223.txt` (`chmod 600`).
- **Achado estrutural:** o ufw já tinha 15 allows IPv4 Cloudflare p/ 15432 +
  `default deny (incoming)` — porém **ineficaz contra a exposição Docker**:
  chain `DOCKER-USER` vazia + `DNAT 0.0.0.0:15432 → container:5432`, de modo
  que o tráfego externo entra por `FORWARD`/`DOCKER`, fora do `INPUT` do ufw.
  Baseline: porta alcançável de fora (externo `True`); staging
  `/api/health/db` → 200 `complete:true` 33/33; prod `/api/health` → 200.
- **Tentativa aplicada (REVERSADA):** +7 allows IPv6 Cloudflare no ufw
  (total 22 regras p/ 15432) + `DOCKER-USER` v4 (15 `ACCEPT` CF + `DROP`
  final) e v6 (7 `ACCEPT` + `DROP`), com match
  `-m conntrack --ctorigdstport 15432` (pós-DNAT a porta visível é 5432, por
  isso o match na porta original). Ranges: 15 IPv4 + 7 IPv6 públicos
  (`cloudflare.com/ips-v4`, `ips-v6`). Portas 22/80/443 **intocadas**; ufw
  nunca desativado/reativado; postgres nunca reiniciado/parado;
  `pg_hba.conf`/`postgresql.conf` **intocados**.
- **Resultado (barrier):** externo não-CF passou a recusar (`False`) — MAS o
  staging `/api/health/db` caiu para 200 `complete:false`
  (`migrationsApplied: 0`, ~16 s; retry confirmou persistência). Evidência de
  que **o egresso do Hyperdrive NÃO origina dos ranges Cloudflare
  publicados**. `ROLLBACK IMEDIATO` executado. Pós-rollback: staging 200
  `complete:true` 33/33 (~0,2 s); prod `/api/health` 200; externo voltou a
  alcançável (`True`, estado original); ufw com as 15 regras IPv4 originais;
  `DOCKER-USER` (v4+v6) vazia.
- **TLS (somente leitura, sem alteração):** instância real com `ssl = on`,
  cert/key em `/etc/postgresql/tls/`, `ssl_min_protocol_version = TLSv1.2`;
  `pg_hba.conf` ativo exige `hostssl` + `scram-sha-256` (v4 e v6).
- **Rollback (comandos, na VPS via SSH):**
  ```bash
  sudo iptables -F DOCKER-USER; sudo ip6tables -F DOCKER-USER
  echo y | sudo ufw delete allow from <RANGE-V6> to any port 15432 proto tcp  # ×7 ranges v6 adicionados
  sudo ufw status numbered | grep 15432   # esperado: 15 regras IPv4 originais
  sudo iptables -L DOCKER-USER -n; sudo ip6tables -L DOCKER-USER -n  # esperado: chains vazias
  ```
  Re-testar: staging `/api/health/db` deve voltar a 200 `complete:true`.
- **Pendências do owner:** (1) 15432 segue exposta a toda a internet
  (`DOCKER-USER` vazia contorna o ufw p/ portas publicadas pelo Docker) —
  mitigação correta exige allowlist do **egresso real do Hyperdrive**
  (identificar IPs de origem via log do postgres em janela de teste) ou rota
  privada (existe o container `synkroo-prod-db-tunnel`/cloudflared na VPS —
  avaliar); **NÃO** reaplicar DROP por ranges CF sem validar staging antes;
  (2) persistência: `iptables-persistent` **não** instalado (sem
  `/etc/iptables/`); regras `DOCKER-USER` são efêmeras (reboot/recreate do
  Docker as perde) — futura regra precisa de script de re-aplicação em
  `/root` + avaliação de persistência; (3) `5433/tcp` (painel-postgres) segue
  `ALLOW IN Anywhere` — fora deste escopo, registrar decisão.

## Firewall do Postgres — atualização 2026-09-26 (allowlist ATIVA)

Autorização do owner nesta sessão ("trabalhe em todas as pendências").

- **Estado:** allowlist ATIVA em `DOCKER-USER` (v4) para o Postgres de
  produção — 17 regras: 15 ranges públicos IPv4 Cloudflare + 1 ACCEPT interno
  `172.16.0.0/12` + `DROP` final **escopado** a
  `-d <ip-container> --dport 5432` (match pós-DNAT canônico do Docker;
  `80/443/traefik`, `5433` e demais portas intocadas). Container na rede
  `172.16.3.2` (IP dinâmico — scripts resolvem via `docker inspect`).
- **Causa-raiz da falha de 2026-09-25 esclarecida:** os ranges estavam
  corretos (egresso observado do Hyperdrive: `104.23.255.x` ∈ `104.16.0.0/13`
  e `172.71.233.x` ∈ `172.64.0.0/13`, amostra 9/9 em `pg_stat_activity`);
  o problema era o **match** `-m conntrack --ctorigdstport 15432`. Com o
  match `-d $PGIP --dport 5432`, staging `/api/health/db` manteve
  `200 complete:true 33/33` (3/3 probes) e prod `/api/health` 200 **através**
  do filtro.
- **Snapshots:** `/root/firewall-backup-fw15432-20260926.txt` (pré-mudança
  deste dia) + os três de 2026-09-25. Todos `chmod 600` via root.
- **Persistência:** `/root/reapply-docker-user-firewall.sh` (idempotente,
  resolve o IP do container com retry de até 5 min p/ ordenação de boot) +
  unit `synkroo-docker-user-firewall.service` (`enable --now`, oneshot,
  `After=docker.service`). Verificada re-execução manual: "18 entradas".
- **Log de conexões:** `log_connections = on` via `ALTER SYSTEM` +
  `pg_reload_conf()` (sem restart) para observar o egresso do Hyperdrive ao
  longo do tempo. Rollback: `ALTER SYSTEM SET log_connections = 'off';
  SELECT pg_reload_conf();`. Se aparecer IP de egresso FORA dos 15 ranges,
  revisar a allowlist antes que um pool novo fique bloqueado.
- **Rollback do filtro:** `sudo systemctl disable --now
  synkroo-docker-user-firewall.service; sudo iptables -F DOCKER-USER` e
  re-testar staging `/api/health/db` (esperado `complete:true`).
- **Pendências restantes do owner:** (1) `5433/tcp` (painel-postgres) segue
  `ALLOW IN Anywhere` — registrar decisão (há `painel-cloudflared` como rota
  alternativa); (2) monitorar o log de conexões nas próximas semanas;
  (3) avaliar migração do Hyperdrive p/ rota privada (tunnel) como fechamento
  definitivo — allowlist atual é mitigação embasada, não garantia absoluta
  (amostra, não universo, do pool de egresso).
