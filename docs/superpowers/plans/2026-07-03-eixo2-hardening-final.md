# Eixo 2 — Hardening Final (pós-auditoria)

> **Tipo:** Plano de hardening. Ações corretivas de curto prazo baseadas na auditoria final do Eixo 2 (2026-07-02).
> **Data:** 2026-07-03
> **Status:** Em execução. WPS-1/2, FUT-1/2/3, CRT-1, REP-1 concluídos. DBC-1 deferido — ver §4.5 para detalhes.
> **Escopo:** apenas hardening/stabilization. Nenhum escopo novo de produto.
> **Dependências:** Eixo 2 completo — todos os módulos implementados e testados.

## 1. Contexto

A auditoria final do Eixo 2 (worker1, 2026-07-02) examinou 5 módulos contra specs/planos canônicos e produziu a matriz abaixo. Core (100%) e E-02 Operacional (100%) não requerem ações. Três áreas têm débitos documentados que este plano endereça.

**Fonte de verdade superior:** relatório de auditoria (handoff `conv_mr53ltqo_d37e0093` — msg `msg_mr53ltqo_025636bb`).

## 2. Escopo / Fora de escopo

| Item | Decisão |
|---|---|
| E-01: refatorar `webhook-processor-service.ts` (eliminar `getDb()` residual) | ✅ **Escopo** |
| E-03: adicionar unit tests para services | ✅ **Escopo** |
| E-03: substituir `console.warn` por logger estruturado no cron | ✅ **Escopo** |
| E-03: decidir/documentar repository layer vs schema bridge | ✅ **Escopo** (decisão documental, não code change) |
| Integração: fechar DB connections após `test:integration` | ✅ **Escopo** |
| Core (100%) | ❌ Fora — sem ações |
| E-02 Operacional (100%) | ❌ Fora — sem ações |
| IA (95%) gaps deliberados (Plano 4 multi-agente) | ❌ Fora — expansão de escopo |
| Novo escopo de produto | ❌ Fora |
| Refatoração ampla ou reescrita de módulos | ❌ Fora |

## 3. Matriz de gaps (da auditoria)

| Módulo | Status | Gap | Prioridade |
|---|---|---|---|
| **E-01 Atendimento** | 95% | `webhook-processor-service.ts` usa `getDb()` em helpers internos em vez de delegar 100% ao repository | P1 — risco de regressão ao mudar pool |
| **E-03 Follow-up** | 90% | Zero unit tests para services (só integração); `console.warn` em cron; repository layer não documentado (schema bridge vs diretório próprio) | P1 — cobertura frágil |
| **Integração** | — | `npm run test:integration` reporta `Jest did not exit` (open handles) | P2 — cosmético, não afeta resultados |

## 4. Tasks por módulo

### 4.1 E-01 — `webhook-processor-service.ts` (P1)

**Task WPS-1:** Auditar `getDb()` calls em `src/modules/atendimento/services/webhook-processor-service.ts` e migrar para conversas-repository.

- **Comportamento esperado:** nenhuma mudança de comportamento — o repository já faz as mesmas queries. Apenas mudar de `getDb()` direto para chamada de função no repository.
- **TDD:** se houver query sem equivalente no repository, criar função no repository + testar antes.
- **Verificação:** `npx jest --verbose src/modules/atendimento` + `npm run test:integration` (integração cobre webhook flow).

**Task WPS-2:** Se WPS-1 revelar query que não existe no repository, criar a função com TDD:
1. RED: teste unitário para a nova query no repository
2. GREEN: implementar query Drizzle no repository
3. REFACTOR: trocar chamada em webhook-processor-service

### 4.2 E-03 — Unit tests para services (P1)

**Task FUT-1:** Criar unit tests para `src/modules/followup/services/followup-service.ts`.

- Testar `executarFollowup` com mocks de DB/clinic/patient.
- Testar fluxos: follow-up executado com sucesso, paciente sem contato, módulo desabilitado.
- Usar mocks diretos — sem Docker/DB real.

**Task FUT-2:** Criar unit tests para `src/modules/followup/services/inactive-service.ts`.

- Testar `detectarInativos` com intervalo configurável.
- Testar: inatividade detectada, paciente reativado, sem pacientes inativos.
- Usar mocks diretos — sem Docker/DB real.

**Task FUT-3:** Criar unit tests para `src/modules/followup/services/campaign-service.ts` e `budget-followup-service.ts`.

- Pelo menos 1 teste de sucesso + 1 borda por service.

**Verificação:** `npx jest --verbose src/modules/followup/services` cobre os novos testes.

### 4.3 E-03 — Logger estruturado no cron (P1)

**Task CRT-1:** Substituir `console.warn` por `logger.warn` ou `logger.info` em `src/app/api/cron/followups/route.ts`.

- Usar o logger existente em `@/lib/logger`.
- Comportamento inalterado; apenas troca de saída.
- **TDD não aplicável** — sem mudança de comportamento.

### 4.4 E-03 — Documentar repository decision (P2)

**Task REP-1:** Adicionar nota na spec ou plano E-03 explicando a decisão de schema bridge vs diretório `repositories/`.

- Local: `docs/superpowers/specs/2026-06-23-eixo2-followup-retencao-modulo-design.md` (seção Fronteiras ou nova subseção).
- Conteúdo: "E-03 não tem repositories/ próprios porque opera sobre dados de outros módulos. O schema bridge aponta para tabelas existentes. Queries específicas de follow-up (quando surgirem) vão em `src/modules/followup/repositories/` — criar diretório conforme a necessidade."

**TDD não aplicável** — documentação.

### 4.5 Integração — DB cleanup (P2) — DEFERRED

**Task DBC-1:** `npm run test:integration` — 18 suites, 135 testes, exit 0. Warning `Jest did not exit one second after the test run has completed` persiste.

**Status atual:**
- 3 suites followup corrigidas com `closeDb()` nos `afterAll` — limpas.
- `forceExit: true` foi tentado e rejeitado (mascaramento).
- 6 suites restantes (conversations, gates, inbound-flow, send, availability, scheduling) usam `new Pool()` local com `await pool.end()` — `pool.end()` resolve antes do TCP close completo, socket residual fica em `writeOnly`.

**Causa-raiz:**
- `pg-pool/index.js` (v8.21.0): `pool.end()` remove clientes de `_clients` sincronamente, resolve sem esperar `client.end(callback)`. O socket TCP fica em half-close (`FIN_WAIT_2`) até o PostgreSQL responder.
- Nenhum fix mínimo seguro encontrado: `allowExitOnIdle` não afeta `pool.end()`, `process.nextTick`/`setImmediate` não elimina o warning em Jest 29, `Client.prototype.end` override com `stream.destroy()` também não (close event é async).
- `--detectOpenHandles` retorna vazio — handles são recursos internos não-nomeáveis.

**Decisão:** Deferir. Débito técnico documentado. Revisitar quando atualizar pg-pool ou Jest (versões futuras podem resolver o timing).

- **TDD não aplicável** — cleanup de teste, não comportamento de produção.

## 5. Critérios de aceite

1. `webhook-processor-service.ts` não contém mais `getDb()` calls diretas (só via repository).
2. `src/modules/followup/services/` tem no mínimo 1 unit test por service (4 services × 1 teste = 4+).
3. `src/app/api/cron/followups/route.ts` usa `logger.warn`/`logger.info` em vez de `console.warn`.
4. Spec E-03 documenta decisão de schema bridge vs repositories.
5. `npm run test:integration` fecha sem warning de open handles. **(DEFERRED — ver §4.5)**

## 6. Verificação

```bash
# Typecheck
npm run typecheck
npm run typecheck:ia-bridge
npm run typecheck:ia-agent

# Unit tests focados
npx jest --verbose src/modules/atendimento src/modules/followup

# Integration tests (DB real)
npm run test:integration

# Sem mudança de comportamento nos módulos 100%
npx jest --verbose src/modules/core src/modules/operacional src/core/rbac
```
