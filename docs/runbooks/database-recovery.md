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
> cadeia de migrations `0000`–`0031` em `src/lib/db/migrations/` — ver
> [baseline do hardening v2](../audit/hardening-v2-baseline.md). Política de
> migrations (expand → migrate → switch → contract):
> [docs/audit/migrations-policy.md](../audit/migrations-policy.md).

## 1. Objetivos (RPO/RTO)

Valores abaixo são **ALVO — datapoint parcial de restore MEDIDO em drill
2026-09-25 (restore + ledger verificados, sem smoke/switch); RPO e RTO fim a fim
NÃO medidos, A RATIFICAR pelo owner**. Frequência e retenção são **proposta —
decisão operacional pendente**.

| Objetivo | Alvo proposto | Status |
|---|---|---|
| RPO (perda máxima aceitável de dados) | ≤ 24 h (backup diário) | **NÃO MEDIDO** (não havia backup anterior em 2026-09-25) — A RATIFICAR pelo owner |
| RTO (tempo máximo de restauração do serviço) | ≤ 4 h (restore + smoke + switch) | **datapoint parcial de restore: < 60 s (77 MiB); fim a fim (smoke + switch) NÃO MEDIDO** — A RATIFICAR pelo owner |
| Frequência de backup (proposta) | 1×/dia (cheio, `pg_dump` custom) + WAL/backup contínuo se o volume justificar | Proposta — decisão operacional pendente; em 2026-09-25 sem agendamento automático evidenciado (primeiro backup canônico gerado no drill) |
| Retenção (proposta) | 7 diários + 4 semanais + 3 mensais; cópia off-host (fora da VPS) | Proposta — decisão operacional pendente; cópia off-host e cron NÃO configurados (sem backup automático em 2026-09-25) |
| Restore test (prova de validade) | 1×/mês em ambiente isolado, com checklist registrado (§6) | Proposta — decisão operacional pendente |

## 2. Princípio: backup sem restore comprovado não é backup

Todo backup só é considerado válido após um restore test com evidência
registrada (§6). Criar o arquivo e nunca restaurar **não conta**.

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
copiar para off-host; registrar hash + data no checklist (§6).

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
# validar contagem de migrations aplicadas vs cadeia 0000–0031
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
(ver §5). Registrar tudo no checklist (§6). **O primeiro restore test contra
um backup real de produção foi EXECUTADO em 2026-09-25** — evidência em
[restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md)
(restore + ledger verificados; smoke pós-restore pendente por desenho do
drill). A partir daqui, o restore test passa a ser rotina mensal proposta
(§1).

### 2.3. Rotina de backup (scripts do repo)

Artefatos canônicos (sem segredos no repo; a connection string nunca é aceita
via argv nem exibida em logs — só o rótulo seguro `host/dbname` é impresso):

| Artefato | Caminho | Uso |
|---|---|---|
| Backup | `scripts/db-backup.mjs` | dump `pg_dump -Fc` + gzip + `.sha256`, retenção por idade |
| Restore | `scripts/db-restore.mjs` | dry-run por padrão; restore real só com `--yes`; verificação pós-restore (contagem de `clinics`, `users`, `patients`, `appointments`) |

```bash
# Local (dump via docker exec no container synkroo-db — pg_dump roda DENTRO
# do container, não precisa de cliente Postgres no host):
node scripts/db-backup.mjs --local
node scripts/db-backup.mjs --local --out-dir ./backups --keep 7

# VPS/staging (pg_dump direto; exige postgresql-client no host; a string de
# conexão vem SOMENTE de $DATABASE_URL do processo — nunca via argv, nunca
# exibida em logs; só o rótulo host/dbname é impresso):
DATABASE_URL="..." node scripts/db-backup.mjs --url --out-dir /var/backups/synkroo

# Restore — DRY-RUN por padrão (nada é alterado, exit 0):
node scripts/db-restore.mjs ./backups/synkroo-<timestamp>.dump.gz --local
# Restore real (destrutivo no alvo — exige confirmação explícita):
node scripts/db-restore.mjs ./backups/synkroo-<timestamp>.dump.gz --local --yes
```

Agendamento sugerido na VPS (atende o RPO ≤ 24 h proposto em §1 —
**RPO/RTO seguem A CONFIRMAR pelo owner**, ver §1):

```cron
# crontab na VPS — dump diário 02:00 UTC, retenção de 7 dias
# (DATABASE_URL exportada no ambiente do cron; nunca inline como argumento)
0 2 * * * /usr/bin/node /opt/synkroo/scripts/db-backup.mjs --url --out-dir /var/backups/synkroo --keep 7 >> /var/log/synkroo-backup.log 2>&1
```

Regras: nunca manter o único exemplar no mesmo volume de dados do banco;
copiar para off-host; registrar hash + data no checklist (§6).

Restore drill (roteiro testável — registrar recibo no checklist §6):

1. `DATABASE_URL="..." node scripts/db-backup.mjs --url` (gera
   `synkroo-<timestamp>.dump.gz` + `.sha256`).
2. Subir alvo isolado (Opção A ou B do §2.2 — **nunca** produção/dev local).
3. Dry-run: `node scripts/db-restore.mjs <arquivo>.dump.gz --local`
   (mostra o plano, exit 0, sem alterar dados).
4. Restore real no alvo isolado: mesmo comando + `--yes`.
5. Conferir a verificação pós-restore impressa pelo script (contagem das 4
   tabelas core) + ledger de migrations (§2.2) + smoke (§4).
6. Preencher o bloco de evidência do §5. **Drill real contra backup de
   produção: EXECUTADO em 2026-09-25** (evidência em
   [restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md));
    datapoint parcial de restore medido segue A RATIFICAR pelo owner (§1).

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
   backup **válido** (com restore test registrado, §6):
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
- Ledger de migrations confere com 0000–0031: [ ] sim / [ ] não
- Smoke pós-restore ([smoke-deploy-runbook](../ops/smoke-deploy-runbook.md)): [ ] PASS / [ ] FAIL
- Resultado: [ ] backup VÁLIDO / [ ] backup INVÁLIDO (ação: <…>)
- Responsável: <nome> — Operação ciente: <nome/data>
```

**Primeiro restore test contra backup real de produção: EXECUTADO em
2026-09-25** — evidência em
[restore-tests/2026-09-25-prod-drill.md](restore-tests/2026-09-25-prod-drill.md).
Próximos drills seguem a rotina mensal proposta (§1).
