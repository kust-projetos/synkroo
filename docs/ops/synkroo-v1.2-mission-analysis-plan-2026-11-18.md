# MISSÃO SYNKROO V1.2 — Análise e plano

**Objetivo:** confrontar o relatório de missão fornecido com o estado observado e registrar um plano verificável M1–M6.
**Data:** 2026-11-18  
**Baseline real:** `origin/main@ba03efed` (CI verde no run [43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701)); branch local `chore/db-central-cutover-20261114` em `0de76e1e`, quatro commits à frente, não enviados.  
**Escopo:** análise e planejamento V1.2. Os resultados do relatório V1.1 são histórico; não constituem validação vigente da V1.2 nem de produção.

## 1. Análise — relatório vs. realidade

| Item do relatório / tema | Estado observado em 2026-11-18 | Evidência | Ação |
|---|---|---|---|
| Baseline | O baseline real informado para a V1.2 é `origin/main@ba03efed`, consistente com o SHA do CI verde. O relatório V1.1 descreve histórico anterior e não substitui esse baseline. | CI [43496593701](https://github.com/kust-projetos/synkroo/actions/runs/43496593701); estado Git coletado pelo Planner. | Manter explícita a distinção entre baseline e commits locais ainda não publicados. |
| PR #112 | Aberto, base `main`, head `415c6fd3`, três commits e nove arquivos; `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED`, sem decisão de review registrada. CI falhou em um teste de health. O commit local `0de76e1e` não está no PR. | PR #112 e run CI `43589458933`, conforme evidência coletada pelo Planner. | Concluir correção de contagem em execução, revisar alterações Goal/financeiro e validar CI antes de qualquer decisão de merge. |
| Migrações 40 vs. 41 | Causa raiz confirmada: journal contém 41 entradas (incluindo `0041_goals`), mas o teste espera `EXPECTED_MIGRATIONS=40`. | `src/services/api-handlers/health/db.ts:12`; falha `src/__tests__/api/health/route.test.ts:70` no run `43589458933`. | Correção + teste + documentação estão **em execução** por outro worker; não considerar concluídos até evidência final. |
| Issues #27, #93 e #94 | Todas abertas; última atualização observada em 13/11. | GitHub issues #27, #93 e #94, conforme consulta do Planner. | Não publicar atualizações sem autorização explícita; manter os gates externos abaixo. |
| Piloto | Insumos humanos não disponíveis nesta evidência; status anterior é `PILOT_AWAITING_HUMAN_INPUT`. | Relatório V1.1, aditivo de 13/11; sem novos insumos observados. | Solicitar clínica, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação. |
| WAHA / IA | Há cobertura unitária extensa do inbound WAHA, mas ativação em runtime **A VALIDAR**; não há evidência de WAHA ativo em produção. | `src/app/api/whatsapp/waha/__tests__/route.test.ts` e `route.freshness.test.ts`: HMAC sobre bytes crus fail-closed, instalação resolvida por `session` (não `clinicId` do body), allowlists de evento/remetente, dedup por sessão+message id, redaction, rate-limit, module gate após autenticação e freshness/replay. Testes rotulam endpoint “vNext P3.3, DORMANT”. | Inventariar localmente de forma read-only e com dados sintéticos; confirmar estado runtime por evidência autorizada. Não usar sessão WAHA compartilhada sem autorização/coordenação. |
| Transferência para atendimento humano | Implementação e testes unitários existem; falta validação E2E/integração. Não concluir que a jornada completa foi validada. | `src/core/ia-agent/clinical-safety.ts` trata takeover solicitado, urgência clínica, medicação e diagnóstico; `orchestrator-logic.ts` produz `escalated=true`/`escalationReason`; `webhook-router.ts` responde “Vou encaminhar para um humano.” e retorna `action: 'escalated'`. `conversation_status` inclui `escalated`; preset RBAC inclui `atendimento:escalate`. Relatório V1.1, aditivo 13/11, já registrava ausência de E2E. | Criar/validar cobertura E2E ou integração em ambiente isolado; distinguir implementação/unit de comportamento integrado e runtime. |

### Contexto do PR #112

O PR carrega o trabalho de fechamento V1.1 e inclui alterações de Goal e guard financeiro. A revisão prévia registrada não contém veredito explícito `APPROVED`. O contexto conhecido descreve Goal como CRUD tenant-scoped, feature flag OFF, estados `open/in_progress/done/cancelled` e migração `0041` expand-only com índices; o guard financeiro usa validação fail-closed de status de parcela no caminho de pagamento e testes, além de remover `src/services/installments/installment.service.ts`. Esses pontos não substituem revisão do diff atual.

## 2. Plano M1–M6

| Marco | Objetivos e critérios de aceite | Status | Próxima ação concreta | Dependências |
|---|---|---|---|---|
| **M1 — CI / consolidação** | Corrigir a expectativa de migrações e seu teste/documentação; revisar Goal e guard financeiro; CI verde no SHA candidato. Não mascarar falhas. | **EM EXECUÇÃO** — correção de contagem por worker separado. | Aguardar resultado da correção; revisar diff e executar testes focados/CI aplicável; confirmar que o SHA validado corresponde ao conteúdo pretendido. | Conclusão do worker; review do PR #112; CI verde. |
| **M2 — gates de banco/rede** | Inventário read-only e evidência dos gates D3/G1–G3 e cutover D4/G4–G5 requeridos por #93; separação runtime/admin conforme #94. | **BLOQUEADO_EXTERNO** para mudanças e validação que exijam acesso operacional. Inventário read-only local pode prosseguir. | Mapear evidência/documentação disponível sem mutação; não acessar ou alterar firewall, credenciais ou banco produtivo antes das autorizações A-REDE/A-PAPEIS. | A-REDE para rede/cutover; A-PAPEIS para roles/credenciais. Estado atual das roles **A VALIDAR**; não inferir configuração vigente sem consulta autorizada. |
| **M3 — auditoria WAHA / IA** | Auditar localmente WAHA, IA Bridge, RAG, classificação, histórico e transferência, distinguindo implementação/testes unitários de integração e operação real. Usar dados sintéticos. | **A VALIDAR** — testes unitários WAHA cobrem controles relevantes, mas endpoint é descrito como DORMANT; estado runtime não comprovado. Escalonamento humano está implementado e testado unitariamente; integração/runtime a validar. | Fazer inventário read-only dos fluxos e testes existentes. Atenção: sessão WAHA compartilhada não deve ser usada ou alterada sem autorização e coordenação. | Acesso local ao código/configuração; autorização separada para qualquer sessão/serviço real. |
| **M4 — E2E dos fluxos** | Reutilizar E2E existentes, registrar skips e limites; cobrir jornada integrada incluindo transferência humana antes de alegar validação completa. | **A VALIDAR** — há specs para GW-01 a GW-10 e categorias de produto (leads, CRM/contacts, patients, appointments, financeiro, chat-widget, conversations, journey-patient e accessibility). Busca em `e2e/` sem matches para transfer/handoff/atendente/humano. | Reutilizar specs/fixtures existentes e propor teste E2E de transferência em ambiente descartável com dados sintéticos; não confundir teste unitário de escalonamento com E2E. | M3 para mapa de fluxos; ambiente de teste isolado. |
| **M5 — piloto** | Preparação técnica sem alegação de prontidão; coletar insumos humanos e validar jornada operacional. | **BLOQUEADO** por insumos humanos ausentes; estado registrado `PILOT_AWAITING_HUMAN_INPUT`. | Obter clínica participante, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação; manter status até confirmação. | Decisões/insumos do responsável pelo piloto; evidência E2E adequada. |
| **M6 — fechamento documental** | Atualizar relatório e rastreabilidade de issues/PRs com resultados verificados, limites e próximos passos. | **A VALIDAR**; escrita externa autorizada condicionalmente. | Após CI verde e revisão concluída, atualizar #27 com o estado real; atualizar #93/#94 com evidências e mantê-las abertas enquanto A-REDE/A-PAPEIS permanecerem pendentes; mergear PR #112 somente sob a mesma condição. | Resultados M1–M5; CI verde e revisão de código concluída. A-REDE/A-PAPEIS não autorizados. |

## 3. Bloqueios e autorizações necessárias

| Bloqueio / autorização | Escopo | Estado e limite |
|---|---|---|
| **A-REDE** | Provas de contenção de rede D3/G1–G3 e cutover D4/G4–G5 para #93. | Pendente. Sem autorização operacional, nenhuma alteração de firewall, credencial, deploy ou banco produtivo. |
| **A-PAPEIS** | Separação de credenciais/roles runtime e admin para #94; runtime não-superuser e `NOBYPASSRLS` são requisitos a verificar. | Pendente. Não afirmar role atual sem consulta autorizada ao servidor; nenhuma criação/alteração de role ou credencial sem autorização. |
| **Insumos do piloto** | Clínica, profissionais/agenda, WhatsApp autorizado, usuários responsáveis e janela de operação. | Não observados; M5 permanece `PILOT_AWAITING_HUMAN_INPUT`. |
| **GitHub — issues** | Atualizar #27, #93 e #94 com evidência; manter #93/#94 abertas enquanto A-REDE/A-PAPEIS estiverem pendentes. | **AUTORIZADO em 2026-11-18, condicionado a CI verde e revisão.** A-REDE e A-PAPEIS permanecem PENDENTES e NÃO foram autorizados; não fechar #93/#94. #27 deve refletir o estado real. |
| **GitHub — PR #112** | Merge do PR após os gates definidos. | **AUTORIZADO em 2026-11-18, condicionado a CI verde e revisão.** PR aberto, CI observado falhando por contagem; correção está em execução, não concluída. Esta autorização não autoriza operação produtiva. |

**Recomendação ao Planner:** executar as atualizações GitHub autorizadas somente após CI verde e revisão concluída. Manter separadas A-REDE, A-PAPEIS, insumos do piloto e autorização GitHub; a autorização GitHub não autoriza operação produtiva.

## 4. Decisões e preservação

1. Preservar os quatro commits locais (`589ad2da`, `434ebd5a`, `415c6fd3`, `0de76e1e`); não descartar nem presumir que todos estejam no PR.
2. Não excluir worktrees. Há worktrees obsoletos marcados `prunable` em `%TEMP%/opencode` e `D:/AppDataMirror/...`, além de um worktree `locked` (`synkroo-wt-outbox`). Apenas inventariar; limpeza futura exige verificação e autorização apropriada.
3. Preservar `run_watch.txt` e `run_watch2.txt`, não rastreados na raiz.
4. Nunca force-push; não alterar histórico remoto como atalho.
5. Não declarar `PROD_READY`: há gates externos pendentes e insumos do piloto ausentes.
6. Não mascarar testes, skips, falhas de CI ou diferenças entre execução sintética e produção.
7. Manter a análise V1.2 separada do relatório histórico V1.1 de `docs/ops/synkroo-v1.1-mission-report-2026-11-12.md` e seu aditivo de 13/11.

## 5. Próximos passos imediatos

1. Aguardar a correção M1 de migrações em execução e validar o diff, teste de health e CI no SHA exato.
2. Revisar Goal e guard financeiro no PR #112; registrar resultado sem presumir aprovação.
3. Prosseguir apenas com inventários locais read-only de M2/M3 e dados sintéticos; manter operações reais bloqueadas pelas autorizações correspondentes.
4. Mapear os E2E existentes e a lacuna de transferência humana antes de qualquer conclusão sobre cobertura do piloto.
5. Solicitar insumos humanos para M5; executar atualizações autorizadas após CI verde e revisão; A-REDE/A-PAPEIS seguem pendentes.
