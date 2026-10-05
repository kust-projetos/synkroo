# ADR-BASE-18: AI Control Plane — Event/Run/Outcome como fundação da autonomia

**Status:** ✅ Decidido (fundação P4; implementação tranche a tranche)
**Data:** 2026-10-05
**Spec vNext:** `docs/superpowers/specs/2026-10-05-synkroo-vnext-ai-native-business-os-design.md` §6-§7
**Inventário de partida:** `docs/inventory/2026-10-05-actions-catalog.md`

## Contexto

O vNext transforma o Synkroo em um Business OS operável por IA. Hoje a execução por agente depende de:

- **`runAction` binário** (`src/core/actions/run.ts:10-63`): auth → módulo → permission → tenant guard → Zod → handler. Não existe noção de risco, classe de autonomia ou pós-condição.
- **Classificação fragmentada:** allowlist IA literal de 8 nomes (`src/core/agent-bridge/tool-policy.ts:19-28`) e security-matrix de 4 níveis (`src/core/agent-bridge/security-matrix.ts`) só para `source='system'` — com taxonomias diferentes entre si e sem equivalente à classe APPROVAL da spec.
- **Logs sem cadeia de decisão:** `action_logs` registra execução, mas não decisão, nível de política, policyVersion, hash de payload, duração nem outcome. 136 de 145 Actions não declaram `auditFields` → `inputRedacted` = `{}`.
- **Estruturas legadas parcialmente mortas** que já esboçam o Control Plane: `pending_actions`, `decision_logs`, `smart_trigger_log` (sem writer de runtime; endpoint smart-triggers retired 410), `agent_queue`/`agent_dlq` (SQL cru, **sem `clinicId`**), `agent_logs` (subconjunto duplicado de `decision_logs`, com reader de produção em `attendance-metrics.service.ts:94-130`).

Consequência: o agente não consegue explicar *por que* agiu, *o que* pretendia, *se* funcionou e *quanto* custou — pré-requisito para autonomia progressiva (P5+) e para o Control Center (P8).

## Decisão

1. **Oito entidades canônicas** do AI Control Plane, com fonte única cada:
   - **BusinessEvent** — todo fato operacional relevante normalizado (`lead.created`, `appointment.cancelled`, `budget.stale`, `payment.overdue`…). Carrega referências e contexto mínimo, nunca dump de PII.
   - **Goal** — resultado desejado (converter lead, preencher horário cancelado), não instrução de baixo nível.
   - **AgentRun** — execução completa: evento de origem, goal, contexto, plano, tools avaliadas, PolicyDecision, ActionAttempts, verificações, outcome, custo, duração, escalada.
   - **ActionAttempt** — cada tentativa de Action dentro de um Run, com `idempotencyKey`, hash de payload imutável, resultado tipado e duração.
   - **PolicyDecision** — classe aplicada (AUTO/CONFIRM/APPROVAL/DENY), policyVersion, razão; auditável por execução.
   - **Outcome** — resultado verificado por pós-condição tipada; nunca "sucesso" declarado pelo LLM.
   - **Exception** — falha/limite/ambiguidade que exige humano (absorve papel de `agent_dlq`).
   - **Approval** — aprovador interno + permission + **payload imutável + TTL**.
2. **Verification loop obrigatória** para ação consequencial: `decidir → executar Action → resultado tipado → validar pós-condição → registrar outcome → concluir`. `runAction` ganha passo de pós-condição; o retorno do handler deixa de ser verdade por declaração.
3. **Policy Engine (P5) generaliza o deny-by-default atual**, não o substitui por confiança: metadata de risco/autonomia por Action (campo único, ex. `policy` em `ActionDefinition`), classes AUTO/CONFIRM/APPROVAL/DENY da spec §7 (a matrix `livre/confirmacao/verificacao_forte/proibido` e a allowlist literal convergem para essa taxonomia única), approval token server-side com TTL, limites de gasto server-side, kill switch global/por tenant/por domínio, rollout `OFF → OBSERVE → ASSIST → AUTO_LIMITED → AUTO` e `policyVersion` em toda decisão. **Durante a transição a allowlist atual de 8 nomes permanece fallback conservador**; chat `agent_delegated` passa a passar pela mesma policy (hoje escapa da matrix).
4. **Reabsorção consciente das estruturas legadas** (sem duplicar):
   - `pending_actions` → fonte do design de Approval/undo (já tem `riskLevel`, `undoPayload`, `confirmationCount`); migrar para entidade Approval com TTL/hash.
   - `decision_logs` + `agent_logs` → convergem em PolicyDecision + AgentRun; **preservar o reader de produção de `agent_logs`** ou migrá-lo na mesma tranche.
   - `smart_trigger_log` → conceito sobrevive como BusinessEvent + Outcome (endpoint emissor já está retired).
   - `agent_queue`/`agent_dlq` → Exception; **adicionar tenant antes de qualquer reabsorção** (hoje sem `clinicId`, varridas globalmente pelo LGPD em `lgpd-service.ts:286-295` — preservar o varredor na tranche de migração).
   - `action_logs` → evolui para ActionAttempt (adicionar `durationMs`, `policyVersion`, `decision`, `agentRunId`, `idempotencyKey`, `approvalId`); falha de auditoria deixa de ser engolida quando a Action for consequencial.
5. **Ordem de chegada (P4 → P5):** primeiro fluxo de prova `appointment.cancelled → fill_waitlist → verify → outcome`; Policy Engine só após os oito tipos com writer/reader de runtime.

## Consequências

**Positivas:** agente auditável ponta a ponta (decisão → tentativa → verificação → outcome); autonomia granular por Action/tenant com rollback conceitual (kill switch + rollout); Control Center (P8) e Intelligence (P12) com dado confiável; fim das taxonomias duplicadas.

**Custos/limites:** toda Action consequencial ganha custo de escrita adicional (Run/Attempt/Decision/Outcome); P4 é pré-requisito de P5-P12 — sem atalho; migração das tabelas legadas exige tranche dedicada com dados LGPD em jogo; `crm.reprocessarSugestoesDuplicidade` (`requires: 'system'`, sentinel) precisa de tratamento explícito no novo modelo.

**Não objetivos:** não reescrever a Action Layer; não introduzir approvação humana em leitura (AUTO permanece leve); não criar segunda fonte para conceitos existentes (reabsorção, não gêmeos).

## Compatibilidade

- RBAC, módulo ativo e tenant por contexto confiável permanecem obrigatórios em toda decisão.
- ADR-BASE-06 (Action Layer como entrada de negócio) e ADR-BASE-12 (audit allowlist) permanecem válidos; este ADR estende, não revoga.
- Deny-by-default é invariante em qualquer rollout.
- **Divergência ADR↔código registrada:** `JWT_SECRET` segue obrigatório em `src/lib/env.ts:24,121` embora ADR-BASE-05 o rejeite como aspiração — a resolução (remover JWT_SECRET do código ou reabrir o ADR) é tranche própria de auth, fora do escopo desta fundação.
