# MISSÃO SYNKROO V1.2 — Análise e plano

**Objetivo:** confrontar o relatório de missão fornecido com o estado observado e registrar um plano verificável M1–M6.
**Data:** 2026-11-18  
**Baseline real:** `origin/main@ba03efed` (CI verde no run [43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701)); branch local `chore/db-central-cutover-20261114` em `0de76e1e`, quatro commits à frente, não enviados.  
**Escopo:** análise e planejamento V1.2. Os resultados do relatório V1.1 são histórico; não constituem validação vigente da V1.2 nem de produção.

## 1. Análise — relatório vs. realidade

| Item do relatório / tema | Estado observado em 2026-11-18 | Evidência | Ação |
|---|---|---|---|
| Baseline | O baseline real informado para a V1.2 é `origin/main@ba03efed`, consistente com o SHA do CI verde. O relatório V1.1 descreve histórico anterior e não substitui esse baseline. | CI [43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701); estado Git coletado pelo Planner. | Manter explícita a distinção entre baseline e commits locais ainda não publicados. |
| PR #112 | Mergeado em `main` em 2026-11-18T23:07:29Z; merge commit `9d037685b9390c8637e155d8bf6233833a26b796`, agora apontado por `origin/main`. | PR #112; CI [44413716643](https://github.com/kust-projetos/synkroo/actions/runs/44413716643). | M1 concluído; registrar o resultado e manter os gates externos pendentes. |
| Migrações 40 vs. 41 | Correção entregue: `EXPECTED_MIGRATIONS` 40→41, fixtures de outbox e documentação de política atualizadas; migration 0041 usa `business_goals` para evitar colisão com a tabela `goals` da 0037/OBSERVE. | CI [44413716643](https://github.com/kust-projetos/synkroo/actions/runs/44413716643); testes de regressão locais. | Concluído no PR #112. |
| Issues #27, #93 e #94 | Atualizadas em 2026-11-18 com evidências; permanecem abertas. #93 e #94 seguem dependentes de A-REDE e A-PAPEIS. | Comentários #27 `6994305402`, #93 `6994305861`, #94 `6994306283`. | Manter abertas; não executar operações produtivas sem autorizações. |
| Piloto | Insumos humanos não disponíveis nesta evidência; status anterior é `PILOT_AWAITING_HUMAN_INPUT`. | Relatório V1.1, aditivo de 13/11; sem novos insumos observados. | Solicitar clínica, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação. |
| WAHA / IA | Há cobertura unitária extensa do inbound WAHA, mas ativação em runtime **A VALIDAR**; não há evidência de WAHA ativo em produção. | `src/app/api/whatsapp/waha/__tests__/route.test.ts` e `route.freshness.test.ts`: HMAC sobre bytes crus fail-closed, instalação resolvida por `session` (não `clinicId` do body), allowlists de evento/remetente, dedup por sessão+message id, redaction, rate-limit, module gate após autenticação e freshness/replay. Testes rotulam endpoint “vNext P3.3, DORMANT”. | Inventariar localmente de forma read-only e com dados sintéticos; confirmar estado runtime por evidência autorizada. Não usar sessão WAHA compartilhada sem autorização/coordenação. |
| Transferência para atendimento humano | Implementação e testes unitários existem; falta validação E2E/integração. Não concluir que a jornada completa foi validada. | `src/core/ia-agent/clinical-safety.ts` trata takeover solicitado, urgência clínica, medicação e diagnóstico; `orchestrator-logic.ts` produz `escalated=true`/`escalationReason`; `webhook-router.ts` responde “Vou encaminhar para um humano.” e retorna `action: 'escalated'`. `conversation_status` inclui `escalated`; preset RBAC inclui `atendimento:escalate`. Relatório V1.1, aditivo 13/11, já registrava ausência de E2E. | Criar/validar cobertura E2E ou integração em ambiente isolado; distinguir implementação/unit de comportamento integrado e runtime. |

### Contexto do PR #112

O PR carrega o trabalho de fechamento V1.1 e inclui alterações de Goal e guard financeiro. A revisão prévia registrada não contém veredito explícito `APPROVED`. O contexto conhecido descreve Goal como CRUD tenant-scoped, feature flag OFF, estados `open/in_progress/done/cancelled` e migração `0041` expand-only com índices; o guard financeiro usa validação fail-closed de status de parcela no caminho de pagamento e testes, além de remover `src/services/installments/installment.service.ts`. Esses pontos não substituem revisão do diff atual.

## 2. Plano M1–M6

| Marco | Objetivos e critérios de aceite | Status | Próxima ação concreta | Dependências |
|---|---|---|---|---|
| **M1 — CI / consolidação** | Corrigir a expectativa de migrações e seu teste/documentação; revisar Goal e guard financeiro; CI verde no SHA candidato. Não mascarar falhas. | **CONCLUÍDO** — PR #112 mergeado; CI final verde, com flake E2E documentado na seção 6. | Nenhuma ação adicional para M1. | Concluído. |
| **M2 — gates de banco/rede** | Inventário read-only e evidência dos gates D3/G1–G3 e cutover D4/G4–G5 requeridos por #93; separação runtime/admin conforme #94. | **BLOQUEADO_EXTERNO** para mudanças e validação que exijam acesso operacional. Inventário read-only local pode prosseguir. | Mapear evidência/documentação disponível sem mutação; não acessar ou alterar firewall, credenciais ou banco produtivo antes das autorizações A-REDE/A-PAPEIS. | A-REDE para rede/cutover; A-PAPEIS para roles/credenciais. Estado atual das roles **A VALIDAR**; não inferir configuração vigente sem consulta autorizada. |
| **M3 — auditoria WAHA / IA** | Auditar localmente WAHA, IA Bridge, RAG, classificação, histórico e transferência, distinguindo implementação/testes unitários de integração e operação real. Usar dados sintéticos. | **A VALIDAR** — testes unitários WAHA cobrem controles relevantes, mas endpoint é descrito como DORMANT; estado runtime não comprovado. Escalonamento humano está implementado e testado unitariamente; integração/runtime a validar. | Fazer inventário read-only dos fluxos e testes existentes. Atenção: sessão WAHA compartilhada não deve ser usada ou alterada sem autorização e coordenação. | Acesso local ao código/configuração; autorização separada para qualquer sessão/serviço real. |
| **M4 — E2E dos fluxos** | Reutilizar E2E existentes, registrar skips e limites; cobrir jornada integrada incluindo transferência humana antes de alegar validação completa. | **A VALIDAR** — há specs para GW-01 a GW-10 e categorias de produto (leads, CRM/contacts, patients, appointments, financeiro, chat-widget, conversations, journey-patient e accessibility). Busca em `e2e/` sem matches para transfer/handoff/atendente/humano. | Reutilizar specs/fixtures existentes e propor teste E2E de transferência em ambiente descartável com dados sintéticos; não confundir teste unitário de escalonamento com E2E. | M3 para mapa de fluxos; ambiente de teste isolado. |
| **M5 — piloto** | Preparação técnica sem alegação de prontidão; coletar insumos humanos e validar jornada operacional. | **BLOQUEADO** por insumos humanos ausentes; estado registrado `PILOT_AWAITING_HUMAN_INPUT`. | Obter clínica participante, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação; manter status até confirmação. | Decisões/insumos do responsável pelo piloto; evidência E2E adequada. |
| **M6 — fechamento documental** | Atualizar relatório e rastreabilidade de issues/PRs com resultados verificados, limites e próximos passos. | **ATUALIZADO PARCIALMENTE** — relatório e issues #27/#93/#94 atualizados; PR #112 mergeado. | Preservar os estados pendentes e limites de prontidão registrados na seção 6. | M2–M5 e gates externos continuam pendentes. |

## 3. Bloqueios e autorizações necessárias

| Bloqueio / autorização | Escopo | Estado e limite |
|---|---|---|
| **A-REDE** | Provas de contenção de rede D3/G1–G3 e cutover D4/G4–G5 para #93. | Pendente. Sem autorização operacional, nenhuma alteração de firewall, credencial, deploy ou banco produtivo. |
| **A-PAPEIS** | Separação de credenciais/roles runtime e admin para #94; runtime não-superuser e `NOBYPASSRLS` são requisitos a verificar. | Pendente. Não afirmar role atual sem consulta autorizada ao servidor; nenhuma criação/alteração de role ou credencial sem autorização. |
| **Insumos do piloto** | Clínica, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação. | Não observados; M5 permanece `PILOT_AWAITING_HUMAN_INPUT`. |
| **GitHub — issues** | Atualizar #27, #93 e #94 com evidência; manter #93/#94 abertas enquanto A-REDE/A-PAPEIS estiverem pendentes. | Atualizações autorizadas e publicadas em 2026-11-18: #27 comentário `6994305402`, #93 `6994305861`, #94 `6994306283`. A-REDE e A-PAPEIS permanecem pendentes; issues continuam abertas. |
| **GitHub — PR #112** | Merge do PR após os gates definidos. | PR #112 mergeado em 2026-11-18T23:07:29Z, commit `9d037685b9390c8637e155d8bf6233833a26b796`; CI final verde no run `44413716643`. Isto não autoriza operação produtiva. |

**Recomendação ao Planner:** atualizações GitHub autorizadas foram realizadas após CI verde e revisão. Manter separados A-REDE, A-PAPEIS e insumos do piloto; autorização GitHub não autoriza operação produtiva.

## 4. Decisões e preservação

1. Preservar os quatro commits locais (`589ad2da`, `434ebd5a`, `415c6fd3`, `0de76e1e`); não descartar nem presumir que todos estejam no PR.
2. Não excluir worktrees. Há worktrees obsoletos marcados `prunable` em `%TEMP%/opencode` e `D:/AppDataMirror/...`, além de um worktree `locked` (`synkroo-wt-outbox`). Apenas inventariar; limpeza futura exige verificação e autorização apropriada.
3. Preservar `run_watch.txt` e `run_watch2.txt`, não rastreados na raiz.
4. Nunca force-push; não alterar histórico remoto como atalho.
5. Não declarar `PROD_READY`: há gates externos pendentes e insumos do piloto ausentes.
6. Não mascarar testes, skips, falhas de CI ou diferenças entre execução sintética e produção.
7. Manter a análise V1.2 separada do relatório histórico V1.1 de `docs/ops/synkroo-v1.1-mission-report-2026-11-12.md` e seu aditivo de 13/11.

## 5. Próximos passos imediatos

1. M1 concluído no PR #112; consultar a seção 6 para validação, revisão e CI.
2. PR #112 mergeado; manter documentados os limites e os gates ainda pendentes.
3. Prosseguir apenas com inventários locais read-only de M2/M3 e dados sintéticos; manter operações reais bloqueadas pelas autorizações correspondentes.
4. Mapear os E2E existentes e a lacuna de transferência humana antes de qualquer conclusão sobre cobertura do piloto.
5. Solicitar insumos humanos para M5; executar atualizações autorizadas após CI verde e revisão; A-REDE/A-PAPEIS seguem pendentes.

## 6. Resultado da execução (2026-11-18)

### Marcos

- **M1 — CONCLUÍDO:** PR #112 mergeado em `main` em 2026-11-18T23:07:29Z, merge commit `9d037685b9390c8637e155d8bf6233833a26b796`; `origin/main` aponta para esse SHA.
- **M6 — atualizado:** este documento e as issues #27, #93 e #94 receberam as atualizações autorizadas. #93 e #94 permanecem abertas, com A-REDE e A-PAPEIS pendentes; #27 permanece aberta pela lacuna de E2E e WAHA runtime A VALIDAR.
- **M2, M4, M5 e gates externos:** permanecem nos estados já documentados. Não houve autorização para operação produtiva; insumos do piloto continuam ausentes e a transferência humana não tem E2E validado.

### Correções entregues

1. `EXPECTED_MIGRATIONS` alterado de 40 para 41, fixtures do outbox atualizadas e `docs/audit/migrations-policy.md` ajustado.
2. Goal recebeu validação fail-closed de status/título, tipagem Drizzle, `metadata` `notNull` e comentários precisos.
3. Migration 0041 renomeada para `business_goals` para evitar colisão com `goals` da 0037/OBSERVE, com teste estático de regressão.
4. Correção de lint em `GoalRow` (interface vazia substituída por alias de tipo).
5. `jest.security.config.js` passou a incluir o teste existente do guard financeiro, sem reduzir thresholds; cobertura final: branches 91,66% / functions 83,33%. O guard financeiro já era código morto no legado; não houve perda de comportamento produtivo.

Revisão independente do PR retornou `CHANGES_REQUIRED` com cinco achados verificados; todos foram endereçados ou aceitos com justificativa documentada.

### Validação

- CI final verde: [run 44413716643](https://github.com/kust-projetos/synkroo/actions/runs/44413716643). Secret Scan (Gitleaks): pass, 8s; Migrations From Zero: pass, 1m30s; Build & Test: pass, 10m32s (lint, `npx tsc --noEmit`, typecheck:ia-bridge, typecheck:ia-agent, 404 suites Jest/3.624 testes, integração 456, segurança 155, release, build Next.js e seed); CF Build & Dry Run: pass, 3m3s.
- Na primeira execução do run, `e2e/crm/lgpd-consent.spec.ts` falhou em `expect.toHaveURL(/contact=/)` e permaneceu em `/dashboard/contatos` (267 passed/7 skipped). O rerun do mesmo job via `gh run rerun 44413716643 --failed` passou integralmente sem mudança de código: flake confirmado, **não corrigido**.
- Validação local: `npm run lint`, `npm run typecheck`, `npm test -- --runInBand` (404 suites / 3.624 passed / 5 skipped / 0 failed), `node --test scripts/__tests__/outbox-control-repair.test.mjs` (13/13) e `node --test scripts/__tests__/goals-table-collision.test.mjs` (1/1).

### Rastreabilidade e prontidão

Issues atualizadas em 2026-11-18: #27 comentário `6994305402`, #93 `6994305861`, #94 `6994306283`. Permanecem abertas. A-REDE e A-PAPEIS continuam pendentes e não autorizam operação produtiva.

**Avaliação:** M1 está concluído, mas a V1.2 não está pronta para produção. M2/M4/M5 e gates externos permanecem pendentes; WAHA runtime segue A VALIDAR, não há E2E de transferência humana e o flake acima não foi corrigido. Não declarar `PROD_READY`.
