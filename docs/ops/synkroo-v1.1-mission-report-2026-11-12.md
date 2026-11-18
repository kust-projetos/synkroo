# MISSÃO SYNKROO — Correção e Consolidação V1.1 — Relatório de fechamento

**Baseline auditada:** `main@55393b6` (início) → `main@d9060f4` (HEAD antes da missão).
**Data:** 2026-11-12
**Executor:** Planner OpenCode

> **Contexto histórico — as of 2026-11-12.** As seções anteriores a “Aditivo de fechamento — 2026-11-13” registram o estado conhecido naquela data. Referências a PR #111 aberto, CI pendente e próximas ações são históricas e foram substituídas pelo aditivo abaixo.

## Marco 1 — Recuperar a CI e consolidar correções

### 1.1 Reconciliação worktree/GitHub
- Branches já integradas a `main` (ancestors): `feat/e2e-gw02-tenant-switch`, `fix/e2e-contacts-responsive-selectors`, `fix/e2e-contacts-mobile-back-retry`, `test/e2e-gw02-flaky`.
- Branch `validation/e2e-contacts-zod` NÃO integrada e descartada (remove migrações/infra — destrutiva).
- PRs existentes já mergeados cobrem GW-02/GW-03/GW-10 parcialmente; nenhuma reimplementação feita.

### 1.2 GW-02 — Tenant Switch
- Estado: JÁ consolidado em `main` antes da missão (`context.tsx` usa `update({ user: { clinicId } })`; JWT callback lê `session?.user?.clinicId`; `_handler` valida acesso e retorna perfil alvo).
- Nenhuma alteração adicional necessária. Testes de tenancy PASS.

### 1.3 GW-03 — Conversão de lead
- Estado: `converterLead` (action) já registrava `lead_converted` em `main`.
- Correção aplicada nesta missão: idempotência em reexecução (não insere atividade duplicada quando lead já convertido).
- `converterLeadSemAgendar` e `agendarAvaliacao` já guardavam via `ensurePatientForLead`.

### 1.4 E2E de contatos
- Causa efetiva: `ContactSplitView` usa `useSearchParams` sem `Suspense` boundary (contrato Next.js 15), degradando hidratação/navegação client-side.
- Correção: envolver `<ContactSplitView />` em `<Suspense>` em `contacts-client.tsx`.
- Sem aumento de timeouts ou retries.

### Validação M1
- `npm run typecheck` PASS.
- `npm run lint` PASS (`--max-warnings=0`).
- `npx jest src/modules/comercial` — 11 suites / 62 testes PASS.
- `npx jest src/components/contacts src/app/dashboard/contatos` — 6 suites / 33 testes PASS.

**Resultado M1: PASS (código)** — CI completa depende de runner remoto (não executada nesta rodada).

## Marco 2 — Golden Workflows GW-01..GW-03

- GW-01 (Login → Dashboard): production-mode contra PostgreSQL descartável local; `login.spec.ts` + `overview.spec.ts`: 9 passed.
- GW-02 (Tenant Switch): `clinic-selector.spec.ts`: 4 passed em production-mode. Inclui fluxo A→B→A→B, exclusividade do paciente sintético B, métricas e permissões.
- GW-02 API/GW-03: `tenant-switch.spec.ts` + `gw03-lead-patient-appointment.spec.ts`: 9 testes listados; 7 passed / 2 skips esperados no fluxo API single-clinic. Switch real coberto pela UI multi-clínica. GW-03 inclui conversão repetida/evento único e replay idempotente de agendamento.
- Contatos: `contacts-notes.spec.ts`: 6 passed em produção local com DB descartável; nenhuma falha reproduzida nesta rodada.
- PostgreSQL descartável local: migrations aplicadas, banco saudável e seed de teste executado. Nenhum E2E desta rodada foi executado em produção real.
- GW-10 (analytics export): preservado, sem ampliação de escopo.

**Resultado M2: E2E local validado** — execução contra PostgreSQL descartável local; não equivale a validação em produção.

## Marco 3 — Correções operacionais

### 3.1 OpenBao
- Arquivo: `scripts/consume-openbao-staging.ps1`.
- Correção atual de ambiente/túnel/`ProcessStartInfo`: porta loopback efêmera e exclusiva; ownership de PID verificado antes do health check, após health check e antes de `bao kv get`. SSH usa `ExitOnForwardFailure`, `BatchMode` e `ConnectTimeout`; child via node + tsx local/`ArgumentList`, sem `cmd`/`npx`.
- Harness mock efêmero passou ProbeOnly, falha Bao, sucesso/falha child, remoção de tokens do child e de SSH/curl, owner falso bloqueado antes de curl/bao, owner correto, restauração do ambiente e cleanup do túnel. Parser PowerShell PASS; `node --test scripts/__tests__/operator-scripts-hardening.test.mjs`: 38/38.
- Contrato de persistência autorizado pelo usuário: o child `setup-staging-db` pode persistir, no `.env` privado, ambas as credenciais efetivas (staging e admin/Postgres) antes de qualquer mutação, sempre no caminho apontado por `SYNKROO_VPS_ENV`, que o operador deve definir fora do repositório. Modo `0600` vale somente em POSIX; no Windows a ACL é governada pelo próprio sistema.
- Wrapper final: corrige o isolamento de `BAO_*`/`VAULT_*`/proxy, exige PowerShell 7, usa curl com timeouts e `-q`, força `--side=target`, valida o path do segredo, fecha o túnel após a leitura e não imprime segredos.
- Revisão AppSec estática final pré-merge: **APPROVED**. Seu escopo foi estático, sem acesso a OpenBao/credenciais reais, `.env` real, Contabo, staging ou produção; não foi revisão pós-merge nem validação live. A CI posterior é evidência separada.
- Verificações desta continuação: teste focado `scripts/__tests__/consume-openbao-staging.test.mjs` (arquivo novo) 16/16; parse PowerShell sem erros; `npm run test:release` 451 pass / 1 skip / 0 fail (452 total), incluindo o arquivo novo.
- Nenhuma implantação nem alteração de produção foi realizada.

### 3.2 PostgreSQL — #93 e #94
- Evidência coletada (read-only) em `contabo-prod`, container `synkroo-prod-postgres`.
- #93: conectividade confirmada (porta 15433, PG 17.11, pgvector 0.8.7, 68 tabelas). Gates D4 de rede/ACL/ledger pendentes (autorização A-REDE).
- #94: confirmado que a role de runtime `synkroo` é **superuser** em produção. Staging já possui `synkroo_staging_app` não-superuser. Criação da role de runtime em produção exige autorização A-PAPEIS.
- Documento: `docs/ops/postgres-93-94-status-2026-11-12.md`.

**Resultado M3: validação mockada/testes locais e documentação concluídos; revisão AppSec estática final APPROVED (sem acesso real); nada implantado.**

## Marco 4 — Preparação do piloto

- Nenhuma funcionalidade nova criada.
- Insumos humanos (clínica participante, profissionais/agenda, WhatsApp autorizado, usuários responsáveis, janela de operação) **não confirmados**.
- Status registrado: `PILOT_AWAITING_HUMAN_INPUT`.
- Não declarado `PROD_READY`.

**Resultado M4: AWAITING_INPUT.**

## Fechamento

| Marco | Resultado |
|---|---|
| M1 — CI e fixes | PASS (código) |
| M2 — GW-01..03 | E2E local validado contra PostgreSQL descartável |
| M3 — Operacional | Validação mockada/testes locais e documentação concluídos; AppSec estática final APPROVED; sem acesso real nem implantação |
| M4 — Piloto | AWAITING_INPUT |

### Commits/PRs
- **Estado em 2026-11-12:** PR #111 aberto na branch `fix/synkroo-v1.1-consolidation`; as alterações então locais não estavam commitadas/enviadas e a CI completa não havia sido reexecutada após elas.
- Commits identificáveis por correção: `fix(comercial): idempotência em converterLead`, `fix(contatos): Suspense boundary para useSearchParams`, `fix(openbao): try/finally para túnel e env temporárias`, `docs(ops): status #93/#94 e relatório de missão`.

### Bugs corrigidos
1. `converter-lead.ts` — atividade `lead_converted` duplicada em reexecução (guard de idempotência).
2. `contacts-client.tsx` — hidratação/navegação quebrada por `useSearchParams` sem `Suspense`.
3. `consume-openbao-staging.ps1` — limpeza de túnel/env não garantida em saídas antecipadas/exceções.

### Testes executados
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npx jest src/modules/comercial` — 11 suites / 62 testes PASS
- `npx jest src/components/contacts src/app/dashboard/contatos` — 6 suites / 33 testes PASS
- GW-01 `login.spec.ts` + `overview.spec.ts` — 9 passed (production-mode, PostgreSQL descartável local)
- GW-02 UI `clinic-selector.spec.ts` — 4 passed
- GW-02 API/GW-03 `tenant-switch.spec.ts` + `gw03-lead-patient-appointment.spec.ts` — 7 passed / 2 skips esperados (9 testes listados)
- `contacts-notes.spec.ts` — 6 passed
- Parser PowerShell — PASS (sem erros); `node --test scripts/__tests__/operator-scripts-hardening.test.mjs` — 38/38 (rodada anterior)
- Teste focado `scripts/__tests__/consume-openbao-staging.test.mjs` — 16/16 (continuação final)
- `npm run test:release` — 451 pass / 1 skip / 0 fail (452 total), incluindo o arquivo novo (continuação final)
- Os testes M1 e E2E acima são PASS histórico e não foram rerodados nesta continuação.

### Pendências externas restantes
- #93: gates D4 de rede/ACL/ledger (A-REDE).
- #94: criação de role de runtime não-superuser em produção (A-PAPEIS).
- **Estado em 2026-11-12:** PR #111 aguardava envio das alterações e CI completa; substituído pelo aditivo de 2026-11-13.
- M4: insumos humanos do piloto (clínica, profissionais, WhatsApp, usuários, janela); estado `PILOT_AWAITING_HUMAN_INPUT`.
- Issue #27: atualização publicada em [comentário de 2026-11-12](https://github.com/kust-projetos/synkroo/issues/27#issuecomment-6831840657); GW-04..GW-09 não iniciados e fora do escopo atual.

### Próxima ação necessária
1. **Ação registrada em 2026-11-12:** commitar/enviar as alterações ao PR #111 e executar CI completa. Estado atualizado no aditivo de 2026-11-13. Para uso do wrapper OpenBao, o operador deve definir `SYNKROO_VPS_ENV` com caminho privado fora do repositório (execução real depende de autorização).
2. Obter autorização A-REDE/A-PAPEIS para #93/#94.
3. Confirmar insumos humanos do piloto ou registrar `PILOT_AWAITING_HUMAN_INPUT` (já registrado).
4. Manter GW-04..GW-09 bloqueados; aguardar autorização e eventual definição de escopo posterior. Não declarar `PROD_READY`.

## Aditivo de fechamento — 2026-11-13

Este aditivo substitui as afirmações acima sobre PR/CI e atualiza o estado com a evidência final. Os resultados históricos continuam identificados como históricos; nada aqui representa validação em produção.

### Evidência final e limites

- PR #111 foi mergeado. O merge commit `ba03efed84ba518d7042795a3bfce6301c5e58a9` é `origin/main` e o SHA exato do CI verde [run 43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701): Secret Scan, Build & Test, Migrations From Zero e CF Build & Dry Run.
- CI: lint/typecheck e typechecks dos workers IA passaram; Jest 3.621 passed / 5 skipped; integração 456 passed; segurança 144 passed; E2E em modo produção 268 passed / 7 skipped. Contagens vêm do job [Build & Test 132131351582](https://github.com/kust-projetos/synkroo/actions/runs/43496593701/job/132131351582) do run [43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701), no SHA exato do merge. Banco PostgreSQL 17 + pgvector descartável. Isso não é evidência de produção.
- Os sete skips são esperados: dois cenários de `tenant-switch.spec.ts` usam fixture admin single-clinic (o `clinic-selector.spec.ts` multi-clinic valida A→B→A→B, sessão/perfil, permissões e isolamento); os outros cinco excluem `/signup` deliberadamente em modo produção conforme ADR-BASE-11. Não são sete bloqueios GW.
- Evidência focal: GW-01 9 passed; UI GW-02 4 passed; API GW-02/GW-03 7 passed / 2 skips esperados. GW-03 verifica persistência/leitura do lead, duplicidade, vínculo do paciente convertido, um único `lead_converted`, replay do agendamento com mesmo ID e leitura do calendário com um agendamento. São testes sintéticos com banco descartável.
- Não há artifacts publicados no run e não há `trace.zip` nem `playwright-report` local. A falha histórica de trace não foi recuperada; não foi reproduzida no run final. A suíte não foi rerodada, conforme escopo.
- Não foi encontrado E2E da jornada de transferência para atendimento humano; não afirmar que a jornada completa do piloto foi validada.
- OpenBao: wrapper mergeado e CI verde; teste focal anterior 16/16 e `npm run test:release` anterior 451 passed / 1 skipped / 0 failed. Validação mockada; sem OpenBao, credenciais, Contabo ou produção reais.
- AppSec: a revisão citada acima ocorreu estaticamente e antes do merge; não foi revisão pós-merge nem live. A CI posterior (run/job acima) é evidência independente, não altera esse escopo.
- Em 13/11 `SYNKROO_VPS_ENV` está ausente; nenhuma conexão/revalidação Contabo foi feita. Para #93, o documento de 12/11 é evidência last-known: conectividade/D3 documentados, mas gates D4 de rede/ACL/TLS/ledger aguardam A-REDE. Para #94, role de runtime `synkroo` superuser em produção e `synkroo_staging_app` em staging são last-known; separação de role/credencial de produção aguarda A-PAPEIS. Não houve mutação nem leitura/alteração de credenciais.
- Insumos humanos do piloto seguem ausentes: `PILOT_AWAITING_HUMAN_INPUT`; sem `PROD_READY`.

### Matriz final

| Marco | Resultado |
|---|---|
| M1 — CI e fixes | PASS — merge em main e CI verde no SHA exato acima |
| M2 — GW-01..03 | PASS sintético — evidência focal e E2E final; skips explicados; sem prova de produção |
| M3 — Operacional | PASS em mock/testes OpenBao; gates Contabo bloqueados por autorização humana, sem revalidação live |
| M4 — Piloto | AWAITING_INPUT — insumos humanos ausentes e sem E2E de transferência para atendimento humano |

### Estado preservado e próximas ações

- A observação local continua em `HEAD=434ebd5a`, dois commits à frente de `origin/main` (`589ad2da`, `434ebd5a`), com `run_watch.txt` e `run_watch2.txt` não rastreados. Foram preservados sem alteração; este aditivo não afirma que esses commits estão no PR/CI.
- Issues #27, #93 e #94 permanecem abertas. #27: não iniciar GW-04..GW-09; definir escopo/autorização futura separadamente. #93: obter autorização A-REDE para concluir D4 e então revalidar. #94: obter A-PAPEIS para planejar/autorizar separação de role e credencial e então revalidar. Para ambos, configurar `SYNKROO_VPS_ENV` com caminho privado antes de qualquer operação autorizada. Piloto: coletar os insumos humanos e validar a jornada de transferência antes de qualquer prontidão.
- Referências: [CI 43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701), [PR #111](https://github.com/kust-projetos/synkroo/pull/111), [#27](https://github.com/kust-projetos/synkroo/issues/27), [#93](https://github.com/kust-projetos/synkroo/issues/93), [#94](https://github.com/kust-projetos/synkroo/issues/94).
