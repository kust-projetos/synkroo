# ADR-BASE-17: Dados Não Confiáveis no LLM (delimitação, allowlist, validação)

**Status:** ✅ Implementado
**Data:** 2026-09-14 (hardening V1, trilha B1)

## Contexto

O agente IA consome conteúdo externo (mensagens WhatsApp, RAG/knowledge, dados do interlocutor vindos do banco) e produz output estruturado (tool calls, `pendingAction`, classificação) que a aplicação executa. Sem boundary explícito, conteúdo externo pode ser interpretado como instrução (prompt injection) e output malformado pode acionar ações com argumentos inválidos ou sem autorização.

## Decisão

1. **Conteúdo externo é dado, nunca instrução:** ao montar o prompt (`src/core/ia-agent/personas.ts`, orquestração em `src/core/ia-agent/orchestrator-logic.ts`), contexto do interlocutor, histórico e trechos RAG/knowledge são delimitados como dado entre marcadores cotados (convenção `<dados_contexto>`), com instrução system separada. Sanitização remove/escapa delimitadores vindos do conteúdo externo para impedir quebra de moldura.
2. **Tools deny-by-default:** só ações na allowlist `AGENT_SAFE_ACTIONS` (`src/core/agent-bridge/tool-policy.ts`, predicado `isAgentSafeAction`) são expostas à bridge; ação fora da lista é recusada sem chamar o modelo.
3. **Validação Zod de todo output estruturado antes do uso:** envelope do provider (`choices`/`message`/`tool_calls`/`usage`), `tool_calls[].function.arguments` e payloads (classificação, `pendingAction`) passam por schema — `JSON.parse` não é validação. `pendingAction.args` persistido no DO é revalidado contra o schema da action no `confirm`.
4. **RBAC fora do modelo:** o único caminho de execução passa por allowlist + `runAction` com `ActionContext`/RBAC (`src/core/actions/`); nenhuma rota contorna esse caminho. Autorização nunca é decidida pelo conteúdo gerado.
5. **pendingAction com binding de principal e reserva atômica:** confirmação vincula token à conversa/sessão (`confirmedToken`/`identityVerifiedToken` verificados no boundary do app em `src/app/api/ia/chat/route.ts`, nunca confiados do body); `history`/`pendingAction` são persistidos por conversa no DO (`src/workers/ia-agent/index.ts`).
6. **Deadline de turno:** budget total por turno (timeout do provider < timeout do invoker; teto de iterações × retries), com correlation/request id propagado app → handle → `runTurn` → provider para rastreabilidade.

## Evidência

- `src/core/agent-bridge/tool-policy.ts` (+ `src/core/agent-bridge/__tests__/tool-policy.test.ts`) — allowlist deny-by-default
- `src/core/agent-bridge/bridge-service.ts` — enforcement da allowlist
- `src/core/ia-agent/orchestrator-logic.ts` (+ testes de `pendingAction` vinculado) — confirmação/identidade, preservação de estado
- `src/app/api/ia/chat/route.ts` — caps de payload e verificação de tokens no boundary
- `src/workers/ia-agent/index.ts` — persistência por conversa (history + pendingAction)
- `src/lib/llm/providers/base.ts` — timeout/abort orçado por chamada

## Alternativas rejeitadas

- Sanitização por blocklist de frases de injection: infinita e burlável — delimitação estrutural + allowlist + validação de schema.
- Eval adversarial de LLM como gate de merge: probabilística e complementar (suíte manual/periódica em `scripts/` + cenários em `docs/`) — os gates de CI são determinísticos (prompt delimitado, allowlist, schema, RBAC fora do modelo, tokens vinculados).

## Consequências

- Nova action do agente nasce fora da allowlist; inclusão exige revisão explícita.
- Nenhuma string do body chega ao provider sem cap; nenhum output estruturado é consumido sem schema.
