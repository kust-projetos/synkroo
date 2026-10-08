# Acesso VPS — Synkroo

## Fonte de configuração

> **Migração 2026-10-05:** Hostinger é o **source** atual e Contabo é o **target** planejado. Ver `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`.

Execute comandos a partir da raiz deste projeto. A configuração privada da VPS é resolvida por `scripts/lib/vps-env.mjs`, compartilhado por `scripts/migrate-vps.ts`, `scripts/update-hyperdrive.ts`, `scripts/setup-staging-db.ts`, `scripts/backup-vps-db.ts` e `scripts/restore-vps-db.ts`, com esta precedência:

1. `SYNKROO_VPS_ENV` — caminho explícito e provider-neutral (absoluto, ou relativo ao diretório de trabalho atual). **Falha fechada:** se a variável estiver definida e apontar para algo que não é um arquivo legível, o script aborta — nunca cai silenciosamente no fallback legado.
2. `../vps-hostinger/.env` — fallback legado **temporário**, resolvido a partir da raiz do repositório (não do diretório de trabalho atual), acompanhado de aviso `[deprecation]` em stderr. Deve ser removido ao fim da migração P2.

Definido mas vazio/branco (`SYNKROO_VPS_ENV=`) é tratado como não definido, preservando a semântica de shell usual. Nenhum literal `../vps-contabo` é usado em código: o caminho do alvo é sempre fornecido pelo operador.

Nunca copie senha, token, chave privada ou valor de `.env` para este repositório. Nenhum script imprime valores de credencial; mensagens e avisos carregam apenas o **caminho** do arquivo e nomes de chave.

Exemplo (a partir da raiz do repositório):

```bash
export SYNKROO_VPS_ENV=../vps-hostinger/.env
npx tsx scripts/setup-staging-db.ts --side=source
```

## Contrato source/target (P1)

Os três scripts operacionais recebem `--side=source|target` **obrigatório**: qual VPS a execução toca. Não há default e não há inferência a partir do arquivo de `.env` ou do hostname — ausente ou inválido, o script imprime o uso e sai com código 1.

- `source` — a VPS de onde os dados são copiados (atualmente Hostinger).
- `target` — a VPS para onde os dados serão copiados (Contabo).

Em `migrate-vps.ts`, `--side` e `--target` são eixos ortogonais: `--side` escolhe **qual VPS**, `--target` escolhe **qual banco dentro daquela VPS** (`production`, `staging` ou `all`; padrão `production`).

### Chaves por lado

Cada lado tem quatro chaves próprias no `.env` privado, resolvidas por `scripts/lib/vps-env.mjs`:

| Chave | Conteúdo |
|---|---|
| `VPS_SOURCE_IP` / `VPS_TARGET_IP` | IP/host da VPS |
| `VPS_SOURCE_PG_PORT` / `VPS_TARGET_PG_PORT` | porta do PostgreSQL (inteiro 1–65535) |
| `VPS_SOURCE_POSTGRES_PASSWORD` / `VPS_TARGET_POSTGRES_PASSWORD` | senha do role `synkroo` (produção) |
| `VPS_SOURCE_STAGING_PASSWORD` / `VPS_TARGET_STAGING_PASSWORD` | senha do role `synkroo_staging` |

A separação de credenciais continua estrita: a senha de staging **nunca** é preenchida com a de produção, em nenhum lado.

### Aliases genéricos (deprecated)

As quatro chaves genéricas `VPS_IP`, `VPS_PG_PORT`, `VPS_POSTGRES_PASSWORD` e `VPS_STAGING_PASSWORD` continuam funcionando como **fallback por chave**, com aviso `[deprecated]` por chave usada durante a migração. A precedência é por chave, não por arquivo:

1. `VPS_<SIDE>_<CAMPO>` (prefixada) — sempre vence.
2. `VPS_<CAMPO>` (genérica, deprecated) — usada só quando a prefixada está ausente ou vazia, com aviso.
3. Ausente nas duas → falha fechada `SYNKROO_VPS_SETTING_MISSING`, citando a chave **prefixada** (a que o operador deve criar).

O aviso nunca imprime valor de credencial — apenas nomes de chave. Porta inválida (vazia, `NaN`, `0`, `70000`, texto) falha com `SYNKROO_VPS_PORT_INVALID`, citando a chave resolvida.

Exemplo de `.env` do source:

```bash
VPS_SOURCE_IP='<ip-do-source>'
VPS_SOURCE_PG_PORT='15432'
VPS_SOURCE_POSTGRES_PASSWORD='<senha>'
VPS_SOURCE_STAGING_PASSWORD='<senha>'
```

### Um `.env` por lado (recomendado)

Cada lado tem seu próprio arquivo privado, apontado por `SYNKROO_VPS_ENV` na sessão. Isso elimina a dependência do fallback genérico e impede que uma execução leia a VPS errada:

```bash
# source
export SYNKROO_VPS_ENV=../vps-hostinger/.env
npx tsx scripts/migrate-vps.ts --side=source --target=all

# target (após provisionar o .env com as chaves VPS_TARGET_*)
export SYNKROO_VPS_ENV=../vps-contabo/.env
npx tsx scripts/migrate-vps.ts --side=target --target=all
npx tsx scripts/setup-staging-db.ts --side=target
npx tsx scripts/update-hyperdrive.ts --side=target
```

Os caminhos acima são ilustrativos: `SYNKROO_VPS_ENV` é provider-neutral e nenhum caminho é fixado em código. Nenhum literal de provider aparece nos scripts.

`update-hyperdrive.ts` atualiza as duas configs (staging e produção) na mesma execução; ambos os bancos vivem na VPS escolhida por `--side`.

### Falha fechada em `setup-staging-db.ts`

A senha de staging **efetiva** é sempre planejada para persistência antes de qualquer mutação no banco: `required` quando gerada no próprio script, e sincronizada quando `process.env` fornece um valor que o arquivo ainda não tem (divergente ou ausente). Um valor que veio do arquivo não gera escrita. Sem esse gate, o role `synkroo_staging` receberia uma senha que não existiria em disco em nenhum lugar.

A chave de destino acompanha a origem do valor efetivo: uma senha gerada (ou ausente) é gravada na chave **prefixada** `VPS_<SIDE>_STAGING_PASSWORD`; um valor resolvido por alias genérico continua sendo gravado na chave genérica, para que o script não reintroduza um alias que o operador já tenha migrado. O script não exige `VPS_<SIDE>_STAGING_PASSWORD` — ele a gera quando ausente, e a falha fechada abaixo garante que a credencial gerada não se perca.

A gravação é atômica (arquivo temporário no mesmo diretório + `rename`) e **sempre** com modo `0600`: a substituição não reaproveita a permissão anterior, para que um arquivo de credenciais previamente group/world-readable não continue legível por outros usuários.

O `CREATE`/`ALTER ROLE` é montado por `scripts/lib/pg-ddl.mjs`, que escapa a senha como literal `E'…'` (aspas e barras escapadas, NUL rejeitado). Não há interpolação de senha em SQL cru no script.

### Sem shell em `update-hyperdrive.ts`

A CLI do Wrangler local (`node_modules/wrangler/bin/wrangler.js`) é executada como argv explícito via `execFileSync(process.execPath, argv)`, sem shell. Uma senha com espaço, aspas, `;`, `$(…)` ou crase permanece em um único elemento de argv e não consegue iniciar um segundo comando. Se o entry local do Wrangler não existir, o script falha fechado pedindo `npm ci`.

### Dry-run e rollback (scripts mutadores)

Os 3 scripts aceitam `--dry-run` (opt-in): mostram o plano (origem, destino,
recursos — sem secrets) sem executar nenhuma mutação. Invocação sem a flag
mantém o comportamento existente e registra o plano antes de agir.

- `setup-staging-db.ts` nunca rotaciona `VPS_STAGING_PASSWORD` em re-execução
  (gera só quando ausente); se o role existir mas a senha configurada não
  autenticar, aborta com erro de inconsistência em vez de rotação silenciosa.
- Toda escrita no `.env` é atômica (tmp+rename) com backup `.bak` prévio;
  re-execução com valores iguais não reescreve o arquivo.
- Após gerar/alterar senha de staging, rode `update-hyperdrive.ts` para o
  Hyperdrive servir a credencial nova (o setup avisa; divergência silenciosa
  não é tolerada).
- Limitação documentada (P2): `update-hyperdrive.ts` passa a senha como
  elemento argv discreto (sem shell), mas ela segue visível na tabela de
  processos local durante a execução do wrangler — avaliar handoff via
  stdin/env se o wrangler vier a suportar.

### Bash/Git Bash

Use a mesma variável para as sessões shell manuais, para que o operador e os scripts apontem sempre para o mesmo arquivo:

```bash
export SYNKROO_VPS_ENV=../vps-hostinger/.env   # enquanto o fallback legado existir
set -a
. "$SYNKROO_VPS_ENV"
set +a
# Expanda a chave do lado em uso (source nesta sessão):
: "${VPS_SOURCE_IP:?VPS_SOURCE_IP ausente}"
: "${VPS_SOURCE_PG_PORT:?VPS_SOURCE_PG_PORT ausente}"
: "${VPS_SSH_USER:?VPS_SSH_USER ausente}"
: "${VPS_SSH_KEY_PATH:?VPS_SSH_KEY_PATH ausente}"
```

### Formato do arquivo

Os valores gravados pelos scripts usam **aspas simples POSIX**: `CHAVE='valor'`, com uma aspa simples interna escrita como `'\''`. Uma senha com espaço, `$`, `;`, crase ou aspas nas bordas continua sendo **um único valor exato** — tanto na leitura do parser quanto no `source` do shell (`set -a; . "$SYNKROO_VPS_ENV"`).

- Valores legados (`CHAVE=valor`, `CHAVE="valor"`, `CHAVE='valor'`) continuam sendo lidos como antes, com `trim` e remoção das aspas de borda. Arquivos existentes não precisam ser migrados.
- Leitura é **last-wins** em chaves duplicadas; por isso o writer reescreve **todas** as ocorrências de uma chave, para que nenhuma credencial obsoleta prevaleça.
- `NUL`, `CR` e `LF` não são representáveis e são **rejeitados** antes de qualquer conexão ao banco (`SYNKROO_ENV_VALUE_UNREPRESENTABLE`); nada é gravado. Um segredo vindo de `process.env` sem arquivo segue rodando sem persistência, porque é de fonte externa.

### PowerShell

O arquivo usa quoting POSIX (`'\''`), que o `ConvertFrom-StringData` não decodifica. Para leitura pontual use o parser canônico:

```powershell
# Chave do lado em uso (source neste exemplo); com o arquivo migrado, as prefixadas são a fonte.
node -e "const {loadVpsEnv}=await import('./scripts/lib/vps-env.mjs');console.log(loadVpsEnv().values.VPS_SOURCE_IP)"
```

Para sessões manuais, `set -a; . "$SYNKROO_VPS_ENV"` em Git Bash é o caminho fiel.

### Mensagens de erro

As mensagens de `migrate-vps.ts`, `update-hyperdrive.ts` e `setup-staging-db.ts` nomeiam a **origem** dos valores (`SYNKROO_VPS_ENV=<caminho>`, o fallback legado, ou a instrução de definir a variável) e nunca o conteúdo do arquivo:

- `SYNKROO_VPS_ENV is set to "<caminho>" but no file exists there` — caminho definido e inválido; corrija ou use `unset`.
- `<CHAVE> is missing: set it in process.env or SYNKROO_VPS_ENV=/absolute/path/to/.env` — chave ausente no env e no arquivo. Com `--side`, `<CHAVE>` é a prefixada do lado (`VPS_TARGET_IP`), nunca a genérica.
- `Cannot persist generated VPS_STAGING_PASSWORD: no VPS env file was found` — falha fechada antes de mutar o banco.
- `Refusing to persist <CHAVE>: the value contains NUL, CR or LF, which the quoted .env format cannot represent` — nada foi gravado e nada foi conectado; troque a credencial.
- `[deprecation] SYNKROO_VPS_ENV is not set: falling back to the legacy path "<caminho>"` — aviso, não erro.
- `[deprecated] chave genérica VPS_IP usada para VPS_TARGET_IP — atualize o .env para a chave prefixada durante a migração` — aviso por chave genérica em uso; nunca imprime valor. Quando há genéricas em uso, os scripts também imprimem um **resumo agregado** por execução: `[deprecated] side="target" ainda lê as chaves genéricas VPS_IP, VPS_PG_PORT — renomeie para as chaves VPS_TARGET_* no .env`. Um `.env` 100% genérico produz, portanto, 1 linha por chave + 1 resumo.
- `--side is required (SYNKROO_VPS_SIDE_INVALID): expected source or target.` + uso do script — exit 1, sem conexão tentada. O mesmo acontece com `--target=` **vazio** em `migrate-vps.ts`: antes cairia no default `production`; agora é erro explícito (fail-closed).
- `<CHAVE> is invalid: expected an integer port between 1 and 65535` — `SYNKROO_VPS_PORT_INVALID`; só a chave e o motivo, nunca o valor.

Falha de banco em `setup-staging-db.ts` **nunca** imprime texto do driver (o `CREATE/ALTER ROLE` carrega a senha em texto claro e o driver ecoa a statement). A saída é um código allowlisted ou uma mensagem fixa:

- `Setup failed: database operation failed (code: 28P01)` — código de transporte/SQLSTATE allowlisted (`28P01`, `42501`, `ECONNREFUSED`, `ETIMEDOUT`, …).
- `Setup failed: database operation failed (details redacted to avoid leaking credentials)` — qualquer outro código; nada do erro bruto é exibido.

Erros de preflight deste repo (`SYNKROO_*`) mantêm a mensagem original, que só contém caminho e nome de chave.

## Conexão

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_SOURCE_IP"
```

Valide identidade antes de alterar qualquer coisa:

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_SOURCE_IP" \
  'hostname; uptime; docker ps; docker compose ls; systemctl --failed'
```

## VPS Contabo (nova — destino de migração, 2026-10)

Segunda VPS do parque, já com bootstrap+hardening concluídos. Credenciais no
mesmo `../vps-hostinger/.env`, no bloco `CONTABO_VPS_*`:

- `CONTABO_VPS_IP` (213.199.37.252), `CONTABO_VPS_SSH_USER` (deploy),
  `CONTABO_VPS_SSH_KEY_PATH` (`~/.ssh/id_ed25519_contabo_vps`, chave dedicada).
- Login exclusivamente por chave (root/senha desativados via SSH). Ubuntu 26.04,
  8 GB RAM, 96 GB disco, UFW (22/tcp), fail2ban, unattended-upgrades, swap 2 GB.
- Doc completo de acesso/operação/recuperação: `../vps-hostinger/docs/contabo-vps.md`.
- Estado inicial: sem Docker/Traefik — instalação faz parte da migração.

## Administração

Acesso administrativo amplo está disponível via usuário SSH e `sudo`, conforme permissões da VPS. Não presuma diretório, container ou unit: descubra o serviço antes de agir.

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_SOURCE_IP" 'pwd; docker ps --format "table {{.Names}}\t{{.Status}}"; systemctl list-units --type=service --state=running --no-pager'
```

- Docker: inspecione compose, volumes e saúde antes de `up`, restart ou migração.
- systemd: confira `systemctl status <unit>` e `journalctl -u <unit> -n 100 --no-pager`.
- PM2: confira `pm2 list` e `pm2 logs --lines 100`.
- Logs: nunca reproduza tokens, cookies, senhas, URLs de banco ou chaves.
- Deploy/rollback: identifique release, faça backup, execute uma mudança e valide healthcheck.

## Topologia conhecida

O runtime de aplicação continua Cloudflare Workers/OpenNext. A VPS hospeda componentes stateful/auxiliares. O repo confirma PostgreSQL 17 + pgvector, cloudflared/tunnel e sidecar Playwright; Evolution e outros serviços devem ser confirmados por descoberta remota antes da migração.

O target é Contabo. WAHA deve ser provisionado diretamente no target e substituir Evolution em uma janela separada do cutover de banco.

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
