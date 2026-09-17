# Auditoria de Schema de Runtime — Etapa 2.5 (SYN-API-003)

**Data:** 2026-09-17 · **Escopo:** 35 rotas candidatas com `request.json()` · **Critério:** todo input externo deve passar por validação de runtime (Zod).

**Gate central:** `src/core/actions/run.ts:50-51` — `runAction` faz `action.input.safeParse(rawInput)` e rejeita com `invalid_input` (mapeado para 422 `INVALID_INPUT` em `src/lib/api/response.ts:135`). Toda rota que delega o body a `runActionRoute` / `runFinanceiroAction` / `runComercialAction` / `runAtendimentoAction` / `runAtendimentoSystemAction` herda essa validação.

## Resultado

| Veredito | Qtd |
|---|---|
| COVERED (Zod no fluxo, sem mudança) | 31 |
| GAP-FIXADO (schema adicionado nesta etapa) | 3 |
| EXCEÇÃO DELIBERADA (webhook autenticado, payload opaco) | 1 |
| **Total** | **35** |

## Tabela rota × veredito × evidência

| Rota | Veredito | Evidência |
|---|---|---|
| `analytics/noshow-prediction` (POST) | GAP-FIXADO | Schema novo `noshowPredictionBodySchema` em `src/app/api/analytics/noshow-prediction/route.ts:10-14`, parse em `:67`; GET `days` normalizado em `:33-36`. Sem arquivo de teste de rota — cobertura via `src/services/analytics/__tests__/noshow-prediction.service.test.ts` (service, não HTTP). |
| `analytics/noshow-prediction` (GET) | GAP-FIXADO (drive-by) | Mesmo arquivo `:33-36` — `days` agora inteiro positivo com teto 90, default 7. |
| `appointments` (POST) | COVERED | `src/modules/operacional/actions/agendar-consulta.ts:13` (`input: z.object`, uuid/coerce/date) via `runActionRoute` (`src/app/api/appointments/route.ts:77`). |
| `appointments/confirm-response` (POST) | COVERED | `src/modules/operacional/actions/processar-confirmacao-resposta.ts:11` (`.strict()`) via `src/app/api/appointments/confirm-response/route.ts:9`. |
| `dentists` (POST) | COVERED | `src/modules/operacional/actions/criar-dentista.ts:11` via `src/app/api/dentists/route.ts:27`. |
| `dentists/[id]` (PATCH) | COVERED | `src/modules/operacional/actions/atualizar-dentista.ts:11` (id uuid + opcionais) via `src/app/api/dentists/[id]/route.ts:29`. |
| `financeiro/budgets` (POST) | COVERED | `src/modules/financeiro/actions/criar-orcamento.ts:20` (+ `refine` paciente-ou-lead `:29-36`) via `src/app/api/financeiro/budgets/route.ts:21`. |
| `financeiro/budgets/[id]` (PUT) | COVERED | `src/modules/financeiro/actions/atualizar-orcamento.ts:17` via `src/app/api/financeiro/budgets/[id]/route.ts:17`. |
| `financeiro/budgets/[id]/accept` (POST) | COVERED | Sem body — só `{ id }` do path, validado por `aceitarOrcamento` (`src/modules/financeiro/actions/aceitar-orcamento.ts:12`). |
| `financeiro/budgets/[id]/installments` (PUT) | COVERED | `src/modules/financeiro/actions/salvar-parcelas.ts:11` (array `min(1)`) via `src/app/api/financeiro/budgets/[id]/installments/route.ts:16`. |
| `financeiro/budgets/[id]/installments/[installmentId]` (PATCH) | COVERED | `src/modules/financeiro/actions/atualizar-parcela.ts:13` (uuids + opcionais) via `.../[installmentId]/route.ts:11`. |
| `financeiro/budgets/[id]/payments` (POST) | COVERED | `src/modules/financeiro/actions/registrar-pagamento.ts:14` (amount positivo, ids uuid) via `src/app/api/financeiro/budgets/[id]/payments/route.ts:17`. Verificado pós-mudança recente: continua delegando com `idempotencyKey` de header sanitizado (`.trim()`). |
| `financeiro/budgets/[id]/reject` (POST) | COVERED | Sem body — `rejeitarOrcamento` (`src/modules/financeiro/actions/rejeitar-orcamento.ts:11`). |
| `financeiro/budgets/[id]/send` (POST) | COVERED | Sem body — `enviarOrcamento` (`src/modules/financeiro/actions/enviar-orcamento.ts:11`). |
| `financeiro/charges` (POST) | COVERED | `src/modules/financeiro/actions/gerar-cobranca.ts:11` via `src/app/api/financeiro/charges/route.ts:9`. |
| `financeiro/charges/[id]` (GET) | COVERED | Sem body — `obterCobranca` (`src/modules/financeiro/actions/obter-cobranca.ts:12`). |
| `financeiro/charges/[id]/cancel` (POST) | COVERED | Sem body — `cancelarCobranca` (`src/modules/financeiro/actions/cancelar-cobranca.ts:11`). |
| `financeiro/gateway-rules` (POST) | COVERED | `src/modules/financeiro/actions/salvar-regra-roteamento.ts:11` (+ `refine` exatamente-um-escopo `:17-23`) via `src/app/api/financeiro/gateway-rules/route.ts:14`. |
| `financeiro/gateways` (POST) | COVERED | `src/modules/financeiro/actions/salvar-gateway.ts:11` (`provider: z.enum`) via `src/app/api/financeiro/gateways/route.ts:14`. |
| `financeiro/payments/manual` (POST) | COVERED | `registrar-pagamento.ts:14` (mesmo schema do payments por budget) via `src/app/api/financeiro/payments/manual/route.ts:9`. |
| `financeiro/webhooks/[provider]` (POST) | EXCEÇÃO DELIBERADA | Token do provider comparado em tempo constante (`safeTokenEquals`, `src/app/api/financeiro/webhooks/[provider]/route.ts:24-29`; match contra credencial descriptografada `:54-75`); body opaco repassado a `processAsaasWebhook` (idempotente via `gateway_events`, `:92-96`). Não se aplica Zod a payload bruto de provider — proteção citada, sem mudança. |
| `ia/chat` (POST) | GAP-FIXADO | `chat/dto.ts` valida só a SAÍDA (`toPublicChatDto`). Schema novo `iaChatBodySchema` em `src/app/api/ia/chat/route.ts:53-58`, parse em `:108`; `conversationId` não-string agora rejeitado (antes passava no teste de truthiness). Tokens de confirmação usam `z.unknown().optional()` deliberado: o contrato B1 tolera não-string e os descarta via `asOptionalToken` (comportamento fixado em teste) — o schema ancora a forma sem quebrar o fluxo legítimo. Falhas mantêm o contrato 422 existente; teto de `message` segue no gate 400 `PAYLOAD_TOO_LARGE` (`:118-128`). Teste novo em `src/app/api/ia/chat/__tests__/route.test.ts` (caso `conversationId não-string → 422`). |
| `messages/inbound` (POST) | COVERED | Segredo por instalação com compare timing-safe (`resolveChannelInstallation`, `src/modules/atendimento/integrations/resolve-channel-installation.ts:32-44`, checado antes do rate limit em `src/app/api/messages/inbound/route.ts:33-37`); guards de tipo na borda (`:42-48`) + `receberMensagem` strict (`src/modules/atendimento/actions/receber-mensagem.ts:11-19`, `.strict()`) via `runAtendimentoSystemAction` (`:50-58`). |
| `messages/send` (POST) | COVERED | `src/modules/atendimento/actions/enviar-mensagem.ts:30` (`conversationId` uuid, `message` min(1)) via `src/app/api/messages/send/route.ts:30`. |
| `patients` (POST) | COVERED | `src/modules/operacional/actions/criar-paciente.ts:11` via `src/app/api/patients/route.ts:42`. |
| `pipeline/stages` (POST) | COVERED | Destruturação manual alimenta `criarEtapaPipeline` (`src/modules/comercial/actions/criar-etapa-pipeline.ts:11`, `name` min(1), `position` int) via `src/app/api/pipeline/stages/route.ts:15`. |
| `pipeline/stages/reorder` (PATCH) | COVERED | Guard `Array.isArray` na borda + `reordenarEtapasPipeline` (`src/modules/comercial/actions/reordenar-etapas-pipeline.ts:12`, array de `{id uuid, position int}`) via `src/app/api/pipeline/stages/reorder/route.ts:14`. |
| `pipeline/stages/[id]` (PATCH) | COVERED | `src/modules/comercial/actions/atualizar-etapa-pipeline.ts:12` (todos opcionais exceto `stageId`) via `src/app/api/pipeline/stages/[id]/route.ts:12`. |
| `procedures` (POST) | COVERED | `src/modules/operacional/actions/criar-procedimento.ts:11` via `src/app/api/procedures/route.ts:27`. |
| `procedures/[id]` (PATCH) | COVERED | `src/modules/operacional/actions/atualizar-procedimento.ts:11` via `src/app/api/procedures/[id]/route.ts:29`. |
| `reminders/config` (PUT) | COVERED | `src/modules/operacional/actions/salvar-config-lembrete.ts:11` via `src/app/api/reminders/config/route.ts:24`. |
| `waitlist` (POST/PATCH) | COVERED | `entrarWaitlist` (`src/modules/operacional/actions/entrar-waitlist.ts:12`, data `YYYY-MM-DD`) e `atualizarWaitlist` (`.../atualizar-waitlist.ts:12`) via `src/app/api/waitlist/route.ts:47,52`. |
| `waitlist/fill` (POST) | COVERED | `src/modules/operacional/actions/preencher-waitlist.ts:12` (`waitlistId` uuid, `scheduledAt` coerce date) via `src/app/api/waitlist/fill/route.ts:25`. |
| `whatsapp/evolution` (POST) | COVERED | Segredo por instalação (`resolveChannelInstallation`, `src/app/api/whatsapp/evolution/route.ts:65-72`) + validação de forma (`:86-103`) + freshness A4 (`:109-115`) + `receberMensagem` strict downstream (`:117-128`). |
| `whatsapp/send` (POST) | COVERED | `enviar-mensagem.ts:30` (mesmo schema do messages/send) via `src/app/api/whatsapp/send/route.ts:9`. |
| `widget/session` (POST) | GAP-FIXADO | Corpo só com `installationId` (chave opaca, fail-closed contra allowlist de origem `isAllowedWidgetOrigin` + `resolveWidgetInstallation`). Schema mínimo `widgetSessionBodySchema` em `src/app/api/widget/session/route.ts:32-34`, parse em `:56-59`; comportamento idêntico. Sem arquivo de teste de rota — anotado aqui em vez de criar infra nova. |

## Notas

1. **Falsos positivos separados:** 31 das 35 rotas já validam via stack canônica action-route (`runAction` → `safeParse`); o `grep` por `request.json()` sem `.parse(` no mesmo arquivo não enxerga o Zod que vive na action importada.
2. **`ia/chat` mantém 422:** o contrato 422 para body inválido está fixado em dois arquivos de teste (`ia/chat/__tests__/route.test.ts`, `ia/__tests__/chat-route.test.ts`); trocar para 400 seria mudança de contrato além do escopo mínimo — o schema novo rejeita no mesmo status.
3. **Rotas sem body** (accept/reject/send/cancel/charges `[id]` GET) classificadas COVERED: único input externo é o `id` do path, validado como uuid no `input` da action.
4. **Sem cobertura nova de rota** para `noshow-prediction` e `widget/session` (sem arquivo de teste existente; sem scaffolding de infra nova por escopo da etapa).
