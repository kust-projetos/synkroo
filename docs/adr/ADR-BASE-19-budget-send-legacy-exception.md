# ADR-BASE-19: POST /api/budgets/[id]/send legado como exceção permanente documentada

**Status:** ✅ Exceção permanente documentada
**Data:** 2026-10-08 (FIN-FAILFAST-FREEZE)

## Decisão

`POST /api/budgets/[id]/send` permanece como exceção permanente documentada à
[ADR-BASE-06](ADR-BASE-06-action-layer.md) e ao contrato canônico da
[ADR-BASE-10](ADR-BASE-10-api-contracts.md). Nenhuma migração para Action é
executada até decisão explícita de produto.

## Contexto

O send legado diverge do caminho canônico em todos os pontos:

- Lê e marca o orçamento via services diretos (`getBudget` / `markBudgetSent`
  de `@/modules/financeiro`), sem passar por Action (`ADR-BASE-06` exige
  entrada de negócio via Action Layer).
- Resolve o telefone do paciente com acesso direto ao DB (`getDb()` +
  `drizzle-orm` + `patients` em
  `src/services/api-handlers/budgets/[id]/send.ts`), fora de qualquer
  seam público de módulo.
- Dispara o WhatsApp via `enviarMensagemDireta` do módulo atendimento com
  `buildSystemContext` + `runAction` improvisados no handler, em vez de
  uma Action dedicada de envio de orçamento.
- Não existe contraparte canônica: `POST /send` não consta da matriz
  canônica `/api/financeiro/budgets/*`, e o parity test
  (`src/__tests__/api/contract/budget-route-parity.test.ts`) cobre apenas
  GET/POST/PUT/DELETE — o send está fora da matriz método-a-método.

## Evidência

- `src/app/api/budgets/[id]/send/route.ts` → `_handler.ts` → `export *` de
  `@/services/api-handlers/budgets/[id]/send`
- `src/services/api-handlers/budgets/[id]/send.ts`: `getBudget`,
  `markBudgetSent`, `getDb`, `enviarMensagemDireta` via `runAction`
- Cobertura comportamental existente em
  `src/__tests__/api/budgets/send/route.test.ts` (inalterada por este ADR)

## Consequências

- A extinção do send legado está bloqueada até decisão de produto (definir
  Action canônica de envio + sucessor `/api/financeiro/budgets/[id]/send`
  ou remoção deliberada do recurso).
- A sinalização de depreciação da família legada é mantida: headers
  `Deprecation` / `Link rel=successor-version` /
  `X-Synkroo-Legacy-Route` nos adapters strangler, sem alteração de
  contrato ou resposta do send.
- Este ADR é somente documentação: nenhuma mudança de código o acompanha.

## Alternativas rejeitadas

- Migrar o send para Action agora: sem contraparte canônica definida e sem
  decisão de produto sobre o recurso, a migração seria especulativa.
- Remover o send: quebraria consumidores existentes sem substituto.
