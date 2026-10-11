# Plano operacional E2b — estabilização vNext (decision-ready; sem execução)

**Data:** 2026-10-11 · **Base:** `origin/main @ a7478979` · **Branch:** `docs/e2b-operational-plan`
**Status:** DECISION-READY — plano para decisão do owner; nenhuma ação mutadora foi executada ou autorizada por este documento.
**Natureza:** isto é um **plano**, não execução e não aprovação. O gate E2b (aprovação humana explícita antes de alterar BD/Cloudflare de produção) continua externo e pendente; sem ele este plano permanece **READY FOR OPERATOR — nunca DONE**.
**Fontes:** `docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md` · `docs/inventory/2026-10-07-p2-contabo-validation.md` · `docs/ops/vps-access.md` · `docs/ops/cloudflare-runtime-checklist.md` · `scripts/migrate-vps.ts` · `scripts/update-hyperdrive.ts` · `scripts/db-backup.mjs` · `scripts/db-restore.mjs` · `scripts/smoke-deploy.mjs` · `scripts/smoke-staging.mjs` · `worker-entry.mjs` · `scripts/lib/cron-schedule.mjs` · `src/services/api-handlers/health/{db,readiness}.ts` · `src/lib/outbox/outbox-repository.ts` · `src/core/schema/infra.ts`.

## 1. Evidência atual (read-only)

- **Código:** `origin/main @ a7478979`; PR #44 merged. CI pós-merge run `38093233530` 4/4 PASS — evidência verificada antes do drafting; o CI do commit que introduz este plano deve ser confirmado após o push (pendência do orquestrador, não desta escrita).
- **Ledgers:** produção e staging em **33/36**. Pendentes, **nesta ordem**: 0034 (`0034_action_attempt_fields` — colunas anuláveis em `action_logs`: `duration_ms`, `policy_version`, `decision`, `approval_id`) → 0035 (`0035_approval_tokens` — cria `approval_tokens`) → 0036 (`0036_outbox_claim_generation` — `outbox_jobs.claim_generation`).
- **Conectividade:** PostgreSQL do target alcançável; conexão autenticada TLS/SCRAM bem-sucedida.
- **Rede (sem novo teste externo):** UFW restrito a ranges Cloudflare IPv4, ineficaz contra a publicação Docker `0.0.0.0:15433`; chain `DOCKER-USER` vazia; unidade de firewall esperada ausente. A exposição é real apesar do UFW — daí a fase 2 ser tratada como janela urgente separada.
- **Papéis runtime atuais:** produção `synkroo` (SUPERUSER); staging `synkroo_staging` (CREATEDB).
- **Backup:** 10/10 artefatos off-host verificados em streaming contra o manifest; o manifest era separado e não foi bundleado; **nenhum restore nesta rodada**. O drill histórico de 10/07 foi restore de **artefato real off-host do dia** no DB **isolado** `synkroo_drill` (ledger 33 / clinics 1 / users 1 / vector 1, com DROP + cleanup) — restore real de backup real em ambiente isolado; **não** era synthetic-only e **não** é restore do backup vigente de produção.
- **Migrations 0034–0036:** expand-only — 0034 `ADD COLUMN IF NOT EXISTS` anuláveis em `action_logs`; 0035 `CREATE TABLE IF NOT EXISTS "approval_tokens"`; 0036 `ADD COLUMN ... claim_generation integer DEFAULT 0 NOT NULL` em `outbox_jobs` (linhas existentes nascem em 0) — todas re-rodáveis; DOWN é comentário — rollback real é forward-fix (`docs/audit/migrations-policy.md`).
- **Contrato do health:** `EXPECTED_MIGRATIONS` conta registros de `drizzle.__drizzle_migrations` (36); journal idx 0–36 (`0000`–`0036`, gap herdado `0017`).
- **Smokes:** `smoke-deploy` = só GETs públicos; o check `workers` é **skipped** (ia-bridge via service bindings, sem HTTP público — skip **não** é prova de worker/fence). `smoke-staging` **não é read-only** e é **stateful synthetic-only**: faz POST `/api/auth/switch-clinic` (muta a sessão ativa) e POST `/api/messages/inbound` com corpo `{}` — rejeitado em 403 (instalação não resolvida) ou 400 (campos inválidos), ambos **antes** de qualquer dispatch, portanto **sem envio real a provider** (`scripts/smoke-staging.mjs:128-135,156-162`; `src/app/api/messages/inbound/route.ts:37,47`). Exige clínica/usuário sintéticos e estado controlado em staging; nunca produção.
- **Scheduler/cron:** trigger `*/5 * * * *` (`wrangler.toml:5`); 8 rotas em `src/app/api/cron/*` (`smart-triggers` aposentado, 410). Seis jobs são **gated por `CRON_JOBS_ENABLED`** (CSV em `[vars]`), mas **`/api/cron/outbox?limit=25` dispara em todo tick fora do gate** (`scripts/lib/cron-schedule.mjs:61-64`; `docs/ops/cloudflare-runtime-checklist.md` §11). Atenção ao valor vigente: `CRON_JOBS_ENABLED` **lista os seis jobs hoje** em produção (`wrangler.toml:47`) e em staging (`wrangler.toml:55`); "vazio" é apenas o default do código quando a variável está ausente ou vazia (`selectDueJobs` devolve `[]`). Pausar job nomeado exige **editar o valor e redepublicar** — não existe pausa por omissão de configuração.
- **Produtores de outbox (inventário real do repo):** além do consumidor `/api/cron/outbox`, produtores enfileiram **inline no request path** via `enqueueOutbox` — 9 chamadas em 9 arquivos (10 sítios; `financeiro-repository` tem duas): `src/modules/comercial/repositories/leads-repository.ts:20`; `src/modules/operacional/repositories/patients-repository.ts:49`; `src/modules/operacional/repositories/reminders-repository.ts:60`; `src/modules/followup/repositories/campaigns-repository.ts:71`; `src/modules/financeiro/repositories/financeiro-repository.ts:233,256`; `src/modules/financeiro/services/collection-service.ts:101`; `src/modules/comercial/services/hot-lead-notification-service.ts:109`; `src/modules/atendimento/repositories/conversations-repository.ts:797`; `src/repositories/campaigns/index.ts:133`. O claim do outbox tem **lease de 5 min recuperável** (`OUTBOX_LEASE_MS`, `src/lib/outbox/outbox-repository.ts:44`). Busca por `OUTBOX_PAUSE`/`MAINTENANCE_MODE`/flag equivalente no repo: **nenhum resultado** — **não existe mecanismo comprovado de pausa/drain do outbox** (ver bloqueador da fase 6).
- **Drift de compose:** repo tunnel-only (sem porta pública, com sidecar cloudflared); container vivo com porta pública e sem cloudflared. **Não aplicar compose agora** — a contenção de rede é decisão de owner em janela separada (fase 2).
- **PRs pendentes:** healthcheck/correções de backup (ainda não criado); ADR-BASE-21 (outro PR, pendente); runbook de papéis de runtime (pendente). Este documento não altera índice de ADRs nem outros docs.
- Fora de escopo desta rodada: itens P3/P4.

## 2. Ordem de mudança e dependências

**Fase 0 — Aprovações (fronteiras separadas; nada executa antes da sua).** São aprovações distintas, em sequência:

1. **A-REDE** — contenção de rede/rota privada (janela própria; escolha D3→D4 ou só D3). Autoriza **apenas** a fase 2.
2. **A-PAPEIS** — criação de papéis/credenciais de runtime + atualização de Hyperdrive por ambiente. Autoriza **apenas** a fase 3.
3. **A-RESTORE** — autorização **escrita** de restore (ambiente isolado, executante, janela). Autoriza **apenas** o gate da fase 4.
4. **E2b** — aprovação final explícita do owner, solicitada somente após o gate da fase 4; é a **única** que autoriza as fases 5–6 (migrations de produção e rollout app/workers).

Nenhuma autorização parcial substitui outra; nenhuma operação ocorre antes da sua autorização específica. Sem A-REDE a fase 2 não inicia; sem A-PAPEIS a fase 3 não inicia; sem A-RESTORE a fase 4 não conclui; sem E2b as fases 5–6 não iniciam.

**Fase 1 — PRs pequenos + CI.** Merge de: readiness/healthcheck; correções de backup; ADR-BASE-21 (outro PR); runbook de papéis de runtime. Cada um com CI verde (`npm run verify`, `npm run test:release`). Nenhum toca produção.
_Entrada:_ plano revisado. _Saída:_ `main` com os PRs merged e CI 4/4.

**Fase 2 — Rede (janela separada, owner-approved; A-REDE).** Contenção D3 → D4 Tunnel+Access, staging primeiro. Produção: conectividade privada provada (probe pelo par canônico do §5, pelo caminho privado) **antes** do unpublish da porta. **Probe pré-migration:** com o ledger em 33, a prova exigida é `SELECT 1` autenticado TLS/SCRAM + leitura do ledger; readiness `migrations-incomplete` em 33/36 é **aceita** (prova o caminho, não o ledger) e a leitura antiga 33/33 (contrato `EXPECTED_MIGRATIONS=33`, anterior a 0034–0036) é apenas histórico. Só `db-unreachable`/falha de auth/TLS reprova. Este gate **não** exige 36/36 — exigir seria circular: o ledger só chega a 36 na fase 5, que depende desta conectividade. Sem rollback público irrestrito.
_Entrada:_ fase 1 verde. _Saída:_ 15433 inacessível fora do caminho autorizado, em ambos os ambientes.

**Fase 3 — Papéis de runtime (janela separada; A-PAPEIS).** Credenciais admin/app distintas; criar e conceder em staging, smoke de worker, Hyperdrive do staging, confirmar `pg_stat_activity`; só então produção. Não alterar credenciais existentes; pools drenam naturalmente. Dependência: capacidade de atualizar Hyperdrive **por ambiente**. **Probe pré-migration:** o smoke de worker contra staging roda com ledger 33 e aceita `migrations-incomplete` (33/36) — prova auth/TLS/papel, não completude de migrations; só `db-unreachable` reprova. O gate 36/36 é pós-fase 5.
_Entrada:_ fase 2 verde — caminho privado provado (papéis trafegam sobre a rede privada, nunca sobre porta pública). _Saída:_ aplicação conectando por papéis novos, sem flags, em ambos os ambientes.

**Fase 4 — Gate de restauração.** Restore de backup **autorizado por escrito (A-RESTORE)** e verificado em ambiente isolado allowlisted (regras §6); backup+manifest off-host co-verificados; readiness corrigida; gates de conectividade privada e least-privilege verdes. Somente então a E2b é solicitada.
_Entrada:_ fases 1–3 verdes. _Saída:_ evidência de restore + trilha de privilégios auditável.

**Fase 5 — Migrations.** Um ambiente por vez (staging; depois produção em janela própria), 33→36 via `migrate-vps`; sem deploy simultâneo.

**Antes das migrations (pré-requisito, não opcional):** provisionar os papéis runtime **e** `ALTER DEFAULT PRIVILEGES` emitida pelo **dono exato da migration** — o mesmo principal com que `scripts/migrate-vps.ts` conecta — para que `approval_tokens` **já nasça concedida** na criação pela 0035 (§3).

**Ordem explícita: 0034 (`0034_action_attempt_fields`, `action_logs`) → 0035 (`0035_approval_tokens`) → 0036 (`0036_outbox_claim_generation`)** — o runner canônico (`scripts/migrate-vps.ts` → drizzle `migrate`) aplica **todo** o journal pendente **em ordem, numa única invocação por ambiente**; **não** existe ponto de intercalação entre 0035 e 0036 para aplicar grant (isso exigiria migrador segmentado — fora de escopo, e nenhuma mudança no runner canônico está prevista ou é necessária). `--target=staging` e `--target=production` são execuções separadas; `--target=all` aplicaria os dois e **não** deve ser usado aqui.

**Imediatamente após a migração e antes do rollout (fase 6):** verificação explícita de `GRANT` vigente e de `has_table_privilege` em `approval_tokens` **e** em todos os objetos criados/alterados por 0034–0036 (`action_logs`, `approval_tokens`, `outbox_jobs.claim_generation`). Só então o rollout.

_Entrada:_ E2b explícita (fase 0) sobre gate da fase 4; papéis + default privileges já provisionados. _Saída:_ ledger 36/36 no ambiente migrado e privilégios verificados.

**Fase 6 — Rollout app/workers.** Sem sobreposição old/new worker — a versão antiga não cerca `claim_generation`. Deploy do app somente após ledger 36 (0034–0036 aplicadas, privilégios de `approval_tokens` provisionados **antes** da migration e **verificados** depois dela — §3/§5). Quiescência old/new de consumidores, operacionalizada:

1. **Pausar produtores nomeados:** `CRON_JOBS_ENABLED=""` em `[vars]` do `wrangler.toml` do ambiente + redeploy — hoje o valor lista os **seis** jobs (`wrangler.toml:47`/`:55`), então isto é uma **mudança de release**, não um default; cobre os 6 jobs nomeados **e somente eles**.
2. **BLOQUEADOR HARD (sem invenção de certeza):** **não existe mecanismo seguro de pausa/drain** para o consumidor outbox — `dispatchScheduledJobs` prefixa `/api/cron/outbox?limit=25` em todo tick `*/5` **fora** do gate (`scripts/lib/cron-schedule.mjs:61-64`) — nem para os produtores inline (`enqueueOutbox` no request path; inventário em §1). `CRON_JOBS_ENABLED=""` **não** prova o consumidor pausado nem os produtores inline parados. Exigir **mecanismo dedicado de pause + procedimento do owner** (responsável a nomear) antes desta fase; sem ele a fase 6 permanece NO-GO.
3. **Inventariar todas as fontes** (não apenas as nomeadas): trigger `*/5`; 8 rotas cron (`smart-triggers` aposentado/410); cadências (reminders 5min; cleanup e hot-leads 60min; followups 09:00, crm-duplicates 04:00, financeiro-collections 03:00 UTC); **consumidor** `/api/cron/outbox?limit=25` em todo tick fora do gate; **produtores inline** (`enqueueOutbox`, 9 arquivos — §1); in-flight = `outbox_jobs.status='processing'` (lease 5 min) + jobs em execução.
4. **Esperar** ≥ 5 min (lease do claim, `OUTBOX_LEASE_MS`) **e** observar zero in-flight/claims da versão antiga: `outbox_jobs.status='processing'` = 0, sem avanço de `updated_at`/`claim_generation` atribuível à versão antiga, e sem conexões da versão antiga reivindicando em `pg_stat_activity`. Job em execução no início da janela precisa terminar (entregue, falha ou dead-letter) dentro do fence — drenagem não é cancelamento forçado.
5. **Deploy dos consumidores com produtores ainda pausados**; validar versão em campo e fence (`claim_generation` incrementada e cercada só pela versão nova). Critério de **não-sobreposição**: uma única versão atendendo por vez — evidência de versão em campo + ausência de claims concomitantes; duas versões reivindicando ao mesmo tempo reprova o gate (não é detalhe).
6. **Retomar apenas uma versão** de worker — a nova, cercada — e só então religar produtores (inclusive os inline, cuja pausa é procedimento do owner). Em rollback: **repetir a quiescência inteira pelo mesmo protocolo** (pausar → inventariar → aguardar ≥5min → zero claims antigos → deploy) e **nunca** retomar o worker antigo sem fence.

Nota: smoke público não prova workers (`smoke-deploy` skips service bindings) nem fence — ver §9. Seguir o runbook E2 existente.
_Entrada:_ fase 5 completa no ambiente-alvo. _Saída:_ só nova versão atendendo, com fence ativa.

**Fase 7 — Smoke e gates.** Smoke pós-deploy + smoke-staging controlado (sintético; POSTs documentados em §1), monitoramento (§8) e veredito GO/NO-GO (§9).
_Entrada:_ fase 6 concluída. _Saída:_ veredito registrado; plano só vira DONE com E2b exercida.

**Cadeia de dependência:** `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7`. Fase 2 **precede** 3: o corte de papéis (credenciais novas + Hyperdrive) trafega **sobre** o caminho privado provado na fase 2 — papéis sobre rede privada, nunca o inverso. Ambas bloqueiam a 4; 5 e 6 jamais coincidem na mesma janela.

**Decisões exigidas ao owner (decisão-ready):** (1) **A-REDE** — janela urgente de rede e escolha D3→D4 ou D3; autoriza **apenas** contenção de rede (fase 2); (2) **A-PAPEIS** — corte de papéis de runtime, credenciais novas e update Hyperdrive por ambiente; autoriza **apenas** fase 3; (3) **A-RESTORE** — autorização escrita de restore de backup real (ambiente isolado allowlisted, executante, janela); autoriza **apenas** o gate da fase 4; (4) **E2b** — aprovação final explícita antes das fases 5–6 (migrations + rollout de app/workers em produção); (5) mecanismo dedicado de pause/drain cron/outbox + responsável (bloqueador da fase 6). Nenhuma dessas aprovações cobre as outras: A-RESTORE não autoriza migrations nem rollout; E2b não autoriza rede, papéis ou restore.

## 3. Papéis de runtime no PostgreSQL (design de privilégio mínimo)

- **`synkroo` permanece admin/DDL** (pgvector, migrations, DDL). Não é papel de runtime da aplicação.
- **Novos papéis runtime:** sem flags (`SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, `REPLICATION`) e sem membership em papéis privilegiados.
- **Grants:** `SELECT/INSERT/UPDATE/DELETE` nas tabelas do schema `public`; `USAGE` nos schemas `public` e `drizzle`; `SELECT` no ledger (`drizzle.__drizzle_migrations`).
- **Sequences:** conceder somente após inventário real dos nomes — não presumir.
- **Objetos criados por migration:** o runner canônico aplica **todo** o journal pendente (0034→0035→0036) em ordem, **numa única invocação por ambiente**; portanto **não** é possível aplicar grant entre 0035 e 0036 sem um migrador segmentado (fora de escopo — nenhuma mudança em `scripts/migrate-vps.ts` está prevista). A solução é provisionar **antes** das migrations: (a) `GRANT ... ON ALL TABLES IN SCHEMA public` cobre as tabelas já existentes; (b) `ALTER DEFAULT PRIVILEGES ... ON TABLES` emitida **pelo mesmo principal que executa a migration** (dono exato da migration) faz `approval_tokens` **nascer concedida** na criação pela 0035. **Depois** das migrations e **antes** do rollout (fase 6): verificação explícita — `GRANT` vigente + `has_table_privilege('synkroo_app','approval_tokens', ...)` e a mesma checagem em todos os objetos criados/alterados por 0034–0036. A concessão é `SELECT/INSERT/UPDATE/DELETE` porque o consumo faz insert, select, update de `consumed_at` e delete (lazy purge de expirados) — `src/core/actions/approval.ts:96,147,149,159,178`. Sem o grant, o fluxo de aprovação falha em runtime **depois** do rollout. 0035 **não** cria sequence nem índice extra, por isso esse passo não interage com o inventário de sequences.
- **Sem revogação blanket de `EXECUTE`** em funções.
- **Defaults do `PUBLIC`:** antes de alegar isolamento, contabilizar/remedir `CONNECT` no banco e `EXECUTE` em funções — defaults do PostgreSQL que nenhum papel novo revoga por si.

Esboço de concessão (não executar; nomes definidos pelo owner):

```sql
-- ===== PRÉ-MIGRATION (antes de 0034→0035→0036) =====
CREATE ROLE synkroo_app LOGIN NOBYPASSRLS;  -- sem SUPERUSER/CREATEDB/CREATEROLE/REPLICATION
GRANT USAGE ON SCHEMA public, drizzle TO synkroo_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO synkroo_app;  -- cobre só o que existe AGORA
GRANT SELECT ON drizzle.__drizzle_migrations TO synkroo_app;
-- sequences: somente após inventário real (§10)
-- EXECUTE em funções: sem revogação blanket
-- default privileges para objetos futuros: approval_tokens NASCE CONCEDIDA na 0035.
-- Emitida pelo MESMO principal que roda scripts/migrate-vps.ts (dono exato da migration) —
-- se o dono for outro papel, usar ALTER DEFAULT PRIVILEGES FOR ROLE <dono-da-migration>.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO synkroo_app;

-- ===== PÓS-MIGRATION, PRÉ-ROLLOUT (verificação; papel admin; NÃO é concessão) =====
-- confirma grant vigente e privilégio efetivo em approval_tokens e nos objetos de 0034-0036
-- (esperado: true nas QUATRO colunas independentes abaixo):
-- ATENÇÃO: has_table_privilege com lista 'SELECT,INSERT,UPDATE,DELETE' testa ANY (basta UM privilégio),
-- por isso cada privilégio exigido é verificado em booleano próprio:
-- SELECT has_table_privilege('synkroo_app', 'public.approval_tokens', 'SELECT') AS sel,
--        has_table_privilege('synkroo_app', 'public.approval_tokens', 'INSERT') AS ins,
--        has_table_privilege('synkroo_app', 'public.approval_tokens', 'UPDATE') AS upd,
--        has_table_privilege('synkroo_app', 'public.approval_tokens', 'DELETE') AS del;
-- (equivalente válido: AND dos quatro has_table_privilege, um por privilégio, num único booleano)
-- mesma checagem (quatro booleanos independentes) para action_logs e outbox_jobs (alterados por 0034/0036) e demais tabelas de public
```

## 4. Sequência de corte de papéis (staging → produção)

1. Criar papéis e conceder grants **em staging** — incluindo o provisionamento pré-migration (papel runtime + `ALTER DEFAULT PRIVILEGES` do dono exato da migration, §3), que é pré-requisito da fase 5.
2. Smoke de worker contra staging com o novo principal.
3. Atualizar Hyperdrive **do staging** (dry-run → aplicação). Dependência: capacidade de atualizar Hyperdrive **por ambiente** — hoje `update-hyperdrive.ts` altera staging e produção na mesma execução; confirmar/tratar como gap antes do corte.
4. Confirmar em `pg_stat_activity` que as conexões novas usam o novo papel e as antigas drenam naturalmente (pools).
5. Só então repetir em produção, em janela própria.
6. Papel admin/antigo **retido** — não remover nesta rodada.
7. Rollback do corte: reapontar Hyperdrive ao principal anterior (credenciais antigas intactas) — nenhum papel é dropado nesta rodada.

## 5. Healthcheck: `pg_isready` vs TLS `psql SELECT 1`

- `pg_isready` prova apenas que o servidor aceita conexão — sem auth, sem TLS: fica verde mesmo com papel ou TLS quebrado.
- `psql` com `sslmode=require` + `SELECT 1` prova handshake TLS, autenticação e utilizabilidade do papel.
- Readiness da aplicação (`/api/internal/readiness`) faz `SELECT 1` + contagem do ledger com `statement_timeout` 3s e distingue `migrations-incomplete` de `db-unreachable` — não confundir com o healthcheck do container.
- Par de sondas canônicas: `pg_isready -h <host> -p 15433` (verde ≠ utilizável) vs `psql "sslmode=require ..." -c 'SELECT 1'` (prova auth + TLS + papel).
- **Probe pré-migration vs gate pós-migration:** probes das fases 2–3 rodam com o ledger em 33 e **aceitam** `migrations-incomplete` (33/36) — o que se prova é caminho/auth/TLS/papel; só `db-unreachable` reprova. Gates das fases 5–7 exigem readiness `ok` = **36/36**. A contagem 33/33 sob o contrato antigo (`EXPECTED_MIGRATIONS=33`) é leitura histórica, não critério. Nenhum probe pré-migration — e nenhum gate de restore (§6) — exigirá readiness 36/36 antes das migrations (evita exigência circular com a fase 5).

## 6. Backup: autorização de restore e confidencialidade

- Restore real de produção/staging é **destrutivo** e envolve dados pessoais (LGPD): exige autorização explícita e **escrita** do owner, ambiente isolado e saída redigida (sem PII, sem connection string).
- **Não há prova de restore bem-sucedido nesta rodada.** A verificação 10/10 foi de streaming dos artefatos contra o manifest; o manifest era separado e não foi co-verificado como bundle.
- **Histórico, corretamente separado:** (a) o drill de **10/07 restaurou artefato real off-host do dia** no DB **isolado** — restore real de backup real em ambiente isolado, com DROP + cleanup; **não** era synthetic-only; (b) o drill de **2026-09-25 de produção** restaurou **backup real de produção** (pg_dump do banco `synkroo` da VPS de produção) no DB **isolado** descartável `synkroo_drill` — `docs/runbooks/restore-tests/2026-09-25-prod-drill.md` — evidência de restore real de backup real de produção, em alvo isolado; (c) o drill **local de 2026-09-26** restaurou backup do **dev local** (`synkroo-db`, dados de desenvolvimento — não produção) em alvo **vivo**, com smoke fim-a-fim e RTO medido — `2026-09-26-local-drill.md` — valida procedimento e smoke, não dado de produção. **Nenhum** deles é restore do dump vigente de produção e nenhum pode ser usado como prova de restauração do artefato atual.
- **"Restore verificado" significa (alvo do dump vigente, ledger 33):** dump real restaurado em ambiente isolado **nomeado e allowlisted**, com: (i) **exit code do `pg_restore` = 0**; (ii) **catálogo** conferido (tabelas/colunas coerentes com o dump — objetos de 0034–0036 **ausentes** no alvo 33); (iii) **extensões** `vector`/`btree_gist` presentes; (iv) `SELECT count(*) FROM drizzle.__drizzle_migrations` = **33** (o dump vigente é 33/36 — 36/36 só existe depois da fase 5); (v) **smoke estrutural via admin/`psql`** (leituras e contagens core no alvo restaurado). **Readiness da aplicação não é critério de restore:** exigir readiness 36/36 antes das migrations é exigência circular — o gate de restore aceita o alvo restaurado em 33. Se a smoke usar o app antigo, o artefato **exato 33-compatível** precisa ser identificado e declarado antes; sem esse artefato, a smoke estrutural é apenas admin/`psql`. Evidência registrada — sem asserting sucesso por síntese.
- **Regras de execução do restore (quando A-RESTORE existir):** alvo **nomeado e allowlisted** (isolado), declarado antes; identidade do banco conferida no dry-run **antes e depois** (rótulo `host/dbname` impresso pelo script); URL de restore **sintética e em variável de ambiente separada**, em processo com ambiente limpo — **nunca** a `DATABASE_URL` herdada usada nas demais operações. O modo remoto de `db-restore.mjs` lê **somente** `$DATABASE_URL` do processo: a convenção segura é sobrescrevê-la na própria linha de comando a partir da variável do alvo (`DATABASE_URL="$SYNKROO_RESTORE_TARGET_URL" ...`), o que é **fail-closed** — alvo vazio/ausente aborta o script em vez de cair na `DATABASE_URL` herdada. Allowlist de alvo definida pelo owner (ex.: DB descartável isolado do tipo `synkroo_drill`); **`synkroo` e `synkroo_staging` de produção/staging nunca entram na allowlist**. Uso de backup real atual de produção permanece **BLOQUEADO** sem autorização escrita e acesso off-host seguro: **o restore do dump vigente (ledger 33) segue bloqueado aguardando A-RESTORE escrita — o gate da fase 4 não está verde.** Nenhum restore do artefato vigente foi feito nesta rodada, e o drill de 10/07 (artefato real **do dia**, restaurado no DB isolado), o drill de 25/09 (backup real de produção → DB isolado `synkroo_drill`) e o drill local de 26/09 (dev local → alvo vivo) não substituem nem provam esse artefato.

## 7. Rollback seguro

- **Schema:** forward-fix (migration corretiva); nunca rollback down.
- **App:** rollback do bundle somente após prova de compatibilidade — 0034–0036 são expand-only, mas a prova precisa existir antes de ser invocada.
- **Rede:** nenhum rollback para porta pública irrestrita; se D4 falhar, corrigir para dentro do modelo privado.

## 8. Monitoramento (após cada fase)

- Readiness por motivo (`migrations-incomplete` vs `db-unreachable`); taxa de 5xx; falhas de autenticação.
- Conexões de BD por principal/pool — evidência do corte de papéis.
- Outbox/DLQ: duplicidade `deliveryUnknown` — a fence `claim_generation` só existe após 0036.
- Skew de versão de worker (antigo/novo) — sobreposição é proibida na fase 6.
- Janela mínima de observação por fase antes de liberar a próxima: definida pelo owner na aprovação da janela; métrica estável é pré-requisito de avanço.

## 9. GO / NO-GO

| Gate | Evidência exigida | Status atual |
|---|---|---|
| CI dos PRs pequenos | `verify` + `test:release` verdes nos 4 PRs | Pendente (PRs não criados) |
| Restore de backup | restore real autorizado (A-RESTORE) e verificado no DB isolado allowlisted: exit 0 do `pg_restore`, catálogo, extensões e ledger = **33** + smoke estrutural via admin/`psql` (nunca readiness 36/36 — circular antes da fase 5) | **NÃO VERIFICADO / BLOQUEADO** — sem A-RESTORE escrita e sem restore nesta rodada; drill 10/07 = artefato real off-host do dia → DB isolado; drill 25/09 = backup real de produção → `synkroo_drill`; nenhum é o dump vigente |
| Backup + manifest off-host | artefatos e manifest co-verificados como bundle | Parcial — streaming 10/10; manifest separado |
| Readiness | PR de healthcheck merged; readiness sem falso negativo; probes pré-migration aceitam `migrations-incomplete` (33/36); gates pós-fase 5 exigem 36/36 | Pendente (PR não criado); ledger 33/36 |
| Conectividade privada | produção alcançável só por caminho autorizado | Pendente (fase 2) |
| Least-privilege | papéis novos sem flags; principals confirmados em `pg_stat_activity` | Pendente (fase 3) |
| Grants de `approval_tokens` e default privileges | papéis + `ALTER DEFAULT PRIVILEGES` do dono exato da migration provisionados **antes** das migrations; `GRANT` + `has_table_privilege` verificados em `approval_tokens` e em todos os objetos de 0034–0036 **depois** da migração e **antes** do rollout | Pendente (fase 5) |
| Quiescência cron/outbox (fase 6) | mecanismo de pause/drain de **todas** as fontes (6 jobs nomeados + consumidor `/api/cron/outbox` fora do gate + produtores inline) comprovado + inventário de fontes + zero in-flight observado | **BLOQUEADOR HARD** — não existe mecanismo seguro de pausa: `CRON_JOBS_ENABLED` não cobre o outbox nem produtores inline |
| Não-sobreposição old/new (fase 6) | uma única versão atendendo por vez; zero claims concomitantes; rollback repete a quiescência inteira | Pendente (fase 6) |
| Ledger | 33 confirmado antes; 36 após fase 5 | 33/36 em ambos os ambientes |
| Smoke-staging controlado | stateful synthetic-only: clínica/usuário sintéticos; POSTs switch-clinic/inbound documentados; nenhum envio real a provider | Pendente (definir alvo sintético) |
| Janela E2b | aprovação humana explícita registrada | Pendente (fase 0) |
| Owner/operador | nomes registrados | **Em branco — não inventado** |

**Veredito atual: NO-GO.** GO somente quando todos os gates acima estiverem verdes e a E2b estiver explícita. Smoke público verde não supre os gates de worker/fence (check `workers` é skipped por design).

## 10. Comandos canônicos (sem secrets)

Todas as conexões vêm de variáveis de ambiente (`SYNKROO_VPS_ENV`, `DATABASE_URL`); nenhuma senha aparece em argv, doc ou log. `--side=target` porque o dado ativo está no host de destino desde o flip do Hyperdrive (2026-10-05); `--target` seleciona o banco dentro do host. Itens marcados **[MUTADOR]** só rodam após a **autorização específica** anotada em cada um — **não** existe uma aprovação E2b única cobrindo todos os mutadores: `migrate-vps` é **E2b**, `update-hyperdrive` é **A-PAPEIS**, `db-restore` é **A-RESTORE**, contenção de rede/unpublish é **A-REDE**, deploy de app/workers é **E2b**.

```bash
# --- pré-checks (read-only) ---
npx tsx scripts/migrate-vps.ts --side=target --target=staging --dry-run
npx tsx scripts/migrate-vps.ts --side=target --target=production --dry-run
npx tsx scripts/update-hyperdrive.ts --side=target --dry-run
GET /api/health              # liveness
GET /api/health/db           # {complete, migrationsApplied, migrationsExpected}
GET /api/internal/readiness  # migrations-incomplete vs db-unreachable

# --- migrations 33→36, ordem 0034→0035→0036 (um ambiente por vez; sem deploy simultâneo) ---
# 0) PRÉ-MIGRATION: provisionar papel synkroo_app + ALTER DEFAULT PRIVILEGES do dono exato da
#    migration (§3) — sem isso approval_tokens nasce sem grant na 0035 e o runner canônico não
#    concede nada entre 0035 e 0036 (aplica todo o journal pendente numa invocação).
npx tsx scripts/migrate-vps.ts --side=target --target=staging       # [MUTADOR → E2b] janela própria; aplica 0034→0035→0036
npx tsx scripts/migrate-vps.ts --side=target --target=production    # [MUTADOR → E2b] janela separada
# 1) PÓS-MIGRATION, PRÉ-ROLLOUT: GRANT vigente + has_table_privilege em approval_tokens e em todos
#    os objetos de 0034–0036 (§3) — verificação, não concessão; runner canônico não é alterado.

# --- smoke (sem credencial literal; auth sintética via ambiente) ---
SMOKE_BASE_URL=https://<worker-url> node scripts/smoke-deploy.mjs
STAGING_BASE_URL=https://<staging-url> STAGING_AUTH_COOKIE=<env> STAGING_CLINIC_ID=<env> \
  node scripts/smoke-staging.mjs   # stateful synthetic-only: POSTs documentados (§1) — switch-clinic (muta sessão) + inbound inválido (400/403, sem envio)

# --- corte de papéis: Hyperdrive por ambiente (dry-run acima; aplicação abaixo) ---
npx tsx scripts/update-hyperdrive.ts --side=target   # [MUTADOR → A-PAPEIS] atualiza staging+produção na mesma execução — tratar o gap por ambiente antes (fase 3)

# --- backup (off-host) ---
DATABASE_URL=<env> node scripts/db-backup.mjs --url --out-dir <dir-off-host>

# --- restore (NUNCA com a DATABASE_URL herdada; alvo isolado allowlisted; URL sintética em env separada) ---
# A convenção de nome da variável é deste plano; o valor e a allowlist de alvo vêm do owner (A-RESTORE).
# O modo remoto de db-restore.mjs lê SOMENTE $DATABASE_URL do processo (nunca argv): sobrescrevê-la na linha
# é fail-closed — alvo vazio/ausente aborta o script em vez de usar a URL herdada.
# 1) dry-run OBRIGATÓRIO em processo com ambiente limpo; confere host/dbname ANTES:
SYNKROO_RESTORE_TARGET_URL=<url-sintética-do-alvo-isolado> \
  DATABASE_URL="$SYNKROO_RESTORE_TARGET_URL" node scripts/db-restore.mjs <arquivo>.dump.gz --url --dry-run
# 2) execução real só após A-RESTORE escrita + allowlist conferida + identidade pré confirmada; reconfere host/dbname DEPOIS:
SYNKROO_RESTORE_TARGET_URL=<url-sintética-do-alvo-isolado> \
  DATABASE_URL="$SYNKROO_RESTORE_TARGET_URL" node scripts/db-restore.mjs <arquivo>.dump.gz --url --yes  # [MUTADOR → A-RESTORE] destrutivo no alvo isolado

# --- inventário e confirmação de papéis (saída contém endereços: não colar em docs) ---
psql "sslmode=require host=$PGHOST port=$PGPORT user=$PGUSER dbname=$PGDATABASE" \
  -c "SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname NOT LIKE 'pg_%' ORDER BY 1;"
psql "..." -c "SELECT usename, application_name, state, count(*) FROM pg_stat_activity WHERE datname = current_database() GROUP BY 1,2,3 ORDER BY 4 DESC;"
psql "..." -c "SELECT schemaname, sequencename FROM pg_sequences WHERE schemaname IN ('public','drizzle') ORDER BY 1,2;"
psql "..." -c "SELECT count(*) AS applied FROM drizzle.__drizzle_migrations;"
```

Validação dos PRs da fase 1: `npm run verify` e `npm run test:release` (cobrem `migrate-vps-env`, `db-backup-restore`, `smoke-*`, `operator-scripts-hardening`). Sintaxe bash; em pwsh usar `$env:VAR`.

## 11. Não-fazer (guardrails deste plano)

- Não aplicar o compose do repo agora — removeria a porta pública em uso antes de D4 existir (drift documentado em §1).
- Não rotacionar credenciais existentes (decisão do owner de 2026-09-25 mantida).
- Não re-testar exposição de rede externamente.
- Não criar rota/tunnel na Cloudflare nem fazer unpublish sem janela owner-approved.
- Não restaurar backup de produção sem autorização de restore (A-RESTORE escrita, alvo isolado allowlisted).
- Não exigir readiness 36/36 antes das migrations — em probe, gate de restore ou smoke; exigir 36/36 no alvo 33 é exigência circular (o ledger só chega a 36 na fase 5).
- Não intercalar GRANTs entre 0035 e 0036: o runner canônico aplica todo o journal pendente numa invocação; a solução é provisionar papéis + default privileges antes e verificar depois — sem criar migrador segmentado.
- Não tratar todas as operações mutadoras como cobertas pela aprovação E2b: `update-hyperdrive` é A-PAPEIS, `db-restore` é A-RESTORE, contenção de rede/unpublish é A-REDE, migrations e rollout de app/workers são E2b.
- Não executar nenhuma operação antes da sua autorização específica (A-REDE / A-PAPEIS / A-RESTORE / E2b).
- Não retomar o worker antigo sem fence em nenhum rollback da fase 6; a quiescência é repetida, não dispensada.
- Não tratar smoke verde como prova de worker/fence (check `workers` é skipped por design) nem drill histórico como prova do dump vigente.
- Não commitar/alterar índice de ADRs neste documento; não inventar owner/operador.

## 12. Responsáveis

| Papel | Nome |
|---|---|
| Owner (aprovações A-REDE / A-PAPEIS / A-RESTORE / E2b) | ________ — a definir; não inventado |
| Operador (execução das janelas) | ________ — a definir; não inventado |
| Responsável pelo mecanismo de pause/drain cron/outbox (bloqueador da fase 6) | ________ — a definir; não inventado |

Sem nomeação registrada, qualquer gate que dependa de owner/operador permanece NO-GO.

## 13. Critérios de validação (para revisor/validador)

O plano só pode ser validado contra estes critérios — cada um verificável no próprio texto e na evidência citada:

1. **Separação probe/gate:** probes das fases 2–3 aceitam ledger 33 com `migrations-incomplete`; gates das fases 5–7 exigem 36/36; nenhum probe exige o que só a fase 5 produz (sem exigência circular).
2. **Ordem das migrations:** 0034 → 0035 → 0036 explícita, com os nomes reais do journal (`0034_action_attempt_fields`, `0035_approval_tokens`, `0036_outbox_claim_generation`) e um ambiente por execução (sem `--target=all`); o runner canônico aplica **todo** o journal pendente numa única invocação — papéis de runtime + `ALTER DEFAULT PRIVILEGES` do dono exato da migration são provisionados **antes** (para `approval_tokens` nascer concedida na 0035) e a verificação de `GRANT`/`has_table_privilege` em `approval_tokens` e em todos os objetos de 0034–0036 ocorre **depois** da migração e **antes** do rollout; nenhum grant é implicado entre 0035 e 0036 e nenhum migrador segmentado é proposto.
3. **Quiescência sem invenção:** pause de produtores via `CRON_JOBS_ENABLED` declarado com seu limite real — hoje o valor lista os seis jobs, então pausar é mudança de release; `/api/cron/outbox` dispara fora do gate e os produtores inline (`enqueueOutbox`, 9 arquivos) não são cobertos; ausência de mecanismo comprovado de pause/drain registrada como **bloqueador**, não como certeza. Drenagem exige ≥5min **e** zero claims da versão antiga; uma única versão atende por vez; rollback repete a quiescência inteira.
4. **Restore:** `--yes` nunca apresentado com `DATABASE_URL` herdada (a sobrescrita a partir da variável do alvo é fail-closed: alvo vazio aborta); alvo nomeado/allowlisted — produção e staging fora da allowlist —, identidade pré/pós e URL sintética em env separada exigidos; verificação do alvo restaurado no ledger **33** = exit 0 do `pg_restore`, catálogo, extensões e smoke estrutural via admin/`psql`, **sem** exigir readiness 36/36 antes das migrations (artefato 33-compatível identificado se a smoke usar o app antigo); drills classificados corretamente (10/07 = artefato real off-host do dia → DB isolado; 25/09 = backup real de produção → DB isolado `synkroo_drill`; 26/09 local = dev local → alvo vivo) e nenhum como prova do dump vigente; uso de backup atual permanece BLOQUEADO sem autorização escrita.
5. **Fronteiras de aprovação:** A-REDE (rede) / A-PAPEIS (papéis + credenciais + Hyperdrive) / A-RESTORE (restore) / E2b (migrations + rollout de produção) distintas e em sequência; nenhuma operação antes da sua autorização específica e nenhuma aprovando outra (A-RESTORE não cobre migrations/rollout; E2b não cobre rede, papéis ou restore).
6. **Cadeia 2→3→4 consistente:** DAG `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7` e as declarações de fase concordam — papéis/credenciais são cortados sobre o caminho privado provado na fase 2, portanto 2 precede 3, e ambas bloqueiam 4.
7. **Smoke:** smoke-deploy (GET-only, `workers` skipped) e smoke-staging (stateful synthetic-only, POSTs documentados, alvo sintético, nenhum envio real a provider) descritos sem tratar skip como prova.
8. **Sem sobreposição com a evidência:** janelas de fases nunca coincidem (5 e 6 jamais na mesma janela; probe pré-migration ≠ gate pós-migration; uma única versão de worker atende por vez na fase 6); cada afirmação do plano mapeia para evidência própria e disjunta — o drill 10/07 não conta como restore do dump vigente, o drill 25/09 (backup real de produção → isolado) e o drill local 26/09 (dev local → alvo vivo) também não, a leitura 33/33 histórica não conta como gate, e checks skipped/inexistentes não contam como prova. Nenhuma evidência é reutilizada para dois gates.
