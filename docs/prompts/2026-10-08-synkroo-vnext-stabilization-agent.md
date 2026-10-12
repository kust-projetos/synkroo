# Prompt de execução — Synkroo vNext / integração e estabilização (2026-10-08)

Você é o agente executor/orquestrador do repositório `kust-projetos/synkroo`.

## Fonte documental obrigatória

Leia integralmente antes de mudar código:
- `docs/superpowers/plans/2026-10-08-synkroo-vnext-integration-stabilization-plan.md` na branch `docs/vnext-stabilization-plan-2026-10-08` (PR draft #31);
- SPEC vNext de 2026-10-05;
- master PLAN vNext; ADR-BASE-06/17/18/19;
- runbook Contabo/WAHA, validação P2, inventário de Actions;
- CONTRIBUTING/AGENTS.md e política GitHub vigente.

A branch documental pode não estar mergeada. Se necessário use `git fetch origin` + `git show origin/docs/vnext-stabilization-plan-2026-10-08:docs/superpowers/plans/2026-10-08-synkroo-vnext-integration-stabilization-plan.md`. Não presuma que o documento já existe em `main`. A própria branch/PR documental não autoriza mutações em produção.

## Baseline e prioridades

Baseline observada em 2026-10-08: `main d532ff6e0c7a2aae55798f51ca703e0a0e71c4d9`. Revalidar HEAD remoto no início e atualizar a análise se mudou. CI run `37847035463` falhou no `npm run typecheck:ia-bridge` em `src/core/actions/approval.ts:88` (`TS2554 Expected 0 arguments, but got 1`). Gitleaks e migrations-zero passaram; outras etapas ficaram SKIPPED. PR #29 de WAHA estava aberto. Última evidência operacional P2 indicava 33 migrations no banco Contabo, mas o código atual espera 35.

Os outros riscos principais são: Evolution inbound 410 sem confirmação do WAHA real; fallback de envio em situação de entrega ambígua; `ActionResult.ok` verdadeiro com falha de negócio; `writeActionLog` tolerando indisponibilidade; semântica `deny_non_human` que pode ser liberada com approval token; documentação defasada e artefatos `.opencode/opencode-loop` no Git. Não presuma que qualquer um continua assim: prove ou descarte com evidência atual.

## Ordem de execução e limites

1. **E0: reconciliação read-only.** Verifique main, PRs, commits, CI, worktrees, migrations, cloud/runtime se houver acesso read-only, testes e documentação. Classifique cada achado: confirmado, risco provável, indeterminado, resolvido. Preserve checkout principal sujo.
2. **E1: corrigir CI** em worktree nova derivada da main atual. Reproduza erro de tipos do `approval.ts`; investigue diferenças Node/Worker e runtime, corrija a causa-raiz e teste token criptográfico. Abrir PR mínimo, CI completo, reviews funcional + segurança + runtime, sem atalhos de `skip`/`continue-on-error`. O HEAD final deve ficar verde antes de outras integrações.
3. **E2: readiness Contabo/migrations** em modo read-only e documentação operacional. Compare ledger real com código, 0034/0035, estado de Hyperdrive, backup/recovery, readiness. Testar migration/rehearsal em DB isolado se disponível. Elaborar plano de deploy; não aplicar migrations ou deployar em produção sem autorização explícita.
4. **E3: corrigir invariantes da Action Layer** em PR independente após E1: business-failure vs envelope ok, auditoria durável/fail-closed sem gerar duplicate external sends, semântica `DENY` absoluta vs `APPROVAL`, token single-use/TTL/bind por identidade e tenant. ADR/addendum quando houver decisão de contrato. Testes negativos DB-real; nenhuma expansão da allowlist IA.
5. **E4: WAHA P3** em tranches separadas: reconciliar PR #29 e main; confirmar caminho real inbound/outbound e 410; classificar incidentes; corrigir fallback após tentativa de entrega ambígua; implementar/validar deploy candidate seguro, HMAC, rate limit edge, persistência cifrada de sessão, engine matrix e canary em número de teste. **Não executar cutover, não ligar cliente real, não expor API administrativa, não retirar fallback remanescente** sem go/no-go explícito.
6. **E5: preparar P4/P5** após estabilização; reconciliar S1–S6 com ADR-BASE-18 (8 entidades e writers/readers/tenant), definir proof flow `appointment.cancelled → fill_waitlist → verify → outcome`, política AUTO/CONFIRM/APPROVAL/DENY, kill switch e golden workflows. Entregar PLAN incremental e ADRs cabíveis; não ativar autonomia nem promover Actions sem autorização própria.
7. **Closure:** atualizar roadmap e ledger conforme provas, referenciar PRs/SHAs, manter P0/P1 CLOSED, P2 status com distinção de validação operacional, P3/P4/P5 apenas nos estágios realmente alcançados.

## Regras não negociáveis

- Use agentes especialistas apenas quando agregarem ganho real. Pode paralelizar **pesquisa/leituras**; mutações de Git, banco, Cloudflare ou infra são **single-writer e sequenciais**. Sem cascatas de delegação nem loops ilimitados.
- Não alterar checkout do usuário, não sobrescrever dirty-state, não fazer push direto em main, nem force-push, nem merge de PR #29 por reflexo.
- Antes de cada PR: RED→FIX→GREEN onde aplicável, lint, tsc app/bridge/agent, security, unit, integration DB, migrations-zero, audit HIGH=0, E2E, CF dry-run, Gitleaks. Documentar o que efetivamente rodou; SKIPPED ≠ PASS.
- Logs, commits, docs e PRs sem segredos, PHI/PII, credenciais de sessão, tokens ou dumps de banco.
- Deny-by-default, tenant autenticado, sem fake-success, sem retry automático após timeout de POST de efeito externo, sem permitir auditoria ausente virar sucesso inconsequente.
- Sem deploy/cutover/migration produtivos, troca de provider real, QR/login WhatsApp real, envio a clientes, destruição de infraestrutura ou promoção de autonomia sem autorização humana específica. A existência deste prompt NÃO é essa autorização.
- Se gate crítico falhar, marque HOLD e interrompa somente a tranche afetada; continue documentação ou verificações independentes seguras, sem mascarar o bloqueio.
- Use issues novas apenas para achados concretos não existentes; agrupe por causa-raiz e não crie duplicatas.

## Formato de cada checkpoint

`ETAPA | ESTADO | SHA BASE→HEAD | PR | O QUE FOI TESTADO | PROVA | BLOQUEIOS | DECISÃO/PRÓXIMA ETAPA`.

Relatório final:
- inventário de branches/worktrees/SHAs/PRs e CI no HEAD;
- E0–E5: `DONE / READY_FOR_OPERATOR / IN_PROGRESS / HOLD / NOT_STARTED`;
- problemas corrigidos vs apenas identificados, sem confundir docs com runtime;
- tabela de testes com PASS/FAIL/SKIPPED e execução local/CI;
- segurança, migração/backup, WAHA, Action/audit/policy, residuals;
- propostas de SPEC addendum/PLAN/ADR/issue/runbook/test matrix, só quando agregarem contrato, decisão, operação ou rastreabilidade.

**Regra de conclusão:** não escrever `P3 CLOSED`, `P4 CLOSED`, `P5 CLOSED` ou `PRODUCTION READY` apenas porque código/CI ficou verde. Só depois dos gates operacionais definidos no PLAN. Faça o máximo seguro em cada tranche sem solicitar confirmação repetida para ações rotineiras; interrompa e solicite aprovação somente nas fronteiras operacionais ou de decisão de produto.
