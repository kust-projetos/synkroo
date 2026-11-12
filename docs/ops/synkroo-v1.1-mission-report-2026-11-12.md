# MISSÃO SYNKROO — Correção e Consolidação V1.1 — Relatório de fechamento

**Baseline auditada:** `main@55393b6` (início) → `main@d9060f4` (HEAD antes da missão).
**Data:** 2026-11-12
**Executor:** Planner OpenCode

## Marco 1 — Recuperar a CI e consolidar correções

### 1.1 Reconciliação worktree/GitHub
- Branches já integradas a `main` (ancestors): `feat/e2e-gw02-tenant-switch`, `fix/e2e-contacts-responsive-selectors`, `fix/e2e-contacts-mobile-back-retry`, `test/e2e-gw02-flaky`.
- Branch `validation/e2e-contacts-zod` NÃO integrada e descartada (remove migrações/infra — destrutiva).
- PRs existentes já mergeados cobrem GW-02/GW-03/GW-10 parcialmente; nenhuma reimplementação feita.

### 1.2 GW-02 — Tenant Switch
- Estado: JÁ consolidado em `main` antes da missão (`context.tsx` usa `update({ user: { clinicId } })`; JWT callback lê `session?.user?.clinicId`; `_handler` valida acesso e retorna perfil alvo).
- Nenhuma alteração adicional necessária. Testes de tenancy PASS.

### 1.3 GW-03 — Conversão de lead
- Estado: `converterLead` (action) já registrava `lead_converted` em `main`.
- Correção aplicada nesta missão: idempotência em reexecução (não insere atividade duplicada quando lead já convertido).
- `converterLeadSemAgendar` e `agendarAvaliacao` já guardavam via `ensurePatientForLead`.

### 1.4 E2E de contatos
- Causa efetiva: `ContactSplitView` usa `useSearchParams` sem `Suspense` boundary (contrato Next.js 15), degradando hidratação/navegação client-side.
- Correção: envolver `<ContactSplitView />` em `<Suspense>` em `contacts-client.tsx`.
- Sem aumento de timeouts ou retries.

### Validação M1
- `npm run typecheck` PASS.
- `npm run lint` PASS (`--max-warnings=0`).
- `npx jest src/modules/comercial` — 11 suites / 62 testes PASS.
- `npx jest src/components/contacts src/app/dashboard/contatos` — 6 suites / 33 testes PASS.

**Resultado M1: PASS (código)** — CI completa depende de runner remoto (não executada nesta rodada).

## Marco 2 — Golden Workflows GW-01..GW-03

- GW-01 (Login → Dashboard): coberto por specs existentes (`e2e/auth/*`); sem mudança.
- GW-02 (Tenant Switch): fixture sintética multi-clínica já presente via seed de testes; spec `e2e/dashboard/clinic-selector.spec.ts`. Validação runtime completa requer DB descartável (não executada nesta rodada — dependência externa de infra local).
- GW-03 (Lead → Paciente → Agendamento): spec `e2e/api/gw03-lead-patient-appointment.spec.ts`. Código de conversão corrigido para idempotência.
- GW-10 (analytics export): preservado, sem ampliação de escopo.

**Resultado M2: PASS (código) / runtime pendente** — execução contra PostgreSQL 17 descartável requer orquestração de DB (contabo dev-exec) não automatizada nesta rodada.

## Marco 3 — Correções operacionais

### 3.1 OpenBao
- Arquivo: `scripts/consume-openbao-staging.ps1`.
- Correção: envolvido em `try/finally` único; túnel iniciado pelo script é encerrado somente se criado por ele; variáveis temporárias (`BAO_ADDR`, `BAO_TOKEN`, `VPS_TARGET_STAGING_PASSWORD`) limpas em todos os caminhos (sucesso, ProbeOnly, falha de leitura, falha do filho).
- ProbeOnly preservado.

### 3.2 PostgreSQL — #93 e #94
- Evidência coletada (read-only) em `contabo-prod`, container `synkroo-prod-postgres`.
- #93: conectividade confirmada (porta 15433, PG 17.11, pgvector 0.8.7, 68 tabelas). Gates D4 de rede/ACL/ledger pendentes (autorização A-REDE).
- #94: confirmado que a role de runtime `synkroo` é **superuser** em produção. Staging já possui `synkroo_staging_app` não-superuser. Criação da role de runtime em produção exige autorização A-PAPEIS.
- Documento: `docs/ops/postgres-93-94-status-2026-11-12.md`.

**Resultado M3: PASS (documentação + wrapper) / pendências externas identificadas.**

## Marco 4 — Preparação do piloto

- Nenhuma funcionalidade nova criada.
- Insumos humanos (clínica participante, profissionais/agenda, WhatsApp autorizado, usuários responsáveis, janela de operação) **não confirmados**.
- Status registrado: `PILOT_AWAITING_HUMAN_INPUT`.
- Não declarado `PROD_READY`.

**Resultado M4: AWAITING_INPUT.**

## Fechamento

| Marco | Resultado |
|---|---|
| M1 — CI e fixes | PASS (código) |
| M2 — GW-01..03 | PASS (código) / runtime pendente |
| M3 — Operacional | PASS (documentação + wrapper) |
| M4 — Piloto | AWAITING_INPUT |

### Commits/PRs
- Branch de trabalho: a ser aberta como PR de consolidação a partir de `main`.
- Commits identificáveis por correção: `fix(comercial): idempotência em converterLead`, `fix(contatos): Suspense boundary para useSearchParams`, `fix(openbao): try/finally para túnel e env temporárias`, `docs(ops): status #93/#94 e relatório de missão`.

### Bugs corrigidos
1. `converter-lead.ts` — atividade `lead_converted` duplicada em reexecução (guard de idempotência).
2. `contacts-client.tsx` — hidratação/navegação quebrada por `useSearchParams` sem `Suspense`.
3. `consume-openbao-staging.ps1` — limpeza de túnel/env não garantida em saídas antecipadas/exceções.

### Testes executados
- `npm run typecheck` — PASS
- `npm run lint` — PASS
- `npx jest src/modules/comercial` — 11 suites / 62 testes PASS
- `npx jest src/components/contacts src/app/dashboard/contatos` — 6 suites / 33 testes PASS

### Pendências externas restantes
- #93: gates D4 de rede/ACL/ledger (A-REDE).
- #94: criação de role de runtime não-superuser em produção (A-PAPEIS).
- M2 runtime: execução GW-01..03 contra PostgreSQL 17 descartável (infra).
- M4: insumos humanos do piloto (clínica, profissionais, WhatsApp, usuários, janela).
- Issue #27: golden workflows — avanço de GW-04..GW-09 bloqueado até consolidação (conforme missão, não iniciados).

### Próxima ação necessária
1. Abrir PR de consolidação e rodar CI completa.
2. Obter autorização A-REDE/A-PAPEIS para #93/#94.
3. Confirmar insumos humanos do piloto ou registrar `PILOT_AWAITING_HUMAN_INPUT` (já registrado).
4. Após CI verde e autorizações, executar GW-01..03 em runtime e avançar issue #27.
