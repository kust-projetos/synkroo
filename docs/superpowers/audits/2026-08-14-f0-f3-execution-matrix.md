# Matriz de execução F0–F3 — Synkroo

**Data:** 2026-08-14  
**Base:** `main` em `11fe3f32909e3f58544c0b8d287ee88c5b8e31f0`  
**Roadmap:** `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md`  
**Gate disponível:** `docs/superpowers/audits/2026-08-14-final-gate-results.json`

## Legenda

- **VERIFIED:** há evidência nominal suficiente no estado atual.
- **PARTIAL:** existe implementação ou cobertura relacionada, mas falta provar o requisito completo.
- **OPEN:** não há evidência suficiente; requer trabalho local.
- **EXTERNAL:** depende de credenciais, provider, GitHub/Cloudflare ou ação do owner; não foi executado.
- **DEFERRED:** não se aplica ao estado atual ou foi deslocado para outro workstream, com justificativa.

> Nenhum segredo foi lido, registrado ou rotacionado nesta matriz. Nenhuma ação de produção foi executada.

## F0 — Conter incidente de secrets

| ID | Requisito | Status | Evidência atual | Lacuna / próximo passo |
|---|---|---|---|---|
| F0.01 | Congelar release, merge, push e novos clones | DEFERRED | O trabalho local foi mantido sem push; o commit de remediação já ocorreu | Definir com o owner se o freeze operacional ainda deve ser aplicado antes da rotação |
| F0.02 | Preservar evidência e backup sem registrar valores | PARTIAL | Evidências versionadas em `docs/superpowers/audits/evidence/74d5ac78/` e gate JSON | Confirmar backup/retention fora do repositório sem incluir secrets |
| F0.03 | Inventariar `.gitleaksignore` por fingerprint | PARTIAL | `.gitleaksignore` tem 83 entradas não-comentário (71 históricas, 12 worktree); `docs/security/credential-inventory.md` existe | Classificar cada suppression e anexar scan completo; full-history Gitleaks local excedeu 180s |
| F0.04 | Revogar/rotacionar secrets de GitHub, Cloudflare, DB, LLM, Evolution, Asaas e auth | EXTERNAL | Nenhuma rotação executada | Owner deve fornecer acesso/autorizar rotação por provider; executar somente em staging/contas autorizadas |
| F0.05 | Verificar forks, Actions logs, artifacts e caches | EXTERNAL | Não há evidência nominal | Auditar GitHub com credencial nova e registrar somente resultado/fingerprint |
| F0.06 | Restaurar `gh auth` com credencial nova | EXTERNAL | Não executado | Após rotação, autenticar novamente e registrar somente `gh auth status` sanitizado |
| F0.07 | Sanear histórico e invalidar clones antigos | EXTERNAL | Não executado | Exige plano coordenado, autorização explícita e comunicação aos consumidores do repositório |
| F0.08 | Reduzir suppressions a fixtures falsas comprovadas | PARTIAL | Inventory document exists and `.gitleaksignore` comments state confirmed suppressions were removed; 83 entries still require classification evidence | Reconcile each of the 83 entries with `docs/security/credential-inventory.md`; do not remove entries by inference |
| F0.09 | Adicionar Gitleaks em pre-commit e CI sobre tree e histórico | PARTIAL | Hook Gitleaks executou no commit `11fe3f32`; workflow `.github/workflows/gitleaks-scheduled.yml` faz full-history semanal; execução local full-history excedeu 180s | Confirmar workflow de PR/push e anexar artifact de scan histórico concluído |
| F0.10 | Registrar owner, rotação e evidência sem valor de credencial | EXTERNAL | Não há ledger de rotação neste repositório | Criar ledger sanitizado após F0.04–F0.06 |

## F1 — Estabilizar Git e baseline

| ID | Requisito | Status | Evidência atual | Lacuna / próximo passo |
|---|---|---|---|---|
| F1.01 | Consultar/revisar PR #6 com credencial rotacionada | EXTERNAL | Não há evidência de PR #6 neste gate | Revisar no GitHub após F0 |
| F1.02 | Confirmar commits de RBAC, CRM, Financeiro, cron e migration journal | OPEN | Histórico contém commits de remediação, sem checklist nominal de PR #6 | Mapear cada commit esperado ao tree atual |
| F1.03 | Mergear PR aprovado ou recriar PR sem alterar conteúdo | DEFERRED | `main` já contém o pacote atual em `11fe3f32` | Encerrar como N/A somente após revisão de PR #6 |
| F1.04 | Rebasear branch de execução sobre `main` atualizado | DEFERRED | Execução atual ocorreu diretamente em `main` | Não criar branch/rebase retroativo; registrar decisão |
| F1.05 | Preservar `AGENTS.md` | VERIFIED | `AGENTS.md` não aparece no commit de remediação | Manter proteção contra sobrescrita em futuras alterações |
| F1.06 | Rodar lint, typecheck, unit, integration e builds | VERIFIED | Gate: lint, typecheck, unit, PostgreSQL integration, build:cf, dry-run e startup passaram | Repetir apenas quando F0–F3 alterar código |
| F1.07 | Criar baseline machine-readable de gates e coverage | VERIFIED | `docs/superpowers/audits/2026-08-14-final-gate-results.json` | Atualizar somente quando a matriz receber novo ciclo de evidência |
| F1.08 | Remover DB real de arquivo nomeado como teste | PARTIAL | `node --test scripts/__tests__/integration-run.test.mjs` passou 43/43; `scripts/integration-run.mjs` exige `TEST_DATABASE_URL` loopback `/synkroo_test` e não encaminha essa variável | Auditar os demais testes nomeados (`ci-workflow`, repository mutation, scale seed) para provar que nenhum executa DB real indevidamente |

## F2 — Fechar P0 de autorização/LGPD

| ID | Requisito | Status | Evidência atual | Lacuna / próximo passo |
|---|---|---|---|---|
| F2.01 | Remover JWT artesanal e exigir NextAuth + `AUTH_SECRET` | PARTIAL | `src/lib/auth/__tests__/session.revocation.test.ts` passou; security suite 9/142 passou; `src/lib/env.ts` e middleware referenciam `AUTH_SECRET` | Anexar scan de rotas/auth sem caminho JWT paralelo |
| F2.02 | Desabilitar signup em produção | OPEN | Não há evidência específica no gate | Verificar middleware/config de produção; não alterar produção sem autorização |
| F2.03 | Testar `input.clinicId != ctx.clinicId` em Core Actions | PARTIAL | Security suite 142/142 e architecture boundary 14/14 passaram | Exigir teste nominal por Action |
| F2.04 | Remover scope de clínica controlável ou falhar fechado | PARTIAL | Architecture boundary 14/14 e staging tenant smoke passaram | Anexar inventário de payloads e asserts fail-closed |
| F2.05 | Validar role/user/entidade na mesma clínica | PARTIAL | Security suite 9/9, tenant smoke e boundary tests passaram | Expandir para matriz de entidades e roles |
| F2.06 | Derivar clínica do credential de canal no webhook | PARTIAL | Invalid webhook smoke passou; security suite passou | Provar binding de credential→clinic em teste de integração |
| F2.07 | Bloquear treatment item cross-plan/cross-clinic e POST repetido | PARTIAL | Integration 33/33 suites e security 142/142 passaram | Anexar teste nominal de ownership e idempotência |
| F2.08 | Update tenant-scoped, atômico e idempotente com concorrência | PARTIAL | Integration 33/33 suites passou; testes direcionados locais passaram | Executar/registrar race test específico por endpoint |
| F2.09 | Revogar acesso de usuário desativado com JWT válido | OPEN | Não há evidência nominal | Criar teste RED/GREEN de sessão revogada |
| F2.10 | Adicionar session version/revocation | OPEN | Não há evidência nominal no gate | Confirmar implementação e cobrir middleware/contexto |
| F2.11 | Revogar após logout, senha, role e access change | OPEN | Não há evidência nominal | Criar matriz de eventos de revogação |
| F2.12 | Audit payload allowlist sem PII top-level/aninhada | PARTIAL | Security suite passou | Anexar scan/assertions de payload aninhado |
| F2.13 | Corrigir webhook Asaas em transação única | OPEN | Não há evidência Asaas no gate | Validar em sandbox quando credencial/provider estiver autorizado |
| F2.14 | Hyperdrive na IA bridge e tool DB-backed fail-closed | PARTIAL | Build/startup/runtime staging passaram | Anexar smoke específico da tool DB-backed |
| F2.15 | Inventariar paths públicos exatos | PARTIAL | Route protection e invalid webhook smoke passaram | Produzir inventário versionado de paths e allowlists |
| F2.16 | Validar Origin/CSRF em ações/APIs cookie-authenticated | OPEN | Não há evidência nominal | Criar testes de Origin/CSRF para superfícies sensíveis |
| F2.17 | Sanitizar `redirectTo` para path interno | OPEN | Não há evidência nominal | Criar teste de redirect externo e implementação fail-closed se necessário |
| F2.18 | Corrigir agent permission fallback para `[]` | OPEN | Não há evidência nominal | Confirmar símbolo/callers e adicionar teste de fallback |
| F2.19 | Stryker focado auth/RBAC/Actions/audit >=70% | PARTIAL | Stryker services: 91,98%, 212 mutantes | Rodar target focado nas áreas F2 e anexar artifact específico |

## F3 — Fundação auth/env/DB/CI

| ID | Requisito | Status | Evidência atual | Lacuna / próximo passo |
|---|---|---|---|---|
| F3.01 | E-mail normalizado unique por instância | PARTIAL | `src/lib/db/schema/core.ts` declara `users_clinic_email_uniq`; typecheck passou | Confirmar migration aplicada e adicionar integration test de duplicidade/normalização |
| F3.02 | Env schema separado para app, bridge, agent e sidecar | OPEN | `src/lib/env.ts` cobre env da app; não há matriz completa por runtime | Inventariar env por runtime e validar fail-fast |
| F3.03 | Validar secrets obrigatórios no startup/smoke | PARTIAL | `npm run typecheck` passou e startup check do gate passou; `AUTH_SECRET`/`DATABASE_URL` aparecem na validação | Cobrir ausência de cada secret sem expor valor |
| F3.04 | Corrigir constraints Drizzle e deduplicar antes da migration | OPEN | Não há artifact de catálogo/preflight neste gate | Gerar preflight read-only e revisar migrations |
| F3.05 | Índices tenant/date/status/FK guiados por query | OPEN | Não há evidência de análise de índices | Produzir inventário query→index e migration somente após revisão |
| F3.06 | Garantir extensões `vector` e `btree_gist` | OPEN | Não há evidência nominal | Check em DB de integração e migration/preflight |
| F3.07 | CLI RBAC pura, `--dry-run` default e `--apply` explícito | OPEN | Não há evidência nominal | Auditar CLI e adicionar testes de flags |
| F3.08 | Cloudflare Queues, outbox, retry, idempotência e DLQ | PARTIAL | Roadmap registra consumer de outbox; gate não prova DLQ completo | Anexar teste de retry/DLQ e runtime evidence |
| F3.09 | Lint boundaries sem side-effect imports cruzados | PARTIAL | Architecture boundary: 14 testes passaram | Promover warnings relevantes a erros e provar CI |
| F3.10 | Alinhar versões Jest/jsdom | OPEN | Unit tests passam, mas não há auditoria de versões | Verificar package lock e compatibilidade major |
| F3.11 | Reparar E2E: auth obrigatório, sem catches/tautologias/skips | PARTIAL | Staging smoke 10/10 passou | Auditar todos os specs E2E e anexar scan/execução completa |
| F3.12 | Banco E2E isolado e runner reproduzível | PARTIAL | Integração usa `synkroo_test` isolado | Confirmar banco/runner Playwright separado |
| F3.13 | Triar `npm audit` e criar waivers owner-expiráveis | OPEN | Não há artifact `npm audit` no gate | Executar auditoria e registrar apenas findings/waivers sanitizados |
| F3.14 | Criar `npm run verify` completo | OPEN | Gates foram executados individualmente | Definir script composto e validar em DB/CI isolados |
| F3.15 | CI com PostgreSQL 17, security e CF dry-run | PARTIAL | Evidências locais cobrem gates equivalentes | Confirmar workflow GitHub e execução em CI |
| F3.16 | Walking skeleton staging app+bridge+agent+PostgreSQL+Hyperdrive | PARTIAL | Staging smoke e startup passaram | Anexar prova nominal de cada componente no mesmo candidato |
| F3.17 | Lifecycle de pool Worker e concorrência no workerd | OPEN | Startup check passou | Criar teste de concorrência/lifecycle no runtime alvo |

## Próximo ciclo seguro

1. Resolver dependências **EXTERNAL** de F0 somente após autorização do owner; não registrar valores.
2. Executar a próxima tranche local: F0.03/F0.08 classificação de suppressions, F1.08 auditoria dos demais testes nomeados e F3.01–F3.03 migration/env/startup.
3. Anexar cada resultado ao gate JSON ou a um artifact novo antes de marcar qualquer item como `VERIFIED`.
4. Só depois decidir se F0–F3 podem ser fechadas ou se continuam parciais.
