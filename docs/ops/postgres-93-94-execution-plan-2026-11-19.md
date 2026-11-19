# Plano de execução — A-REDE (#93) e A-PAPEIS (#94) — 2026-11-19

> **Data:** 2026-11-18 (o nome do arquivo segue a data CET do inventário, 2026-11-19).
> **Escopo:** PostgreSQL Synkroo na VPS Contabo (`db-central-hml`, porta publicada
> 15434) — **A-REDE** (#93: contenção IPv4/IPv6 da porta publicada) e **A-PAPEIS**
> (#94: runtime Hyperdrive deixar de conectar como owner e passar às roles app).
>
> **Autoridade:** as operações foram autorizadas pelo owner em 2026-11-18, **porém
> sujeitas a esta reaprovação**: o owner escolheu "reaprovar plano detalhado antes de
> qualquer mutação". Este documento **não autoriza execução**; só a marcação do
> checklist da §7 pelo owner o faz.
>
> **NADA FOI EXECUTADO.** Este plano foi escrito a partir do inventário
> [`postgres-93-94-inventory-2026-11-19.md`](postgres-93-94-inventory-2026-11-19.md)
> e do [ADR-BASE-21](../adr/ADR-BASE-21-contabo-postgres-private-connectivity.md),
> acrescidos dos pré-checks somente leitura de 2026-11-19. Nenhum comando abaixo foi testado
> contra o host real; todos devem ser revalidados em `DRY_RUN`/leitura antes de uso.
> Nenhum `PROD_READY` é declarado.
>
> **Convenções:** sem segredos neste arquivo. Valores aparecem como `<PLACEHOLDER>`
> ou nomes de variável. Senhas nunca vão para argv, URL, log, chat nem Git.

---

## §0 — Mudanças materiais vs plano anterior (2026-11-12)

O plano/inventário de 2026-11-12 **não serve mais**:

| Item | 2026-11-12 | Medido em 2026-11-18/19 | Consequência |
|---|---|---|---|
| Endpoint | `synkroo-prod-postgres`, porta **15433** | `db-central-hml`, porta **15434** (`0.0.0.0` e `[::]`); 15433 sem listener; `synkroo-prod-postgres` inexistente | Todo comando/regra mirando 15433 ou `SYNKROO-D3` está obsoleto |
| Instância | dedicada | **compartilhada** (`freelingo`, `kaneo`, `infisical`, `pi_financeiro_canonical`, `iptv`, `synkroo`, `synkroo_staging`) | Raio de impacto maior: qualquer regra de rede, `pg_hba` ou `ALTER ROLE` afeta outros projetos; `max_connections=100` é compartilhado |
| Roles | owners eram superuser | `synkroo`/`synkroo_staging` **não** são superuser (f/f/f/f) | A parte "remover superuser" de #94 já está feita; resta migrar o runtime para as roles app |
| Tabelas | 68 | **75** | Grants devem ser recontados em todas as 75 |
| D3 v4 | `SYNKROO-D3` → container dedicado | `SYNKROO-D3` **órfã** (alvo `172.20.0.2`, contadores zerados); contenção real é `DBCENTRAL-HML` → `172.31.0.3`, com tráfego vivo | Não reaproveitar o script `ops/vps/synkroo-prod-postgres/apply-d3-firewall.sh` sem adaptá-lo |
| D3 v6 | `SYNKROO-D3-V6` (DROP 5432) | Pré-check de 2026-11-19 confirmou cenário **S1**: listener `[::]:15434` é `docker-proxy`, sem IPv6 global no container e sem DNAT v6 | Contenção v6 de 15434 deve atuar em **INPUT**; manter DROP-only e não remover `SYNKROO-D3-V6` sem prova |
| Firewall persistente | unit `synkroo-d3-firewall` | duas units ativas: `synkroo-d3-firewall.service` e `dbcentral-hml-firewall.service` | A unit/script do `db-central` **não está versionada neste repo** e não foi lida |
| UFW | allows para 15433 | 15 allows obsoletos para 15433, nenhum para 15434 | Limpeza possível, mas só após prova de não-uso |

**Resolução dos pré-checks — 2026-11-19:** S1 confirmado (`docker inspect` sem
`GlobalIPv6Address` em `db-central-hml`; `ss -ltnp`/`lsof` atribuem `[::]:15434`
ao `docker-proxy`; `ip6tables -t nat -S` sem DNAT v6). Assim, a contenção v6
deve ser em `INPUT`, não `DOCKER-USER`; `SYNKROO-D3-V6` está zerada e pode não
ser a barreira efetiva. Foram observadas cinco conexões Hyperdrive por banco,
`ssl=t`, todas IPv4 em `172.70.245.*`, `104.22.123.*` e `162.158.85.*`; nenhum
egresso IPv6 foi observado. Produção e staging: `/api/health` ok,
`/api/health/db` complete 40/40 com `maintenanceControl`, ledger 40/40. Os
grants foram verificados: `synkroo_app` sem exceções CRUD nas 75 tabelas;
`synkroo_staging_app` tem exceção intencional em `public.outbox_control`
(SELECT apenas; sem INSERT/UPDATE/DELETE). `db-central-prod` é
`pgvector/pgvector:pg17`, sem porta publicada, na rede `dbcentral_net`
(`172.31.0.7`), Compose `db-central`/serviço `postgres-prod`, contendo
`freelingo`, `kaneo` e `postgres`, nenhum banco Synkroo — divergência benigna,
embora esteja na mesma rede. O log `backup.log` de 19/11 05:30 não confirma
dump recente; dumps versionados disponíveis são de outubro. **Backup recente
verificado continua pendente e bloqueia a janela.** Nada foi executado.

Também mudou o ADR: o ADR-BASE-21 ainda descreve 15433/`synkroo-prod-postgres`; deve
ser reescrito (fora deste plano, mas é entregável posterior).

---

## §1 — Pré-checks comuns (SOMENTE LEITURA)

Repetir **imediatamente antes** da janela (o inventário tem horas/dias de idade).
Salvar a saída em `/root/.secrets/synkroo-93-94/precheck-<UTC>.txt` (diretório 0700,
arquivos 0600, fora do repo). Nenhuma saída pode conter senha.

### 1.1 Rede e host

```bash
umask 077
docker ps --format '{{.Names}}\t{{.Ports}}\t{{.Status}}' | grep -E 'db-central|postgres'
ss -ltnp | grep -E ':(15433|15434|5433|5432)\b' || true
docker inspect db-central-hml --format '{{json .NetworkSettings.Networks}}' | jq 'map_values({IPAddress,GlobalIPv6Address,Gateway})'
docker inspect db-central-hml --format '{{json .NetworkSettings.Ports}}'
docker network ls; docker network inspect <REDE_DO_DB_CENTRAL> --format '{{json .IPAM.Config}} {{.EnableIPv6}}'
cat /etc/docker/daemon.json 2>/dev/null | jq '{ip6tables,ipv6,"userland-proxy",iptables}'
iptables  -S DOCKER-USER; iptables  -L DBCENTRAL-HML -v -n --line-numbers; iptables  -L SYNKROO-D3 -v -n
ip6tables -S DOCKER-USER; ip6tables -L SYNKROO-D3-V6 -v -n
ufw status numbered
systemctl status dbcentral-hml-firewall.service synkroo-d3-firewall.service --no-pager
systemctl cat dbcentral-hml-firewall.service synkroo-d3-firewall.service
```

Registrar: IPv4/IPv6 do container, se `ip6tables`/`userland-proxy` do daemon estão
ligados, contadores atuais por range e do DROP, hash (`sha256sum`) do script e da
unit `dbcentral-hml-firewall`, e o `EnvironmentFile` (somente chaves, sem valores
sensíveis).

### 1.2 Banco (psql local como superuser via `docker exec`, só SELECT, sem senha em argv)

```bash
docker exec -i db-central-hml psql -U postgres -v ON_ERROR_STOP=1 -X <<'SQL'
-- atributos das roles
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls, rolcanlogin, rolconnlimit
  FROM pg_roles WHERE rolname IN ('synkroo','synkroo_staging','synkroo_app','synkroo_staging_app','outbox_worker','outbox_executor');
-- conexões atuais (client_addr/família/app name; nenhum segredo)
SELECT datname, usename, application_name, client_addr, family(client_addr) AS fam, ssl, count(*)
  FROM pg_stat_activity a LEFT JOIN pg_stat_ssl s USING (pid)
 WHERE datname IN ('synkroo','synkroo_staging') GROUP BY 1,2,3,4,5,6 ORDER BY 1,2;
SHOW log_statement; SHOW log_connections; SHOW max_connections; SHOW ssl;
SELECT count(*) AS conns_total FROM pg_stat_activity;
SQL
```

Interpretação: `fam=4` vs `6` mostra se o egresso real do Hyperdrive usa IPv4 ou
IPv6. `client_addr` igual ao gateway da bridge sugere `docker-proxy` (origem
mascarada) — isso **muda** onde a contenção precisa ser aplicada (ver §2.b).
`application_name` pode vir vazio; registrar como observado.
`log_statement` deve ser `none`/`ddl`-sem-senha: se for `all`/`ddl`, **não** executar
`ALTER ROLE ... PASSWORD` sem antes tratar o vazamento em log (§3.b).

### 1.3 Grants efetivos das app roles (em TODAS as 75 tabelas, sequences, funções, outbox)

Rodar **em cada banco** (`-d synkroo` com `synkroo_app`; `-d synkroo_staging` com
`synkroo_staging_app`). Template (substituir `<APP_ROLE>`):

```sql
-- 1) cobertura de tabelas (schema public) — esperado: 75 linhas, nenhuma faltando
SELECT c.relname,
       has_table_privilege('<APP_ROLE>', c.oid, 'SELECT')  AS sel,
       has_table_privilege('<APP_ROLE>', c.oid, 'INSERT')  AS ins,
       has_table_privilege('<APP_ROLE>', c.oid, 'UPDATE')  AS upd,
       has_table_privilege('<APP_ROLE>', c.oid, 'DELETE')  AS del,
       c.relrowsecurity AS rls, c.relforcerowsecurity AS rls_force, pg_get_userbyid(c.relowner) AS owner
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY 1;
-- 2) sequences
SELECT c.relname, has_sequence_privilege('<APP_ROLE>', c.oid, 'USAGE') AS usage,
       has_sequence_privilege('<APP_ROLE>', c.oid, 'SELECT') AS sel,
       has_sequence_privilege('<APP_ROLE>', c.oid, 'UPDATE') AS upd
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='S';
-- 3) funções (incl. SECURITY DEFINER e a função do gate do outbox)
SELECT p.proname, p.prosecdef AS security_definer, pg_get_userbyid(p.proowner) AS owner,
       has_function_privilege('<APP_ROLE>', p.oid, 'EXECUTE') AS can_exec
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public';
-- 4) schema drizzle (o readiness lê drizzle.__drizzle_migrations)
SELECT has_schema_privilege('<APP_ROLE>','drizzle','USAGE') AS usage_drizzle,
       has_table_privilege('<APP_ROLE>','drizzle.__drizzle_migrations','SELECT') AS sel_ledger;
SELECT has_schema_privilege('<APP_ROLE>','public','USAGE') AS usage_public;
-- 5) políticas RLS e triggers do outbox
SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public' ORDER BY 1,2;
SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid='public.outbox_jobs'::regclass AND NOT tgisinternal;
-- 6) default privileges (garante que tabelas FUTURAS de migrations dão grant à app role)
SELECT pg_get_userbyid(defaclrole) AS grantor, defaclobjtype, defaclacl FROM pg_default_acl;
-- 7) a app role NÃO pode ser superuser/bypassrls, nem membro da owner
SELECT r.rolname, r.rolsuper, r.rolbypassrls,
       EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles o ON o.oid=m.roleid
                WHERE m.member=r.oid AND o.rolname IN ('synkroo','synkroo_staging')) AS member_of_owner
  FROM pg_roles r WHERE r.rolname='<APP_ROLE>';
```

**Critério de parada (qualquer um):**
- contagem de tabelas ≠ 75 sem explicação, ou qualquer `sel/ins/upd/del=false` em
  tabela que o app escreve;
- `can_exec=false` em função usada por trigger/gate do outbox, ou `usage_drizzle` /
  `sel_ledger = false` (o readiness quebraria → `db-unreachable`);
- sequence sem USAGE onde a tabela usa `serial/identity` com default de sequence;
- `default privileges` não cobrem o owner do runtime de migrations (tabelas futuras
  ficariam sem grant → regressão na próxima migration);
- RLS com `relforcerowsecurity` e políticas que dependem de `current_user` = owner;
- app role superuser, `bypassrls`, ou membro da owner (anularia o benefício de #94).

Correção de grants, se necessária, é **mutação** e entra como passo §3.a — nunca
durante o pré-check.

### 1.4 Aplicação, ledger e backup

```bash
curl -fsS https://<APP_HOST_PROD>/api/health            # 200 ok
curl -fsS https://<APP_HOST_PROD>/api/health/db         # 200 complete 40/40 maintenanceControl presente
# readiness autenticado (G1): usa token interno de $READINESS_TOKEN do ambiente; nunca imprimir
curl -fsS -H "Authorization: Bearer ${READINESS_TOKEN}" https://<APP_HOST_PROD>/api/internal/readiness | jq '{status,checks}'
# idem staging
docker exec -i db-central-hml psql -U postgres -d synkroo -XAtc "select count(*) from drizzle.__drizzle_migrations"   # 40
docker exec -i db-central-hml psql -U postgres -d synkroo_staging -XAtc "select count(*) from drizzle.__drizzle_migrations" # 40
```

Backup: executar `scripts/db-backup.mjs` (ou o runbook `docs/runbooks/database-recovery.md`
§2.3) para `synkroo` **e** `synkroo_staging`; verificar integridade
(`pg_restore --list` sem erro, tamanho plausível, `sha256` registrado) e que o
restore do último drill (2026-09-26) continua válido. **Também** dump de roles/grants
(`pg_dumpall --roles-only` de `postgres` local, guardado 0600 fora do repo, pois
contém hashes SCRAM) e `pg_dump --schema-only` com ACLs para reverter grants.

**Parada global:** health ≠ verde, ledger ≠ 40/40, backup não verificado, conexões
totais > 80 do `max_connections=100`, ou diferença material entre inventário e estado
atual não explicada → **não abrir a janela**.

**Resultado dos checks de 2026-11-19:** checks de host/rede, conexões e família
de IP, grants, health e ledger foram lidos; resultados resumidos na §0. 15433
segue sem listener; UFW conserva 15 allows obsoletos; units de firewall seguem
ativas; `DBCENTRAL-HML` v4 tem tráfego vivo e DROP com 12 pacotes. Permanecem
pendentes confirmar com os donos os consumidores da porta compartilhada 15434
e obter **backup recente verificado** antes da janela. O `backup.log` não satisfaz
esse gate.

---

## §2 — A-REDE (#93) — passos

Objetivo: contenção efetiva e persistente para 15434 em **IPv4 e IPv6**, sem
derrubar o Hyperdrive nem os outros projetos da instância. A-REDE é independente de
A-PAPEIS e **vai primeiro**, em janela própria.

**Princípios** (herdados do ADR D1–D3 e do script existente): fill-before-jump;
idempotência via `-C`; nunca `-F` em `DOCKER-USER`; nunca flush global; ranges
Cloudflare são **contenção, não identidade** (D2); sem `iptables-restore` de
snapshot completo (sobrescreveria chains gerenciadas pelo Docker).

### Passo 2.a — Snapshot de segurança (somente leitura + gravação 0600)

```bash
umask 077; S=/root/.secrets/synkroo-93-94/snap-$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$S"
iptables-save  > "$S/iptables.v4"; ip6tables-save > "$S/iptables.v6"
ufw status numbered verbose > "$S/ufw.txt"; cp -a /etc/ufw "$S/ufw-etc"
cp -a /etc/systemd/system/dbcentral-hml-firewall.service /etc/systemd/system/synkroo-d3-firewall.service "$S/"
cp -a <CAMINHO_SCRIPT_DBCENTRAL_HML> <CAMINHO_ENVFILE_SEM_SEGREDOS> "$S/"
cp -a <CAMINHO_COMPOSE_DB_CENTRAL>/docker-compose*.yml "$S/" ; sha256sum "$S"/* > "$S/SHA256SUMS"; chmod -R go-rwx "$S"
```

- **Risco:** nulo (leitura). Cuidado: snapshot do `.env`/compose pode conter
  segredos → permissão 0600 e **nunca** colar no chat/PR.
- **Validação:** `SHA256SUMS` íntegro; arquivos não vazios.
- **Rollback:** n/a (não altera estado). Os snapshots servem para *comparar* (`diff`),
  não para `restore` global.

### Passo 2.b — Confirmar IPv6 do container e como 15434 é publicada

Decide **onde** a contenção v6 precisa atuar. O pré-check de 2026-11-19 confirmou **S1**:

| Cenário | Evidência | Onde filtrar |
|---|---|---|
| **S1 — confirmado** — container sem IPv6, `[::]:15434` servida por `docker-proxy` | `GlobalIPv6Address` vazio; `ss -ltnp`/`lsof` mostram `docker-proxy`; `ip6tables -t nat -S` sem DNAT v6 | **INPUT**, não `DOCKER-USER`; tráfego é recebido pelo host e reencaminhado pelo proxy |
| **S2** — `ip6tables` do daemon Docker ligado, container com IPv6 | `daemon.json` `ip6tables:true`, `GlobalIPv6Address` presente | `DOCKER-USER` v6 com `-d <IPV6_DO_CONTAINER>` (padrão de `DBCENTRAL-HML`) |
| **S3** — v6 publicada mas encaminhada por DNAT v6 para o IPv4 | improvável; só admitir com evidência | decidir com o owner antes de seguir |

Não há DNAT v6 observado; S1 torna `INPUT` o ponto de contenção. Embora
`SYNKROO-D3-V6` esteja zerada, isso não prova que seja dispensável ou a barreira
efetiva. **Só remover após prova** de que a nova contenção está efetiva e de
que a chain não é a única barreira v6.

Comandos (leitura):
```bash
docker inspect db-central-hml --format '{{range .NetworkSettings.Networks}}{{.GlobalIPv6Address}} {{end}}'
ss -ltnp | grep -E '15434'; pgrep -a docker-proxy | grep 15434 || true
ip6tables -S INPUT | head -50; ufw status verbose | grep -i -E '15434|v6'
```

- **Risco:** nenhum (leitura).
- **Validação:** cenário **S1 confirmado** em 2026-11-19; revalidar imediatamente antes da janela.
- **Rollback:** n/a.
- **Resultado:** cenário **S1 confirmado** em 2026-11-19.

### Passo 2.c — Criar a contenção v6 (somente se 15434 for alcançável por IPv6)

Decisão de conteúdo (recomendada, a ser aprovada na §7): **DROP-only para v6**, a
menos que 1.2 mostre egresso Hyperdrive **IPv6** real (`fam=6`). Justificativa: o
egresso observado é IPv4 (`162.158.0.0/15`, `104.16.0.0/13`, `172.64.0.0/13`), D2
proíbe tratar ranges como identidade, e allowlist v6 sem egresso observado é o mesmo
erro que derrubou staging em 2026-09-25. Se for necessário permitir v6 Cloudflare,
**buscar a lista IPv6 oficial na hora** (`https://www.cloudflare.com/ips-v6`) — o
conjunto IPv6 **não é de 15 ranges** (os 15 são os IPv4); não copiar números deste
documento.

Cenário **S1 confirmado**: usar `INPUT` v6, escopado à porta publicada 15434,
com DROP-only. Comando genérico (não executado; revalidar em leitura e dry-run
antes da janela):
```bash
ip6tables -C INPUT -p tcp --dport 15434 -m comment --comment <MARCADOR> -j DROP 2>/dev/null \
  || ip6tables -I INPUT 1 -p tcp --dport 15434 -m comment --comment <MARCADOR> -j DROP
```
O egresso Hyperdrive observado é todo IPv4; sem egresso IPv6 observado, manter
DROP-only e não criar ACCEPT v6. Gate bloqueante: antes da janela, confirmar
com os donos dos outros projetos o impacto na porta compartilhada 15434 **e
obter backup recente verificado** (§1.4). Sem ambas as confirmações, não executar.

- **Risco:** se o Hyperdrive de fato conectar por IPv6, o DROP o derruba (outage de
  produção+staging). Mitigação: 1.2 prova a família; manter `ip6tables -D` pronto;
  executar com sessão SSH secundária aberta e verificar `/api/health/db` +
  contadores logo após. Também afeta **outros projetos** da instância que usem v6 em
  15434 (freelingo/kaneo/infisical/pi/iptv) → confirmar na §7 que o owner aceita.
- **Validação:** `ip6tables -S INPUT`; contador do DROP aumenta no probe
  negativo; readiness e `pg_stat_activity` inalterados (5 conexões Hyperdrive cada).
- **Rollback exato:**
  ```bash
  ip6tables -D INPUT -p tcp --dport 15434 -m comment --comment <MARCADOR> -j DROP
  ```
  (desfaz **só** a regra que o passo criou.)

### Passo 2.d — Probes externos (positivos e negativos, v4 e v6)

Origem do teste: um host **fora** da VPS e fora de ranges Cloudflare, com v4 **e** v6
(a escolher e declarar na janela; é uma **limitação**: hoje não há).
```bash
pg_isready -h <VPS_IPV4> -p 15434 -t 5    # negativo v4: esperado timeout/no response (DROP)
pg_isready -h <VPS_IPV6> -p 15434 -t 5    # negativo v6: idem
nc -vz -w 5 <VPS_IPV4> 15434; nc -6vz -w 5 <VPS_IPV6> 15434
```
Sem credenciais: só alcance TCP/handshake, **nunca** tentativa de autenticação.
**Positivo:** não se simula origem Cloudflare de fora; a prova positiva é o
Hyperdrive vivo — readiness autenticado 200, `pg_stat_activity` com as 5+5 conexões e
contadores de `DBCENTRAL-HML` crescendo nos ACCEPT de `162.158.0.0/15`, `104.16.0.0/13`,
`172.64.0.0/13`.
- **Risco:** tráfego de teste é benigno; não repetir em massa.
- **Validação (G2):** v4 negativo bloqueado, v6 negativo bloqueado, positivo vivo.
  **Resultado invertido em qualquer família reprova o gate e aciona rollback de 2.c.**
- **Rollback:** o de 2.c.

### Passo 2.e — Persistência (atualizar script e unit EXISTENTES, não criar outro conjunto)

1. **Ler** o script e a unit reais do host (`dbcentral-hml-firewall.service` e o que
   ela executa) — **não estão neste repo**. Trazer uma cópia sem segredos para
   `ops/vps/db-central-hml/` (PR separado) para que o estado fique versionado.
2. Acrescentar ao **mesmo** script a regra v6 de INPUT (2.c) idempotente, sem
   `-F`/`-X` no caminho normal. S1 não depende de IP IPv6 do container.
3. Recarregar: `systemctl daemon-reload && systemctl restart dbcentral-hml-firewall.service`
   e checar `-C` idempotente (rodar duas vezes = no-op).
- **Risco:** erro no script no boot → v6 sem contenção até correção manual; restart
  da unit não deve dropar a chain v4 (verificar contadores antes/depois).
- **Validação:** `systemctl is-active/is-enabled`; `ip6tables -S` idêntico antes/depois
  do restart; probes de 2.d repetidos.
- **Rollback:** restaurar o script/unit dos snapshots (2.a), `daemon-reload`, restart,
  e remover as regras v6 por `-D` (2.c).

### Passo 2.f — Limpeza de regras órfãs (SOMENTE após prova de não-uso)

Candidatas: chain v4 `SYNKROO-D3` (e o salto para `172.20.0.2`), 15 allows ufw de
15433, `synkroo-d3-firewall.service`, **e** `SYNKROO-D3-V6`.

**Provas exigidas antes de cada remoção:**
- `SYNKROO-D3`: contadores zerados em duas leituras ≥ 24 h; nenhum container com
  `172.20.0.2` em nenhuma rede (`docker network inspect` de todas). **Risco latente de
  mantê-la:** se outro container receber `172.20.0.2`, o DROP final o afetaria; no
  boot a unit antiga recria os saltos.
- ufw 15433: `ss` sem listener e nenhum container publicando 15433.
- `SYNKROO-D3-V6`: está zerada no pré-check, o que não prova que seja dispensável.
  Remover **somente** após prova de que a contenção INPUT de S1 está efetiva e de
  que esta chain não é a única barreira v6. Até essa prova, mantê-la.

Procedimento (modelo do cabeçalho de `apply-d3-firewall.sh`): desabilitar a unit antes
→ remover salto com `-D` exato → só então `-F`/`-X` da chain **própria** → verificar
`iptables -S DOCKER-USER`. UFW: remover por regra, **uma a uma, conferindo a
numeração a cada passo** (`ufw status numbered`, `ufw --force delete <N>`), nunca
`ufw reset`.
- **Risco:** baixo se provas obedecidas; alto se removida chain que ainda é barreira.
- **Validação:** `iptables -S DOCKER-USER` só com o que sobrou intencionalmente;
  `DBCENTRAL-HML` intocada; probes 2.d de novo; readiness verde.
- **Rollback:** recriar a regra removida a partir do snapshot 2.a (`iptables -S` do
  trecho) com `-I/-A` explícitos; `ufw allow ...` com a regra original do `ufw.txt`.

### Passo 2.g — Drill de recreate/reboot (janela SEPARADA)

Só depois de 2.c–2.e verdes e estáveis (≥ 24 h):
1. `docker compose up -d --force-recreate db-central-hml` (compose do host; o IP do
   container pode mudar → a guarda do script deve **abortar fail-closed** em vez de
   abrir; validar esse comportamento e ter a rotação manual do script pronta).
2. Reboot do host.
Após cada etapa: `DOCKER-USER` v4 **e** v6 com as chains, probes 2.d, readiness,
`pg_stat_activity` 5+5 (Hyperdrive reconecta sozinho).
- **Risco:** **outage de toda a instância compartilhada** (freelingo, kaneo,
  infisical, iptv…) durante recreate/reboot. Exige aviso aos outros donos (§4) e
  janela própria. Risco adicional: recreate pelo compose do host vs do repo (deriva
  E6) — usar **só** o compose do host.
- **Validação (G3):** contenção v4+v6 efetiva após recreate **e** após reboot.
- **Rollback:** reaplicar manualmente o bloco do script com o novo IP; se o container
  não subir, restaurar o compose do snapshot. O banco em si não é modificado.

---

## §3 — A-PAPEIS (#94) — passos

O pré-check confirmou que `synkroo_app` não tem exceções CRUD nas 75 tabelas.
Em staging, `public.outbox_control` concede SELECT a `synkroo_staging_app`, mas
não INSERT/UPDATE/DELETE por design: é uma tabela de controle administrativa.
**Essa exceção é intencional; não corrigir nem tratar como bloqueio de A-PAPEIS.**

Objetivo: Hyperdrive de produção e de staging passam a conectar como `synkroo_app` e
`synkroo_staging_app` (não-owner, sem DDL), mantendo as owners para migrations.
**Pré-requisito:** A-REDE 2.a–2.e concluído (ou decisão explícita do owner de ordem
diferente) e janela própria.

### Passo 3.a — Validar (e, se preciso, corrigir) grants completos

Executar 1.3 para as duas app roles. Se faltar grant, preparar um SQL **versionado**
(`GRANT … ON ALL TABLES/SEQUENCES IN SCHEMA public`, `GRANT EXECUTE` nas funções
necessárias, `GRANT USAGE ON SCHEMA drizzle` + `GRANT SELECT ON drizzle.__drizzle_migrations`,
e `ALTER DEFAULT PRIVILEGES FOR ROLE <OWNER> IN SCHEMA public GRANT … TO <APP_ROLE>`),
revisado e aprovado antes; aplicar como owner/`postgres` em transação, depois repetir
1.3. **Verificar também as funções/triggers do outbox** (`outbox_jobs`, a função do
gate e `claim_release`) e se `outbox_worker`/`outbox_executor` dependem de
`current_user` — um runtime como `synkroo_app` pode se comportar diferente de owner em
RLS/`SECURITY DEFINER`.
- **Risco:** grant a mais amplia superfície; grant a menos quebra jornadas. Nada
  de `GRANT ALL`/`SUPERUSER`/`BYPASSRLS`.
- **Validação:** 1.3 sem nenhum `false` indevido; teste funcional em staging primeiro
  (3.d).
- **Rollback:** `REVOKE` simétrico do mesmo SQL versionado (gerar o inverso junto).
  O `pg_dump --schema-only` com ACLs (1.4) é a referência do estado anterior.

### Passo 3.b — Credencial da app role

Decisão: **usar a senha existente se ela estiver em cofre/`.env` e for conhecida**;
caso contrário **gerar uma nova**. Hoje **não se sabe** se existe senha conhecida
(inventário não leu isso) — a confirmar.
- Gerar 32+ bytes aleatórios; gravar **atomicamente** em arquivo `.env` **fora do
  repo** (`SYNKROO_VPS_ENV`) com modo 0600 (`write tmp → fsync → chmod 600 → rename`),
  após **backup** do `.env` atual (0600). Chaves novas sugeridas (a alinhar com o
  código de 3.c): `VPS_SOURCE_APP_PASSWORD` e `VPS_SOURCE_STAGING_APP_PASSWORD`.
  Nunca imprimir, nunca em argv, nunca em histórico (`set +o history`).
- Aplicar a senha no banco **sem argv**: variável de ambiente herdada + `\getenv`
  (psql 17 suporta):
  ```bash
  docker exec -i -e APP_PW db-central-hml psql -U postgres -X -v ON_ERROR_STOP=1 <<'SQL'
  \getenv pw APP_PW
  ALTER ROLE synkroo_app PASSWORD :'pw';
  SQL
  ```
  (`APP_PW` exportado no shell sem aparecer no comando; repetir para
  `synkroo_staging_app`.) **Antes:** conferir `SHOW log_statement` (§1.2) — se
  `all`/`ddl`, a senha iria para o log do Postgres: nesse caso `SET log_statement='none'`
  só na sessão ou usar `ALTER ROLE ... PASSWORD 'md5/SCRAM-hash'` pré-computado.
  Confirmar também que a rotação não afeta nenhum outro consumidor das app roles
  (1.2 mostra 0 conexões hoje).
- **Risco:** invalidar uma senha em uso por outro serviço desconhecido; vazamento em
  log/histórico.
- **Validação:** conexão de teste **local** como `synkroo_app` (`SELECT 1`) com
  `PGPASSWORD` herdado de ambiente e `PGSSLMODE=require`, sem imprimir.
- **Rollback:** a senha antiga das app roles **não** é restaurável se não era
  conhecida → como a app role não tinha uso (0 conexões), o rollback funcional é
  voltar o Hyperdrive às owners (3.f); `ALTER ROLE ... NOLOGIN` na app role se o
  owner decidir isolar. Backup do `.env` restaura as chaves antigas.

### Passo 3.c — Código: `scripts/update-hyperdrive.ts` (PR separado, ANTES da janela)

**Achado verificado:** o script hoje usa `user: 'synkroo_staging'` e `user: 'synkroo'`
**hard-coded** (linhas ~266/275/287/298) e só aceita as senhas
`VPS_<SIDE>_STAGING_PASSWORD`/`VPS_<SIDE>_POSTGRES_PASSWORD`. **Não suporta app
roles.** Portanto exige alteração:
- novo flag, p.ex. `--db-role=owner|app` (default `owner`, **byte-idêntico** ao
  comportamento atual); com `app`, usa `synkroo_app`/`synkroo_staging_app` e as chaves
  `VPS_<SIDE>_APP_PASSWORD`/`VPS_<SIDE>_STAGING_APP_PASSWORD` do env resolvido por
  `SYNKROO_VPS_ENV`; falha fechada nomeando a variável ausente (nunca o valor);
- `--dry-run` imprime o plano com o **usuário** e **sem** senha/token (o `safeOriginText`
  já faz isso); incluir `user` na reconciliação GET+compare (a senha não é observável);
- testes: default owner inalterado; `app` seleciona usuário/senha certos; senha
  ausente aborta; staging-only não exige senha de produção; redaction nunca expõe a
  senha; `--target=both` não mistura roles;
- origem: confirmar que `VPS_SOURCE_PG_PORT` no `.env` privado é **15434** (o
  inventário **não leu** o host/porta reais do Hyperdrive via API — lê-los por
  `GET` antes de qualquer PATCH e comparar).
- **Rota alternativa (sem código):** PATCH manual via API Cloudflare com a mesma lib —
  não recomendada (sem teste, sem reconcile).
- **Risco:** PATCH aponta para host/porta errados se o `.env` divergir da origem real.
- **Validação:** `npm run typecheck && npm test` + `npx tsx scripts/update-hyperdrive.ts
  --side=source --target=staging --db-role=app --dry-run` sem chamadas de API.
- **Rollback:** reverter o PR; o default `owner` não muda comportamento.

### Passo 3.d — Aplicar: staging primeiro, depois produção (um de cada vez)

Credenciais antigas (owner) **permanecem válidas** durante todo o passo.
1. Snapshot do estado Hyperdrive: `GET` do config (campos seguros) — o script já faz;
   guardar a saída sem segredos junto com o `host/port/database/user` anteriores.
2. **Staging:** `npx tsx scripts/update-hyperdrive.ts --side=source --target=staging --db-role=app`
   (CLOUDFLARE_API_TOKEN/ACCOUNT_ID apenas em `process.env`).
3. Validação de staging (3.e). Só então:
4. **Produção:** `… --target=prod --db-role=app`; validação 3.e. Nunca `--target=both`
   nesta janela.
- **Risco:** pool do Hyperdrive reconecta por Postgres user novo; durante a
  transição pode haver erros pontuais; `outbox` e jobs com `current_user` diferente
  podem falhar. **Mitigação:** staging primeiro; produção só em baixo tráfego;
  watch de `/api/health/db` e logs do worker.
- **Rollback:** §3.f.

### Passo 3.e — Validação (por ambiente, em seguida ao PATCH)

- `/api/health` 200; `/api/health/db` 200 `complete` **40/40** e `maintenanceControl`
  presente; readiness autenticado 200 `status:ready` (`checks.database=ok`,
  `checks.migrations=complete`) — **isto**, não o 200 isolado de `/api/health/db`, é
  a prova (ADR adendo Etapa 4).
- Smoke de jornadas mínimas (login, leitura de agenda/paciente, escrita simples em
  staging, mensagem/outbox em staging; em produção apenas leituras e uma escrita
  controlada de baixo impacto **se o owner aprovar**).
- `pg_stat_activity`: conexões do Hyperdrive aparecem como `synkroo_app` /
  `synkroo_staging_app` e as owners ficam sem conexões do runtime (espera-se queda
  gradual; `synkroo`/`synkroo_staging` podem manter conexões de outro uso).
  Se `permission denied` aparecer nos logs: **abort** + rollback (§3.f).
- **Critério para dar a troca por estável:** 24 h sem `permission denied`, erros 5xx
  do app em linha-base, e a próxima execução de migrations (owner) concede grants
  corretamente à app role (verificar default privileges — 1.3 item 6).

### Passo 3.f — Rollback

Reapontar o Hyperdrive para as owners com os valores salvos:
`npx tsx scripts/update-hyperdrive.ts --side=source --target=<staging|prod> --db-role=owner`
(idempotente; é o caminho legado). Confirmar via `GET` (user de volta a
`synkroo`/`synkroo_staging`), readiness verde e `pg_stat_activity`. Se o script novo
falhar, PATCH manual com a mesma lib usando os valores do snapshot. As senhas owner
**nunca** são alteradas por este plano, então o rollback é sempre possível.

### Passo 3.g — `pg_hba` → `hostssl` (SOMENTE após estabilização, janela separada)

Hoje: `host all all all scram-sha-256` (não exige SSL). Mudar para `hostssl` +
`hostnossl … reject` impede conexão sem TLS, mas **afeta todos os projetos da
instância compartilhada** e qualquer cliente sem TLS (kaneo/infisical/iptv/etc.).
Pré-requisitos: inventariar `pg_stat_ssl` por usuário/aplicação por um período,
verificar que Hyperdrive (já `ssl=t`) e todos os outros clientes usam TLS, ter
`pg_hba` anterior salvo e `SELECT pg_reload_conf()` (não restart). Rollback: restaurar
o `pg_hba` salvo + reload. **Fora do escopo da primeira janela e dependente de
aprovação específica do owner e dos demais donos.**

---

## §4 — Janela e comunicação

| Item | Proposta (a confirmar pelo owner) |
|---|---|
| Janela A-REDE 2.a–2.e | baixo tráfego, ex.: madrugada de dia útil/domingo, **03:00–05:00 BRT**; ~60–90 min |
| Janela A-PAPEIS 3.a–3.e | outra madrugada de baixo tráfego, **≥ 24 h** depois e só com A-REDE estável; ~60 min por ambiente (staging → produção) |
| Janela 2.g (recreate/reboot) | **separada**, anunciada aos donos de freelingo/kaneo/infisical/iptv/pi; ~30–45 min |
| Quem executa | operador de infra com acesso SSH (papel `infra-engineer`/owner), com segunda sessão SSH aberta |
| Quem valida | owner (ou delegado) valida readiness, smoke e `pg_stat_activity`; evidências coladas no registro da missão sem segredos |
| Comunicação | aviso prévio aos donos dos demais bancos da instância compartilhada; registro do início/fim em `docs/ops/` |

**Critérios de abort (qualquer um → rollback imediato do passo corrente):**
- `/api/health/db` ou readiness não volta a 200 em **5 min** após a mudança;
- teste negativo v4 ou v6 falha (alcança) **ou** positivo falha (Hyperdrive perde
  conexões / contadores ACCEPT param);
- `permission denied`/`db-unreachable` nos logs após troca de role;
- qualquer app role com grant ausente no pré-check;
- conexões totais próximas de `max_connections=100` ou latência anômala;
- surgimento de erro em outro projeto da instância compartilhada;
- diferença não explicada entre pré-check e inventário.

---

## §5 — Matriz de rollback

| Passo | Como desfazer | Evidência de que voltou ao estado anterior |
|---|---|---|
| 2.a snapshot | n/a (sem mutação) | `SHA256SUMS` íntegro |
| 2.c regra v6 INPUT | `ip6tables -D INPUT -p tcp --dport 15434 … -j DROP` (regra exata criada) | `ip6tables-save` sem a regra adicionada; diff com `iptables.v6` do snapshot; readiness verde |
| 2.e script/unit | restaurar arquivos do snapshot + `daemon-reload` + restart | `sha256sum` igual ao snapshot; `systemctl is-active` |
| 2.f remoção de órfãs | recriar regra a partir de `-S` salvo / `ufw allow` do `ufw.txt` | `iptables -S`/`ufw status numbered` iguais ao snapshot no trecho |
| 2.g recreate/reboot | reaplicar bloco com o IP novo; restaurar compose do snapshot | contenção v4+v6 visível; readiness verde |
| 3.a grants | `REVOKE` simétrico do SQL versionado | 1.3 igual ao pré-estado; `pg_dump --schema-only` ACL diff |
| 3.b senha da app role | owner decide `NOLOGIN` se isolar; senha antiga **não** restaurável se desconhecida | app role sem conexões; Hyperdrive nas owners |
| 3.c código | reverter PR (default `owner` inalterado) | testes verdes na versão revertida |
| 3.d/3.f Hyperdrive | `--db-role=owner` (ou PATCH com snapshot) por ambiente | `GET` do Hyperdrive com user owner; readiness 200; `pg_stat_activity` com owners |
| 3.g `pg_hba` | restaurar `pg_hba` salvo + `pg_reload_conf()` | `pg_hba_file_rules` igual ao salvo |

---

## §6 — Fora de escopo

- **G4/G5** do ADR-BASE-21 (Tunnel + Access, remoção da porta publicada, rollback
  contido) — não iniciados e não dependem deste plano.
- Piloto real / go-no-go W12.
- Mudança de `pg_hba` além do estudo de 3.g (que é janela separada e condicional).
- WAHA, WhatsApp e demais serviços do VPS.
- Reescrita do ADR-BASE-21 e versionamento do compose/script do `db-central-hml`
  (PRs documentais/ops próprios).
- Rotação das senhas das **owners** (decisão do owner de 2026-09-25: cancelada).
- Qualquer declaração de `PROD_READY`: **nenhuma** é feita aqui nem após a execução
  sem evidência completa de G1–G3 e do #94.

## Limitações assumidas

- Nenhum teste externo v4/v6 foi feito; o cenário S1 foi confirmado, mas a eficácia da contenção ainda não foi provada por probe.
- Host/porta/usuário reais do Hyperdrive não foram lidos pela API Cloudflare; as conexões observadas no banco foram todas IPv4.
- O script/unit/compose de `db-central-hml` não foram lidos.
- `log_connections=off`: sem trilha histórica de conexões; usar contadores e
  `pg_stat_activity` como evidência.
- O host de teste externo com v4+v6 ainda precisa ser definido.
- Não se sabe se existe senha conhecida de `synkroo_app`/`synkroo_staging_app`.
- Backup recente não confirmado; é gate bloqueante para a janela.
- Todos os comandos são **proposta**; nenhum foi executado ou testado. Nenhum `PROD_READY` é declarado.

---

## §7 — Checklist de aprovação do owner

Marcar cada item **antes** de qualquer execução (a ausência de uma marca bloqueia o
passo correspondente):

- [ ] Confirmo que a instância **compartilhada** `db-central-hml` pode receber
      mudança de firewall (chain v6 e limpeza), ciente do impacto em
      freelingo/kaneo/infisical/pi_financeiro_canonical/iptv.
- [ ] Confirmo o impacto em outros consumidores da porta compartilhada 15434,
      após consultar os donos dos projetos afetados.
- [ ] Confirmo backup recente verificado de `synkroo` e `synkroo_staging`
      antes da janela; sem essa confirmação a execução fica bloqueada.
- [ ] Aprovo a política v6 **DROP-only** (sem allowlist de ranges IPv6) — ou indico
      que há egresso IPv6 observado e exijo allowlist.
- [ ] Aprovo manter `SYNKROO-D3-V6` até prova de que não é a barreira v6 efetiva.
- [ ] Aprovo a limpeza das regras órfãs (`SYNKROO-D3`, ufw 15433,
      `synkroo-d3-firewall.service`) **somente após** as provas do passo 2.f.
- [ ] Designo o host externo (v4+v6) para os probes negativos.
- [ ] Confirmo a **rotação/definição da credencial** de `synkroo_app` e
      `synkroo_staging_app` (ou informo a senha existente por cofre, sem repetir em chat).
- [ ] Aprovo o PR separado de `scripts/update-hyperdrive.ts` (`--db-role`) **antes**
      da janela.
- [ ] Aprovo staging primeiro e produção depois, um por vez, com credenciais owner
      mantidas válidas.
- [ ] Aprovo as janelas da §4 e a comunicação aos demais donos da instância.
- [ ] Aprovo (ou não) a janela separada de drill de recreate/reboot (2.g), ciente do
      outage da instância compartilhada.
- [ ] Reconheço que `pg_hba → hostssl` (3.g) **não** faz parte desta execução.
- [ ] Reconheço que nenhum `PROD_READY` será declarado ao final.
