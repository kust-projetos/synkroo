# Plano operacional E2b — estabilização vNext (decision-ready; sem execução)

**Data:** 2026-10-11 · **Base documental:** `origin/main @ bda1d488` (pós-merge #52, CI `38164553952` PASS) · **Branch de trabalho:** `feat/e2b-outbox-maintenance-control`
**Status:** CANDIDATE DECISION-READY — controle e ensaios isolados estão nesta branch; código/docs ainda não integrados. Nenhuma ação mutadora de produção foi executada ou autorizada por este documento.
**Natureza:** isto é um **plano**, não execução e não aprovação. O gate E2b (aprovação humana explícita antes de alterar BD/Cloudflare de produção) continua externo e pendente; sem ele este plano permanece **READY FOR OPERATOR — nunca DONE**.
**Fontes:** `docs/runbooks/2026-10-08-vnext-e2-contabo-migration-deploy-runbook.md` · `docs/inventory/2026-10-07-p2-contabo-validation.md` · `docs/ops/vps-access.md` · `docs/ops/cloudflare-runtime-checklist.md` · `scripts/migrate-vps.ts` · `scripts/update-hyperdrive.ts` · `scripts/db-backup.mjs` · `scripts/db-restore.mjs` · `scripts/smoke-deploy.mjs` · `scripts/smoke-staging.mjs` · `worker-entry.mjs` · `scripts/lib/cron-schedule.mjs` · `src/services/api-handlers/health/{db,readiness}.ts` · `src/lib/outbox/outbox-repository.ts` · `src/core/schema/infra.ts`.

## 1. Evidência atual (read-only)

- **Código/documentação:** PRs #44–#52 estão integrados; CI pós-merge #51 passou (run `38134604347`, 4/4) e #52 passou (run `38164553952`, 4/4). Nenhuma dessas integrações comprova operação de produção.
- **Ledgers:** produção e staging em **33/36**. Pendentes, **nesta ordem**: 0034 (`0034_action_attempt_fields` — colunas anuláveis em `action_logs`: `duration_ms`, `policy_version`, `decision`, `approval_id`) → 0035 (`0035_approval_tokens` — cria `approval_tokens`) → 0036 (`0036_outbox_claim_generation` — fence + controle operacional do outbox; ledger continua 36).
- **Conectividade:** PostgreSQL do target alcançável; conexão autenticada TLS/SCRAM bem-sucedida.
- **Rede (sem novo teste externo):** UFW restrito a ranges Cloudflare IPv4, ineficaz contra a publicação Docker `0.0.0.0:15433`; chain `DOCKER-USER` vazia; unidade de firewall esperada ausente. A exposição é real apesar do UFW — daí a fase 2 ser tratada como janela urgente separada.
- **Papéis runtime atuais:** produção `synkroo` (SUPERUSER); staging `synkroo_staging` (CREATEDB).
- **Backup:** 10/10 artefatos off-host verificados em streaming contra o manifest; o manifest era separado e não foi bundleado; **nenhum restore nesta rodada**. O drill histórico de 10/07 foi restore de **artefato real off-host do dia** no DB **isolado** `synkroo_drill` (ledger 33 / clinics 1 / users 1 / vector 1, com DROP + cleanup) — restore real de backup real em ambiente isolado; **não** era synthetic-only e **não** é restore do backup vigente de produção.
- **Migrations 0034–0036:** expand-only — 0034 `ADD COLUMN IF NOT EXISTS` anuláveis em `action_logs`; 0035 `CREATE TABLE IF NOT EXISTS "approval_tokens"`; 0036 mantém `claim_generation` e inclui o singleton `outbox_control`, `claim_release` e trigger de proteção do claim/liquidação. A contagem permanece **36**, sem migration 0037. O alvo conhecido em produção/staging é 33; banco já em 36 com a versão antiga de 0036 precisa do repair explícito, nunca de um falso readiness verde. Rollback de schema é forward-fix (`docs/audit/migrations-policy.md`).
- **Contrato do health:** readiness pré-migration diferencia consulta/ledger acessíveis com 33/36 (`migrations-incomplete`) de `db-unreachable`; pós-migration exige **exatamente 36/36** e shape funcional do controle. `>=36` não aprova o gate.
- **Smokes:** `smoke-deploy` = só GETs públicos; o check `workers` é **skipped** (ia-bridge via service bindings, sem HTTP público — skip **não** é prova de worker/fence). `smoke-staging` **não é read-only** e é **stateful synthetic-only**: faz POST `/api/auth/switch-clinic` (muta a sessão ativa) e POST `/api/messages/inbound` com corpo `{}` — rejeitado em 403 (instalação não resolvida) ou 400 (campos inválidos), ambos **antes** de qualquer dispatch, portanto **sem envio real a provider** (`scripts/smoke-staging.mjs:128-135,156-162`; `src/app/api/messages/inbound/route.ts:37,47`). Exige clínica/usuário sintéticos e estado controlado em staging; nunca produção.
- **Scheduler/cron:** trigger `*/5 * * * *` (`wrangler.toml:5`); 8 rotas em `src/app/api/cron/*` (`smart-triggers` aposentado, 410). Seis jobs são **gated por `CRON_JOBS_ENABLED`** (CSV em `[vars]`), mas **`/api/cron/outbox?limit=25` dispara em todo tick fora do gate** (`scripts/lib/cron-schedule.mjs:61-64`; `docs/ops/cloudflare-runtime-checklist.md` §11). Atenção ao valor vigente: `CRON_JOBS_ENABLED` **lista os seis jobs hoje** em produção (`wrangler.toml:47`) e em staging (`wrangler.toml:55`); "vazio" é apenas o default do código quando a variável está ausente ou vazia (`selectDueJobs` devolve `[]`). Pausar job nomeado exige **editar o valor e redepublicar** — não existe pausa por omissão de configuração.
- **Produtores/consumidores de outbox:** o consumidor agendado `/api/cron/outbox` é chamado em todo tick; dispatchers diretos passam pelo mesmo `claimOutboxJob`. Os produtores inline continuam usando `enqueueOutbox` em 9 arquivos/10 sítios (inventário anterior nesta seção). O controle DB pausa **consumo**, não enqueue: eventos continuam duráveis na mesma transação de negócio; jobs `pending` acumulam e serão avaliados antes do resume. A migration 0036 expandida instala o gate no banco para releases legados/direct-SQL; código novo exige release conhecido e cerca settlements por `(claim_release, claim_generation)`.
- **Inventário dos produtores inline (read-only):** `src/modules/comercial/repositories/leads-repository.ts`; `src/modules/operacional/repositories/patients-repository.ts`; `src/modules/operacional/repositories/reminders-repository.ts`; `src/modules/followup/repositories/campaigns-repository.ts`; `src/repositories/campaigns/index.ts`; `src/modules/financeiro/repositories/financeiro-repository.ts` (2 sítios); `src/modules/financeiro/services/collection-service.ts`; `src/modules/comercial/services/hot-lead-notification-service.ts`; `src/modules/atendimento/repositories/conversations-repository.ts`. Eles permanecem liberados para enqueue durante a pausa; nenhum evento de negócio é descartado.
- **Drift de compose:** repo tunnel-only (sem porta pública, com sidecar cloudflared); container vivo com porta pública e sem cloudflared. **Não aplicar compose agora** — a contenção de rede é decisão de owner em janela separada (fase 2).
- **CI/docs:** #52 corrigiu o comando SSH do target usando `CONTABO_VPS_*`; nenhuma dessas integrações comprova rede, roles, restore ou migration em produção. As autorizações continuam separadas e pendentes.
- Fora de escopo desta rodada: itens P3/P4.

## 2. Ordem de mudança e dependências

**Fase 0 — Aprovações (fronteiras separadas; nada executa antes da sua).** São aprovações distintas, em sequência:

1. **A-REDE** — contenção de rede/rota privada pelo caminho único D3→D4 do ADR-BASE-21 (janela própria). Autoriza **apenas** a fase 2.
2. **A-PAPEIS** — criação de papéis/credenciais de runtime + atualização de Hyperdrive por ambiente. Autoriza **apenas** a fase 3.
3. **A-RESTORE** — autorização **escrita** de restore (ambiente isolado, executante, janela). Autoriza **apenas** o gate da fase 4.
4. **E2b** — aprovação final explícita do owner, solicitada somente após o gate da fase 4; é a **única** que autoriza as fases 5–6 (migrations de produção e rollout app/workers).

Nenhuma autorização parcial substitui outra; nenhuma operação ocorre antes da sua autorização específica. Sem A-REDE a fase 2 não inicia; sem A-PAPEIS a fase 3 não inicia; sem A-RESTORE a fase 4 não conclui; sem E2b as fases 5–6 não iniciam.

**Fase 1 — PRs pequenos + CI.** PRs #44–#50 integrados. PR #51 (recovery/VPS access) foi integrado externamente; CI pós-merge `38134604347` ficou 4/4 verde. O review posterior encontrou uma variável SSH de target incorreta; correção mínima #52 foi integrada, com CI pós-merge ainda a confirmar neste snapshot. Nenhum desses PRs executou operação de produção.
_Entrada:_ plano revisado. _Saída:_ PRs necessários em `main`, CI pós-merge verde e findings documentais fechados; isso não equivale a GO operacional.

**Fase 2 — Rede (janela separada, owner-approved; A-REDE).** Contenção D3 → D4 Tunnel+Access, staging primeiro. Produção: conectividade privada provada (probe pelo par canônico do §5, pelo caminho privado) **antes** do unpublish da porta. **Probe pré-migration:** com o ledger em 33, a prova exigida é `SELECT 1` autenticado TLS/SCRAM + leitura do ledger; readiness `migrations-incomplete` em 33/36 é **aceita** (prova o caminho, não o ledger) e a leitura antiga 33/33 (contrato `EXPECTED_MIGRATIONS=33`, anterior a 0034–0036) é apenas histórico. Só `db-unreachable`/falha de auth/TLS reprova. Este gate **não** exige 36/36 — exigir seria circular: o ledger só chega a 36 na fase 5, que depende desta conectividade. Sem rollback público irrestrito.
_Entrada:_ fase 1 verde. _Saída:_ 15433 inacessível fora do caminho autorizado, em ambos os ambientes.

**Fase 2 — Janelas A-REDE-1/2/3 (autorização A-REDE desdobrada; approved pelo owner por janela).**
A-REDE autoriza apenas rede/contenção (fase 2); nada de papéis, restore, migrations ou rollout.
Cada janela tem entrada, prova e rollback próprios; pular janela reprova a fase.

- **A-REDE-1 — Contenção D3 urgente (target Contabo).** _Entrada:_ egresso real do
  Hyperdrive **identificado no próprio target** (observar via `log_connections`/
  `pg_stat_activity` em janela de teste — **não copiar** os ranges da source; amostra
  não é universo). _Execução:_ filtro `DOCKER-USER` com match pós-DNAT canônico
  (`-d <ip-container> --dport 5432`), `ACCEPT` só do egresso observado + `DROP`
  final, em **IPv4 e IPv6**; script idempotente de reaplicação + persistência
  pós-recreate/reboot. _Anti-lockout:_ aplicar em janela com SSH reserva ativo;
  provar o **positivo** (staging `/api/internal/readiness` verde pelo filtro)
  **antes** de fechar o `DROP` final; rollback imediato pronto (`iptables -F
  DOCKER-USER` + regras ufw originais intactas). _Prova:_ G2 (positivo+negativo
  nas duas famílias) e G3 (persiste após recreate/reboot) verdes. _Rollback:_
  contido — remover o filtro devolve ao estado NO-GO anterior, nunca a um estado
  novo; sem D3 verde não há A-REDE-2.
- **A-REDE-2 — Tunnel+Access em staging (não toca produção).** _Entrada:_ A-REDE-1
  verde (D3 ativo). _Execução:_ subir `cloudflared` no target, política Access
  *Service Auth* com **tokens dedicados de staging** (nunca reutilizar o futuro
  token de produção), Hyperdrive **de staging** reapontado pelo túnel via
  mecanismo **isolado por ambiente** — gap conhecido: `update-hyperdrive.ts`
  altera staging+produção na mesma execução (fase 3, §4); A-REDE-2 exige driver
  PATCH/novo que atualize **só staging** (dry-run → aplicação) antes do corte.
  _Prova:_ G4 Fase 1 — smoke verde pelo túnel (readiness autenticado, critério
  G1-pre nesta janela) + negativo Access em **dois casos separados** (token
  ausente negado; token inválido negado). _Rollback:_ reverter Hyperdrive de
  staging ao endpoint atual **sob D3 ativo** (G5) — nunca sem filtro.
- **A-REDE-3 — Corte de produção (janela de produção autorizada à parte).**
  _Entrada:_ A-REDE-2 verde + janela de produção explícita. _Execução:_ readiness
  real de produção pelo túnel verde (critério G1 da janela) → **só então** remover
  a porta publicada `0.0.0.0:15433` e apontar o Hyperdrive de produção só pelo
  túnel. _Prova:_ G4 Fases 2–3 (readiness com query real nos dois ambientes,
  probes inbound negativos v4+v6, sem porta publicada, persistência do
  tunnel-only após recreate **e** reboot). _Rollback:_ **sem retorno à exposição
  irrestrita** — após a porta removida, corrige-se pelo túnel (G5); recriar a
  publicação pública é proibido em qualquer caminho. D3 só é removido depois de
  G4 Fase 3 completo em produção.

**Risco porta 5433 (registrado, fora das janelas).** `5433/tcp`
(painel-postgres) segue `ALLOW IN Anywhere` — pendência consciente já registrada
(`docs/ops/vps-access.md`), **separada** das janelas A-REDE-1/2/3: não amplia
nenhuma janela nem condiciona G2–G4 (que tratam só do caminho do PostgreSQL
15433→5432). Decisão sobre 5433 (fechar, filtrar ou manter com rota alternativa
`painel-cloudflared`) é janela própria do owner.

**Deriva E6 — regra de recreate (ADR-BASE-21 E6).** O compose versionado é
tunnel-only (sem `ports:` + `cloudflared`); o container vivo publica
`0.0.0.0:15433` sem `cloudflared`. Impacto: `compose up`/recreate a partir do
repo **remove** a porta (quebra o Hyperdrive até D4 existir); recreate a partir
do compose local do host **reexpõe** `0.0.0.0` sem filtro (E4). Regra: **nenhum
recreate sem reconciliar antes** — até A-REDE-3, o host e o repo precisam
descrever o mesmo estado ou a diferença estar registrada como exceção
consciente; após A-REDE-3, o compose versionado volta a ser a fonte (G4 Fase 3
passo 8 ancora a persistência do não-exposição nele).

**Probes read-only do HBA efetivo no Contabo (qualquer janela A-REDE, sem
mutação, via `docker exec` + `psql` administrativo):**

```sql
SHOW hba_file;            -- deve apontar o pg_hba.conf versionado/montado
SELECT * FROM pg_hba_file_rules ORDER BY rule_number;  -- hostssl apenas fora de local; primeira regra que casa vence
SHOW ssl;                 -- on
SELECT * FROM pg_stat_ssl; -- sessões app com ssl=t (prova de criptografia no caminho real)
```

Evidência HBA/TLS em Postgres descartável local (2026-10-11, imagem
`postgres:17`, credenciais sintéticas, container+volume removidos após): HBA
espelhado da produção (`local trust` + `hostssl scram-sha-256` 127.0.0.1/::1,
`hba_file` explícito) — `pg_hba_file_rules` com 3 regras hostssl-only;
`ssl=on`; sessão `psql sslmode=require` com `ssl=t` em `pg_stat_ssl`;
`sslmode=disable` rejeitado (`no pg_hba.conf entry ... no encryption`);
senha errada rejeitada; socket local sem senha OK (trust pinado); linha
`reject` inserida em primeiro lugar bloqueou TLS+SCRAM válido (precedência
first-match provada) e foi removida; `pg_isready` + `psql SELECT 1` compatíveis;
`docker restart` com recovery verde e regras persistidas (arquivo no volume).
Prova de forma, não do host: o Contabo só se prova pelos probes read-only
acima, em janela autorizada.

**Fase 3 — Papéis de runtime (janela separada; A-PAPEIS).** Credenciais admin/app distintas; criar e conceder em staging, smoke de worker, Hyperdrive do staging, confirmar `pg_stat_activity`; só então produção. Não alterar credenciais existentes; pools drenam naturalmente. Dependência: capacidade de atualizar Hyperdrive **por ambiente**. **Probe pré-migration:** o smoke de worker contra staging roda com ledger 33 e aceita `migrations-incomplete` (33/36) — prova auth/TLS/papel, não completude de migrations; só `db-unreachable` reprova. O gate 36/36 é pós-fase 5.
_Entrada:_ fase 2 verde — caminho privado provado (papéis trafegam sobre a rede privada, nunca sobre porta pública). _Saída:_ aplicação conectando por papéis novos, sem flags, em ambos os ambientes.

**Fase 4 — Gate de restauração.** Restore de backup **autorizado por escrito (A-RESTORE)** e verificado em ambiente isolado allowlisted (regras §6); backup+manifest off-host co-verificados; readiness corrigida; gates de conectividade privada e least-privilege verdes. Somente então a E2b é solicitada.
_Entrada:_ fases 1–3 verdes. _Saída:_ evidência de restore + trilha de privilégios auditável.

**Fase 5 — Migrations.** Um ambiente por vez (staging; depois produção em janela própria), 33→36 via `migrate-vps`; sem deploy simultâneo.

**Antes das migrations (pré-requisito, não opcional):** provisionar os papéis runtime **e** `ALTER DEFAULT PRIVILEGES` emitida pelo **dono exato da migration** — o mesmo principal com que `scripts/migrate-vps.ts` conecta — para que `approval_tokens` **já nasça concedida** na criação pela 0035 (§3).

**Ordem explícita: 0034 (`0034_action_attempt_fields`, `action_logs`) → 0035 (`0035_approval_tokens`) → 0036 (`0036_outbox_claim_generation` + controle de manutenção do outbox)** — o runner canônico aplica o journal pendente em ordem, numa invocação por ambiente; não existe grant intermediário entre 0035 e 0036. A contagem continua **36**, sem migration 0037. Bancos já em 36 com a 0036 antiga são detectados como `maintenance-control-missing`; com autorização E2b, convergir pelo `node scripts/outbox-control-repair.mjs` (dry-run) e depois `--apply`, não por readiness presumido. `--target=staging` e `--target=production` são separados; não usar `--target=all`.

**Imediatamente após a migração e antes do rollout (fase 6):** verificar ledger exato 36/36, tabela/linha singleton, trigger BEFORE UPDATE ROW habilitado e versão do control shape. Verificar `has_table_privilege` separadamente em cada privilégio de `approval_tokens`, `action_logs`, `outbox_jobs` e `outbox_control`: runtime recebe SELECT no controle, não mutação; conexão administrativa executa pause/resume. Nenhum rollout com `maintenance-control-missing` ou grants divergentes.

_Entrada:_ E2b explícita (fase 0) sobre gate da fase 4; papéis + default privileges já provisionados. _Saída:_ ledger 36/36 no ambiente migrado e privilégios verificados.

**Fase 6 — Pause, drain e rollout app/workers.** Executar somente após a Fase 5 no mesmo ambiente. O banco é a autoridade: singleton `outbox_control` + trigger bloqueiam claims diretos/legados; `claim_generation` e o marcador transacional cercam as liquidações da versão ativa.

1. No ambiente-alvo, disponibilizar `DATABASE_URL` no ambiente protegido do operador usando credencial administrativa, nunca como argumento/log. Runtime app recebe **somente SELECT** em `outbox_control`; operadores do controle usam conexão administrativa. Ver §3 para GRANT/REVOKE.
2. Registrar backlog e release atual sem payload/PII: `npm run outbox:control -- status`. O comando informa epoch, contagens, leases em `processing` com id aleatório/generation/release/timestamp e se a lista é completa. Conferir também a distribuição por operação com a consulta somente-leitura de §10; `pending` será preservado e poderá incluir mensagens/cobranças a processar depois do resume.
3. Pausar o **consumo**, sem desligar produtores nem descartar enqueues: `npm run outbox:control -- pause`. O comando incrementa epoch e persiste `paused=true`. Scheduler `*/5` continua chamando a rota; a aplicação retorna sem dispatch e o gate DB bloqueia claims antigos/direct-SQL. Os 6 jobs cron e produtores inline podem seguir enfileirando atomicamente na transação de negócio.
4. Drenar e verificar: `npm run outbox:control -- status` seguido de `npm run outbox:control -- verify-drained`. Só `paused=true`, `processing=0` e saída `OUTBOX_DRAIN=VERIFIED` aprovam. Lease expirado/stale é apenas observação — **cinco minutos não provam drain**. Execução ambígua ou job que permaneça `processing` mantém NO-GO; reconciliar pelo domínio com o owner, sem reset/retry cego e sem `force`.
5. Deploy all-at-once de **um único release**; não usar gradual/split traffic. Com producers continuando, novas linhas ficam `pending`; nenhuma é enviada enquanto pausado. Antes de resume, probe GET autenticado `/api/cron/outbox` (`CRON_SECRET` via ambiente) precisa retornar `status=paused`, `processing=0`, `controlEpoch` esperado e `releaseId` exatamente igual ao Worker Version ID ativo do Cloudflare. A distribuição do Worker deve estar 100% nesse release, sem versão antiga atendendo tráfego.
6. Retomar explicitamente com CAS de epoch e versão: `npm run outbox:control -- resume --expected-epoch=<EPOCH> --release-id=<CF_VERSION_ID>`. Não há `force`; `processing>0`, release desconhecido/divergente ou control shape ausente aborta fechado. O código obtém a versão de `CF_VERSION_METADATA` no contexto OpenNext. Após retomar, GET deve mostrar `status=running` e `controlReleaseId=releaseId`; claims novos escrevem a mesma release e incrementam `claim_generation`.
7. Confirmar backlog/ritmo antes do resume como decisão operacional: cada tick agenda até 25 jobs com concorrência 5; eventos pendentes podem produzir efeitos externos (WhatsApp/cobranças). Não executar smoke que envia dados reais sem autorização específica.

**Rollback:** primeiro repetir pause → drain → verify e obter nova epoch. Um bundle anterior sem protocolo/release metadata **não pode voltar a consumir**: o DB o rejeita e a fila permanece preservada, não recuperada pela simples troca de release. Se for necessário voltar o app, manter o outbox pausado até publicar uma versão protocol-capable e revalidar a versão/fence antes de resume. Não remover a migration expandida nem reabrir porta pública; rollback de D3→D4 continua contido conforme G5.

Nota: smoke público não prova workers (`smoke-deploy` skips service bindings) nem fence. O GET autenticado identifica release/estado; o status DB identifica leases; nenhum dos dois sozinho substitui a verificação de rollout único e drain.
_Entrada:_ Fase 5 completa, autorização E2b registrada, grants verificados. _Saída:_ somente release identificada consumindo, fence ativa e backlog aceito pelo owner.

**Fase 7 — Smoke e gates.** Smoke pós-deploy + smoke-staging controlado (sintético; POSTs documentados em §1), monitoramento (§8) e veredito GO/NO-GO (§9).
_Entrada:_ fase 6 concluída. _Saída:_ veredito registrado; plano só vira DONE com E2b exercida.

**Cadeia de dependência:** `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7`. Fase 2 **precede** 3: o corte de papéis (credenciais novas + Hyperdrive) trafega **sobre** o caminho privado provado na fase 2 — papéis sobre rede privada, nunca o inverso. Ambas bloqueiam a 4; 5 e 6 jamais coincidem na mesma janela.

**Decisões exigidas ao owner (decisão-ready):** (1) **A-REDE** — janela urgente de rede pelo caminho único D3→D4 do ADR-BASE-21 (contenção verificada antes de qualquer corte; sem alternativa D3-only); autoriza **apenas** contenção de rede (fase 2); (2) **A-PAPEIS** — corte de papéis de runtime, credenciais novas e update Hyperdrive por ambiente; autoriza **apenas** fase 3; (3) **A-RESTORE** — autorização escrita de restore de backup real (ambiente isolado allowlisted, executante, janela); autoriza **apenas** o gate da fase 4; (4) **E2b** — aprovação final explícita antes das fases 5–6 (migrations + rollout de app/workers em produção); (5) mecanismo dedicado de pause/drain cron/outbox + responsável (bloqueador da fase 6). Nenhuma dessas aprovações cobre as outras: A-RESTORE não autoriza migrations nem rollout; E2b não autoriza rede, papéis ou restore.

## 3. Papéis de runtime no PostgreSQL (design de privilégio mínimo)

- **`synkroo` permanece admin/DDL** (pgvector, migrations, DDL). Não é papel de runtime da aplicação.
- **Novos papéis runtime:** sem flags (`SUPERUSER`, `CREATEDB`, `CREATEROLE`, `BYPASSRLS`, `REPLICATION`) e sem membership em papéis privilegiados.
- **Grants:** `SELECT/INSERT/UPDATE/DELETE` nas tabelas do schema `public`; `USAGE` nos schemas `public` e `drizzle`; `SELECT` no ledger (`drizzle.__drizzle_migrations`).
- **Exceção do controle operacional (0036 expandida):** runtime exige `SELECT` em `public.outbox_control` para observar pause/release e executar o trigger, mas **não** recebe `INSERT/UPDATE/DELETE` nessa tabela. `pause`/`resume` via `scripts/outbox-control.ts` usa `DATABASE_URL` administrativa protegida, nunca a credencial runtime. Depois de `ALTER DEFAULT PRIVILEGES`, revogar os privilégios mutadores do runtime nessa tabela e verificar cada um com `has_table_privilege` antes do rollout.
- **Sequences:** conceder somente após inventário real dos nomes — não presumir.
- **Objetos criados por migration:** o runner canônico aplica **todo** o journal pendente (0034→0035→0036) em ordem, **numa única invocação por ambiente**; não existe grant intermediário entre 0035 e 0036. `ALTER DEFAULT PRIVILEGES` do dono exato da migration faz `approval_tokens` nascer acessível em 0035. Depois da migration e antes do rollout: verificar privilégios independentes em `approval_tokens`, `action_logs`, `outbox_jobs` e `outbox_control`. Runtime recebe CRUD nas tabelas de negócio/outbox e somente SELECT no singleton `outbox_control`; `INSERT/UPDATE/DELETE` do controle ficam na conexão administrativa do operador. `approval_tokens` exige CRUD porque `src/core/actions/approval.ts` insere, lê, atualiza `consumed_at` e remove expirados. 0035 não cria sequence.
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

### 7.1 Matriz de compatibilidade específica do controle 0036

| Cenário | Resultado exigido/observável | Gate operacional |
|---|---|---|
| App legado em schema 36 com 0036 expandida e controle inicialmente desarmado | APIs/produtores seguem escrevendo; enqueue continua durável. O consumidor legado só pode operar antes do pause; após pause, trigger bloqueia novos claims e permite drenar somente leases pré-protocolo (`claim_release IS NULL`). | pause antes da troca de release; `processing=0` antes de deploy/resume. |
| Banco ledger 36 com a 0036 original (sem objetos de controle) | readiness `maintenance-control-missing`; código novo e claims falham fechado. | `outbox-control-repair.mjs` dry-run → `--apply` explícito e shape verificado; não contar apenas ledger. |
| App/consumer novo em schema 36 expandido | release obtida por `CF_VERSION_METADATA`/override válido; claim incrementa `claim_generation`, persiste `claim_release`; settlement precisa do marcador `<release>#<generation>`. Release ausente/mismatch é recusado. | readiness ready + GET autenticado confirma o release antes de resume. |
| Consumer antigo ainda ativo; novo release aguardando | pause DB impede novos claims inclusive do scheduler/direct SQL; jobs antigos em execução aparecem em `processingJobs` com geração/release; suas liquidações pré-protocolo só terminam durante o pause e enquanto o release não foi rearmado. | não fazer resume até zero processing e uma única versão nova ativa. |
| Rollback para release anterior sem protocolo | app pode servir rotas, mas o consumer não passa o gate; fila permanece pendente e preservada. Não há recuperação automática por swap. | repetir pause→drain→verify; manter pausado até versão protocol-capable. Nunca retomar legacy sem fence. |

Compatibilidade em PG descartável foi exercitada por migrations-from-zero e
ensaios de trigger/readiness/repair. Isso não substitui rehearsal autorizado em
staging; nenhum schema produtivo foi alterado.

## 8. Monitoramento (após cada fase)

- Readiness por motivo (`migrations-incomplete` vs `db-unreachable`); taxa de 5xx; falhas de autenticação.
- Conexões de BD por principal/pool — evidência do corte de papéis.
- Outbox/DLQ: duplicidade `deliveryUnknown` — a fence `claim_generation` só existe após 0036.
- Skew de versão de worker (antigo/novo) — sobreposição é proibida na fase 6.
- Janela mínima de observação por fase antes de liberar a próxima: definida pelo owner na aprovação da janela; métrica estável é pré-requisito de avanço.

## 9. GO / NO-GO

| Gate | Evidência exigida | Status atual |
|---|---|---|
| CI/integração de código | CI da main pós-#51/#52 verde; CI + review do PR do controle devem estar verdes antes de avançar | #51 e #52 pós-merge PASS; PR do controle ainda não aberto |
| Restore de backup | restore real autorizado (A-RESTORE) e verificado no DB isolado allowlisted: exit 0 do `pg_restore`, catálogo, extensões e ledger = **33** + smoke estrutural via admin/`psql` (nunca readiness 36/36 — circular antes da fase 5) | **NÃO VERIFICADO / BLOQUEADO** — sem A-RESTORE escrita e sem restore nesta rodada; drill 10/07 = artefato real off-host do dia → DB isolado; drill 25/09 = backup real de produção → `synkroo_drill`; nenhum é o dump vigente |
| Backup + manifest off-host | artefatos e manifest co-verificados como bundle | Parcial — streaming 10/10; manifest separado |
| Readiness/conectividade | pré-migration comprova auth/TLS/SELECT/ledger e aceita somente `migrations-incomplete` em 33/36; pós exige ledger **exato 36/36**, readiness integral e control shape funcional | lógica candidate; ensaio isolado PASS; produção/staging continuam reportados 33/36 até nova evidência autorizada |
| Conectividade privada | produção alcançável só por caminho autorizado | Pendente (fase 2) |
| Least-privilege | papéis novos sem flags; principals confirmados em `pg_stat_activity` | Pendente (fase 3) |
| Grants de `approval_tokens` e outbox control | runtime roles + `ALTER DEFAULT PRIVILEGES` do dono exato antes; pós-migration verificar `approval_tokens`/objetos 0034–0036; runtime com SELECT-only em `outbox_control`; credencial administrativa opera pause/resume | Pendente (A-PAPEIS/E2b; nenhuma role/grant alterada) |
| Pause/drain do outbox | PostgreSQL singleton + trigger no claim, pause/resume CAS, status leases/releases; enqueue segue durável; `verify-drained` exige pause + `processing=0` | implementado no candidate; ensaio local PG17 PASS; não mergeado/aplicado em produção |
| Jobs ambíguos / lease stale | nunca considerar 5 min prova; `processing` stale mantém drain incompleto; reconciliation por domínio antes de qualquer resume | limitação conhecida: nenhum force/retry cego; se existir job ambíguo, NO-GO até resolução manual autorizada |
| Não-sobreposição old/new (fase 6) | rollout all-at-once para release único; GET autenticado confirma versão/epoch; marker + generation cercam settlement; rollback repete pause/drain e nunca retoma consumer pre-protocol | ensaio isolado PASS; implantação e verificação de versão em produção pendentes |
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
#    os objetos de 0034–0036 (§3), incluindo outbox_control SELECT-only para runtime.
#    O control singleton é mutado somente pela conexão administrativa do operador.
# Se o ledger 36 tiver a 0036 original sem os objetos do controle, readiness deve
# retornar maintenance-control-missing. Inspecionar primeiro (dry-run); --apply
# é DDL mutador e exige E2b + backup/preflight, nunca rodar implicitamente:
node scripts/outbox-control-repair.mjs
# node scripts/outbox-control-repair.mjs --apply  # [MUTADOR → E2b, somente se shape ausente]

# --- pause/drain do outbox (após schema 36; DATABASE_URL admin vem do ambiente protegido) ---
npm run outbox:control -- status
npm run outbox:control -- pause
npm run outbox:control -- status
npm run outbox:control -- verify-drained
# Revisar imediatamente antes de resume os eventos preservados/efeitos que podem
# ser emitidos; CASE allowlisted evita expor operação desconhecida ou payload.
psql "sslmode=require host=$PGHOST port=$PGPORT user=$PGUSER dbname=$PGDATABASE" \
  -c "SELECT CASE operation
        WHEN 'financeiro.charge.create' THEN operation
        WHEN 'financeiro.charge.cancel' THEN operation
        WHEN 'followup.campaign.recipient' THEN operation
        WHEN 'atendimento.inbound.message' THEN operation
        WHEN 'atendimento.outbound.message' THEN operation
        WHEN 'crm.contact.changed' THEN operation
        ELSE 'unknown' END AS operation_class,
      status, count(*)
      FROM public.outbox_jobs WHERE status IN ('pending','processing')
      GROUP BY 1,2 ORDER BY 1,2;"
# Em outro terminal autorizado, após deploy all-at-once, confirmar o release que
# atende /api/cron/outbox via GET autenticado (CRON_SECRET somente no env; não argv/log):
# PowerShell: Invoke-RestMethod -Method Get -Uri "$env:OUTBOX_BASE_URL/api/cron/outbox" `
#   -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
# Exigir status=paused, processing=0, controlEpoch esperado e releaseId igual ao
# único Worker Version ID ativo no Cloudflare (100%, sem gradual/split traffic).
# Revisar de novo o backlog por operação (a pausa não interrompe produtores); nunca
# usar SELECT de payload para esse gate. Se houver eventos sem autorização de efeito,
# manter pausado e obter decisão do owner.
psql "sslmode=require host=$PGHOST port=$PGPORT user=$PGUSER dbname=$PGDATABASE" \
  -c "SELECT CASE operation
        WHEN 'financeiro.charge.create' THEN operation
        WHEN 'financeiro.charge.cancel' THEN operation
        WHEN 'followup.campaign.recipient' THEN operation
        WHEN 'atendimento.inbound.message' THEN operation
        WHEN 'atendimento.outbound.message' THEN operation
        WHEN 'crm.contact.changed' THEN operation
        ELSE 'unknown' END AS operation_class,
      status, count(*)
      FROM public.outbox_jobs WHERE status IN ('pending','processing')
      GROUP BY 1,2 ORDER BY 1,2;"
npm run outbox:control -- resume --expected-epoch=<epoch-do-pause> --release-id=<cf-version-id>
# Confirmar GET status=running + releaseId=controlReleaseId; se processing>0,
# release divergir/desconhecido ou o control shape falhar, NÃO retomar.

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
- Não intercalar GRANTs entre 0035 e 0036: o runner canônico aplica todo o journal pendente numa invocação; provisionar papéis/default privileges antes e verificar depois. Em `outbox_control`, runtime só SELECT; mutação é administrativa — sem criar migrador segmentado.
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
| Responsável operacional por pause/drain e reconciliação de leases ambíguas | ________ — a definir; o código candidate não nomeia nem substitui o operador |

Sem nomeação registrada, qualquer gate que dependa de owner/operador permanece NO-GO.

## 13. Critérios de validação (para revisor/validador)

O plano só pode ser validado contra estes critérios — cada um verificável no próprio texto e na evidência citada:

1. **Separação probe/gate:** probes das fases 2–3 aceitam ledger 33 com `migrations-incomplete`; gates das fases 5–7 exigem 36/36; nenhum probe exige o que só a fase 5 produz (sem exigência circular).
2. **Ordem das migrations/grants:** 0034 → 0035 → 0036 explícita, um ambiente por execução; o runner aplica o journal numa chamada. Default privileges do dono exato são provisionados antes; depois, verificar `approval_tokens`, objetos 0034–0036 e `outbox_control`. Runtime recebe SELECT-only no singleton; a conexão administrativa muta pause/resume. Ledger e control shape são verificações independentes.
3. **Quiescência verificável:** pausa PostgreSQL bloqueia claims de `/api/cron/outbox`, dispatchers diretos e versões legadas pelo trigger comum; scheduler pode continuar o poll sem dispatch. Produtores inline permanecem ativos e seus enqueues são duráveis/atômicos; não se afirma que foram pausados. `verify-drained` exige estado paused + `processing=0` + listagem completa; lease >5min não prova drain. Jobs de resultado ambíguo mantêm NO-GO até reconciliação de domínio, sem force/retry cego. Deploy é all-at-once para uma release; rollback repete pause/drain/verify.
4. **Restore:** `--yes` nunca apresentado com `DATABASE_URL` herdada (a sobrescrita a partir da variável do alvo é fail-closed: alvo vazio aborta); alvo nomeado/allowlisted — produção e staging fora da allowlist —, identidade pré/pós e URL sintética em env separada exigidos; verificação do alvo restaurado no ledger **33** = exit 0 do `pg_restore`, catálogo, extensões e smoke estrutural via admin/`psql`, **sem** exigir readiness 36/36 antes das migrations (artefato 33-compatível identificado se a smoke usar o app antigo); drills classificados corretamente (10/07 = artefato real off-host do dia → DB isolado; 25/09 = backup real de produção → DB isolado `synkroo_drill`; 26/09 local = dev local → alvo vivo) e nenhum como prova do dump vigente; uso de backup atual permanece BLOQUEADO sem autorização escrita.
5. **Fronteiras de aprovação:** A-REDE (rede) / A-PAPEIS (papéis + credenciais + Hyperdrive) / A-RESTORE (restore) / E2b (migrations + rollout de produção) distintas e em sequência; nenhuma operação antes da sua autorização específica e nenhuma aprovando outra (A-RESTORE não cobre migrations/rollout; E2b não cobre rede, papéis ou restore).
6. **Cadeia 2→3→4 consistente:** DAG `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7` e as declarações de fase concordam — papéis/credenciais são cortados sobre o caminho privado provado na fase 2, portanto 2 precede 3, e ambas bloqueiam 4.
7. **Smoke:** smoke-deploy (GET-only, `workers` skipped) e smoke-staging (stateful synthetic-only, POSTs documentados, alvo sintético, nenhum envio real a provider) descritos sem tratar skip como prova.
8. **Sem sobreposição com a evidência:** fases 5 e 6 não coincidem; probe pré-migration ≠ gate pós-migration; uma release única atende no resume; enqueues e backlog são preservados e revisados antes da retomada. Cada evidência é disjunta: nenhum drill histórico prova o dump vigente; leitura 33/33 antiga, lease expirado, check skipped ou troca de release isolada não comprovam restore, drain ou fence.
