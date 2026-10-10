# ADR-BASE-16: Política de Timeout/Retry/Idempotência das Integrações

**Status:** ✅ Implementado
**Data:** 2026-09-14 (hardening V1, trilhas A2/A3/A4)
**Adendo E4:** 2026-10-09 — fail-closed no claim de envio com chave, chave
estável por job do outbox WhatsApp, DLQ terminal para entrega não confirmada,
defer do job em conflito de claim e DLQ terminal para a liquidação do lembrete
recusada pelo cerco de tenant (ver seção "Adendo E4").

## Contexto

Integrações externas (Evolution/WhatsApp, Instagram, Asaas, sidecar Playwright) falham de formas que a aplicação não controla: timeouts, 429/5xx, duplicação de entrega de webhooks e retries de rede. Sem política única, cada client inventa seu próprio retry — com risco de duplo envio (cobrança duplicada, mensagem duplicada) ou de retry agressivo sobre operação não-idempotente.

## Decisão

1. **Timeout explícito em todo fetch externo**, via `AbortSignal`/budget por client (referência: `src/lib/llm/providers/base.ts` com `timeoutMs` default e abort; `src/lib/sidecar/client.ts` com `timeoutMs`).
2. **Retry somente para operações idempotentes** (GET ou POST com `Idempotency-Key`), apenas em erros retryable (rede/timeout/429/5xx), com backoff exponencial + jitter e budget único de retry por operação (mecanismo: `withRetry` em `src/lib/retry.ts` — tentativas limitadas, `retryableErrors`, jitter anti-thundering-herd).
3. **Claim antes do envio (facade de envio):** a idempotência de negócio usa `withIdempotency(key, jobType, handler)` (`src/lib/idempotency/index.ts`) — primeira execução processa, duplicata retorna o resultado anterior sem reexecutar side-effects. Estados de claim distinguem concluído / em progresso / retry adiado; **fail-open só em infra-failure** (nunca como atalho de regra de negócio).
4. **Outbox com DLQ para envios enfileiráveis:** `claimOutboxJob` com `SKIP LOCKED`, estados `pending → processing → delivered`, `dead_letter` após esgotar tentativas (`src/lib/outbox/outbox-repository.ts`, `src/lib/outbox/dispatch-outbox.ts`).
5. **Budgets/Asaas:** mutações com `Idempotency-Key` (`src/modules/financeiro/gateways/providers/asaas/client.ts`, `reqHeaders`) e `maxRetries 0` em mutação de cobrança sem chave estável — cobrança nunca é retentada às cegas; reemissão passa por outbox/DLQ (`src/modules/financeiro/services/charge-service.ts` via `withIdempotency`).
6. **Freshness de webhooks inbound:** payload fora da janela é rejeitado (Evolution/messages: janela curta de 600s/300s conforme o transporte; referência de padrão: freshness check em `src/app/api/instagram/webhook/route.ts`), combinado com secret por instalação (`src/modules/atendimento/integrations/resolve-channel-installation.ts`), dedup por event-id e idempotência downstream (`src/app/api/whatsapp/evolution/route.ts`, `src/app/api/messages/inbound/route.ts`).

## Adendo E4 — política de infra por tipo de claim (fail-closed no envio com chave)

O item 3 fala do claim **genérico** de negócio (`withIdempotency`), cuja
política de infra-failure continua **fail-open onde está documentada** — ele
não ganha efeito externo novo por esta regra. O **envio outbound COM chave**
(`withOutboundIdempotency`, `src/lib/http/outbound-idempotency.ts`) tem
natureza diferente: ali o claim É a única barreira contra duplicate-send,
porque o provider (Evolution/WAHA/sidecar) não suporta `Idempotency-Key`.

- **Claim com falha de infra ⇒ fail-closed.** `IdempotencyInfraError` é
  relançada **antes** de qualquer handler/sidecar/provider: sem claim não há
  dispatch. Enviar sem dedup seria justamente o duplicate-send que o claim
  existe para impedir (retry de job, redelivery, execução concorrente). Essa
  é uma **mudança intencional de disponibilidade**: com a loja de idempotência
  indisponível, envios com chave deixam de sair e o job do outbox fica
  retryável (`pending`) até a infra recuperar — nunca `delivered`.
- **Chave estável por job do outbox WhatsApp.**
  `dispatchOutboundMessageJob` ancora a chave em (tenant, job):
  `buildOutboundIdempotencyKey('whatsapp', job.clinicId, 'outbox:'+job.id)`,
  repassada por `sendByChannel` → `sendWhatsApp`. WAHA + fallback sidecar
  contam como UMA operação lógica sob o MESMO claim. Instagram/web seguem sem
  chave (contratos existentes; o stub do Instagram não envia de fato).
- **Entrega não confirmada ⇒ DLQ terminal.** `delivery: 'unknown'` (dispatch
  ocorrido, entrega não confirmada) levanta `OutboxDeliveryUnknownError`
  (`src/lib/outbox/errors.ts`): falha **permanente**, nunca sucesso. O
  dispatcher move a linha direto para `dead_letter`
  (`markOutboxDeadLetter`) **sem consumir tentativa de retry**, chama
  `onDeadLetter` uma única vez e devolve `dead_letter`. A linha de
  idempotência permanece `unknown` (terminal) para reconciliação manual.
- **Sem envio sem chave por inferência:** `runIdempotentSend` sem chave
  continua direto (compatibilidade legada); a política fail-closed acima vale
  para toda operação COM chave.
- **Conflito do claim ⇒ defer, não falha.** O claim vivo (`in_progress`) ou
  falhado recentemente (`retry_after`) devolve `OutboundSendConflictError`
  provando que o handler NÃO rodou. `dispatchOutboundMessageJob` converte o
  conflito em `OutboxDeferredError` (`src/lib/outbox/errors.ts`) e o dispatcher
  defere o job (`markOutboxDeferred`): volta a `pending` com
  `next_attempt_at` depois do TTL do claim (`OUTBOUND_IDEMPOTENCY_TTL_SECONDS`,
  600s — piso que nunca é anterior ao `expires_at` da chave), **devolve** a
  tentativa de retry (`attempts - 1`, piso 0, condicional `processing`) e não
  chama `onDeadLetter`. Sem isso, o backoff de 60/180/420/900s reenviaria o
  conflito contra o TTL de 600s: sobrariam ~2 tentativas reais de handler e a
  primeira falha determinística real iria direto à DLQ. O job NUNCA é marcado
  `delivered` no defer e a codificação em `last_error_code` é a fixa e
  sanitizada `OUTBOX_SEND_DEFERRED`.

### Fence do lease: `claim_generation` (migration 0036)

O lease do outbox é **recuperável**: `claimOutboxJob` torna a linha
claimable quando `status='processing'` e `updated_at` envelhece 5min. Um
worker lento pode portanto estar liquidando uma linha que outro worker já
reclamou. A fence anterior era só `(id, status='processing')` — e `attempts`
**não pode** servir de geração, porque o defer a decrementa
(`GREATEST(attempts - 1, 0)`): depois de um reclaim o valor volta a repetir e
a condição casaria com um lease já perdido (ABA).

- **Coluna nova:** `outbox_jobs.claim_generation integer NOT NULL DEFAULT 0`
  (migration `0036_outbox_claim_generation.sql`, expand-only, aditiva e
  reversível; linhas existentes nascem em 0).
- **Claim:** `claimOutboxJob` incrementa a geração no MESMO UPDATE que rouba a
  linha e devolve o lease completo `(id, claimGeneration)`. Semântica de
  `attempts` inalterada.
- **Liquidação:** `markOutboxDelivered`/`markOutboxRetry`/
  `markOutboxDeferred`/`markOutboxDeadLetter` casam `id` + `processing` +
  `claim_generation` num único UPDATE conditional e devolvem **boolean** via
  `RETURNING`. O defer devolve a tentativa mas **nunca** decrementa a geração.
- **Dispatcher:** só o erro do SENDER é classificado no caminho de falha; toda
  liquidação roda fora do `catch` do sender. A exceção tipada é a rejeição
  SEMÂNTICA da liquidação (ver “Hook de liquidação de sucesso”), que vai à DLQ
  com código fixo. `false` na liquidação ⇒ `lease_lost`: nenhum desfecho é
  reportado e nenhum callback roda. Falha de escrita na liquidação
  **propaga** (nunca é reinterpretada como falha de provider). Callback de
  reconciliação só depois de a DLQ ter sido confirmada pelo banco; exceção do
  callback não gera segunda liquidação. O worker trata `lease_lost` como
  não-vazio e segue para o próximo claim.

#### Hook de liquidação de sucesso (`OutboxSuccessHook`)

Um efeito colateral que depende da entrega (marcar o lembrete como entregue)
**não pode** rodar dentro do sender: no instante em que o sender termina, a
execução ainda não é dona *comprovada* da linha — o lease de 5min pode já ter
sido recuperado. O sender passa então a devolver um hook
(`OutboxSuccessHook = (tx) => Promise<void>`, `src/lib/outbox/outbox-repository.ts`)
em vez de escrever, e o dispatcher o encaminha a
`markOutboxDelivered(id, generation, hook)`, que roda o UPDATE cercado e o hook
**na mesma transação**:

- fence recusa (lease perdido) ⇒ `false`, hook **nunca** invocado, `lease_lost`;
- hook lança falha de ESCRITA (queda/timeout do banco, rollback) ⇒ `delivered`
  e efeito colateral são desfeitos juntos, o job volta a `processing` e o erro
  **propaga** (nunca vira falha de provider) — o replay reexecuta o hook e o
  claim de idempotência dedupa o reenvio ao provider;
- hook lança rejeição **SEMÂNTICA** (`ReminderSettlementRejectedError`,
  `src/lib/outbox/errors.ts`: `markReminderDelivered` não casou nenhuma linha —
  id inexistente, status já não `queued` ou lembrete de outro tenant) ⇒
  `delivered` e efeito colateral são desfeitos juntos e o dispatcher move a
  linha direto para `dead_letter` com o código fixo
  `REMINDER_SETTLEMENT_REJECTED`, **sem consumir tentativa**, chamando
  `onDeadLetter` uma única vez e devolvendo `dead_letter`. A entrega AO
  PROVIDER já ocorreu: reexecutar o job reexecutaria o envio e liquidar como
  `delivered` marcaria um lembrete que não foi enviado. Nenhum
  `markOutboxRetry` e nenhum novo envio — a recusa semântica NUNCA é confundida
  com falha de provider. É o único erro da transação de liquidação que o
  dispatcher classifica; qualquer outro (banco, timeout, escrita do hook)
  **propaga**;
- caminho desconhecido (operação não reconhecida) lança **antes** de qualquer
  hook: DLQ imediata e nenhuma marcação de lembrete.

`worker.ts` devolve o hook do handler ao dispatcher (`return def.handle(job)`) —
descartá-lo perderia a liquidação. `markReminderDelivered(reminderId, clinicId,
messageId?, tx?)` passa a exigir o `clinicId` do job como condição de tenant
(casamento por `EXISTS` em `appointments`, na mesma transação/executor) e a
aceitar `tx?` opcional (default: client padrão). O hook de liquidação do outbox
é o **único** caller da função: não havia caller prévio a preservar e nenhuma
compatibilidade com a assinatura antiga é afirmada — a exigência de tenant é
justamente o que impede a liquidação cruzada.
- **Rollback:** `DROP COLUMN claim_generation` só é seguro depois que nenhuma
  versão ativa liquida com fence (voltar a liquidação sem fence reintroduz a
  janela de liquidação cruzada). Forward-fix é sempre preferível.

### Compatibilidade e limites de rollback

- **Contratos preservados:** assinaturas de `sendByChannel`/`sendWhatsApp`/
  `runIdempotentSend` são compatíveis (parâmetro de chave opcional); Instagram
  e web não ganham idempotência; `withIdempotency` genérico não muda.
- **Migração:** `status` continua `text` livre em `idempotency_keys`/
  `outbox_jobs` (`dead_letter`, `pending` e `unknown` são valores existentes);
  a única mudança de schema deste adendo é a coluna aditiva
  `outbox_jobs.claim_generation` (0036), sem dados backfillados — o default 0
  já é o valor correto para linhas pré-existentes.
- **Rollback limitado:** reverter o fail-closed para fail-open no claim
  reintroduz a janela de duplicate-send que este adendo fecha — só é aceitável
  como medida de emergência de disponibilidade, com registro do incidente e
  retorno ao fail-closed. Reverter a DLQ imediata de `unknown` para o retry
  por TTL é pior ainda: reexecutaria um efeito possivelmente já ocorrido.
  Nenhum dos dois rollbacks é "neutro".

## Evidência

- `src/lib/retry.ts` (+ `src/lib/__tests__/retry.test.ts`) — backoff+jitter, retryable errors
- `src/lib/llm/providers/base.ts` — timeout/abort + retry orçado por tentativa
- `src/lib/idempotency/index.ts` — claim de envio
- `src/lib/outbox/` — claim, retry com backoff limitado, DLQ
- `src/lib/outbox/__tests__/outbound-delivery-safety.integration.test.ts` — E4 contra PostgreSQL real: chave tenant/job-bound, defer por conflito de claim, DLQ de `unknown` e DLQ da liquidação do lembrete recusada pelo cerco de tenant
- `src/modules/financeiro/gateways/providers/asaas/client.ts` — `Idempotency-Key`
- `src/modules/financeiro/services/charge-service.ts` — cobrança idempotente
- Rotas inbound + `resolve-channel-installation.ts` — secret, dedup, freshness

## Alternativas rejeitadas

- Retry genérico em qualquer erro: causa duplo side-effect em POST não-idempotente — proibido.
- Confiar só na dedup do provider (ex.: Evolution): o provider pode não suportar assinatura/idempotência — controles compensatórios (secret + dedup + freshness + claim) são obrigatórios (trilha A4).

## Consequências

- Nenhum client externo novo sem timeout explícito e sem classificação idempotente/não-idempotente.
- `first execution → process; duplicate → ignore/return previous` é verificável por teste de integração em cada facade de envio.
