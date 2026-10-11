# Runbook — Runtime de banco em menor privilégio (proposta arquitetural + plano operacional)

**Data:** 2026-10-10 · **Base:** `a7478979` (branch `docs/plan-db-runtime-roles`,
worktree `C:\Users\walis\AppData\Local\Temp\opencode\synkroo-e2a-role-docs`)
· **Status:** **PROPOSTA — NADA EXECUTADO.** Este documento especifica arquitetura e
plano operacional; não cria role, não altera grant, não rotaciona credencial e não
toca configuração de Hyperdrive. Nenhuma ação de produção foi autorizada nesta rodada.

**Revisão 2026-10-11 (endereça findings de review).** (1) `CONNECT`/`TEMPORARY` com
default em `PUBLIC` — ausência de `GRANT` por-role **não** nega cross-env; inventário
de ACL no Stage 0 e enforcement movido para o **Stage 3**, **depois** do rehearsal e da
criação/validação dos roles (a revisão anterior punha esse enforcement como "Stage 0b",
antes de ambos — ordem corrigida, ver §5). (2) `EXECUTE` em function
com default `PUBLIC`; distinção **extensão × aplicação**; sem revoke em bloco antes do
inventário. (3) **identidades de credencial separadas** (admin antigo vs. runtime novo)
por ambiente; chaves novas, sem repurpose das existentes. (4) gate de transição do
Hyperdrive por **smoke de readiness do Worker + identificação do principal + drenagem
natural** — contagem de sessão sozinha não basta. (5) **reconciliação do admin:** o
dono quer identidades de runtime novas, **não** a deleção do admin — "descomissionar"
significa sair do Hyperdrive/runtime apenas; o login/secret admin segue preservado para
migração/backup/restore, e revoke/delete de credencial admin é autorização futura
separada, fora desta rodada. Nada foi executado; segue proposta.

**Revisão 2026-10-11 (b) — três correções de precisão.** (1) **Escopo do Stage 3:**
enforcement `PUBLIC` só em `synkroo_staging`; a negação do runtime de staging na base de
produção (`synkroo_staging_app`→`synkroo`) só é probe depois do **Stage 5** — probes
separados por etapa (§5, §7). (2) **Negativo `CREATE EXTENSION vector`:** `IF NOT EXISTS`
contra base com `vector` já instalado é no-op; o negativo passa a usar **banco
descartável sem a extensão** (§7). (3) **Rollback** do enforcement de ACL documentado
como cláusula operacional explícita (§8). Nada executado; segue proposta.

**Revisão 2026-10-11 (c) — findings finais de review.** (1) **Identidade de probe
autenticável — sem depender de falha de autenticação:** negação de `CONNECT` só se prova
com identidade que **existe e autentica**; senha inválida ou role inexistente falha com
`28P01` (autenticação) e **não** é evidência de negação. Por isso o negativo do Stage 3
usa uma **identidade de probe dedicada, autenticável e sem grant** (criada no Stage 2), e
não `synkroo_app` — que em produção só passa a existir no Stage 5; `has_database_privilege`
sobre role inexistente **erro** (`42704`), não `false` (V18). A direção
`synkroo_staging_app`→`synkroo` segue reservada ao **Stage 5** (§5, §7). (2) **Negativo
`CREATE EXTENSION vector`:** banco descartável **separado e sem a extensão**, com o papel
de app titular de `CONNECT` + `CREATE` no schema — aí o único denial é o da extensão
(`42501 permission denied to create extension "vector"`); no banco da aplicação a extensão
segue instalada e o positivo de coluna `vector` permanece (§7). (3) **Rollback da ACL de
`PUBLIC`:** somente regrant **nomeado** e inventariado; o snapshot é **referência/diff**,
nunca restauração em bloco; `PUBLIC` não recebe `CONNECT`/`TEMPORARY` de volta (§8).
(4) **Fail-closed e autorização explícita do owner por etapa de ACL** (§5, Stages 3 e 5).
Nada executado; segue proposta.

**Regra de segredo deste documento:** ele **não contém DDL executável de criação de
role com credencial** — nenhuma sentença que já saia pronta para copiar e colar com
uma senha. Onde uma mutation de role seria necessária, a execução é delegada aos helpers
já existentes (`scripts/lib/pg-ddl.mjs` — `quotePgIdentifier`, `quotePgLiteral`), e
nenhum valor de senha é reproduzido, nem como placeholder. As únicas sentenças SQL
aqui são **consultas somente-leitura de catálogo** (verificação), que não carregam
segredo. Fonte da mesma política: `scripts/lib/pg-ddl.mjs:94-96` e
`scripts/lib/pg-ddl.mjs:128-147` (saída de erro saneada).

**Fontes canônicas consultadas:** `src/lib/db/migrations/**` (0000–0036),
`scripts/update-hyperdrive.ts`, `scripts/migrate-vps.ts`, `scripts/restore-vps-db.ts`,
`scripts/backup-vps-db.ts`, `scripts/setup-staging-db.ts`, `scripts/lib/pg-ddl.mjs`,
`src/lib/db/client.ts`, `src/services/api-handlers/health/db.ts`, `wrangler.toml`,
`docs/inventory/2026-10-07-p2-contabo-validation.md`,
`docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md`,
`docs/audit/migrations-policy.md`, `docs/ops/vps-access.md`.

---

## 1. Fatos: verificados neste checkout vs. reportados (não verificáveis aqui)

### 1.1 Verificados no código em `a7478979` (evidência local, reproduzível)

| # | Fato | Evidência |
|---|---|---|
| V1 | Banco-alvo é PostgreSQL 17 com imagem pgvector/pg17, tanto em dev quanto no ambiente de teste descartável | `docker-compose.yml` (`pgvector/pgvector:pg17`), `docker-compose.remediation.yml` (idem, porta 55434) |
| V2 | O ledger Drizzle tem **36** entradas (`0000`–`0036`, gap herdado `0017`); a saúde compara com `EXPECTED_MIGRATIONS = 36` | `src/lib/db/migrations/meta/_journal.json` (idx 0–36), `src/services/api-handlers/health/db.ts:12` |
| V3 | A saúde lê o ledger com **SELECT** em `drizzle.__drizzle_migrations` — somente leitura, sem INSERT/UPDATE | `src/services/api-handlers/health/db.ts:30` |
| V4 | `pgvector` é criado por migration na criação do schema (`0000` linha 1) e pelo script de staging (`vector` + `btree_gist`) | `src/lib/db/migrations/0000_jazzy_strong_guy.sql:1`; `scripts/setup-staging-db.ts:239-240` |
| V5 | Três tabelas carregam `embedding vector(1536)`: `messages`, `conversation_memories`, `knowledge_base` | `0000_jazzy_strong_guy.sql:299`, `:250`, `:721-728` |
| V6 | **Não existe sequence** em nenhuma migration ativa (sem `serial`, `bigserial`, `AS IDENTITY`, `nextval`, `CREATE SEQUENCE`); ids são `uuid DEFAULT gen_random_uuid()` | grep em `src/lib/db/migrations/**.sql`; `0000_jazzy_strong_guy.sql:9` |
| V7 | **Nenhuma function ou trigger** é criada por migration ativa (só `CREATE INDEX`); não há chamada `.rpc(`/`nextval` no código de aplicação | grep `FUNCTION\|TRIGGER` = 0 em `src/lib/db/migrations/**.sql`; grep `.rpc(`/`nextval` em `src/**` = 0 |
| V8 | A aplicação conecta usando **a connection string do Hyperdrive** (binding) em produção e `DATABASE_URL` em Node — o role do runtime é o role configurado no Hyperdrive | `src/lib/db/client.ts` (`resolveConnectionString`, `setDbConnectionString`) |
| V9 | IDs de Hyperdrive conferem entre código e runtime: prod `be5a789a…` (`wrangler.toml:42`), staging `e0033a75…` (`wrangler.toml:84`) | `scripts/update-hyperdrive.ts:45-46` |
| V10 | `scripts/update-hyperdrive.ts` **fixa os usernames em literal** e atualiza **staging e produção na mesma invocação**, staging primeiro | `scripts/update-hyperdrive.ts:116` (`user: 'synkroo_staging'`), `:125` (`user: 'synkroo'`), `:141-155` |
| V11 | `scripts/migrate-vps.ts` usa os roles atuais (`synkroo`, `synkroo_staging`) para migrar | `scripts/migrate-vps.ts:176`, `:184` |
| V12 | `scripts/restore-vps-db.ts` fixa `DB_ROLE = 'synkroo'`, cria o DB de rehearsal com esse owner e exporta `PGUSER` para os filhos | `scripts/restore-vps-db.ts:87`, `:368`, `:570` |
| V13 | `scripts/backup-vps-db.ts` fixa `user = 'synkroo'` no dump | `scripts/backup-vps-db.ts:114` |
| V14 | `scripts/setup-staging-db.ts` trata `synkroo` como superuser, cria o role de staging **com CREATEDB**, cria o DB de staging com owner `synkroo_staging` e aplica `GRANT ALL ON SCHEMA public` a ele | `scripts/setup-staging-db.ts:162`, `:178`, `:188` (via `scripts/lib/pg-ddl.mjs:63`), `:219-221` (`:78-80`), `:239-241` (`:90-92`) |
| V15 | O DDL desses scripts está **assentado em teste** — qualquer endurecimento exige atualizar os testes na mesma mudança | `scripts/__tests__/operator-scripts-hardening.test.mjs:74-126` |
| V16 | `FOR UPDATE` é usado em fluxos reais e **precisa de UPDATE**, não só de SELECT | `src/modules/operacional/repositories/waitlist-repository.ts:229`, `src/modules/financeiro/repositories/installment-replacement-repository.ts:38`, `src/modules/financeiro/services/payment-service.ts:65`, `src/app/api/waitlist/fill/route.ts:5` |
| V17 | Migrations 0034/0035/0036 são expand-only e aditivas; 0035 cria a tabela `approval_tokens` | `src/lib/db/migrations/0034_action_attempt_fields.sql`, `0035_approval_tokens.sql`, `0036_outbox_claim_generation.sql` |
| V18 | Comportamentos de ACL verificados em **PG17 descartável** (`pgvector/pgvector:pg17`, `scram-sha-256` sobre TCP, cliente `pg`, 2026-10-11): (a) identidade autenticável sem `CONNECT` falha com `42501 permission denied for database`; (b) senha inválida **e** role inexistente falham com `28P01` (autenticação); (c) `has_database_privilege` com role inexistente **erro** `42704`, não `false`; (d) `CREATE EXTENSION vector` sem superuser, em banco sem a extensão, falha `42501 permission denied to create extension "vector"`; (e) superuser conecta mesmo com `PUBLIC` sem `CONNECT` (bypass) | container descartável local, reprodutível pelo procedimento de §7; nenhum dado de cliente envolvido |

### 1.2 Reportados na tarefa — **não verificáveis** neste checkout (sem acesso ao cluster)

> A tabela abaixo registra o que foi **afirmado**, não o que foi verificado. Nenhuma
> linha aqui foi confirmada por consulta ao banco: a rodada atual não tem acesso de
> produção nem a roles. Cada item precisa de verificação read-only antes de qualquer
> uso (ver §2, Stage 0). Isolamento de escopo: `synkroo_staging` é role distinto de
> `synkroo`, e o fato de o script de staging usar `synkroo` como administrador (V14)
> não prova os atributos de nenhum dos dois.

| # | Afirmado | Como verificar (somente-leitura) |
|---|---|---|
| R1 | Hyperdrive de produção usa o role `synkroo` com `superuser + createdb + createrole + replication + bypassrls` | `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = 'synkroo';` |
| R2 | Role de staging `synkroo_staging` tem `createdb` | idem, `rolname = 'synkroo_staging'` |
| R3 | Existem roles de owner/migrator/backup/restore | `SELECT rolname FROM pg_roles ORDER BY 1;` |
| R4 | Autenticação do cluster: `scram-sha-256`, `ssl=on`, `pg_hba` `hostssl` | `docs/inventory/2026-10-07-p2-contabo-validation.md:53` (evidência de 2026-10-07 — revalidar) |

---

## 2. Diagnóstico: por que a definição-alvo é conservadora

1. **O credential de runtime é o credential de superuser.** A aplicação se conecta
   pelo Hyperdrive (V8), cujo user é `synkroo` (V10). Se R1 for confirmado, o role que
   atende o tráfego de produção tem `superuser/bypassrls/createrole` — a superfície de
   dano de uma injeção de SQL ou de um bug de query é o cluster inteiro, não o schema.
2. **`synkroo` não pode ser totalmente rebaixado.** `pgvector` não é extensão
   *trusted*: `CREATE EXTENSION vector` exige superuser. Esse caminho é exercitado na
   criação do schema (V4) e pelo script de staging. Por isso o plano **preserva
   `synkroo`** (e os papéis owner/migrator/backup/restore) e **adiciona** roles de
   runtime separados, em vez de tentar demover o superuser existente.
3. **Staging é mais permissivo que produção no papel.** O DB de staging tem owner
   `synkroo_staging` (V14), que recebe `GRANT ALL ON SCHEMA public` — ou seja, inclui
   `CREATE`. O runtime de staging, hoje, é **dono do banco**.
4. **Sequences: nenhuma (V6). Functions: aplicação × extensão — e `EXECUTE` com default
   `PUBLIC`.** Nenhuma migration cria function de aplicação (V7), mas o banco **não é
   livre de functions**: as extensões `vector`/`btree_gist` instalam functions e
   operators (V4) usados pelas colunas `vector(1536)` (V5). Em PostgreSQL, **`PUBLIC` tem
   `EXECUTE` em toda function por default** — inclusive nas que uma migration futura
   criar; default privileges de tabela não cobrem function. Daí a regra dura: **nenhuma
   revogação em bloco de `EXECUTE` antes do inventário** por function (origem, dono,
   `SECURITY DEFINER`, volatilidade, grants) no Stage 0.
5. **Acoplamento rotação × Hyperdrive já é conhecido** — trocar senha de role obriga
   re-executar `scripts/update-hyperdrive.ts` (ver
   `docs/inventory/2026-10-05-contabo-target-findings.md:110`). É exatamente por isso
   que **esta rodada não rotaciona credencial**.
6. **`CONNECT`/`TEMPORARY` de `PUBLIC` derrotam a negação por-role.** `PUBLIC` tem
   `CONNECT` **e** `TEMPORARY` em todo database por default. Isso neutraliza a defesa
   §3/§4 de "o role de app de um ambiente não `CONNECT` no banco do outro": revogar
   `CONNECT` só do role de app não nega nada, porque o privilégio vem de `PUBLIC`, não de
   um grant por-role. A negação real exige **revogar `CONNECT` de `PUBLIC` e re-grant só
   aos legítimos** (Stage 3 em staging; Stage 5 em produção). Até lá — e, na direção
   staging→produção, até o Stage 5 — "staging_alcança_produção · negação" (§9) é
   intenção, não fato do cluster.

---

## 3. Arquitetura proposta (papéis e fronteiras)

| Papel | Login | Atributos | O que faz | O que **não** faz |
|---|---|---|---|---|
| `synkroo` (preservado) | sim | mantém flags atuais (R1) | owner/migrator do schema; `CREATE EXTENSION`; criação de DB/role | deixa de ser o role de runtime (isso é a mudança) |
| owner/migrator (R3) | sim | inalterado nesta rodada | roda `drizzle-kit migrate` / `migrate-vps.ts`; é o **alvo dos default privileges** | não é usado pelo app em runtime |
| backup/restore (R3) | sim | inalterado | `pg_dump`/`pg_restore` dos scripts (`backup-vps-db.ts:114`, `restore-vps-db.ts:87`) | — |
| **`synkroo_app`** (novo) | sim | **NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION, NOBYPASSRLS**, sem membership em papéis elevados (nem `pg_read_all_data`, nem `pg_execute_server_program`) | CRUD em `public`, `SELECT` no ledger, `FOR UPDATE`/`UPDATE` | não cria tabela/sequence/function, não `TRUNCATE`, não `REFERENCES`, não `TRIGGER`, não conecta em outro banco |
| **`synkroo_staging_app`** (novo) | sim | idem, sem `CREATEDB` | idem, no banco de staging | **não tem `CONNECT` no banco de produção** |
| `PUBLIC` (pseudo-role) | — | default do cluster: `CONNECT` **e** `TEMPORARY` em todo database; `USAGE` no schema `public`; `EXECUTE` em toda function; **sem `CREATE`** no schema `public` (PG15+) | herança de `CONNECT`/`EXECUTE` que a negação por-role **não** remove | revogar `CONNECT`/`TEMPORARY` de `PUBLIC` + regrant é o **Stage 3** em staging / **Stage 5** em produção (depois de roles validados) |

**Fronteiras que o desenho assume explicitamente:**

- **Propriedade não muda.** As tabelas continuam do role migrador/owner. O app não é
  owner: por isso não pode `ALTER`/`DROP`/`CREATE INDEX` — a correção de schema é sempre
  via migration, nunca via runtime.
- **Migração e runtime são papéis diferentes** mesmo que o mesmo time opere os dois:
  `migrate-vps.ts` continua com o role privilegiado (V11); só o Hyperdrive muda de user.
- **`FOR UPDATE` exige `UPDATE`** (V16): `SELECT … FOR UPDATE` sem privilégio de UPDATE
  na tabela falha em runtime. O grant de tabela é `SELECT, INSERT, UPDATE, DELETE`
  justamente por isso.
- **`gen_random_uuid()`** é built-in de catálogo em PG17 e executável por `PUBLIC`
  (pg_catalog). As functions das extensões (`vector`/`btree_gist`) **também** detêm
  `EXECUTE` de `PUBLIC` por default e são dependência real nas colunas `vector(1536)`
  (V5). Por isso **nada de `REVOKE EXECUTE` em bloco**: hoje functions de aplicação são
  zero (V7), mas as de extensão sustentam o runtime (Stage 0 + §4).

### 3.1 Credenciais — identidades separadas por ambiente (admin antigo vs. runtime novo)

Hoje o **mesmo** password faz administração **e** runtime (V8/V10/R1: o Hyperdrive usa
`synkroo`). O desenho **separa**: quando os roles nascem, cada ambiente passa a ter
**duas identidades distintas** — o administrador/migrator antigo (preservado; usado por
scripts e como caminho de rollback) e o runtime novo (só o app, via Hyperdrive).

| Ambiente (role) | Papel | Chave `.env` (proposta; confirmar em §6) | Status |
|---|---|---|---|
| Produção `synkroo` | admin/migrator (ex-runtime) | `VPS_<SIDE>_POSTGRES_PASSWORD` | **existente — preservar intacta** (rollback + scripts admin) |
| Produção `synkroo_app` | runtime do app | `VPS_<SIDE>_PROD_APP_PASSWORD` (**nova**) | nova identidade; senha gerada pelo caminho atômico 0600 |
| Staging `synkroo_staging` | admin/owner do banco de staging | `VPS_<SIDE>_STAGING_PASSWORD` | **existente — preservar intacta** (scripts de staging) |
| Staging `synkroo_staging_app` | runtime do app (staging) | `VPS_<SIDE>_STAGING_APP_PASSWORD` (**nova**) | nova identidade; idem |
| Staging `synkroo_acl_probe` (novo) | **probe negativo de ACL — não é runtime** | `VPS_<SIDE>_STAGING_ACL_PROBE_PASSWORD` (**nova**) | login válido com **zero grants**; só prova negação de `CONNECT` (`42501`) nos Stages 1 e 3 |

- **Nunca repurpose:** `VPS_<SIDE>_POSTGRES_PASSWORD` e `VPS_<SIDE>_STAGING_PASSWORD`
  continuam significando os roles **administrativos**; as chaves de app **nunca** as
  sobrescrevem. Isso preserva o rollback — e é a reconciliação de admin pedida: o login
  antigo segue autenticável **depois** da transição também, porque migração, backup e
  restore continuam usando-o; nenhum stage deste plano o remove.
- As chaves novas seguem **o mesmo contrato** do resolver (`scripts/lib/vps-env.mjs`):
  precedência `process.env` > arquivo, fallback legacy `VPS_*` (depreciado), escrita
  atômica `0600`, fail-closed antes de qualquer mutação de DB; **nenhum valor de senha
  em log**.
- **Probe não é runtime:** `synkroo_acl_probe` existe apenas para provar negação por
  **autorização** (`42501`) — autentica, não recebe grant nenhum e não é usado pelo app.
  Ele é o negativo confiável do Stage 3 porque já existe (criado no Stage 2) e autentica;
  `synkroo_app` não serve nessa etapa (só passa a existir no Stage 5).
- **Contratos de script a mudar (ver §6):** `scripts/lib/vps-env.mjs` (novos campos em
  `VPS_SIDE_FIELDS` + `keys`/`origins`); `scripts/update-hyperdrive.ts` (flag `--env`,
  username + chave de senha por parâmetro, sem literal, barreira por ambiente);
  `scripts/setup-staging-db.ts` (passo irmão para o role de app + probe corrigido).

---

## 4. Inventário conceitual de grants (guardado)

Matriz de **intenção**, não DDL executável. A execução real deve gerar as sentenças via
`scripts/lib/pg-ddl.mjs` (helpers de quoting) em mudança de código revisada, com o
password do novo role trafegando apenas por elas e pelo caminho de env já existente
(`SYNKROO_VPS_ENV` / chaves `VPS_<SIDE>_*`, ver `scripts/lib/vps-env.mjs`).

| Objeto | `synkroo_app` (prod) | `synkroo_staging_app` (staging) | migrator/owner |
|---|---|---|---|
| `DATABASE synkroo` | `CONNECT` | **negar** | `CONNECT` (já tem) |
| `DATABASE synkroo_staging` | **negar** | `CONNECT` | `CONNECT` (já tem) |
| `SCHEMA public` | `USAGE` (sem `CREATE`) | `USAGE` (sem `CREATE`) | `CREATE` + owner |
| `SCHEMA drizzle` | `USAGE` | `USAGE` | owner |
| Tabelas de `public` (todas, atuais e futuras) | `SELECT, INSERT, UPDATE, DELETE` | idem | DDL completo |
| `drizzle.__drizzle_migrations` | `SELECT` apenas (V3) | `SELECT` apenas | `INSERT/UPDATE` (é o migrador) |
| Sequences de `public` | `USAGE, SELECT, UPDATE` — **preventivo**, hoje nenhuma existe (V6) | idem | owner |
| Functions | **inventário antes, sem revoke em bloco**: extensões `vector`/`btree_gist` dependem de `EXECUTE` de `PUBLIC` (V5); functions de aplicação = zero hoje (V7), mas nascem com `EXECUTE` de `PUBLIC` por default | idem | owner; `SECURITY DEFINER` exige dono confiável |
| `TRUNCATE` / `REFERENCES` / `TRIGGER` | **não conceder** | **não conceder** | implícito no owner |
| Default privileges (objetos novos) | ver abaixo | ver abaixo | — |

**Ressalva `PUBLIC` (crítica — corrige §3/§4).** A negação "por-role" de `CONNECT` nas
duas linhas de `DATABASE` **não é suficiente sozinha**: `PUBLIC` tem `CONNECT` (**e**
`TEMPORARY`) em todo database por default. Enquanto `CONNECT` não for revogado de
`PUBLIC` e concedido explicitamente só aos legítimos, o role de staging ainda alcança a
base de produção — e um role novo também. Idem para o teste negativo §7 (`CONNECT` prod
com role de staging): só passa depois da revogação de `PUBLIC` **no banco de
produção** — ou seja, no **Stage 5** (o Stage 3 revoga só em `synkroo_staging`). O
enforcement (regrants + revogação) é o **Stage 3** em staging e o **Stage 5** em
produção — **depois** do rehearsal e da criação/validação
dos roles novos (Stages 1–2), com autorização explícita do owner (ops), staging
primeiro; futuro e **não executável** nesta rodada. E a **verificação** de cada negação
desta matriz exige identidade autenticável sem grant (§7): falha de **autenticação**
(`28P01`) não prova negação de `CONNECT` — só `42501` prova.

**Default privileges (peça central da arquitetura).** Devem ser definidas **para o role
migrator/owner**, no schema `public`, de modo que objetos criados por migrations futuras
nasçam acessíveis ao role de aplicação sem nova intervenção manual:

- tabelas novas → `SELECT, INSERT, UPDATE, DELETE` para o role de app do ambiente;
- sequences novas → `USAGE, SELECT, UPDATE` (preventivo, espelha V6);
- functions → **fora do default privileges**: já nascem com `EXECUTE` para `PUBLIC` por
  default; o default-privileges não controla isso — controlar exige `ALTER DEFAULT
  PRIVILEGES … REVOKE EXECUTE` **depois** do inventário (Stage 0) e decisão function a
  function; nada de revoke antes da auditoria;
- `ALTER DEFAULT PRIVILEGES` só vale para objetos criados **depois** e **por aquele
  role** — não retroage. Daí a etapa de *regrant* (§4).

**Regrant após 0034–0036 (obrigatório, independente da ordem).** O alvo pode estar em
33/35/36 (`docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md` §1).
`approval_tokens` (0035) e as colunas de `action_logs` (0034) e `outbox_jobs` (0036)
passam a ser lidas/escritas pelo app. Conceder default privileges **não** cobre objetos
já existentes: o *regrant* explícito sobre o inventário atual é a rede de segurança, e
deve rodar **depois** de confirmar que as migrations pendentes foram aplicadas.

---

## 5. Ordem de stages (com barreira entre cada um)

Cada stage termina em uma **barreira explícita**: sem evidência do gate, o próximo
stage não começa. Nenhum stage abaixo foi executado.

**Invariante de ordenação (corrige a revisão anterior desta seção).** Qualquer mudança
de ACL em `PUBLIC` (`CONNECT`/`TEMPORARY`) é **sempre posterior** à criação, concessão e
validação dos roles novos: primeiro o rehearsal isolado (Stage 1) e o preparo de staging
(Stage 2); só depois o enforcement (Stage 3). A revisão anterior colocava esse
enforcement como "Stage 0b", **antes** do rehearsal e da criação dos roles — ordem
inválida, aqui corrigida. Enforcement de ACL nunca precede role/grant validado.

**Invariante de fail-closed (Stages de ACL 3 e 5).** A revogação de `CONNECT`/
`TEMPORARY` de `PUBLIC` é **sempre o último passo** da etapa — depois de regrants
conferidos, snapshot e leituras de conferência verdes. Falha, timeout ou evidência
inconclusiva **antes** dela aborta a etapa sem tocar em `PUBLIC`: a base permanece no
default do cluster, que é o estado conhecido. Falha **depois** dela se corrige por
regrant **nomeado** do papel legítimo faltante — **nunca** por `GRANT … TO PUBLIC`, que
reabriria o caminho cross-database que a operação existe para fechar. Como superuser
ignora checagem de privilégio (V18), o caminho administrativo de recuperação sobrevive à
revogação **se** o admin for superuser (R1, a confirmar no Gate 0) ou houver caminho
equivalente; sem caminho administrativo garantido, a etapa é NO-GO. Toda etapa de ACL
exige **autorização explícita do owner**, registrada, nomeando a base e a janela; a de
produção é sempre separada da de staging.

### Stage 0 — Inventário read-only (pré-requisito de tudo)
Consultas de catálogo, sem mutação e sem leitura de dados de cliente:

```sql
-- atributos dos roles (confirma R1-R3)
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
  FROM pg_roles WHERE rolname NOT LIKE 'pg\_%' ORDER BY rolname;
-- memberships (um role de app NAO deve herdar papel elevado)
SELECT r.rolname AS role, m.rolname AS membro_de
  FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.member
  JOIN pg_roles m ON m.oid = am.roleid ORDER BY 1,2;
-- sequences (esperado: nenhuma - V6)
SELECT schemaname, sequencename FROM pg_sequences
 WHERE schemaname NOT IN ('pg_catalog','information_schema');
-- functions fora do catálogo: EXTENSÃO x APLICAÇÃO (corrige "esperado nenhuma" de V7)
-- Extensões vector/btree_gist instalam functions EM PUBLIC; a query as lista.
-- origem: deptype='e' = membro de extensão. public_execute: proacl NULL JÁ implica
-- EXECUTE default de PUBLIC em functions (atenção à armadilha: NULL != "sem grant").
SELECT n.nspname AS schema, p.proname,
       CASE WHEN EXISTS (SELECT 1 FROM pg_depend d
                          WHERE d.objid = p.oid AND d.deptype = 'e')
            THEN 'extensao' ELSE 'aplicacao/outro' END AS origem,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       CASE p.provolatile WHEN 'i' THEN 'immutable' WHEN 's' THEN 'stable'
            ELSE 'volatile' END AS volatilidade,
       (p.proacl IS NULL OR EXISTS (
          SELECT 1 FROM aclexplode(p.proacl) a
           WHERE a.privilege_type = 'EXECUTE' AND a.grantee = 0)) AS public_execute
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname NOT IN ('pg_catalog','information_schema')
 ORDER BY 1, 3, 2;
-- (complementar, se desejado: operators/tipos das extensões ficam em pg_operator/pg_type
--  na mesma schema e também têm uso de PUBLIC por default)
-- ACL EFETIVA de PUBLIC por database: CONNECT e TEMPORARY em colunas SEPARADAS,
-- por base. grantee = 0 é PUBLIC. datacl NULL => vale o default do cluster
-- (acldefault('d', datdba), que concede CONNECT e TEMPORARY a PUBLIC); datacl
-- NÃO-NULL substitui o default por inteiro — aí PUBLIC só tem o que estiver
-- explícito no array. O COALESCE cobre os dois casos sem suposição.
SELECT d.datname,
       d.datacl IS NULL AS datacl_nula_default,
       EXISTS (SELECT 1 FROM aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
                WHERE a.grantee = 0 AND a.privilege_type = 'CONNECT')
            AS public_connect_efetivo,
       EXISTS (SELECT 1 FROM aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
                WHERE a.grantee = 0 AND a.privilege_type = 'TEMPORARY')
            AS public_temporary_efetivo
  FROM pg_database d
 WHERE d.datname IN ('synkroo','synkroo_staging')
 ORDER BY 1;
-- cruzamento simples (mesmo resultado efetivo; has_* resolve default e array):
-- SELECT datname,
--        has_database_privilege('public', datname, 'CONNECT')   AS public_connect,
--        has_database_privilege('public', datname, 'TEMPORARY') AS public_temporary
--   FROM pg_database WHERE datname IN ('synkroo','synkroo_staging');
-- default privileges atuais
SELECT defaclrole::regrole, defaclnamespace::regnamespace, defaclobjtype, defaclacl
  FROM pg_default_acl;
```

**Gate 0:** R1–R3 confirmados ou corrigidos por evidência. **Mais dois registros
obrigatórios:** (a) a ACL **efetiva** de `CONNECT`/`TEMPORARY` de `PUBLIC` em
`synkroo`/`synkroo_staging` — consulta que reporta os dois privilégios em colunas
separadas por base, com a semântica `datacl` NULL = default (`acldefault`); se o
cluster não estiver no default (`PUBLIC` com ambos), o Stage 3 muda de forma; (b) o
catálogo de functions por origem — se aparecer function de **aplicação** onde V7 previa
nenhuma, os grants de §4 precisam ser revistos. Divergência entre o que a tarefa
afirma e o que o cluster tem interrompe o plano e devolve a decisão ao Planner.

### Stage 1 — Rehearsal completo em pg17 descartável (prova o modelo antes de qualquer ambiente real)

Executar o plano inteiro (criar roles, grants, default privileges, migrations, CRUD do
app, testes negativos) no container descartável — **nunca** em staging/produção.
Ambiente: `docker-compose.remediation.yml` (`pgvector/pgvector:pg17`, porta 55434) ou o
padrão de container de restore documentado em `docs/runbooks/database-recovery.md` §2
(porta 55435, `--no-owner`).

1. **Migrations:** `drizzle-kit migrate` do zero como migrador (prova V4:
   `CREATE EXTENSION vector` passa). Se viável no descartável, exercitar também o
   caminho até o estado-alvo do ambiente — o alvo pode estar em 33/35/36
   (`docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md` §1/§5) —
   para que o *regrant* 0034–0036 seja testado contra os objetos reais.
2. **Roles novos:** criar `synkroo_app` e `synkroo_staging_app` via helper, sem
   `CREATEDB` e sem memberships elevadas; senha nova gerada pelo caminho de env.
   **Mais a identidade de probe de ACL** (ex.: `synkroo_acl_probe`): login válido, senha
   pelo mesmo caminho de env, **zero grants** — inclusive sem `CONNECT` em lugar algum.
   Ela existe para provar negação por **autorização** (`42501 permission denied for
   database`), nunca por falha de autenticação.
3. **Grants + default privileges + *regrant*** 0034–0036 conforme a matriz §4.
4. **Ciclo do app:** CRUD em amostra multi-domínio, `SELECT` no ledger,
   `FOR UPDATE`/`UPDATE` (V16), escrita/leitura de `embedding vector(1536)` (V5). Criar
   também, no mesmo container, um **segundo banco descartável sem a extensão `vector`**
   — com `CONNECT` + `CREATE` no schema público para o papel de app: é o palco do
   negativo `CREATE EXTENSION` (§7), onde o único denial precisa ser o da extensão. No
   banco da aplicação a extensão já está instalada (V4) e o negativo não provaria nada.
5. **Negativos** de §7 — à exceção do cross-ambiente: com `PUBLIC` no default, a
   conexão cross-env é **concedida**; registrar como comportamento do cluster, não
   como falha do grant. Cada direção cross-env só vira negativa real na etapa que
   revoga o `PUBLIC` da base **de destino**: `synkroo_app`→`synkroo_staging` no
   Stage 3; `synkroo_staging_app`→`synkroo` no Stage 5. Nos ambientes reais, o probe
   "para dentro" do Stage 3 usa a **identidade de probe** (item 2): `synkroo_app` só
   passa a existir no Stage 5 e, enquanto o role não existe, a tentativa falha na
   **autenticação** (`28P01`) — que não prova negação de `CONNECT` (§7). No descartável
   os dois roles existem, então o par nominal pode ser exercitado aqui.

**Gate 1:** 100% dos testes de §7 verdes (com a ressalva cross-env acima), com matriz
de evidência versionável e sem segredo. **Este gate é pré-requisito do Stage 3:** sem
ele, o modelo de roles/grants não está provado e nenhuma mudança de ACL em `PUBLIC`
pode ser considerada.

### Stage 2 — Staging: preparar roles/grants e probes (primeiro ambiente real)

1. Criar `synkroo_staging_app` via helper (sem `CREATEDB`, sem memberships); senha
   **nova**, gerada e persistida pelo caminho de env — mas sob a **chave nova**
   `VPS_<SIDE>_STAGING_APP_PASSWORD` (§3.1), escrita atômica 0600 (mesmo contrato de
   `scripts/setup-staging-db.ts:134-157`); **nunca** sobrescrever
   `VPS_<SIDE>_STAGING_PASSWORD` (continua sendo do admin antigo, preservado p/ rollback).
   **E** criar a **identidade de probe de ACL** `synkroo_acl_probe`: login válido, senha
   nova sob a chave `VPS_<SIDE>_STAGING_ACL_PROBE_PASSWORD` (§3.1), mesmo caminho atômico
   0600, **zero grants** em qualquer base. Ela é a identidade autenticável e não
   regrantada que prova o negativo de `CONNECT` no Stage 3 — `synkroo_app` não serve
   nessa etapa porque em produção só passa a existir no Stage 5, e a tentativa falharia
   por **autenticação** (`28P01`), não por autorização.
2. Aplicar grants + default privileges + *regrant* 0034–0036 no banco de staging.
3. Validar com o app apontando para o role novo (`DATABASE_URL` local/staging) e rodar a
   verificação de saúde: `/api/health/db` com `applied=36`.
4. **Probes (pré-condição do Stage 3):** o probe *never-rotate* de
   `scripts/setup-staging-db.ts` hoje conecta `synkroo_staging` ao database **de produção
   `synkroo`** (`scripts/setup-staging-db.ts:191-199`, `database: 'synkroo'`, timeout
   10 s) e depende de `CONNECT` herdado de `PUBLIC`. Refatorar para mirar o database do
   próprio role (`synkroo_staging`) — mudança de script **separada, com teste**
   (`scripts/__tests__/operator-scripts-hardening.test.mjs`) e `--dry-run` verde. Sem
   esse refatoramento **testado**, revogar `CONNECT` de `PUBLIC` no Stage 3 produziria
   falso `INCONSISTENCY` e quebraria o contrato *never-rotate*.
5. **Não** alterar o Hyperdrive de staging ainda; **não** tocar em ACL de `PUBLIC` ainda.

**Gate 2:** app íntegro em staging com `synkroo_staging_app`; nenhum teste negativo
passou indevidamente; probe refatorado e coberto por teste; **e** identidade de probe de
ACL criada — autenticável (login + senha válidos) e sem grant nenhum.

### Stage 3 — Enforcement `PUBLIC` `CONNECT`/`TEMPORARY` — **somente `synkroo_staging`** (produção fica para o Stage 5; só após autorização explícita do owner)

**Natureza.** Operação de enforcement para aprovação humana explícita. **Não é SQL
executável:** nenhuma sentença de mutação é fornecida. Quando aprovada, a execução gera
as sentenças pelos helpers de `scripts/lib/pg-ddl.mjs` (nunca por interpolação no call
site), uma base por execução, com barreira e evidência versionável sem segredo.

**Escopo (precisão das revisões b/c).** A operação mexe **somente** na base de staging
`synkroo_staging`. A base `synkroo` (produção) continua com o default do cluster — logo
a direção `synkroo_staging_app` → `synkroo` **continua concedida** ao fim deste stage e
**não** é probe daqui: ela só fecha no **Stage 5**, quando o `PUBLIC` de produção
também sai do default. Probe deste stage: entradas **para dentro** de `synkroo_staging` —
legítimo conecta; identidade **autenticável e não regrantada** não conecta. Essa
identidade é a **probe dedicada** `synkroo_acl_probe` (criada no Stage 2) — **não**
`synkroo_app`, que em produção só passa a existir no Stage 5: enquanto o role não
existe, a tentativa falha na **autenticação** (`28P01`), que não é evidência de negação
de `CONNECT`; o negativo exige identidade existente, senha válida e privilégio ausente
(`42501 permission denied for database`). O par cross-env nominal
`synkroo_app`↔`synkroo_staging` é reconferido no **Stage 5**, quando os dois roles
existem.

**Pré-condições duras (bloqueantes) — nesta ordem:**
1. **Stages 1–2 concluídos:** roles novos **criados, concedidos e validados** no
   rehearsal e em staging. O enforcement **nunca** precede a validação do role/grant
   novo — é a correção de ordenação desta revisão.
2. **Identidade de probe existente** (criada no Stage 2: autenticável, zero grants) —
   sem ela o negativo da etapa seria medido por falha de autenticação, que não prova
   negação. **E caminho administrativo garantido:** `synkroo` superuser (R1) ou
   equivalente que ignore a revogação de `PUBLIC` (superuser bypassa checagem de
   privilégio — V18); sem caminho administrativo, NO-GO.
3. **Probe de `setup-staging-db.ts` refatorado e testado** (Stage 2) — senão a
   revogação produziria falso `INCONSISTENCY` e quebraria o contrato *never-rotate*.
4. **Autorização explícita do owner** para esta rodada, registrada, nomeando a base
   (`synkroo_staging`), o conjunto de regrants e a janela de execução.

**Ordem segura (staging primeiro):**
1. **Regrants explícitos primeiro** (evita lockout): na base sendo aplicada (Stage 3:
   `synkroo_staging`), conceder `CONNECT` (e `TEMPORARY`, se mantido) aos papéis
   legítimos **daquela base**, **antes** de mexer em `PUBLIC` — administrador/migrator
   (`synkroo` + roles owner/migrator R3), runtime novo **do mesmo ambiente**
   (`synkroo_staging_app`), backup/restore (R3) e monitor/health (hoje conecta como
   `synkroo`, V8/R1 — coberto pelo grant do administrador). Cada legítimo passa a deter
   `CONNECT` por grant explícito, não por herança de `PUBLIC`. A identidade de probe e o
   runtime do **outro** ambiente (`synkroo_app`, quando existir) **não** entram na lista
   — são os papéis que a matriz §4 nega nesta base.
2. **Snapshot da ACL efetiva** (`datacl` por base + grants por role nomeado, com as
   entradas de `PUBLIC` **separadas** das de roles nomeados) em artefato versionável sem
   segredo — insumo do rollback §8, como **referência/diff** para regrant nomeado,
   **nunca** como alvo de restauração em bloco; sem snapshot, não revogar.
3. **Conferir** cada grant com `has_database_privilege('<role>','<db>','CONNECT')`
   (somente-leitura) — inclusive o probe de `setup-staging-db.ts`, agora contra
   `synkroo_staging`, e a identidade de probe de ACL (`false` esperado após a
   revogação). Atenção: com role **inexistente** a função **erro** `42704` (V18), não
   `false` — role ausente não é probe de catálogo.
4. **Revogar `CONNECT` (e, se desejado, `TEMPORARY`) de `PUBLIC`** — **somente em
   `synkroo_staging`**, via helper, uma base por execução, com barreira e evidência;
   `synkroo` fica para o Stage 5.
5. **Smoke pós-mudança:** cada papel legítimo (regrant conferido) conecta em
   `synkroo_staging` — sem lockout; e o negativo que este enforcement fecha é a
   direção **para dentro** da base aplicada: identidade **não** regrantada — em
   particular `synkroo_acl_probe`, autenticável e sem grant — falha com `42501`
   (`permission denied for database`). Falha de **autenticação** (`28P01`) não conta
   como prova: identidade inexistente ou não autenticável não testa `CONNECT`. A
   direção inversa (`synkroo_staging_app` → `synkroo`) é esperada **concedida** neste
   ponto e é probe do **Stage 5**; sem exceção inesperada além dessa.
6. **Não-regressão de ops:** `scripts/setup-staging-db.ts --dry-run` + probe corrigido
   passam; `/api/health/db` segue `applied=36` por ambiente.

**Fail-closed desta etapa.** Qualquer falha, timeout ou evidência inconclusiva nos
itens 1–3 **aborta antes** da revogação (item 4): a base permanece no default do
cluster — estado conhecido e anterior. Falha **após** a revogação: (a) papel legítimo
sem `CONNECT` → regrant **nomeado** imediato do papel faltante; (b) `PUBLIC` **nunca**
recebe `CONNECT`/`TEMPORARY` de volta como correção — isso reabriria o caminho
cross-database que a operação existe para fechar; (c) persistindo a indisponibilidade,
ou sem evidência de qual papel ficou de fora, **parar** a etapa e escalar ao owner com o
snapshot em mãos. A execução da recuperação é o administrador superuser
(pré-condição 2). Todo aborto registra motivo e estado no artefato versionável sem
segredo, e as etapas seguintes ficam bloqueadas até decisão do owner.

**Barreira explícita:** staging com regrants conferidos, revogação aplicada, smoke e
não-regressão verdes. A produção só é elegível dentro do **Stage 5**, após aprovação
explícita — **nunca** no mesmo passo/execução do staging. A autorização do owner
(pré-condição 4) fica registrada junto à evidência da etapa; sem ela a etapa não começa.

**`TEMPORARY` é opcional** (defesa de profundidade). Sem `TEMPORARY`, o app não cria temp
tables (`pg_temp_N` contorna o `CREATE` negado no schema `public`). Aplicar só se o
levantamento confirmar que o app não usa temp tables; caso contrário, mantê-lo.

### Stage 4 — Troca do login do Hyperdrive — **staging** (runtime)

Um ambiente por execução. Hoje o script faz os dois na mesma invocação (V10); logo,
**esta etapa depende da mudança de script do §6**. Ordem: staging primeiro; produção
só no Stage 5.

- Apontar o Hyperdrive de **staging** para o role de aplicação.
- **Não reiniciar** o Worker e **não** rotacionar a credencial antiga.
- **Prova de transição — não basta CONTAR sessões.** Comparar `count(*)` por `usename`
  antes/depois é insuficiente: com o Worker sem restart, o pool existente segue servindo
  no role antigo e uma contagem > 0 no role novo pode refletir conexão ainda não
  exercitada. O gate exige quatro evidências, juntas:
  1. **Smoke de readiness pelo Worker** do ambiente — tráfego real de aplicação através do
     binding do Hyperdrive (ex.: `/api/health/db` respondendo `applied=36`, e pelo menos
     um ida-e-volta real de leitura/escrita), provando que o caminho app→DB está íntegro
     pelo credential novo; sem esse smoke, contagem não vale.
  2. **Identificação do principal nas sessões novas** — `pg_stat_activity` mostrando
     `usename` = role de app (com `application_name`/`client_addr` do Worker) nas sessões
     que servem o smoke.
  3. **Identificação do principal nas sessões antigas** — enumerar as sessões ainda no
     role antigo (`usename` = role admin); são as que precisam drenar.
  4. **Drenagem natural** — as sessões antigas tendem a zero **sozinhas** à medida que o
     pool do Hyperdrive recicla conexões (por idade/max); **sem** flush forçado e **sem**
     restart. Observar a tendência por uma janela de aquecimento combinada.

**Barreira:** staging só está provado quando (a) smoke íntegro pelo role novo, (b)
sessões novas identificadas pelo role de app e (c) sessões antigas em tendência de
drenagem para zero — aí, e só aí, a produção é elegível (Stage 5). Falha aqui = reverter
o config para o role anterior — não há credencial nova a quebrar.

### Stage 5 — Produção (só após aprovação explícita)

Sequência completa de produção, cada passo com evidência própria — todos exigem
autorização humana explícita, **não concedida nesta rodada**:

1. **Criar `synkroo_app`** em produção com os mesmos grants/default privileges/regrant
   do staging. Stage **aditivo**: cria capacidade, não muda tráfego. **O Hyperdrive de
   produção continua com `synkroo`** até o passo 4.
2. **Validar** o role com o app (leitura/escrita reais) e conferir grants por
   `has_*_privilege`. Zero sessão de app usando-o ainda (esperado: nenhuma conexão nova
   foi feita).
3. **Enforcement `PUBLIC` em `synkroo`** — mesma ordem do Stage 3: regrants de todos os
   papéis legítimos → conferência → revogação → smoke → não-regressão de ops. O
   procedimento já foi provado em staging; a produção **nunca** recebe revogação de
   `PUBLIC` antes de o role novo estar criado, concedido e validado. **Probe que este
   passo fecha** (e só ele): `synkroo_staging_app` — criado no Stage 2, portanto
   existente e autenticável — e qualquer role não regrantado **não** `CONNECT` em
   `synkroo` (falha `42501`; falha `28P01` de autenticação não conta): a negação
   staging→produção da matriz §4, agora real porque o `PUBLIC` de produção saiu do
   default. Conferir também a regressão inversa já fechada no Stage 3
   (`synkroo_acl_probe` **não** `CONNECT` em `synkroo_staging`) e, com `synkroo_app` já
   existente, o par cross-env nominal `synkroo_app`↔`synkroo_staging`.
4. **Apontar o Hyperdrive de produção** para o role de aplicação, com as mesmas quatro
   evidências do Stage 4 (smoke de readiness pelo Worker, principal nas sessões novas e
   antigas, drenagem natural) — sem restart forçado e sem rotacionar credencial.
5. **Barreira final** de produção.

**Fail-closed e autorização — produção.** Idem Stage 3: abort antes da revogação sem
tocar em `PUBLIC`; correção depois da revogação só por regrant **nomeado**; recuperação
executada pelo administrador superuser (pré-condição análoga à do Stage 3 — se R1 não
confirmar superuser, Gate 0 precisa garantir caminho administrativo equivalente, senão
NO-GO). **Autorização do owner explícita e separada** da de staging, registrada,
nomeando a base (`synkroo`), os regrants e a janela — **nunca** no mesmo
passo/execução do staging. O rollback da ACL de produção é autorização separada (§8).

**"Descomissionamento" — redefinido e reconciliado.** Descomissionar o login antigo
significa **apenas** removê-lo do **Hyperdrive/runtime** — o que já acontece no passo 4:
o Hyperdrive passa a referenciar somente o role de app. O login admin `synkroo` e seu
secret **permanecem válidos e preservados** para migração (`migrate-vps.ts`), backup
(`backup-vps-db.ts`), restore (`restore-vps-db.ts`) e como caminho de rollback: são
identidades de runtime novas, **não** a substituição do admin. **Revogar senha ou dropar
role admin é autorização futura separada, com plano próprio — não é planejada nesta
rodada.**

---

## 6. Scripts que precisam de mudança (inventário com paths)

| Script | Constatação verificada | Mudança necessária |
|---|---|---|
| `scripts/update-hyperdrive.ts` | usernames fixos em `:116`/`:125`; **staging e produção na mesma invocação**, staging primeiro (`:141-155`); password vem de `postgresPassword`/`stagingPassword` (`:86-87`) | flag por ambiente (`--env=staging\|production`) recusando os dois num run; username **e chave de senha por parâmetro/env, não literal** — selecionar o password pela identidade do role alvo (admin vs. app) e pelo ambiente, sem fixar `user:'synkroo'`/`'synkroo_staging'`; é o alvo do smoke dos Stages 4–5; **barreira** entre ambientes |
| `scripts/migrate-vps.ts` | usa `synkroo`/`synkroo_staging` (`:176`, `:184`) | manter role privilegiado (migração é DDL), mas explicitar o par role/banco por `--side` + `--env` e documentar que **não** é role de runtime |
| `scripts/restore-vps-db.ts` | `DB_ROLE='synkroo'` (`:87`), `CREATE DATABASE … OWNER` (`:368`), exporta `PGUSER` (`:570`) | restore segue privilegiado (é dono do DB de rehearsal); documentar que `--no-owner` exige dono compatível (`docs/runbooks/database-recovery.md:77`) |
| `scripts/backup-vps-db.ts` | `user='synkroo'` (`:114`) | role de backup dedicado exigiria `CONNECT`+`SELECT` (ou `pg_read_all_data`) — **proposta futura**, fora deste escopo; hoje segue com o role atual |
| `scripts/setup-staging-db.ts` | cria role de staging **com CREATEDB** (`:188` → `pg-ddl.mjs:63`) e dá `GRANT ALL ON SCHEMA public` (`:241` → `pg-ddl.mjs:90-92`); **e** a verificação *never-rotate* conecta `synkroo_staging` ao database **de produção `synkroo`** (`:191-199`) | (a) passos irmãos para `synkroo_staging_app` (`USAGE` sem `CREATE`, CRUD em tabelas, default privileges; estreitar `GRANT ALL ON SCHEMA`) e para a identidade de probe `synkroo_acl_probe` (login válido, senha em `VPS_<SIDE>_STAGING_ACL_PROBE_PASSWORD`, **zero grants**); (b) **pré-condição do Stage 3:** o probe nunca rotaciona, mas hoje mira a base de produção como usuário de staging (`database: 'synkroo'`, `:191-199`) e depende de `CONNECT` herdado de `PUBLIC` — mudar para o database de staging (`synkroo_staging`, o do próprio role) **em mudança separada + teste**, antes de qualquer `REVOKE` de `CONNECT` de `PUBLIC`; cobrir `operator-scripts-hardening.test.mjs` |
| `scripts/lib/pg-ddl.mjs` | helpers de quoting já existem e são a arena segura (`:28-56`, `:82-92`) | novos helpers (role de app sem `CREATEDB`, default privileges, *regrant*) **aqui**, nunca por interpolação no call site |
| `scripts/lib/vps-env.mjs` | resolve `VPS_<SIDE>_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD}` com fallback `VPS_*` genérico (`VPS_SIDE_FIELDS` `:271`, resolução `:392-419`) | **novas identidades de credencial por ambiente** (§3.1): acrescentar três campos de runtime (`PROD_APP_PASSWORD`, `STAGING_APP_PASSWORD`, `STAGING_ACL_PROBE_PASSWORD` — a última só da identidade de probe, **sem grants**) a `VPS_SIDE_FIELDS` + `keys`/`origins`/precedência/legacy/escrita atômica `0600`; **nunca** reutilizar `POSTGRES_PASSWORD`/`STAGING_PASSWORD` (seguem do admin antigo, preservados p/ rollback) |
| `scripts/__tests__/operator-scripts-hardening.test.mjs` | assenta o DDL atual em `:74-126` | atualizar/estender na **mesma** mudança de script; incluir teste de que role de app não recebe `CREATE`/`CREATEDB` |
| `src/lib/db/client.ts` | runtime usa a connection string do Hyperdrive | nenhuma mudança de código: a troca é de configuração, não de app |

---

## 7. Testes (realistas, contra pg17 descartável)

**Positivos (o role de app deve conseguir):**

1. `drizzle-kit migrate` do zero como migrador (prova V4: `CREATE EXTENSION vector` passa).
2. CRUD em amostra multi-domínio: `appointments`, `patients`, `waitlist`,
   orçamentos/pagamentos (financeiro), `outbox_jobs`, `idempotency_keys`,
   `approval_tokens`, `action_logs`.
3. `SELECT count(*) FROM drizzle.__drizzle_migrations` (V3) e `/api/health/db`
   respondendo `applied=36`.
4. `SELECT … FOR UPDATE` + `UPDATE` em `waitlist` e no fluxo de pagamento/parcelas (V16).
5. Escrita e leitura de `embedding vector(1536)` em `messages`, `conversation_memories`,
   `knowledge_base` (V5).

**Negativos (o role de app **não** deve conseguir):**

| Tentativa | Resultado esperado |
|---|---|
| `CREATE TABLE` / `CREATE SEQUENCE` / `CREATE FUNCTION` em `public` | `42501` permissão negada |
| `CREATE INDEX` em tabela existente | `42501` |
| `TRUNCATE` em qualquer tabela | `42501` |
| `ALTER TABLE … ADD CONSTRAINT … REFERENCES` | `42501` |
| `CREATE TRIGGER` | `42501` |
| `ALTER ROLE <app> SUPERUSER` / `BYPASSRLS` | `42501` |
| `CREATE ROLE` / `CREATE DATABASE` | `42501` |
| `CREATE EXTENSION vector` em **banco descartável separado, sem `vector` instalado** (tentativa real, sem `IF NOT EXISTS`, como role de app) | `42501 permission denied to create extension "vector"` — extensão não é *trusted*, exige superuser (V4/V18). Montagem do palco: no banco descartável o papel de app recebe `CONNECT` + `CREATE` no schema, para que o **único** denial seja o da extensão (sem `CREATE` no schema, o `42501` seria de schema e provaria outra coisa). **Não** usar `IF NOT EXISTS` contra o banco da aplicação: lá `vector` já está instalado (V4) e a sentença é no-op (`NOTICE … skipping`) — não prova negação alguma. No banco da aplicação `vector` segue instalado e o app lê/escreve `embedding vector(1536)` (positivo 5, V5) |
| `INSERT`/`UPDATE` em `drizzle.__drizzle_migrations` | `42501` |
| `SET ROLE` para o owner/migrator | `42501` |
| `CONNECT` em `synkroo_staging` por identidade **autenticável não regrantada** — no rehearsal, `synkroo_app` (existe no descartável); nos ambientes reais, a **identidade de probe** `synkroo_acl_probe` (Stage 2), porque `synkroo_app` em produção só passa a existir no Stage 5 | `42501 permission denied for database` — real a partir do **Stage 3** (`PUBLIC` revogado em `synkroo_staging`, regrant só aos legítimos); no rehearsal só passa se o `PUBLIC` também for revogado nas bases descartáveis — do contrário, concedido. A identidade **precisa existir e autenticar**: senha inválida ou role inexistente falha com `28P01` (autenticação) e **não** prova negação de `CONNECT` |
| `CONNECT` em `synkroo` com o runtime de staging (`synkroo_staging_app`) | `42501` — real a partir do **Stage 5** (`PUBLIC` revogado em `synkroo`); **não** exigível no Stage 3 — com o `PUBLIC` de produção no default, a conexão é concedida mesmo sem grant por-role. `synkroo_staging_app` existe desde o Stage 2 e autentica, então a falha observada é de autorização |

**Autenticação × autorização (regra do probe — verificada em PG17 com `scram-sha-256`,
V18).** Três resultados possíveis, e só o terceiro prova negação de `CONNECT`:

| Resultado | SQLSTATE | Significado |
|---|---|---|
| `password authentication failed for user …` | `28P01` | **falha de autenticação** — senha inválida ou role inexistente; não prova nada sobre `CONNECT` |
| `role … does not exist` (em `has_database_privilege`) | `42704` | role ausente **erro**, não `false` — role inexistente não é probe de catálogo |
| `permission denied for database …` | `42501` | **falha de autorização** — a identidade autenticou e o privilégio está ausente: é a prova do negativo |

Complemento: superuser conecta mesmo com `PUBLIC` sem `CONNECT` (bypassa checagem de
privilégio) — por isso o superuser não serve de probe negativo, e por isso o admin é o
caminho de recuperação pós-revogação (pré-condição do Stage 3, item 2).

**Verificação de grants (`has_*`, somente-leitura):**

```sql
SELECT has_table_privilege('synkroo_app', 'public.appointments', 'SELECT')  AS sel,
       has_table_privilege('synkroo_app', 'public.appointments', 'INSERT')  AS ins,
       has_table_privilege('synkroo_app', 'public.appointments', 'UPDATE')  AS upd,
       has_table_privilege('synkroo_app', 'public.appointments', 'DELETE')  AS del,
       has_table_privilege('synkroo_app', 'public.appointments', 'TRUNCATE') AS trunc_negado;
SELECT has_schema_privilege('synkroo_app', 'public', 'USAGE')  AS usage,
       has_schema_privilege('synkroo_app', 'public', 'CREATE') AS create_negado;
SELECT has_database_privilege('synkroo_app', 'synkroo', 'CONNECT')       AS conn_prod,
       has_database_privilege('synkroo_staging_app', 'synkroo', 'CONNECT') AS conn_prod_negado,
        -- conn_prod_negado (staging_app -> producao) só passa DEPOIS do Stage 5
        -- (revogação de CONNECT de PUBLIC em synkroo); no Stage 3 continua concedido
        has_database_privilege('synkroo_app', 'synkroo_staging', 'CONNECT') AS conn_staging_negado,
         -- conn_staging_negado (prod_app -> staging) só passa DEPOIS do Stage 3 E de o
         -- role EXISTIR (criado no Stage 5): role inexistente ERRO 42704, não false (V18).
         -- No Stage 3 o probe equivalente usa a identidade dedicada (existe desde o Stage 2):
         has_database_privilege('synkroo_acl_probe', 'synkroo_staging', 'CONNECT') AS conn_probe_staging_negado,
         -- TEMPORARY é OPCIONAL (Stage 3) - conferir apenas quando TEMP for revogado
         has_database_privilege('synkroo_app', 'synkroo', 'TEMPORARY')        AS temp_prod_app_opcional,
         -- espelho PUBLIC (efetivo, inclusive default datacl NULL): em synkroo fica true
         -- ate o Stage 5; em synkroo_staging quem derruba e o Stage 3
         has_database_privilege('public', 'synkroo', 'CONNECT')               AS public_connect_efetivo,
         has_database_privilege('public', 'synkroo_staging', 'CONNECT')       AS public_connect_staging_efetivo,
         has_database_privilege('public', 'synkroo', 'TEMPORARY')             AS public_temporary_efetivo;
```

**Execução e evidência:** container `pgvector/pgvector:pg17` descartável
(`docker-compose.remediation.yml`), com `DATABASE_URL` do papel de app; registrar a
matriz de resultados em artefato versionável **sem segredo** (role/objeto/privilégio/
booleano). Nenhum dado de cliente no rehearsal.

---

## 8. Rollback

- **Rollback padrão (rápido, sem credencial nova):** apontar o Hyperdrive de volta ao
  role anterior. Como o login antigo **não foi rotacionado** nesta rodada, ele continua
  válido — não há credencial quebrada a consertar. (A reversão do enforcement de ACL
  de `PUBLIC` tem cláusula operacional própria abaixo.)
- **Admin preservado — nada de remoção nesta rodada:** o login `synkroo` e seu secret
  **não** são removidos nem revogados neste plano; continuam servindo migração, backup,
  restore e rollback. "Descomissionar" = sair do Hyperdrive/runtime (Stage 5), não
  dropar role nem revogar senha — isso é autorização futura separada, com plano próprio.
  Se um dia ocorrer, só depois de o caminho de rede estar fechado e as sessões novas
  provadas; revogar antes derruba sessões ainda ativas.
- **Rollback do enforcement `PUBLIC` (Stages 3/5) — cláusula operacional explícita.**
  O rollback **nunca** executa `GRANT CONNECT`/`TEMPORARY … TO PUBLIC` e **nunca**
  aplica o snapshot em bloco: devolver o default de `PUBLIC` reabriria o caminho
  cross-database que a operação existe para fechar. O snapshot tirado antes da
  revogação (ordem dos Stages 3/5) é **referência/diff**, não alvo: dele se usa
  **apenas a parte de roles nomeados** — a entrada de `PUBLIC` fica de fora — e se
  regranta, papel por papel, só o que a disponibilidade exige: administrador/migrator
  (`synkroo` + owner/migrator R3), backup/restore (R3), monitor/health e o runtime **do
  próprio ambiente** (`synkroo_staging_app` em staging; `synkroo_app` em produção).
  Identidades de probe e o runtime do outro ambiente **não** são regrantados — são
  justamente os negados. `PUBLIC` segue sem `CONNECT`/`TEMPORARY` depois do rollback.
  Persistindo a indisponibilidade após os regrants nomeados, a ação é escalar ao owner
  (com o snapshot em mãos), não ampliar `PUBLIC`. Ordem do rollback: **staging
  primeiro**; o rollback da ACL de **produção é autorização separada** e não vem
  acoplado ao de staging. Identidades admin (`synkroo`, `synkroo_staging`) ficam
  **intactas** — sem drop e sem revoke de senha: seguem como caminho de
  migração/backup/restore e de reexecução futura do enforcement. Como todo rollback
  daqui, também não reamplia privilégio de runtime (ver tópico seguinte).
- **Não desfazer a exposição:** rollback não é "voltar a dar `GRANT ALL`/superuser ao
  runtime". Se o role novo falhar, corrige-se o grant; não se reamplia privilégio.
- **Sessões de pool:** a atualização *in-place* do Hyperdrive **não garante** que as
  sessões já abertas do pool troquem de role na hora, e uma **contagem por `usename`
  sozinha não prova saúde**. Por isso a janela de transição mantém **os dois logins
  válidos** e a prova exige smoke de readiness pelo Worker **e** identificação do
  principal nas sessões novas e antigas (`pg_stat_activity.usename`/`application_name`),
  com drenagem natural — nunca só config aplicada, nunca só contagem (Stages 4–5).
- **Sem restart e sem rotação nesta rodada:** reinício de Worker e rotação de senha são
  mudanças separadas, cada uma com sua autorização e seu próprio rollback.
- **Migrations:** 0034–0036 são expand-only; qualquer correção de schema é forward-fix
  (`docs/audit/migrations-policy.md`), nunca `drizzle-kit` DOWN.

---

## 9. Riscos e limites conhecidos

| Risco | Mitigação / nota |
|---|---|
| `synkroo` permanece superuser (V4: pgvector não é *trusted*) | redução de dano vem do **perímetro** (TLS/`hostssl scram-sha-256`, UFW só ranges Cloudflare — `docs/inventory/2026-10-07-p2-contabo-validation.md:53`), não de role |
| Maior privilégio hoje em **staging**: `synkroo_staging` é dono do DB e tem `CREATE` no schema público (V14) | estreitar `GRANT ALL ON SCHEMA public`; não é mudança de runtime desta rodada |
| Default privileges não retroagem | *regrant* explícito pós-0034–0036 (§4) como rede de segurança |
| Staging (ou qualquer role) alcança a produção | hoje **não é negado**: `PUBLIC` tem `CONNECT`/`TEMPORARY` por default e a negação por-role não remove privilégio herdado de `PUBLIC`; mitigação em duas etapas — Stage 3 em staging (regrants explícitos **antes**, `REVOKE` de `PUBLIC` depois, probe de `setup-staging-db.ts` corrigido e testado antes, só após autorização do owner) e Stage 5 em produção: a direção staging→produção só é negada quando o `PUBLIC` de `synkroo` sai do default |
| Negativo "provado" por falha de **autenticação** — senha inválida ou role inexistente dão `28P01` e parecem negação de `CONNECT`, mas não são; role inexistente em `has_database_privilege` **erro** `42704`, não `false` (V18) | probe com identidade dedicada, autenticável e sem grant (§7); o único resultado que conta é `42501`; falha de auth aborta o gate, não o passa |
| `EXECUTE` em function | **default concede a `PUBLIC`**: hoje toda function (inclusive as de aplicação que uma migration futura criar) é executável por qualquer role; mitigação por inventário (Stage 0) e decisão function a function — **sem revoke em bloco**, que quebraria as extensões `vector`/`btree_gist` (V5) |
| `pg_dumpall` de globais carrega **hash de role** | nunca versionar (`docs/inventory/2026-10-05-hostinger-findings.md:96`) |
| R1–R3 não verificados | Stage 0 é bloqueante; o plano não depende deles para ser escrito |
| Scripts são a fonte da verdade operacional | mudança de script + teste na mesma entrega (§6); `update-hyperdrive.ts` segue fazendo dois ambientes por run até ser endurecido |
| Propriedade das tabelas | só o owner faz DDL; correção de schema é sempre via migration |

---

## 10. Gates e condições NO-GO

- **Gate 0** inventário read-only concluído e divergências resolvidas — inclui a ACL
  **efetiva** de `CONNECT`/`TEMPORARY` de `PUBLIC` por base (colunas separadas, com
  semântica `datacl` NULL = default) e o catálogo de functions (extensão × aplicação).
- **Gate 1** rehearsal em pg17 descartável 100% verde — roles, grants, default
  privileges e negativos (o negativo cross-ambiente só vira real na etapa que revoga o
  `PUBLIC` da base de destino: prod→staging no Stage 3, staging→prod no Stage 5).
  Inclui identidade de probe criada, o segundo banco descartável **sem `vector`** para
  o negativo de `CREATE EXTENSION` e o banco da aplicação com `vector` operando
  (positivo 5).
- **Gate 2** staging íntegro com o role de app **e** probe de `setup-staging-db.ts`
  refatorado/testado **e** identidade de probe de ACL criada (autenticável, zero grants).
- **Gate 3** enforcement `PUBLIC` em **staging** — regrants de todos os legítimos
  conferidos + snapshot (com `PUBLIC` separado dos nomeados) + revogação + smoke +
  não-regressão; **só** após autorização explícita do owner (base, regrants e janela
  registrados) e sempre **depois** de os roles novos estarem validados (Stages
  1–2); produção intocada e direção staging→produção ainda concedida (probe do
  Gate 5). Negativo provado por identidade **autenticável e não regrantada** (`42501`);
  falha de autenticação (`28P01`) não passa gate.
- **Gate 4** cutover do Hyperdrive **de staging**, com smoke de readiness pelo Worker +
  identificação do principal nas sessões novas/antigas + drenagem natural (**não** só
  contagem) — depende de §6 (mudança de script).
- **Gate 5** produção — role criado/validado, enforcement `PUBLIC` (regrants nomeados,
  fail-closed, autorização do owner **separada** da de staging), cutover e barreira
  final **só após aprovação explícita**; login/secret admin **preservados** para
  migração/backup/restore; nenhum revoke/delete de credencial admin nesta rodada.

**NO-GO:** divergência entre R1–R3 e o cluster; migration pendente sem respaldo
(`docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md` §5); ausência
de backup off-host válido; qualquer credencial valorizada em Git/log; tentativa de
rotacionar credencial ou reiniciar Worker dentro desta rodada; dois ambientes na mesma
invocação de `update-hyperdrive.ts` sem a barreira do §6; executar a revogação de
`CONNECT`/`TEMPORARY` de `PUBLIC` (Stage 3) **antes** de os roles novos estarem
criados e validados (Stages 1–2), de o probe de `setup-staging-db.ts` estar corrigido
e testado (Stage 2), de a identidade de probe existir (Stage 2), de o caminho
administrativo superuser estar garantido (R1) ou sem regrants explícitos de todos os
papéis legítimos; enforcement em produção sem aprovação explícita do owner (separada da
de staging); usar `GRANT … TO PUBLIC` como correção de lockout ou como rollback de ACL;
provar negativo de `CONNECT` com identidade inexistente ou não autenticável (`28P01` em
vez de `42501`); qualquer revoke/delete da credencial admin nesta rodada.

---

## 11. Referências (arquivos)

- Migrations: `src/lib/db/migrations/0000_jazzy_strong_guy.sql`,
  `0034_action_attempt_fields.sql`, `0035_approval_tokens.sql`,
  `0036_outbox_claim_generation.sql`, `meta/_journal.json`
- Saúde/ledger: `src/services/api-handlers/health/db.ts`
- Cliente de banco: `src/lib/db/client.ts`; bindings: `wrangler.toml:42`, `:84`
- Scripts: `scripts/update-hyperdrive.ts`, `scripts/migrate-vps.ts`,
  `scripts/restore-vps-db.ts`, `scripts/backup-vps-db.ts`,
  `scripts/setup-staging-db.ts`, `scripts/lib/pg-ddl.mjs`, `scripts/lib/vps-env.mjs`
- Testes de script: `scripts/__tests__/operator-scripts-hardening.test.mjs`
- Fluxos `FOR UPDATE`: `src/modules/operacional/repositories/waitlist-repository.ts`,
  `src/modules/financeiro/repositories/installment-replacement-repository.ts`,
  `src/modules/financeiro/services/payment-service.ts`,
  `src/app/api/waitlist/fill/route.ts`
- Ambientes descartáveis: `docker-compose.yml`, `docker-compose.remediation.yml`
- Docs: `docs/runbooks/database-recovery.md`,
  `docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md`,
  `docs/audit/migrations-policy.md`, `docs/ops/vps-access.md`,
  `docs/inventory/2026-10-05-contabo-target-findings.md`,
  `docs/inventory/2026-10-05-hostinger-findings.md`,
  `docs/inventory/2026-10-07-p2-contabo-validation.md`
