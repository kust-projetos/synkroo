# ADR-BASE-20: Contratos de Action — DENY absoluto, ok/unknown e auditoria fail-closed

**Status:** ✅ Decidido e implementado (tranche E3) — adendo E4 abaixo
**Data:** 2026-10-08
**Escopo:** `src/core/actions/{types,approval,audit-writer,run}.ts`,
`src/modules/atendimento/actions/enviar-mensagem-direta.ts`,
`src/modules/atendimento/actions/enviar-mensagem.ts`,
`src/modules/atendimento/services/channel-service.ts` (adendo E4),
`src/lib/api/response.ts` (mapeamento de erros),
`src/core/agent-bridge/__tests__/tool-policy.test.ts` (barreira: allowlist segue 8)
**Relaciona:** [ADR-BASE-06](ADR-BASE-06-action-layer.md) (Action Layer),
[ADR-BASE-12](ADR-BASE-12-audit-allowlist.md) (allowlist de auditoria),
[ADR-BASE-18](ADR-BASE-18-ai-control-plane.md) (AI Control Plane, item 5 — PolicyDecision/ActionAttempt),
[ADR-BASE-19](ADR-BASE-19-budget-send-legacy-exception.md) (exceção do send legado),
spec vNext §7 (classes AUTO/CONFIRM/APPROVAL/DENY)

## Contexto

A tranche S5 introduziu approval token server-side (single-use, TTL, amarrado a
ação + hash do input canônico + clínica + actor + source + identidade
server-derived) e o gate `riskClass: 'deny_non_human'` em `runAction`. O
comportamento resultante tinha três defeitos, todos corrigidos aqui:

1. **Falso-sucesso no envio.** `atendimento.enviarMensagemDireta`
   (`enviar-mensagem-direta.ts`) devolvia `{ success: false, error }` quando o
   `channel-service` falhava. Como o `channel-service` converte exceção/timeout
   do provider em `success:false` (nunca lança), o `runAction` carimbava `ok` e
   a auditoria registrava sucesso para um envio que não existiu.
2. **Token elevando um DENY.** `evaluatePolicy` devolvia
   `approval_required` para `deny_non_human` com principal não-humano, ou
   seja, um token de aprovação humana podia liberar uma ação cuja classe de
   risco é "negar não-humano".
3. **Auditoria engolida e Posterior ao efeito.** `writeActionLog` engolia
   falha de escrita e era chamada depois do handler. Para uma Action
   consequencial, a evidência da tentativa podia desaparecer sem sinal algum,
   e nada impedia reenvio após falha ambígua.

Decisão humana vinculante registrada: **`deny_non_human` nunca é elevado por
token**. Isso quebra deliberadamente o comportamento S5 anterior.

## Decisão

### 1. Matriz de classes (implementação determinística, sem Policy Engine)

| Classe na Action | Principal humano (`source='user'`) | Principal não-humano (`agent_delegated`/`system`) |
|---|---|---|
| `standard` (padrão) | AUTO — executa | AUTO — executa (RBAC/módulo/allowlist seguem valendo) |
| `approval` | AUTO — executa | **APPROVAL** — exige approval token válido, single-use, TTL, amarrado |
| `deny_non_human` | AUTO — executa | **DENY absoluto** — recusa antes do handler e antes de consumir token |

- `approval_required` **só** nasce da classe `approval` (explícita, opt-in).
  Nenhuma Action de produção usa essa classe hoje e **nada foi reclassificado
  automaticamente**; a classe existe para o contrato APPROVAL permanecer
  exercitável sem afrouxar o DENY.
- `deny_non_human` continua sendo ENVIO externo; token válido **não** eleva
  (zero chamadas ao handler e zero chamadas a `consumeApprovalToken`).
- A negação mais restritiva vence: RBAC, módulo e allowlist da bridge são
  avaliados **antes** da política e não são sobrepostos por token algum. A
  allowlist IA permanece com exatamente 8 nomes (`tool-policy.ts`).

### 2. Semântica do resultado (`ok` / erro / `unknown`)

| Situação | Resultado | Auditoria |
|---|---|---|
| Handler conclui, finalização ok | `{ ok: true, data }` | tentativa finalizada `result='ok'` |
| Falha conhecida do provider (`success:false`) | `{ ok:false, error:{ code:'internal', message:'Falha ao enviar mensagem.' } }` — mensagem segura, sem detalhe do provider | tentativa finalizada `result='error'` |
| Desfecho ambíguo (timeout do provider) | `{ ok:false, error:{ code:'unknown_effect' } }` | tentativa finalizada como erro, com o código do handler |
| Escrita da tentativa inicial falha | `{ ok:false, error:{ code:'audit_incomplete' } }` — **handler não executa** | nenhuma linha (zero efeito) |
| Finalização falha após o handler | `{ ok:false, error:{ code:'unknown_effect', attemptId } }` | linha permanece `result='started'` |

- Novos códigos de erro (`ActionErrorCode`): `audit_incomplete` (503
  `AUDIT_INCOMPLETE`) e `unknown_effect` (500 `UNKNOWN_EFFECT`), mapeados em
  `src/lib/api/response.ts`.
- `unknown_effect` **nunca** significa "seguro reenviar". O `runAction` não
  tem retry automático em nenhum desses estados; o `attemptId` (uuid da linha
  em `action_logs`) é a referência para reconciliação humana **quando presente**:
  se o próprio handler lança `ActionError('unknown_effect')`, o resultado chega
  sem `attemptId` — consumers não devem assumir sua presença.
- Não existe detector genérico de `data.success` e não existe estado `partial`
  global: uma consulta pode legitimamente devolver `success:false` como dado.

### 3. Auditoria fail-closed para Actions consequenciais

- Campo novo, opt-in, em `ActionDefinition`: `consequential: true`.
  `atendimento.enviarMensagemDireta` é a primeira (e única) Action consequencial.
- Ordem no `runAction`: gates (auth → módulo → RBAC) → política → guard de
  tenant → Zod (input canônico) → **begin da tentativa** → consumo do token
  (quando APPROVAL) → handler → **finalização da mesma linha**.
- `beginActionAttempt` grava `result='started'` e **propaga** falha
  (fail-closed): o handler não roda. `finalizeActionAttempt` atualiza a mesma
  linha por `id` e também propaga falha.
- A tentativa é gravada **antes** do consumo do token: falha de auditoria não
  pode gastar uma aprovação sem executar (risco conhecido e documentado no
  código — nunca retry cego).
- Erro do handler e erro de auditoria ficam separados: com finalização
  bem-sucedida, o erro do handler aparece com o código dele; se a finalização
  falha, o resultado é `unknown_effect` com `attemptId`.
- `writeActionLog` (best-effort) permanece para caminhos **sem efeito**:
  denies, gates e Actions não consequenciais. Nenhuma tabela/coluna nova — a
  linha `started` usa colunas existentes (`result` é `text` livre).

### 4. Envio conhecidamente falho

`enviarMensagemDireta` passa a lançar `ActionError('internal', 'Falha ao
enviar mensagem.')` quando `sendByChannel` devolve `success:false`. O
`channel-service` converte exceção/timeout em `success:false`; esses casos são
**erro conhecido** neste contrato (sem retry automático). O detalhe do provider
fica no log do servidor, nunca na mensagem devolvida.

> **Refinado pelo adendo E4 (§5):** uma falha de provider **não é sempre
> conhecida**. Entrega ambígua agora é classificada `unknown_effect`, não
> `internal`. O texto acima vale apenas para a falha **determinística**
> (não-dispatch confirmada).

### 5. Entrega ambígua sem fallback (adendo E4)

O `channel-service` passava para o sidecar de fallback após **qualquer** falha
do provider — inclusive timeout/exceção **depois** de o dispatch ter ocorrido.
Como a idempotência local não prova que o outro provider não entregou, isso era
risco de duplicate-send (efeito duplicado sem retry). Correção:

- `SendResult` ganha `delivery?: 'sent' | 'failed' | 'unknown'`, definido pelo
  facade quando relevante. Só `delivery: 'unknown'` é atribuído explicitamente —
  em sucesso e em falha determinística o campo fica omitido (legado).
- Fallback para o sidecar **somente** em falha determinística PRÉ-dispatch:
  provider indisponível (adapter `null`) ou rejeição antes de qualquer envio à
  rede (`WahaProviderError.delivery === 'not_attempted'`, detectado
  estruturalmente — o facade não importa o leaf).
- Resultado **ambíguo** — timeout após dispatch, exceção após possível envio,
  `WahaProviderError` com `delivery: 'unknown'`, ou `success:false` retornado
  sem confirmação de não-dispatch (inclui a Evolution, que converte falha de
  transporte em `success:false`) — devolve `delivery: 'unknown'` **sem fallback**,
  com log sanitizado. Sem retry automático em nenhum nível.
- `enviarMensagemDireta` **e** `enviarMensagem` mapeiam `delivery: 'unknown'` →
  `ActionError('unknown_effect')`; falha determinística segue `internal`. Ambos
  ficam alinhados ao mesmo contrato de efeito desconhecido (§2).

Porta o endurecimento WAHA da PR #29 (reordenação processabilidade-antes-de-
freshness no webhook inbound; abort de transporte em corpo oversized; gate de
deploy loopback-only com RepoDigest pinado + preflight 0600 exato) sem regredir
a ativação WAHA-only (`3863c4f`), que a #29 ainda não tinha.

### 6. Garantia terminal do dispatch (adendo E4, revisão)

O marco de estado do claim (`completed`/`failed`/`unknown`) é **best-effort**:
se a escrita falhar depois do dispatch, a linha continuaria `in_progress` com
TTL de 600s e — expirado o TTL — seria reclaimada e **reexecutada**
(duplicate-send). O `unknown` sozinho não fecha o buraco: ele depende da
própria escrita que falhou.

- `withOutboundIdempotency` persiste um marco **durável `dispatching`**
  (`status='dispatching'`, `expires_at = NULL`) **antes** de invocar o handler,
  condicional a `status='in_progress'` (corrida ⇒ não despacha). Sem o marco,
  falha de infra aborta o envio (**fail-closed**); nunca fail-open.
- `settleClaim`/`rereadClaim` tratam `dispatching` como terminal: o replay
  devolve `unknown` (ou `unknown_effect` na Action) — **nunca sucesso e nunca
  reexecução**, mesmo após o TTL. `reclaimExpired` só reclaima linha com
  `expires_at` não-nulo.
- Liquidação normal sobrescreve o marco: sucesso ⇒ `completed` (com TTL próprio
  quando há âncora de conteúdo), falha determinística ⇒ `failed` com TTL
  reescrito (o `dispatching` zerou a expiração), ambígua ⇒ `unknown`.
- A liquidação agora tem **espera limitada** (`OUTBOUND_SETTLE_TIMEOUT_MS`,
  1s): escrita de marco não prende a resposta do envio. Passado o limite, a
  resposta segue e a escrita continua em background com rejeição absorvida — a
  segurança não depende dela, porque `dispatching` já está persistido.

Custo assumido: um crash entre o marco `dispatching` e o dispatch real deixa a
chave terminal para reconciliação manual (a mensagem não é reenviada sozinha).
É a direção segura — preferível a um efeito duplicado.

Paridade de validação no deploy: `deploy-waha.sh` reimplementa a regra de URL
do `preflight.mjs` de forma **estrutural e equivalente** (scheme HTTPS
case-insensitive, sem credenciais, host válido, port ≤ 65535, path EXATO
`/api/whatsapp/waha`) e o charset/length do HMAC (`^[A-Za-z0-9_-]{32,}$`), sem
exigir `node` no alvo. A matriz de paridade é testada contra o validador
canônico em `scripts/__tests__/vps-waha-deploy-exec.test.mjs`.

## Consequências

- **Quebra intencional de S5:** chamadores que dependiam de `result.ok === true`
  após um envio falho passam a receber `ok:false`. O único caller legado
  (`/api/budgets/[id]/send` → `runAction(enviarMensagemDireta, …)` via
  `buildSystemContext`) **já** era bloqueado hoje: `source='system'` +
  `deny_non_human` sem token → `forbidden`. Portanto **não há mudança de
  comportamento observável** nesse caller; ele segue fora da Action canônica
  por ADR-BASE-19 (exceção permanente, sem migração).
- Ações não consequenciais (inclusive `atendimento.enviarMensagem`, que mantém
  idempotência própria e já lança `ActionError`) não mudam de contrato.
- `unknown_effect`/`audit_incomplete` ampliam a superfície de códigos HTTP:
  callers devem tratar 503/500 como "não concluído", sem reenviar sozinhos.

## Alternativas rejeitadas

- **Manter `approval_required` para `deny_non_human`:** contradiz a decisão
  humana vinculante; token passaria a elevar um DENY.
- **Detector genérico de `data.success`:** consultas legítimas carregam esse
  campo; a separação precisa ser por classe de risco declarada, não por forma
  de dado.
- **Estado `partial` global:** obrigaria reescrever todos os callers sem
  ganho de segurança; o mínimo necessário é o par
  `audit_incomplete`/`unknown_effect` com referência da tentativa.
- **Transação DB + provider:** não existe atomicidade entre os dois; abrir
  transação durante HTTP agravaria o problema. Outbox/dispatcher novo está
  fora de escopo (não torna DB+provider atômicos).
- **Retry automático após finalização falha:** risco de duplicate-send. A
  reconciliação é manual, via `attemptId`.

## Validação

- Unit: `src/core/actions/__tests__/{approval,run,consequential-audit}.test.ts`,
  `src/modules/atendimento/actions/__tests__/enviar-mensagem-direta.test.ts`,
  `src/core/agent-bridge/__tests__/tool-policy.test.ts` (allowlist exatamente 8).
- Integração DB-real (`scripts/integration-run.mjs` → `synkroo_test`):
  `src/core/actions/__tests__/approval.integration.test.ts` — corrida de duas
  conexões pelo mesmo token, replay, mismatch por binding, TTL no limite,
  tentativa consequencial started→finalizada, DB-down em emissão/consumo/escrita
  inicial/finalização (`unknown_effect` sem resend), sanitização.
