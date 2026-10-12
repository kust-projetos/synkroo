# Runbook operacional — E2: aplicar migrations 0034/0035/0036 + deploy (Contabo)

**Data:** 2026-10-08 · **Base:** `origin/main @ efee7d48` (pós-merge E1, PR #32) · **Status:** READY FOR OPERATOR — nenhuma ação aqui executada; cada seção mutadora exige autorização humana explícita, preflight e backup.
**Revisão operacional 2026-10-11:** reconcilia G1 pré/pós-migration e liga a fase 6 ao controle outbox candidate em `origin/main @ bda1d488`; a integração desse candidate ainda requer CI/review próprios. Nenhuma ação de produção executada.
**Fontes:** `docs/audit/2026-10-08-vnext-integration-reconciliation.md` (E0), `src/lib/db/migrations/0034_*`, `0035_*`, `0036_*`, `meta/_journal.json`, `drizzle.config.ts`, `scripts/migrate-vps.ts`, `docs/audit/migrations-policy.md`, `src/services/api-handlers/health/{db,readiness}.ts`.

## 1. Estado conhecido (read-only, sem acesso autorizado ao target)

- Código espera ledger **36** (`EXPECTED_MIGRATIONS`, conta registros `drizzle.__drizzle_migrations`). Journal: idx 0–36 (`0000`–`0036`, gap herdado `0017`).
- Última evidência operacional (2026-10-07, `docs/inventory/2026-10-07-p2-contabo-validation.md`): target com **33** → 0034 (`action_logs`: 4 cols NULL) e 0035 (`approval_tokens`, CREATE TABLE IF NOT EXISTS) **pendentes**.
- **0036 (`outbox_jobs.claim_generation` + controle outbox)** permanece a 36ª entrada: além de `claim_generation`, a versão expandida instala `claim_release`, singleton `outbox_control` e trigger DB-side para pause/claim/fencing. Se o target estiver em 33, aplicar `0034 → 0035 → 0036` em ordem. Um banco já 36/36 com a 0036 original precisa de `maintenance-control-missing` e repair explícito — contagem sozinha não basta.
- 0034/0035/0036 são **expand-only** (`ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`, re-rodáveis, breakpoints journal). A contagem fica 36, sem 0037. DOWN é só comentário — rollback real = forward-fix/restore (nunca `drizzle-kit` DOWN).
- Ledger atual do target, Hyperdrive source/target, backup off-host, grants, jobs/outbox: **INDETERMINADOS** (sem acesso read-only autorizado nesta rodada).
- Readiness G1 tem gates separados: antes da migration, 33/36 + `SELECT 1`/ledger autenticados permite apenas `migrations-incomplete`; depois, exige ledger exatamente 36/36, readiness ready e control shape presente. Falha auth/TLS/rede/ledger continua NO-GO.
- **Nota de versionamento:** o relatório E0 (`docs/audit/2026-10-08-vnext-integration-reconciliation.md`) fixa 35 porque congelou o snapshot `d532ff6e`; ele permanece como registro histórico e NÃO foi reescrito. A contagem vigente é 36 (ver `docs/audit/migrations-policy.md`).

## 2. Pré-checks (somente leitura, antes de qualquer mutação)

1. `GET /api/health/db` no target → anotar `{complete, migrationsApplied, migrationsExpected, maintenanceControl}`. Esperado pré-migrate: `complete:false, applied:33, expected:36`.
2. `readiness` interno autenticado com `statement_timeout 3s`: G1-pre aceita somente `migrations-incomplete` quando `SELECT 1` + leitura ledger foram bem-sucedidos e ledger =33; `db-unreachable`, auth/TLS/timeout/ledger-read falho reprovam. Depois das migrations, exigir 36/36 **exato**, control shape funcional e readiness integral ready.
3. `scripts/migrate-vps.ts --side=source --dry-run` e `--side=target --dry-run` → plano sem mutação, sem secrets (handoff de senha via stdin/env no wrangler).
4. Confirmar backup off-host recente + drill de restore válido (`docs/runbooks/database-recovery.md` §2.3; último drill completo local 2026-09-26, RTO ~114s; switch real em prod **pendente**).
5. Congelar deploys concorrentes (WAHA/Action E4) na janela — sem mudar migrations + WAHA + Action Layer juntos.

## 3. Janela de aplicação (com autorização E2b)

1. Freeze curto de escrita se o operador exigir (0034/0035/0036 são NULL/IF-NOT-EXISTS → compatíveis com app antigo e novo; freeze é precaução, não requisito técnico).
2. Aplicar `drizzle-kit migrate` (ou `migrate-vps.ts` sem `--dry-run`, lado correto) **uma vez**, ordem do journal.
3. Re-rodar prechecks: esperado `complete:true, applied:36, expected:36, maintenanceControl:present`; readiness ready. Repair da 0036 antiga só após dry-run e autorização E2b explícita.
4. Antes de trocar release, executar o protocolo operacional da seção 3A: `pause → drain → verify → deploy → verify version/fencing → resume`. O pause não interrompe os producers: enqueues continuam na transação e acumulam como pending. O trigger do banco é o gate para scheduler/consumidor antigo e dispatchers diretos.
5. Após deploy all-at-once, verificar o GET autenticado `/api/cron/outbox`: `status=paused`, `processing=0`, `controlEpoch` esperado e `releaseId` igual ao único Worker Version ID ativo (100%, sem gradual/split). Conferir o bundle do alvo e migrations 36/36 antes do resume.
6. Conferir backlog pendente por operação sem ler payload/PII e obter aceitação do owner para os efeitos que serão processados; só então `resume` com epoch e release exatos. O scheduler retoma no tick seguinte; nenhum envio/cobrança real é usado como smoke.

### 3A. Protocolo obrigatório do outbox — `pause → drain → verify → deploy → verify version/fencing → resume`

Executar após ledger/control 36/36, numa janela E2b aprovada e por conexão
administrativa protegida em `DATABASE_URL` (não usar o role runtime). Os comandos
não recebem DSN/secret em argv e emitem somente estado agregado, IDs aleatórios,
release, geração e timestamp — nunca payload.

1. Registrar estado/backlog: `npm run outbox:control -- status`. Enqueues durante
   a janela permanecem `pending`; nenhum produtor é desligado nem tem evento
   descartado. O status lista no máximo 500 leases em processamento e sinaliza
   `processingJobsComplete`.
2. Pausar: `npm run outbox:control -- pause`. Guardar o epoch impresso. O banco
   serializa a transição com claims/settlements; scheduler continua fazendo o
   poll, mas rota e trigger não admitem novos dispatches/claims. Claims diretos e
   versões legadas também passam pelo trigger.
3. Drenar e verificar: acompanhar `status` e executar
   `npm run outbox:control -- verify-drained`; exige pausado, lista completa e
   `processing=0`. `staleProcessing` e lease >5min são diagnóstico, nunca prova.
   Job ambíguo/crash mantém NO-GO; não usar retry/reset/force. Exigir reconciliação
   do provider/operação e do owner antes de qualquer tratamento manual.
4. Deploy do novo release **all-at-once**, sem split/gradual. Pending é mantido,
   não despachado durante deploy. GET autenticado com `CRON_SECRET` só do env
   (não imprimir `$headers` nem o valor):

   ```powershell
   $headers = @{ Authorization = "Bearer $env:CRON_SECRET" }
   Invoke-RestMethod -Method Get -Uri "$env:OUTBOX_BASE_URL/api/cron/outbox" -Headers $headers
   ```

   Exigir `status=paused`,
   `processing=0`, epoch esperado e `releaseId` do Cloudflare idêntico ao único
   Worker Version ID ativo. Se old/new ainda divide tráfego ou release não bate,
   parar pausado.
5. Conferir code/schema (36/36 exato + shape) e a lista de leases vazia. Review
   dos jobs `pending` por operação é obrigatório: resume pode chamar providers
   e executar cobranças. Não usar envio real como teste do protocolo.
6. Resume explícito e compare-and-swap: `npm run outbox:control -- resume
   --expected-epoch=<epoch> --release-id=<Worker-Version-ID>`. O comando recusa
   `processing>0`, epoch divergente ou release desconhecido. GET autenticado deve
   retornar `status=running`, `releaseId=controlReleaseId` e o mesmo epoch/release
   registrado no comando. Claim novo incrementa `claim_generation`; liquidações
   são aceitas só com marcador `<release>#<generation>`.

**Rollback:** repetir pause → drain → verify antes do rollback/redeploy e gerar
epoch nova. Um bundle anterior sem protocolo/release marker pode servir o app,
mas **não pode consumir o outbox**; manter pausado até publicar versão
protocol-capable e verificar sua identidade/fence. Rollback de release não
recupera automaticamente jobs nem prova que provider não recebeu um efeito.

## 4. Rollback

- **Migrations:** sem DOWN — forward-fix (nova migration corretiva) ou restore do backup off-host (runbook `database-recovery.md`). 0034 (cols NULL) e 0035 (tabela nova sem FK) são reversíveis por `DROP COLUMN`/`DROP TABLE` manual **somente** se nenhum consumidor as usa e com aprovação (policy §contract, 5 condições). 0036 é reversível por `ALTER TABLE outbox_jobs DROP COLUMN claim_generation` **somente** na mesma condição — e apenas enquanto nenhuma liquidação depender da fence (a coluna é `DEFAULT 0 NOT NULL`: sem leitor, removê-la não corrompe dado algum).
- **App:** rollback de rotas/app pode ocorrer com schema expandido, mas release pre-protocol sem `claim_release`/marker **não pode consumir**. Após rollback, manter o outbox pausado; qualquer retomada exige nova pause → drain → verify, versão protocol-capable identificada e novo resume. Trocar release não recupera jobs por si só.
- **Limites:** sem backup válido → NO-GO. Sem Hyperdrive source/target confirmados → NO-GO.

## 5. Condições NO-GO (abortar antes de mutar)

Tenant escape, backup inconsistente/ausente, Hyperdrive ambíguo, divergência financeira, segredo exposto, control shape ausente, drain não comprovado, versão ativa desconhecida, ausência de rollback viável, ou qualquer gate E2a (compat em staging/rehearsal) pendente sem dispensa escrita do responsável.

## 6. Gates

- **E2a:** prova de compatibilidade em staging/rehearsal (migrate + app + readiness verdes em DB isolado).
- **E2b:** aprovação humana explícita antes de tocar BD/Cloudflare produção.
- Sem E2b: este runbook permanece **READY FOR OPERATOR — nunca DONE**.
