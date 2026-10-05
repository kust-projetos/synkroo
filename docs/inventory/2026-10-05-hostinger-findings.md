# Inventário Hostinger → Contabo — Findings (vNext P2)

**Data:** 2026-10-05
**Fase:** P2 — Hostinger → Contabo (plano mestre `docs/superpowers/plans/2026-10-05-synkroo-vnext-ai-native-business-os-implementation.md`)
**Runbook:** `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md` (§3 inventário, §5.1 pré-check, §5.2/§5.3 backup e rehearsal)
**Método:**
- inventário: `ops/vps/inventory/collect-inventory.sh --side=source` executado na própria VPS (host `srv1773156`), saída redatada em [`2026-10-05-hostinger-source.txt`](2026-10-05-hostinger-source.txt);
- pré-check §5.1: `docker exec -i synkroo-prod-postgres psql` sobre SSH (socket unix, trust local), sem `psql`/`pg_dump` na máquina do operador;
- teste de exposição TCP a partir da máquina do operador (22 vs 15432).

**Revisão de segredos:** nenhum secret encontrado na saída redatada. As duas linhas de `crontab -l` são apenas caminhos de script; nenhum dump, volume, log ou arquivo de configuração foi copiado pelo coletor. Sem IPs, tokens ou senhas neste documento.

Docs-irmãos: [inventário de runtime](2026-10-05-runtime-inventory.md) · [catálogo de Actions](2026-10-05-actions-catalog.md) · [mapa de duplicação services/modules](2026-10-05-services-modules-duplication.md)

## 1. Checklist Descobrir do runbook §3

| Item §3 | Encontrado | Status |
|---|---|---|
| PostgreSQL | `synkroo-prod-postgres` — `pgvector/pgvector:pg17`, Up 4 weeks (healthy); compose `/home/deploy/infra/synkroo-prod-postgres/docker-compose.yml` (stack de 2: postgres + tunnel); volume `synkroo-prod-postgres_synkroo_prod_pgdata`; rede `synkroo-prod-postgres_default`; publica `0.0.0.0:15432->5432` e `[::]:15432->5432` via `docker-proxy`. Detalhe do DB em §2 | ✅ descoberto |
| cloudflared | `synkroo-prod-db-tunnel` — `cloudflare/cloudflared:2026.7.2` (tag pinada), Up 4 weeks, sem porta publicada (mesmo compose do postgres). Gap: ingress/hostname/credentials do tunnel não coletados | ✅ descoberto |
| Evolution | **Nenhum container Evolution nesta VPS.** O app ainda tem config Evolution (`EVOLUTION_GO_*` no `.env` privado) e o sidecar Playwright é o fallback. Para onde aponta `EVOLUTION_GO_URL` (self-hosted em outra VPS? serviço externo?) não foi determinado — requer confirmação do owner | ❌ não visto |
| Traefik/Nginx | `traefik` — `traefik:latest` (**tag flutuante**), Up 4 weeks, `0.0.0.0:80->80` e `0.0.0.0:443->443`; compose `/home/deploy/infra/traefik/docker-compose.yml`; participa da rede `proxy`. Gap: labelling/routers/domains não coletados (sem `docker inspect`) | ⚠️ parcial |
| sidecar Playwright | `synkroo-prod-whatsapp-sidecar` — imagem build local `synkroo-whatsapp-sidecar-whatsapp-sidecar`, Up 4 weeks (healthy), `127.0.0.1:3030` e `127.0.0.1:6080` (loopback); volume `synkroo-whatsapp-sidecar_synkroo_whatsapp_session`; compose próprio. Loopback-only: rota pública via `proxy`/Traefik não confirmada no inventário | ✅ descoberto |
| staging | Role `synkroo_staging` existe no PostgreSQL da source (junto de `synkroo`); o **banco staging não foi inspecionado** no pré-check. Não há container/volume de staging do Synkroo; o volume `ai-memory-evo252-s-*` pertence ao ai-memory | ⚠️ parcial |
| outros containers dependentes | Inventário completo (10 containers + 1 agente de host): `ai-memory-prod` (`akitaonrails/ai-memory:2.5.2`, healthy, `127.0.0.1:49374`), `ai-memory-bridge-252` (`python:3.12-alpine`), stack `iptv-infisical` + `iptv-infisical-postgres` + `iptv-infisical-redis` (prefixo `iptv-`: secrets manager de terceiro, **não** parte do Synkroo), `waha` (ver achado inesperado), `synkroo-prod-db-tunnel`, `traefik`, `synkroo-prod-postgres`, `synkroo-prod-whatsapp-sidecar`; `monarx-agent` roda no host (agent do provider Hostinger, UDP 1721 + TCP 65529 loopback). 6 compose files em `/home/deploy/**` | ✅ descoberto |
| cron/jobs | `crontab -l` do usuário `deploy`, 2 entradas: `*/30 * * * * /home/deploy/infra/monitor/healthcheck.sh` e `30 3 * * * /home/deploy/infra/backup/backup.sh >> /home/deploy/infra/backup/cron.log 2>&1`. 17 timers systemd, **todos de SO padrão** (apt, sysstat, logrotate, motd, fstrim, fwupd, e2scrub, man-db, dpkg-db-backup, snapd, apport, ua-timer) — nenhum timer de aplicação | ✅ descoberto |
| systemd/PM2 | `systemctl --failed` → **0 unidades**. Nenhum PM2: nenhum processo/listener de PM2 no `ss -lntup` e nenhum unit correspondente nos timers. O app não roda nesta VPS (roda na Cloudflare/OpenNext); `monarx-agent` é do provider | ✅ descoberto |
| volumes | 9 volumes, todos `local`. Do Synkroo: `synkroo-prod-postgres_synkroo_prod_pgdata` (dados do PG) e `synkroo-whatsapp-sidecar_synkroo_whatsapp_session` (sessão WhatsApp). De terceiro: `infisical_infisical_pgdata`, `infisical_infisical_redisdata`. Do ai-memory: 5 snapshots/evolution volumes | ✅ descoberto |
| bind mounts | **`docker inspect` não foi executado** pelo coletor; a saída de `docker compose ls` revela apenas os caminhos dos compose files. Conteúdo real em disco (`/home/deploy/**`) e paths de bind mount permanecem desconhecidos | ❌ não visto |
| certificados | Não inspecionados. Traefik em 80/443 sugere ACME/Let's Encrypt, mas o **store acme não foi lido**; certificados server-side/Cloudflare não foram inventariados | ❌ não visto |
| firewall | **Externamente confirmado por teste TCP:** porta 22 alcançável, **porta 15432 bloqueada**, apesar de o docker publicar `0.0.0.0:15432`. Regras não enumeradas (o coletor não inspeciona UFW/iptables/nftables nem o firewall do painel Hostinger). O `ss -lntup` local confirma o listener em `0.0.0.0:15432`, logo o bloqueio é de borda (host ou provider) | ⚠️ parcial |
| backup | `backup.sh` diário às 03:30 UTC, output em `cron.log`; `healthcheck.sh` a cada 30 min referencia `HC_PING_URL_BACKUP` (monitoramento externo do backup). Gap: destino, retenção e escopo do backup não inspecionados; `scripts/db-backup.mjs` (canônico do repo) atua sobre Postgres local e não cobre esta VPS | ⚠️ parcial |
| monitoramento | `healthcheck.sh` (30 min) + `sysstat-collect.timer`/`sysstat-summary.timer` + `monarx-agent` (agent do provider). Sem stack dedicado de métricas/logs nesta VPS; `iptv-infisical` é secrets manager, não observabilidade | ⚠️ parcial |

### Achado inesperado — WAHA já ativo na source

O container `waha` (`devlikeapro/waha:latest`, Up 8 days, **tag não pinada**) está **rodando** na source, com compose próprio em `/home/deploy/infra/waha/docker-compose.yml`, e chaves `WAHA_*` já presentes no `.env` privado — enquanto o app ainda está configurado com Evolution (`EVOLUTION_GO_*`) e não há container Evolution nesta VPS.

Observado no inventário: sem porta publicada no host (apenas `3000/tcp` exposto no namespace do container), **sem volume** (nada de persistência de sessão), sem healthcheck reportado, sem dependência de banco (compose `running(1)`).

Duas leituras possíveis, ambas sem confirmação: (a) parte do escopo P3 já foi executada e WAHA está deployed-but-idle; (b) foi um deploy exploratório. A imagem `:latest` viola o requisito de imagem pinada do runbook §6.1. **Requer decisão do owner sobre qual provider o app realmente usa antes de qualquer cutover de canal.**

### Ambiente da source (contexto de sizing)

- Disco: 48G total, 42G usados, **6.3G livres (87%)** em `/dev/sda1`.
- RAM: 3.8Gi total, 2.4Gi usados, 190Mi livres, 1.4Gi available; swap 2.0Gi com 884Mi usados.
- Timezone `GMT`; sem IPv6 filters aplicados a 22/80/443 (somente IPv4 e IPv6 publicados).

## 2. Pré-check §5.1

Coletado com `docker exec -i synkroo-prod-postgres psql` sobre SSH (socket unix, trust local — ver *Acesso ao banco* abaixo).

| Check §5.1 | Valor medido |
|---|---|
| versão source | PostgreSQL **17.11** (build Debian, pacote pgdg12) |
| extensions | `btree_gist`, `plpgsql`, **`vector`** — as três presentes |
| migration ledger (Drizzle) | **33** entradas aplicadas |
| tamanho | `db_size` = **11 MB** |
| tabelas | **68** relações em `public` |
| conexões | **6** conexões |
| encoding / timezone | `UTF8` / `GMT` |
| roles | `synkroo`, `synkroo_staging` |
| maiores relações | todas são tabelas de sistema de `pg_catalog` — **volume de dados de usuário desprezível**, consistente com o piloto W12 nunca ter iniciado |

Checks de §5.1 **não** cobertos por esta coleta: "backup recente" e "restore drill atual" para o banco desta VPS (o que existe é o drill local do Postgres de desenvolvimento, em `docs/runbooks/restore-tests/`, que não exercita a VPS).

### Acesso ao banco — rota canônica

O teste TCP externo mostrou 22 aberto e **15432 bloqueado**, apesar do `0.0.0.0:15432` publicado pelo docker: o acesso direto ao PostgreSQL está barrado por firewall de borda. A tentativa de conexão pelo driver `pg` através de SSH local-forward para `127.0.0.1:15432` **travou no handshake TLS/pg** — o caminho de published port (`docker-proxy`) não é confiável contra o `pg_hba.conf` vivo, coerente com o comentário do header no repo: *"The database has no host port"*.

Rota de acesso validada hoje (única funcional):

```bash
ssh <vps> "docker exec -i synkroo-prod-postgres psql -U synkroo -d <db> -c '<sql>'"
ssh <vps> "docker exec -i synkroo-prod-postgres pg_dump -U synkroo -d <db> -Fc" > dump.dump
```

### Evidências do backup §5.2 (2026-10-05)

Dump custom format produzido pela rota canônica (stream SSH → arquivo local, **zero escrita on-host** — o disco da source está a 87%):

| Artefato | Valor |
|---|---|
| Dump | `backups/synkroo-source-<ts>.dump` (186.306 bytes, header `PGDMP` verificado) — **gitignored, local** |
| SHA-256 | `1b6394e0f2987ab37190f7ce9e7d81b3a65924fe5d7f6744ca50dcc9cd8ac002` (sidecar `.sha256` gravado) |
| Globals | `backups/globals-source-<ts>.sql` (950 bytes; roles `synkroo` + `synkroo_staging`; **contém hashes de role — nunca versionar**) |
| Superuser do cluster | `synkroo` (não `postgres` — `pg_dumpall --globals-only -U postgres` falha com *role does not exist*; usar `-U synkroo`) |
| Pendência §5.2 | backup **off-host** ainda não configurado (depende da decisão de destino — ver §3/g) |

## 3. Implicações para a migração

- **(a) Dump trivial.** 11 MB de banco com 68 tabelas majoritariamente vazias: o dump custom é pequeno e rápido. Executar via `docker exec` remoto com **stream direto por SSH** para o destino, sem staging em disco na source.
- **(b) Disco da source a 87% (6.3G livres).** **Nunca gravar dump on-host.** `backup.sh`/`pg_dump` devem sempre ser piped por SSH para fora. Cuidado adicional: o `backup.sh` diário às 03:30 UTC compete pelo mesmo espaço durante a janela de cutover.
- **(c) Sem cliente PostgreSQL na máquina do operador** (sem `pg_dump`/`psql` no PATH, sem instalação de PostgreSQL 17). O dump/restore tem de rodar por `docker exec` no lado remoto, ou exige instalar um cliente local como passo explícito antes de qualquer rehearsals.
- **(d) Acesso ao banco é tunnel-only.** O target precisa decidir a rota Hyperdrive (§4 Rede do runbook) **com a origem real do tráfego identificada primeiro** — não repetir a publicação `0.0.0.0` esperando que o firewall do target seja permissivo como o da source.
- **(e) `0.0.0.0:15432` é publicação residual sem exposição externa real.** Não reproduzir no Contabo; remover do compose do target e manter o Postgres acessível só via tunnel/unix socket.
- **(f) WAHA já está na source.** Qualquer cutover de canal (P3) depende de decisão do owner sobre o provider efetivo e sobre a origem do `waha` atual (deploy exploratory ou P3 parcial). Até lá, não desligar, não reapontar e não duplicar o WAHA no target.
- **(g) `ai-memory-prod` + `ai-memory-bridge` rodam nesta VPS** — é onde vive o servidor MCP ai-memory deste projeto, com 5 volumes de snapshot. Decidir explicitamente se o stack migra para o Contabo ou fica na Hostinger; se ficar, o Source vira dependência de memória do time e entra no plano de cleanup/decommission (§12) como ativo a preservar.
- **(h) Stack de terceiros no mesmo host** (`iptv-infisical` com pg+redis, `monarx-agent` do provider) não é escopo do Synkroo: não migrar, e não tratar como resíduo removível sem aprovação do responsável por aquele workload.
- **(i) Firewall da borda da source não é reproduzível a partir do inventário.** O bootstrap do Contabo (§4, `--apply-firewall` em gate separado) precisa ser avaliado contra o comportamento observado aqui: com `0.0.0.0:15432` publicado e sem exposição externa, a regra que funciona é fechar o que não é público.

## 4. Próximos passos

Alinhado ao runbook:

1. **Fechar os gaps do §3** antes do cutover: `docker inspect` dos containers do Synkroo (bind mounts, labelling do Traefik, healthchecks, resource limits); leitura do store acme do Traefik; inventário do `pg_hba.conf`/`postgresql.conf` vivos; destino e retenção do `backup.sh`; confirmação do owner sobre Evolution (onde está o `EVOLUTION_GO_URL`) e sobre o WAHA já ativo.
2. **§5.2 — Backup source.** `npx tsx scripts/backup-vps-db.ts --side=source`, produzindo dump custom `-Fc` + SHA-256 + `*.meta.json` redatado, **streamado por SSH** (nunca gravado on-host, item (b)), com o `pg_dump` executado por `docker exec` (item (c)). Guardar uma cópia off-host, não só na source.
3. **§5.3 — Rehearsal no target.** Depois do bootstrap Contabo (§4): `npx tsx scripts/restore-vps-db.ts --side=target --from <dump> --create-db synkroo_rehearsal`, validando pgvector, btree_gist, ledger Drizzle (33), constraints, counts e queries de health. Definir no target a rota Hyperdrive/túnel conforme item (d)/(e), sem publicar a porta do Postgres.
4. **Cutover DB (§5.4)** só com restore test verde, backup off-host e rollback ensaiado (§13 Infra GO); Hostinger não é destruída no dia do cutover.
5. **P3 (canal)** permanece bloqueado até a decisão do owner sobre o WAHA já presente na source (item (f)) e sobre a rota Hyperdrive (item (d)).

Evidências a registrar por etapa conforme §14: timestamp, versão/digest das imagens, backup hash, smoke e decisão GO/NO-GO.
