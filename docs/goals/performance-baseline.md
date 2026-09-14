# Baseline de Performance — G5 (W28)

**Data:** 2026-09-14
**Tipo:** baseline inicial — **NENHUM SLO é imposto nesta fase** (SPEC W28).
**Pré-requisito:** roda após F2 (contrato do readiness interno é do owner F).

## Propósito

Registrar o ponto de partida mensurável de performance (bundle, SQL, latências) para que otimizações futuras (G2/G4) tenham comparação before/after. Este documento consolida por referência — não duplica conteúdo das fontes.

## Fontes (por referência)

- **Bundle / first load por rota:** spike designado `docs/spikes/2026-09-14-bundle-baseline.md` — produzido em **G2** (com `@next/bundle-analyzer`, antes de qualquer otimização). Enquanto pendente, nenhuma afirmação de tamanho de bundle é feita aqui.
- **SQL / queries críticas:** spike designado `docs/spikes/2026-09-14-sql-profiling.md` — produzido em **G4** (`EXPLAIN ANALYZE` nas queries críticas com banco representativo; índice só com antes/depois). Enquanto pendente, nenhum índice é proposto aqui.
- **Ledger/estado do programa:** `docs/goals/roadmap-143-resume.md` (autoridade via `npm run roadmap:check`).
- **Contrato de API:** `docs/adr/ADR-BASE-10-api-contracts.md`.
- **Política de retry/timeouts:** `docs/adr/ADR-BASE-16-retry-idempotency-policy.md`.
- **Runbook de deploy:** `docs/ops/w11-rollout-runbook.md`.

## Mecanismos de medição contínua

1. **`durationMs` no readiness interno (F2):** `GET /api/internal/readiness` (protegido, barato — ver `src/app/api/internal/readiness/route.ts`) passa a incluir a latência de DB da checagem (`{ status: 'ready', durationMs }`). `/api/health` permanece **liveness puro, sem banco** (consistência com F2) e nunca carrega métrica.
2. **Telemetria por provider call (B2):** cada chamada LLM registra no log estruturado o formato mínimo `{ provider, model, latencyMs, attempt, usage }` (tokens via `LlmUsage`, tentativa via orçamento de retry — referência: `src/lib/llm/providers/base.ts`), com correlation/request id propagado (app → handle → `runTurn` → provider) para rastrear um incidente de ponta a ponta.
3. **Logs JSON com `requestId`/`correlationId`** conforme observabilidade do runbook (`src/lib/logger.ts`).

## Procedimento p50/p95 (script de carga simples — futuro, não implementado)

1. Script manual (proposto `scripts/` — **descrever, não implementar** nesta etapa): aquece a rota, dispara N requests sequenciais contra staging para cada endpoint crítico (health, readiness autenticado, listagens de agenda/leads/pacientes), coleta latências e imprime p50/p95/max + taxa de erro.
2. Rodar contra **staging** (nunca produção sem owner), com `DATABASE_URL` de staging e segredos via fingerprint apenas.
3. Registrar o resultado datado neste diretório (`docs/goals/`) como nova linha de baseline; comparar apenas mesma rota, mesmo ambiente, mesma carga.

## Aceite de G5

- Baseline documentado (este arquivo + spikes G2/G4 quando produzidos).
- `/api/health` sem consulta a banco; readiness interno com `durationMs` (contrato coordenado com owner F).
- Nenhum SLO imposto; SLOs futuros usam este baseline como referência.
