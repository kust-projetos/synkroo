# Synkroo vNext — PLAN de integração, estabilização e retomada

**Data:** 2026-10-08  
**Tipo:** PLAN corretivo e de reconciliação; complementa, não substitui, a SPEC vNext de 2026-10-05.  
**Base auditada:** `origin/main @ d532ff6e0c7a2aae55798f51ca703e0a0e71c4d9`.  
**Execução:** em PRs pequenos e independentes, sempre com evidências no HEAD exato.  
**Status:** PROPOSED — nenhum gate operacional é autorizado por este documento.

## 1. Objetivo e não objetivos

Restabelecer CI e confiabilidade na integração P0 trust + WAHA-only + S1–S6, reconciliar a migração Contabo P2 e o PR #29, preservar invariantes de segurança da Action Layer e preparar retomada progressiva do plano P3–P5. **Não** realizar cutover, deploy em produção, habilitar automação, migrar sessões WhatsApp, rodar migrations produtivas ou expandir a allowlist automaticamente.

**Critério de fonte da verdade:** Git/CI confirmam entrega em código; documentação e relatórios operacionais são evidência histórica, não substituem verificação de runtime. O PR #28 declarou P2 `TARGET ACTIVE` e `P2 CLOSED`, mas este PLAN não afirma que o runtime permanece saudável hoje.

**Estado de entrada observado:**
- `main d532ff6e` integra 25 commits/217 arquivos desde `79ee2b95`; grande lote direto com S1–S6 e WAHA.
- CI push run `37847035463` = FAILURE: `typecheck:ia-bridge` → `src/core/actions/approval.ts:88 TS2554 Expected 0 arguments, but got 1`. Lint, tsc principal, Gitleaks e Migrations From Zero PASS; testes seguintes, build e CF SKIPPED.
- `src/services/api-handlers/health/db.ts` espera `EXPECTED_MIGRATIONS=35`, enquanto a última evidência P2 de runtime em 2026-10-07 registra ledger 33.
- PR #29 WAHA provider seam está OPEN e desatualizado frente à main; não mesclar cegamente.
- `/api/whatsapp/evolution` passou a responder 410; `channel-service` tenta WAHA primeiro, mas mantém caminhos Evolution/sidecar. Status efetivo dos serviços, sessões e canal não foi verificado ao vivo.
- `writeActionLog` captura falha e não a propaga; `enviarMensagemDireta` pode devolver `data.success=false` com envelope de Action `ok=true`. O comportamento exige correção contratual.
- `approval_tokens` (0035) e `action_logs` ampliado (0034) existem em código; `riskClass=deny_non_human` vira `approval_required` se houver token, diferente de um DENY absoluto. Taxonomia ainda incompleta.
- `AGENT_SAFE_ACTIONS` tem 8 nomes; não expandir.
- `main` aparece sem proteção de branch. Arquivos de runtime `.opencode/opencode-loop` foram versionados no delta recente: classificar antes de excluir.

## 2. Invariantes e guardrails

1. Reconciliação read-only antes de alterar código, ambientes, branches ou PRs.
2. Jamais tocar checkout principal sujo; usar worktree e branch derivadas da main remota atual; nunca reset/force-push em branch do usuário.
3. Não tratar PASS antigo em HEAD diferente como prova de novo HEAD. FAIL/SKIPPED permanecem explícitos.
4. Nunca registrar dados de pacientes, tokens, chaves, URLs com segredo, backups em logs/docs/PR.
5. Backend autoritativo, tenant por contexto autenticado, no silent success, no blind retry após resultado externo ambíguo.
6. Documentação de aprovação não autoriza operação de produção. Requer autorização explícita do responsável, preflight, backup, rollout e rollback.
7. Não mudar simultaneamente migrations produtivas, WAHA, Action Layer e policy. PR pequeno por causa-raiz, CI e review próprios.
8. Toda mudança de contrato requer testes negativos e nota de compatibilidade. Nenhuma mudança de autonomia até verificação de policy e pós-condição.

## 3. Entregas e sequência de execução

### E0 — Reconciliação/baseline (read-only, pré-requisito)

**Tarefas:**
- Capturar HEAD da main, árvore de worktrees e branches, PR #29 (mergeability/reviews/threads), jobs CI atuais e diferenças da integração S1–S6.
- Inventariar migrations 0034/0035, ledger esperado vs observado, configuração de deploy; só leitura de banco e Cloudflare quando houver acesso autorizado.
- Mapear mudanças reais em WAHA (inbound/outbound/engine/sessão/installation/fallback), Action Layer, docs/ADRs e artefatos `.opencode`.
- Construir matriz `evidência / código / runtime / gap / dono / decisão` e registrar divergências sem apagar histórico.

**Saída:** `docs/audit/YYYY-MM-DD-vnext-integration-reconciliation.md` (sem segredo). **Gate:** inventário de blockers e sequência de PRs aprovada tecnicamente.

### E1 — CI unblock e compatibilidade de runtimes (bloqueador imediato)

**Tarefas:**
- Reproduzir `npm run typecheck:ia-bridge` no HEAD exato e investigar tsconfig/ambient types e `randomBytes(32).toString('hex')` em `approval.ts`, sem trocar criptografia às cegas.
- Corrigir causa-raiz de tipagem de modo compatível com Workers, Node e bundle IA; testar entropia, formato e persistência do token, sem segredo em output.
- Executar primeiro os typechecks (principal, ia-bridge, ia-agent); depois pipeline completo no PR e no merge commit: lint, unit, DB integration, security, release, migrations zero, audit HIGH=0, build, E2E, CF build/dry-run, Gitleaks.
- Se surgir outra falha, adjudicar regressão vs flake com evidência. Proibido `skip`, `continue-on-error` ou timeout artificial sem causa-raiz.

**Entrega:** PR `fix/vnext-ci-bridge-compat` (nome ilustrativo) com teste de regressão. **Gate E1:** CI verde em HEAD integrado; se falhar, HOLD E2–E4 para merges funcionais.

### E2 — Integridade de runtime / P2 → S5 readiness

**Tarefas (read-only primeiro):**
- Confirmar via backend/ledger operacional a versão e migrações efetivamente aplicadas no target Contabo; separar código EXPECTED=35 da realidade registrada 33 em 2026-10-07.
- Inspecionar 0034/0035 para expansão, compatibilidade, transação, rollback e consumidores; verificar se migration runner aplica em ordem, se existiram deploys e se app depende de colunas/tabela já disponíveis.
- Verificar `/api/health/db` vs readiness interno: endpoint público HTTP 200 com `status=incomplete` não é prova de prontidão.
- Checar backup off-host/restauração, Hyperdrive source/target, TLS/CA, firewall, grants, jobs, outbox e a janela/limites de rollback; sem expor dados sensíveis.
- Preparar **runbook operacional de aplicação das migrations e deploy** com pré-check, freeze se preciso, compatibilidade expand/contract, telemetria, rollback e condição NO-GO.

**Gate E2a:** prova de compatibilidade em staging/rehearsal; **Gate E2b:** aprovação humana explícita antes de alterar BD/Cloudflare produção. Sem autorização, marcar `READY FOR OPERATOR` — nunca `DONE`.

### E3 — Contratos de Action, aprovação e auditoria (segurança/corretude)

**Tarefas:**
- Impedir `ActionResult.ok=true` quando handler sinaliza falha de negócio; definir contrato explícito `success/partial/unknown`, ou adaptar para `ActionError` com testes de callers e idempotência. Priorizar `enviarMensagemDireta`, pagamentos, cobrança e envios.
- Resolver inconsistência `DENY` vs `APPROVAL`: `deny_non_human` com token hoje permite prosseguir. Deliberar policy com matriz `AUTO/CONFIRM/APPROVAL/DENY`; DENY absoluto não pode ser elevado por token; preservar allowlist IA atual.
- Persistência de auditoria: falha de log não pode virar sucesso invisível em operação consequencial. Projetar write-before-effect/transactional outbox e resultado `unknown` quando efeito externo pode ter ocorrido, em vez de simplesmente lançar depois do envio e incentivar duplicação.
- Testar replay, double consume concorrente com DB-real, TTL, mismatch actor/user/tenant/source/input, indisponibilidade DB, campos de auditoria sanitizados, ações humanas vs delegadas, pós-condição e falha parcial.
- Não ligar Policy Engine completo nem promover novas Actions no mesmo PR.

**Decisões documentais:** ADR ou addendum para política DENY/APPROVAL e para semântica de `ActionResult`/auditoria/outcome; atualizar ADR-BASE-18 quando a decisão for tomada. **Gate E3:** testes negative/contract/DB-real e reviewer de segurança independentes.

### E4 — Reconciliação e operacionalização WAHA (P3; separado de E1–E3)

**Tarefas:**
- Reconciliar PR #29 via comparação `merge-base`, arquivos/commits exclusivos e o que já entrou na main; fechar/superseder ou rebasear sem duplicar implementações. Nunca forçar merge.
- Verificar risco imediato: Evolution inbound = 410, WAHA-first outbound, Evolution/sidecar fallback; confirmar instalação WAHA real, secret, webhook ativo, escopo da sessão/clinic e quem recebe eventos hoje. Se houver ruptura, classificar incidente; não inverter provider sem decisão explícita.
- Eliminar fallback de envio **após resultado ambíguo** (`unknown` delivery/timeout após dispatch), evitando duplo envio. Idempotência local é necessária mas não prova que dois providers não enviaram na mesma tentativa.
- Validar transporte edge-authenticated para WAHA, HTTPS/CA, HMAC raw bytes, rate limit Cloudflare na rota exata, origem não bypassável, session→clinic, dedup durável, 503 retryable, payloads media, engine pinado, QR/reconnect, backup cifrado da sessão + restore drill.
- Montar matriz de testes reais WEBJS/GOWS/NOWEB e canary por clínica/número de teste (sem comunicação a clientes reais).
- Cortes WAHA, revogação definitiva Evolution, exposição de API e rotas de produção exigem **go/no-go humano**, com plano de contingência realista. Não inventar rollback via Evolution se provider já foi descontinuado.

**Gate E4a:** código/CI + infra candidate; **E4b:** engine + canary + observabilidade; **E4c:** autorização para cutover real; **E4d:** observação e closure P3. Não declarar P3 CLOSED apenas por código WAHA presente.

### E5 — Control Plane P4/P5 e retomada do vNext (após estabilidade)

**Tarefas:**
- Reconciliar S1–S6 já integrados e inventariar entidades reais vs ADR-BASE-18: `BusinessEvent, Goal, AgentRun, ActionAttempt, PolicyDecision, Outcome, Exception, Approval`.
- Construir matriz por entidade: `schema / writer / reader / tenant / policy / idempotency / retention / tests / runtime status`.
- Planejar fluxo ouro inicial: `appointment.cancelled → fill_waitlist → verify → Outcome` (sem enviar mensagem real no ambiente de teste).
- Definir policy profiles, kill switches, orçamento/limites, rollback de autonomia, observabilidade, consentimento humano e pós-condições verificadas; preservar 8 Actions atuais até gate específico.
- Entregar **PLAN P4/P5 incremental** ou addendum somente após E3/E4, com tarefas menores (P4 foundation → P5 policy → P6 Golden Workflows), sem prometer fechar tudo nesta rodada.

**Gate E5:** SPEC/ADR coerentes com código e backlog executável; habilitação/autonomia real depende de autorização separada.

## 4. Rastreabilidade Git, documentação e governança

- PRs independentes por E1, E3, WAHA e P4/P5; nunca transformar o PR de CI em mega-refactor. Documentação atualizada junto ao código que muda o contrato.
- O commit na main `d532ff6e` agregou mudanças sem PR próprio. Adicionar proteção da main (required CI, review, sem push direto) mediante aprovação de política GitHub, evitando bloquear equipe sem avaliar permissões.
- `.opencode/opencode-loop`: classificar artefatos como runtime vs documentação; impedir novos artefatos efêmeros versionados; preservar histórico sem apagar conteúdo relevante ou dados do usuário inadvertidamente.
- Reconciliar master PLAN (há linha antiga P2 NOT STARTED), ADR-BASE-06/18/19, runbook Contabo/WAHA e inventário de Actions; aplicar `ATUAL > RESOLVIDO > HISTÓRICO > SUBSTITUÍDO`. ADR-19 `/budgets/[id]/send` permanece exceção vigente até decisão explícita, não migrar automaticamente.
- Evidências por PR: SHAs, testes, gates, review findings, screenshots/trace apenas sem PII, issue links, delta de risco e follow-ups.

## 5. Plano de testes e quality gates

| Gate | E1 | E2 | E3 | E4 | E5 |
|---|---|---|---|---|---|
| lint / TS app, bridge, agent | Obrig. | Se código | Obrig. | Obrig. | Se código |
| Jest unit/contract + security-negative | Obrig. | Focados | Obrig. | Obrig. | Planejar |
| Postgres integração / migrations-zero | Obrig. | Obrig. | Obrig. | Quando DB | Planejar |
| E2E produção + CF build/dry-run | Obrig. | Após mudança | Obrig. | Obrig. | Por tranche |
| Gitleaks + audit prod HIGH=0 | Obrig. | Obrig. | Obrig. | Obrig. | Obrig. |
| Runtime checks/restore/readiness | — | Obrig. | Se migrar | Obrig. | Por tranche |
| Segurança/infra reviewer | Obrig. | Obrig. | Obrig. | Obrig. | Obrig. |
| Aprovação operacional humana | Não | Antes prod | Antes habilitar risco | Antes canary/cutover | Antes autonomia |

`SKIPPED` só é legítimo se justificado e não for gate obrigatório da tranche. CI verde em HEAD anterior não substitui CI no HEAD final.

## 6. Riscos prioritários e critérios de parada

- **B0 / integração atual:** CI vermelho na IA Bridge — trava merges funcionais/deploy.
- **B1 / runtime:** código precisa de 0034/0035, target evidenciado com 33 migrations — travar novas chamadas a Approval até prova de compatibilidade.
- **B1 / mensagens:** inbound Evolution 410 sem confirmação de WAHA live; resultado ambíguo com fallback pode gerar perda ou duplicação — verificar/mitigar antes do canary.
- **B1 / auditabilidade:** `ActionResult` pode reportar sucesso falso; `writeActionLog` falha silenciosamente — não permitir autonomia consequencial.
- **B2 / rastreabilidade:** PR #29 divergente, docs de fase antigas, artefatos runtime versionados, main desprotegida.

Abortar execução/ativação se tenant escape, perda de mensagens, duplicate send, divergência financeira, token de aprovação bypassável, segredo exposto, backup inconsistente ou ausência de rollback viável.

## 7. Estados finais admitidos

**INTEGRATION BASELINE CLOSED:** E0+E1 completos, CI full green no HEAD integrado; E2 diagnosticado e plano de migração publicado. Não implica P3/P4/P5 CLOSED.

**P3 READY FOR CANARY:** E4a completos + ambiente seguro; não equivale a WAHA ativo.

**P3 CLOSED:** canary + autorização + cutover + observação + restauração de sessão verificadas.

**P4/P5 READY FOR IMPLEMENTATION:** matriz de entidades + ADR/policy revisados + tarefas por tranche; não equivale a autonomia ativada.

**PROJECT PRODUCTION READY:** não utilizar até prova de runtime, recovery, segurança, workflows e operação observada em gates específicos.

## 8. Entrega obrigatória do executor

Relatório por fase: SHA inicial/final, branch/worktree, PR, diff escopado, causa-raiz, testes executados e seus HEADs, gates PASS/FAIL/SKIPPED, reviews independentes, migrations observadas vs esperadas, runtime read-only, risks/residuals, rollback e verdict `READY / HOLD / NOT DONE`. Não declarar closure de fases futuras por associação.

**Primeira implementação autorizada por este plano:** E0 → E1. E2 read-only pode rodar em paralelo; E3/E4/E5 aguardam o gate de E1 e decisões relevantes. Nenhuma ação operacional mutadora está pré-autorizada.
