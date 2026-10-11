# Recuperação do banco de dados (backup & disaster recovery)

> Etapa 9 do plano de hardening. Convenções herdadas da árvore existente em
> `docs/runbooks/` (ver `staging-environment.md` e
> `remediation-migration-rollback.md`).
>
> Ponto de entrada operacional (acesso, SSH, descoberta remota):
> [docs/ops/vps-access.md](../ops/vps-access.md) — **nenhum segredo, hostname
> de produção ou credencial é reproduzido aqui.**
>
> Fatos de base: PostgreSQL 17 (imagem `pgvector/pgvector:pg17`) + Drizzle ORM,
> cadeia de migrations `0000`–`0036` em `src/lib/db/migrations/` — ledger
> esperado **36** (autoridade: [docs/audit/migrations-policy.md](../audit/migrations-policy.md);
> constante `EXPECTED_MIGRATIONS` em `src/services/api-handlers/health/db.ts`).
> Política de migrations (expand → migrate → switch → contract):
> [docs/audit/migrations-policy.md](../audit/migrations-policy.md).
>
> **Estado medido atual (sessão E2a, read-only, 2026-10-10):**
> - Cadeia canônica `0000`–`0036` (ledger 36); bancos de produção e staging no
>   target Contabo com **33/36** aplicadas — 0034–0036 pendentes. O bundle de
>   Worker ainda em campo reporta **33/33** (`migrationsExpected` congelado no
>   deploy anterior): número velho, não prova 36/36; a contagem vigente é 36.
> - Backup agendado **em vigor** no target: artefatos off-host presentes até
>   2026-10-10, frequência **03:30Z/dia** conforme logs — ver §2.3. A afirmação
>   "sem backup automático em vigor" sobrevive apenas como **asserção
>   documental datada e superada** (2026-09-25 e 2026-10-08): ela é
>   **contraditada pelo inventário P2 observado** (backups diários off-host no
>   target desde 2026-10-05) e **não** deve ser lida como "não existia backup
>   real" — ver §1.
> - Ressalvas medidas (não silenciadas): (1) o restore do archive atual
>   (2026-10-10) **não foi executado** — o backup mais recente não tem validade
>   provada por restore; (2) o manifest portátil **não viaja dentro** do archive
>   off-host atual (script vivo no host antecede o fix do manifest; hash do
>   archive atual conferido contra manifest local separado); (3) drill mensal
>   de restore segue sem agendamento nem dono.
> - Exposição de rede do PostgreSQL no target (`0.0.0.0:15433` publicado,
>   `DOCKER-USER` vazia, sem container `cloudflared`): registrada, com decisão
>   e gates, em
>   [ADR-BASE-21](../adr/ADR-BASE-21-contabo-postgres-private-connectivity.md).
> - Role de aplicação em runtime com **superuser** (observado/reportado em
>   2026-10-10): pendência de separação de papéis — trilha própria em
>   [db-runtime-least-privilege.md](db-runtime-least-privilege.md) (proposta,
>   nada executado), fora do escopo deste runbook.

## 1. Objetivos (RPO/RTO)

Valores abaixo são **ALVO — datapoint parcial de restore MEDIDO em drill
2026-09-25 (restore + ledger verificados, sem smoke/switch); RPO e RTO fim a fim
NÃO medidos, A RATIFICAR pelo owner**. Frequência e retenção são **proposta —
decisão operacional pendente**.

| Objetivo | Alvo proposto | Status |
|---|---|---|
| RPO (perda máxima aceitável de dados) | ≤ 24 h (backup diário) | **NÃO MEDIDO** (não havia backup anterior em 2026-09-25) — A RATIFICAR pelo owner |
| RTO (tempo máximo de restauração do serviço) | ≤ 4 h (restore + smoke + switch) | **datapoint parcial de restore: < 60 s (77 MiB); fim a fim (smoke + switch) NÃO MEDIDO** — A RATIFICAR pelo owner |
| Frequência de backup (proposta) | 1×/dia (cheio, `pg_dump` custom) + WAL/backup contínuo se o volume justificar | Proposta — decisão operacional pendente; em 2026-09-25 sem agendamento automático evidenciado (primeiro backup canônico gerado no drill). **Medido 2026-10-10 (E2a): agendado em vigor no target Contabo — 03:30Z/dia, off-host via rclone; ver §2.3** |
| Retenção (proposta) | 7 diários + 4 semanais + 3 mensais; cópia off-host (fora da VPS) | Proposta — decisão operacional pendente; histórico 2026-09-25: cópia off-host e cron NÃO configurados (sem backup automático). **Medido 2026-10-10 (E2a): cópia off-host ativa no target Contabo, artefatos presentes até 2026-10-10; retenção local 14 dias — ver §2.3** |
| Restore test (prova de validade) | 1×/mês em ambiente isolado, com checklist registrado (§5) | Proposta — decisão operacional pendente; drills históricos datados em §5 (2026-09-25, 2026-09-26, 2026-10-07); rotina mensal segue sem dono |

> **Ratificação owner 2026-10-08 (sem produção):** RPO ≤ 24 h e RTO ≤ 4 h
> RATIFICADOS como alvo com medição parcial — drill local 2026-09-26 COMPLETO
> (alvo vivo + smoke 3/3 PASS, RTO fim a fim local ~114 s;
> `restore-tests/2026-09-26-local-drill.md`); prod com datapoint parcial
> (restore < 60 s / 77 MiB, sem smoke/switch —
> `restore-tests/2026-09-25-prod-drill.md`). Switch real em prod, drill mensal
> agendado e ratificação final seguem pendentes. Cron diário off-host (§2.3) e
> drill mensal APROVADOS como proposta nesta data.
>
> **Correção documental (E2a, 2026-10-10):** a frase desta ratificação
> "**sem backup automático em vigor em 2026-10-08**" permanece citada apenas
> como **asserção datada e superada (erro documental)** — o
> [inventário P2 de 2026-10-07](../inventory/2026-10-07-p2-contabo-validation.md)
> **observou backups diários off-host já ativos no target desde 2026-10-05**
> (artefatos de 05/06/07-10; `backup-synkroo.sh` diário 03:30 UTC + rclone,
> retenção 14). A frase **não** afirma que não existia backup real: registra o
> estado da documentação naquela data e está **contraditada pela evidência
> observada**.
>
> **Atualização medida 2026-10-10 (E2a, read-only) — substitui o estado acima
> apenas no ponto do agendamento:** o backup automático **está em vigor** no
> target Contabo — artefatos off-host presentes até 2026-10-10, criados
> **03:30Z/dia** conforme logs do host (cron `30 5 * * *`); código versionado
> em `ops/vps/contabo/backup/backup-synkroo.sh` (detalhes e ressalvas em §2.3).
> Permanecem pendentes: restore do archive atual (2026-10-10) **não executado**;
> manifest não embutido no archive off-host atual; drill mensal sem
> agendamento/dono; switch real em prod e ratificação final de RPO/RTO.

## 2. Princípio: backup sem restore comprovado não é backup

Todo backup só é considerado válido após um restore test com evidência
registrada (§5). Criar o arquivo e nunca restaurar **não conta**.

### 2.1. Backup (genérico — adaptar ao ambiente real descoberto via [vps-access](../ops/vps-access.md))

```bash
# Na VPS (após conexão e descoberta do serviço, ver docs/ops/vps-access.md):
# backup lógico do banco de produção para um arquivo datado, fora do volume de dados
docker exec <container-postgres-producao> \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/synkroo-$(date +%F).dump
docker cp <container-postgres-producao>:/tmp/synkroo-$(date +%F).dump ./backups/
sha256sum ./backups/synkroo-$(date +%F).dump | tee ./backups/synkroo-$(date +%F).sha256
```

Regras: nunca armazenar o único exemplar no mesmo volume de dados do banco
(`synkroo_prod_pgdata`, ver `ops/vps/synkroo-prod-postgres/docker-compose.yml`);
copiar para off-host; registrar hash + data no checklist (§5).

### 2.2. Restore test em ambiente isolado (procedimento concreto)

O alvo do teste **nunca** é o banco de produção nem o banco de dev local.
Duas opções isoladas (escolher uma):

**Opção A — container descartável (qualquer host com Docker):**

```bash
docker run --rm -d --name synkroo-restore-test \
  -e POSTGRES_DB=synkroo_restore -e POSTGRES_USER=synkroo_test \
  -e POSTGRES_PASSWORD=restore-test-only \
  -p 55435:5432 pgvector/pgvector:pg17
# aguardar healthcheck
docker exec synkroo-restore-test pg_isready -U synkroo_test -d synkroo_restore
# restaurar (o dump precisa das extensões pgvector/btree_gist — criadas pelo bootstrap 0000)
pg_restore -h 127.0.0.1 -p 55435 -U synkroo_test -d synkroo_restore --no-owner ./backups/<arquivo>.dump
# validar contagem de migrations aplicadas vs cadeia 0000–0036
# (ledger de readiness: GET /api/internal/readiness contra esse banco, ou contagem na tabela de migrations do Drizzle)
docker stop synkroo-restore-test   # --rm remove o container; nada persiste
```

**Opção B — compose de remediação (padrão já documentado em
`staging-environment.md`):**

```bash
docker compose -f docker-compose.remediation.yml up -d --wait
pg_restore -h 127.0.0.1 -p 55434 -U synkroo_test -d synkroo_remediation --no-owner ./backups/<arquivo>.dump
```

Critério de aceite do teste: restore conclui sem erro, contagem de migrations
confere com a cadeia canônica e o smoke de liveness contra esse banco passa
(ver §5). Registrar tudo no checklist (§5).

**O que o drill prova — e o que ele não prova.** O restore drill valida a
**estrutura e o ledger do próprio backup** (fidelidade do `pg_restore` +
contagem/hashes do ledger restaurado). Um backup cujo ledger é **anterior** à
cadeia vigente — ex.: 33/36, tomado antes das migrations 0034–0036 — restaurado
com fidelidade é **VÁLIDO como backup**: a defasagem de migrations do ambiente
(33 vs 36) é avaliada **em separado**, pela trilha migrate/readiness
(`/api/internal/readiness`), e **não invalida o restore** por si só. O que
reprova o backup é falha ou divergência no próprio restore (estrutura ou
hashes do ledger), nunca a defasagem contra a cadeia vigente.

**O primeiro restore test contra um backup real de produção foi EXECUTADO em
2026-09-25** — evidência em
[restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md)
(restore + ledger verificados; smoke pós-restore pendente por desenho do
drill). A linha do tempo completa de drills, com datas, está em §5. A partir
de 2026-09-25, o restore test passa a ser rotina mensal proposta (§1).

### 2.3. Rotina de backup (scripts do repo)

Artefatos canônicos (sem segredos no repo; a connection string nunca é aceita
via argv nem exibida em logs — só o rótulo seguro `host/dbname` é impresso):

| Artefato | Caminho | Uso |
|---|---|---|
| Backup | `scripts/db-backup.mjs` | dump `pg_dump -Fc` + gzip + `.sha256`, retenção por idade |
| Restore | `scripts/db-restore.mjs` | dry-run por padrão; restore real só com `--yes`; no modo `--local` o default é o **dev local** (`synkroo-db`/`synkroo`) — em drill/teste passe `--container/--db/--user` do alvo isolado do §2.2; verificação pós-restore (contagem de `clinics`, `users`, `patients`, `appointments`) |
| Backup VPS target (rotina viva) | `ops/vps/contabo/backup/backup-synkroo.sh` | rotina medida em 2026-10-10 (E2a): dump lógico via `docker exec` (unix socket, sem rede) + manifest SHA + cópia off-host via rclone; retenção local 14 dias; falha off-host é fail-closed |

```bash
# Local (dump via docker exec no container synkroo-db — pg_dump roda DENTRO
# do container, não precisa de cliente Postgres no host):
node scripts/db-backup.mjs --local
node scripts/db-backup.mjs --local --out-dir ./backups --keep 7

# VPS/staging (pg_dump direto; exige postgresql-client no host; a string de
# conexão vem SOMENTE de $DATABASE_URL do processo — nunca via argv, nunca
# exibida em logs; só o rótulo host/dbname é impresso):
DATABASE_URL="..." node scripts/db-backup.mjs --url --out-dir /var/backups/synkroo

# Restore — DRY-RUN por padrão (nada é alterado, exit 0).
# Alvo EXPLÍCITO: container isolado do §2.2 (Opção A). Sem --container/--db/--user
# o script cai no default do DEV LOCAL (synkroo-db/synkroo) — em drill ou teste
# de backup nunca aceite o default sem confirmar que o alvo é o dev local:
node scripts/db-restore.mjs ./backups/synkroo-<timestamp>.dump.gz --local \
  --container synkroo-restore-test --db synkroo_restore --user synkroo_test

# Restore real — DESTRUTIVO no alvo: exige --yes, APROVAÇÃO ESCRITA e só pode
# rodar contra o container isolado synkroo-restore-test (nunca o dev local,
# nunca produção):
node scripts/db-restore.mjs ./backups/synkroo-<timestamp>.dump.gz --local --yes \
  --container synkroo-restore-test --db synkroo_restore --user synkroo_test
```

Agendamento sugerido na VPS (atende o RPO ≤ 24 h proposto em §1 —
**RPO/RTO seguem A CONFIRMAR pelo owner**, ver §1):

```cron
# crontab na VPS — dump diário 02:00 UTC, retenção de 7 dias
# (DATABASE_URL exportada no ambiente do cron; nunca inline como argumento)
0 2 * * * /usr/bin/node /opt/synkroo/scripts/db-backup.mjs --url --out-dir /var/backups/synkroo --keep 7 >> /var/log/synkroo-backup.log 2>&1
```

**Rotina viva medida no target Contabo (E2a, read-only, 2026-10-10):** backup
agendado **em vigor**, distinto do sugerido acima — horário do host
`30 5 * * *` (= **03:30Z/dia**; mesmo horário do backup da source, sem colidir
com o backup-pi às 03:30 CEST), execução de
`ops/vps/contabo/backup/backup-synkroo.sh` instalado em `/opt/synkroo/backup/`,
artefatos **off-host presentes até 2026-10-10** (logs + listagem do destino),
retenção local de 14 dias. Esta seção substitui, como estado corrente, a
afirmação "sem backup automático em vigor": a frase de 2026-09-25/2026-10-08
sobrevive apenas como **asserção documental datada e superada (erro
documental)**, **contraditada pelo inventário P2 observado** (backups diários
off-host no target desde 2026-10-05) — e **não** como prova de que não havia
backup real.

Ressalvas medidas do estado atual (não silenciadas):

1. **Restore do archive atual não provado:** o archive de 2026-10-10 **não foi
   restaurado** — pelo princípio do §2, o backup mais recente não tem validade
   comprovada. Último restore contra backup real: 2026-10-07 (histórico, §5).
2. **Separação do manifest no servidor:** o script **vivo no host** antecede o
   fix do manifest portátil — o manifest **não está embutido** no archive
   off-host atual; o hash do archive atual foi conferido contra um manifest
   **local separado**, que não viaja com o artefato. O código versionado
   (`ops/vps/contabo/backup/backup-synkroo.sh`) já gera o manifest dentro do
   tar: a deriva é de deploy, não do repo — reconciliar exige atualizar o
   script no host (operação mutadora, fora do escopo E2a).
3. **Off-host:** cópia fora do host confirmada até 2026-10-10; a disponibilidade
   contínua depende do rclone configurado no host — falha off-host é
   fail-closed por desenho do script (exit ≠ 0, sem ping de sucesso).

Regras: nunca manter o único exemplar no mesmo volume de dados do banco;
copiar para off-host; registrar hash + data no checklist (§5).

Restore drill (roteiro testável — registrar recibo no checklist §5):

1. `DATABASE_URL="..." node scripts/db-backup.mjs --url` (gera
   `synkroo-<timestamp>.dump.gz` + `.sha256`).
2. Subir alvo isolado (Opção A ou B do §2.2 — **nunca** produção/dev local).
3. Dry-run contra o alvo isolado (container do §2.2 — Opção A):
   `node scripts/db-restore.mjs <arquivo>.dump.gz --local --container synkroo-restore-test --db synkroo_restore --user synkroo_test`
   (mostra o plano, exit 0, sem alterar dados). Os flags explícitos são
   obrigatórios no drill: sem eles o script restaura no default do **dev
   local** (`synkroo-db`/`synkroo`).
4. Restore real no alvo isolado — **apenas com aprovação escrita** e
   **exclusivamente** contra `synkroo-restore-test`: mesmo comando do passo 3
   acrescido de `--yes`. `--yes` é destrutivo no alvo; nunca usar sem o alvo
   isolado explícito.
5. Conferir a verificação pós-restore impressa pelo script (contagem das 4
   tabelas core) + ledger de migrations (§2.2) + smoke (§4).
6. Preencher o bloco de evidência do §5. **Linha do tempo de drills contra
   backup real (histórico datado — manter datas, não reescrever):**
   2026-09-25 — primeiro restore contra backup real de produção, prova parcial
   (restore + ledger; smoke pendente) —
   [restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md);
   2026-09-26 — drill local com alvo vivo, smoke 3/3 PASS e RTO fim a fim
   ~114 s — [restore-tests/2026-09-26-local-drill.md](restore-tests/2026-09-26-local-drill.md);
   2026-10-07 — no target Contabo, backup off-host do dia restaurado no DB
   isolado `synkroo_drill` (backup real, não sintético) —
   [inventário 2026-10-07](../inventory/2026-10-07-p2-contabo-validation.md);
   2026-10-10 (E2a) — restore do archive do dia **não executado**: validade do
   backup mais recente segue não provada (ressalva 1 acima).

## 3. Runbooks por cenário

Ordem geral em qualquer cenário: conter → preservar evidência (backup do
estado atual antes de mexer) → agir → smoke (§5) → registrar.

### (a) Banco corrompido

1. Confirmar o sintoma (logs, `pg_isready`, healthcheck do container; nunca
   reproduzir segredos em logs — ver [vps-access](../ops/vps-access.md)).
2. Congelar escrita: parar o app/worker que escreve no banco (deploy parado,
   manutenção), **sem** remover o volume de dados.
3. Preservar evidência: backup do estado atual (mesmo corrompido), conforme
   §2.1, marcado como `corrompido-<data>`.
4. Subir banco de substituição (novo volume ou host) e restaurar o último
   backup **válido** (com restore test registrado, §5):
   `pg_restore ... --no-owner <último-backup-válido>.dump`.
5. Reapontar `DATABASE_URL`/Hyperdrive para o banco restaurado, aplicar
   `npm run db:migrate` se o ledger indicar migrations faltantes.
6. Rodar o smoke pós-restore (§5). Só então liberar escrita.

### (b) Migration com problema em produção

Autoridade: [docs/audit/migrations-policy.md](../audit/migrations-policy.md).

1. **Não** tentar "desfazer" a migration no calor do incidente: o `drizzle-kit`
   aplica só `UP`; os blocos `DOWN` comentados são nota de intenção, não plano
   testado.
2. Se a migration era fase **expand/migrate/switch** (estrutura antiga ainda
   existe): rollback = **forward-fix**, feature flag ou dual-read de volta
   para a estrutura antiga. Deploy da versão anterior do Worker compatível
   com o schema expandido (padrão já usado em
   `remediation-migration-rollback.md`).
3. Se a migration era fase **contract** (removeu estrutura/dados): contract em
   produção é **PROIBIDO** sem as 5 condições cumulativas (backup com restore
   testado; nenhum consumidor ativo da estrutura antiga; janela de observação
   pós-switch; forward-fix documentado; aprovação operacional explícita).
   Rollback de contract **não recupera dados** — exige restore de backup
   (§(a)) ou re-expand + re-backfill.
4. Registrar: migration envolvida, fase (expand/switch/contract), decisão
   forward-fix vs restore, aprovador.

### (c) Deploy incompatível com migration (expand/contract)

1. Regra de ouro: **deploy de código e fase de schema andam separados**.
   Deploy B (switch/contract) nunca vai junto com o Deploy A (expand).
2. Sintoma típico: versão nova lê coluna/tabela que a migration ainda não
   criou (ou versão antiga lê estrutura que o contract removeu).
3. Ação: voltar o Worker para a versão compatível com o schema atual
   (`npx wrangler rollback` / `npx wrangler deploy --version <version-id>` —
   procedimento base em `docs/runbook-deploy-instancia.md` §5 e resumo no
   [smoke pós-deploy](../ops/smoke-deploy-runbook.md) §5), rodar o smoke (§5)
   e só então re-planejar a sequência expand → migrate → switch → contract.
4. Nunca "resolver" aplicando contract às pressas para casar com o código.

### (d) Credencial comprometida (rotação)

Onde cada uma vive (sem valores — nunca commitar segredo):

| Credencial | Onde vive / como rotacionar |
|---|---|
| `DATABASE_URL` (+ `POSTGRES_*` na VPS) | Produção: `.env` ao lado de `ops/vps/synkroo-prod-postgres/docker-compose.yml` (fora do repo) + Hyperdrive; Cloudflare: `wrangler secret put`. Rotacionar no banco **e** em todos os consumidores antes de derrubar a antiga. |
| `AUTH_SECRET` / `JWT_SECRET` | Env do app (`src/lib/env.ts` exige `AUTH_SECRET` ≥ 32, `JWT_SECRET` ≥ 16); Cloudflare: `wrangler secret put`. Troca invalida sessões — avisar operação e fazer em janela. |
| `CRON_SECRET` | Env do app; jobs em `/api/cron/*` validam com `crypto.timingSafeEqual`. Atualizar chamadores agendados junto. |
| `WEBHOOK_SECRET` (inbound) | Env do app; validado em `/api/messages/inbound`. Coordenar com o emissor do webhook antes de trocar. |
| Chaves de gateway de pagamento | Configuração **por clínica** via `/api/gateway/*` (não é env global) — rotacionar no painel do gateway + atualizar o cadastro da clínica afetada. |
| Chaves de LLM (`MINIMAX_API_KEY` / `OPENAI_API_KEY` etc.) | Env do app (ver `src/lib/llm/factory.ts`, `src/lib/env.ts`); Cloudflare: `wrangler secret put`. |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` (WhatsApp) | Env do app; rotacionar também no console da Evolution API. |
| Inventário completo de vars | `docs/ENV-CHECKLIST.md` |

Passos: gerar o novo valor fora do repo → atualizar o cofre/origem → atualizar
todos os consumidores → validar (smoke §5 cobre liveness/auth/db) → revogar o
antigo → registrar quem/quando (operações destrutivas exigem confirmação
explícita — ver [vps-access](../ops/vps-access.md)).

## 4. Smoke pós-restore

Reaproveitar o runbook de smoke existente — **não duplicar checks aqui**:

- Contrato e comandos: [docs/ops/smoke-deploy-runbook.md](../ops/smoke-deploy-runbook.md)
  (`scripts/smoke-deploy.mjs`, `npm run smoke:deploy`; checks `liveness`,
  `auth-pipeline`, `db`, `middleware`, `workers: skipped`).
- Atenção ao check `db`: ele valida liveness do DB + compatibilidade do
  **ledger de migrations**, não a existência física de cada tabela — após
  restore, complementar com a contagem de migrations aplicadas (§2.2).
  Ressalva medida (E2a, 2026-10-10): o bundle de Worker em campo reportava
  `migrationsExpected` 33 (deploy anterior à cadeia `0000`–`0036`), exibindo
  `complete:true` 33/33 mesmo com o ambiente em 33/36 — conferir também
  o ledger real no banco (`drizzle.__drizzle_migrations`) e o readiness
  autenticado antes de concluir "completo".
- Contrato estendido com auth sintética (staging): ver
  [staging-environment.md](staging-environment.md) (`scripts/smoke-staging.mjs`).
- Rollback de Worker (quando o cenário exigir): ver
  [remediation-migration-rollback.md](remediation-migration-rollback.md).

> Nota de árvore: o runbook de smoke do Hardening V1 (F5) vive em `docs/ops/`
> (`smoke-deploy-runbook.md`), não em `docs/runbooks/`. Este documento o
> referencia em vez de criar convenção paralela.

## 5. Registro de evidência — checklist de restore test

Copiar o bloco abaixo a cada restore test e arquivar (onde a operação
definir — propor: este diretório ou o sistema de chamados; **definição
pendente da operação**).

```text
RESTORE TEST — <AAAA-MM-DD>
- Backup usado: <nome do arquivo> (hash sha256: <hash>)
- Origem do backup: <produção / staging / <ambiente>>
- Ambiente de restore: <container descartável synkroo-restore-test / compose remediação>
- Início/fim do restore: <HH:MM> → <HH:MM> (tempo total: <X min>)
- pg_restore: [ ] OK sem erros / [ ] OK com avisos (anexar) / [ ] FALHOU (anexar log redatado)
- Ledger de migrations confere com a cadeia canônica vigente (0000–0036; ledger 36): [ ] sim / [ ] não
  · Ledger do backup anterior à cadeia vigente (ex.: 33/36, backup pré-0034–0036):
    fidelidade do restore (estrutura + hashes do ledger) = backup VÁLIDO; a defasagem
    de migrations do ambiente é avaliada em migrate/readiness à parte (§2.2) e NÃO
    invalida o restore por si só.
- Smoke pós-restore ([smoke-deploy-runbook](../ops/smoke-deploy-runbook.md)): [ ] PASS / [ ] FAIL
- Resultado: [ ] backup VÁLIDO / [ ] backup INVÁLIDO (ação: <…>)
- Responsável: <nome> — Operação ciente: <nome/data>
```

**Linha do tempo de restore tests (histórico datado — preservado; cada entrada
vale para a cadeia canônica da sua data e não deve ser reescrita):**

- **2026-09-25** — cadeia então vigente `0000`–`0033` (ver
  [baseline do hardening v2](../audit/hardening-v2-baseline.md)): primeiro
  restore contra backup real de **produção**, prova parcial (restore + ledger
  33/33 idênticos; smoke pendente) —
  [restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md).
- **2026-09-26** — drill **local**, alvo vivo, smoke 3/3 PASS, RTO fim a fim
  ~114 s; ledger 33/33 contra a cadeia `0000`–`0033` da época —
  [restore-tests/2026-09-26-local-drill.md](restore-tests/2026-09-26-local-drill.md).
- **2026-10-07** — target Contabo: backup **off-host do dia** (real, não
  sintético) restaurado no DB isolado `synkroo_drill`; ledger 33 à época —
  [inventário 2026-10-07](../inventory/2026-10-07-p2-contabo-validation.md).
- **2026-10-10 (E2a, read-only)** — medições do estado atual: cadeia vigente
  `0000`–`0036` (ledger 36); produção e staging em **33/36**; Workers ainda
  reportam 33/33; **restore do archive do dia não executado** (§2.3, ressalva 1)
  — a validade do backup mais recente segue não provada.

Próximos drills seguem a rotina mensal proposta (§1).
