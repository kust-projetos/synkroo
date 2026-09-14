# Plano — Consolidação Hardening V1 (Synkroo)

> **STATUS DE EXECUÇÃO (2026-09-14 — PLANO CONCLUÍDO):** todas as 4 ondas executadas via orquestração de subagentes (ciclo coder→tester→reviewer por trilha), integradas em `main` local (16 merges `--no-ff`, sem push) com bateria global **10/10 verde**: lint, tsc, typechecks ia-bridge/ia-agent, unit (346 suites / 2538 testes), integration (45 suites / 256), security (144), release (49), build, build:cf.
>
> **Trilhas concluídas e mergeadas:** A1 (Asaas timing-safe) · C1+C3 (senha async v1 + cleanup auth) · D1 (routePolicy + gate filesystem) · E1 (FECHADA ALREADY_COMPLIANT — constraint `appointments_no_overlap` já existia desde `0001`) · A2+A3 (resiliência + idempotência outbound com estados de claim) · A4 (freshness inbound) · B1 (IA: cap, binding de principal + reserva atômica, deadline de turno, prompt delimitado, Zod em outputs) · B2 (telemetria estruturada com redaction) · D2+D3 (18 rotas → envelope canônico + Zod nos gaps) · F1 (Production-mode E2E renomeado; `continue-on-error` mantido condicionado a estabilidade no CI) · F2 (liveness puro, health/db sanitizado, readiness real com ledger de migrations) · F3 (boundaries endurecidos + cleanup de shims/rotas 410) · F4 (fonte canônica, ADRs 15–17, ADR-BASE-14 atualizado) · F5 (smoke pós-deploy + runbook) · G1 (queryKeys escopadas por clínica + cancelQueries + gate) · G2 (bundle baseline; 0 migrações — evidência provou boundaries dinâmicos existentes) · G3 (Playwright alinhado 1.59.1, engines node 22) · G4 (profiling SQL: 2 índices com evidência, 4 avaliados/não aplicados) · G5 (baseline consolidado em `docs/goals/performance-baseline.md`).
>
> **Integração B1×B2:** resolução por hunks (propagação/segurança da B1 + telemetria da B2); decisão semântica: `needs_identity`/`needs_confirmation` NÃO re-armam pending (at-most-once, fail-closed).
>
> **Residuais conhecidos (registrados em AGENTS.md §Débitos e docs):** ~17 handlers em `src/services/api-handlers/**` sem envelope canônico (consumidor acoplado campaign-wizard↔segments/preview); F3 onda (c) — 35 violações `services→modules` antes de endurecer; predicates amplos de mutation no frontend (over-invalidation seguro); F1 flag `continue-on-error` até estabilidade no CI; flaky raro em `atendimento/gates` (1/256, verde no re-run); monitorar taxa de 409 freshness e warns de telemetria pós-deploy.

> **STATUS DE EXECUÇÃO (2026-09-13, fim da Onda 1):** todas as trilhas da Onda 1 concluídas com ciclo coder→tester→reviewer e APPROVED.
>
> | Etapa | Branch | Commits | Status |
> |---|---|---|---|
> | A1 (Asaas timing-safe) | `feat/hardening-a1-asaas-timing-safe` | `65e38dee` | APPROVED |
> | C1 (senha async v1) | `feat/hardening-c1-password-async` | `f1076ce4`, `7688fb9b`, `05fa2774` | APPROVED (após fixes de DoS/CAS/parser) |
> | D1 (routePolicy + gate filesystem) | `feat/hardening-d1-route-policy` | `eb42ed7c` | APPROVED |
> | E1 (agenda) | — | — | FECHADA: ALREADY_COMPLIANT (constraint `appointments_no_overlap` existe desde `0001`) |
> | A2+A3 (resiliência + idempotência outbound) | `feat/hardening-a2a3-external-resilience` | `4df975c0`, `b702ad80`, `952ca7f4`, `24e99753` | APPROVED (após fixes de estados de claim/facade/abort) |
> | A4 (freshness inbound) | `feat/hardening-a4-inbound-replay` | `cf9365cc`, `f41ba2f4` | APPROVED |
> | B1 (IA transporte+prompt) | `feat/hardening-b1-ia-hardening` | `894430ed`..`b1ec21c9` (18 commits) | APPROVED (partes 1+2, 5 ciclos) |
>
> Próximo: **Onda 2** — D2 (migração de contrato servidor+consumidor, em lotes) → D3, B2 (telemetria), F1 (Production-mode E2E bloqueante), F2 (health/readiness).
> Escopo ratificado pelo Planner: `src/services/rag/rag.service.ts` e `src/services/api-handlers/knowledge.ts` integram o hardening knowledge da B1 (defesa em profundidade sob rotas B-owned).

**Data:** 2026-09-13
**Fonte:** `docs/superpowers/specs/` — SPEC V1 (consolidação técnica) + auditoria de estado real `2026-09-13-consolidacao-hardening-v1-auditoria.md`
**Branch de trabalho:** feature branches a partir de `main`; uma trilha por PR.
**Autorização:** refatoração estrutural autorizada pela SPEC §4; restrições da SPEC §39/§40 em vigor.

## 0. Regras de execução do plano

1. **Nada classificado ALREADY_COMPLIANT na auditoria é reimplementado.** Os itens correspondentes viram apenas verificação (§9) ou manutenção contínua.
2. Ciclo por etapa (SPEC §37): caracterizar → teste RED quando aplicável → implementar → GREEN → verificação de integração → review independente → receipt/documentação.
3. Toda mudança de schema via migration (expand → migrate → contract, SPEC W27).
4. Breaking change **interno** permitido; contrato externo (dashboard, webhooks de providers, widget) preservado ou migrado explicitamente.
5. Após 2 tentativas falhas no mesmo problema: acionar `debugger`; incerteza arquitetural: `architect` advisor.

Comando de verificação canônico (usar o recorte por risco):

```bash
npm ci && npm run lint && npm run typecheck
npm run typecheck:ia-bridge && npm run typecheck:ia-agent
npm test && npm run test:integration:run
npm run test:security && npm run test:release
npm run build && npm run build:cf
```

E2E de produção-mode (hoje não bloqueante): `npm run test:e2e:production`.

---

## 1. Mapa de trilhas, ownership exclusivo e paralelização

Regra: **cada arquivo tem um único owner de escrita**. Trilhas só rodam em paralelo quando seus escopos são disjuntos; sobreposições inevitáveis foram resolvidas por atribuição exclusiva ou serialização explícita (coluna "Serialização"). Todo helper compartilhado novo aparece formalmente no ownership da trilha responsável.

| Trilha | Ownership de escrita (arquivos) | Etapas | Paralela com | Serialização explícita |
|---|---|---|---|---|
| **A — Integrações/mensageria** | `src/app/api/financeiro/webhooks/**`, `src/app/api/whatsapp/evolution/**`, `src/app/api/messages/inbound/**`, `src/modules/atendimento/services/{evolution-service,channel-service}.ts`, `src/modules/atendimento/integrations/resolve-channel-installation.ts`, `src/modules/financeiro/gateways/**`, `src/lib/whatsapp/send.ts`, helper novo `src/lib/http/**` (A2) | A1→A2→A3→A4 | B, C, D, E, F, G | rotas A-owned ficam **fora** do escopo de D2/D3; A preserva as assinaturas públicas de `send.ts`/`channel-service` (consumidores em rotas não são editados por A) |
| **B — IA/Workers** | `src/core/ia-agent/**`, `src/core/ia-channel/**`, `src/core/agent-bridge/**`, `src/workers/**`, `src/lib/llm/**`, `src/app/api/ia/**`, `src/app/api/knowledge/**` | B1→B2 | A, C, D, E, F, G | rotas B-owned ficam fora de D2; migração de contrato dessas rotas, se necessária, é feita pela própria B |
| **C — Auth/tenancy core** | `src/lib/auth/password.ts`, `src/lib/auth/auth.ts`, `src/lib/auth/permissions.ts` (C3), `src/repositories/{appointments,dentists,procedures}/**` e seus consumidores imediatos | C1, C2, C3 (C1/C2 independentes) | A, B, D, E, F, G | C **não** toca `src/lib/auth/context.tsx` (owner: G); consumidores de `findById` que sejam rotas: C2 (Onda 1) precede D2 (Onda 2) — sem sobreposição temporal; re-basear se antecipado |
| **D — Rotas/contrato** | `src/middleware.ts`, `src/lib/route-policy.ts` (novo), `src/lib/api/**`, `src/lib/validations/**`, demais `src/app/api/**` não atribuídos a A/B | D1→D2→D3 | A, B, C, E, F | arquivos de consumidor frontend (`src/lib/hooks/**`, `src/hooks/**`) ficam **temporariamente** sob o lote D2 durante a Onda 2; G1 só inicia após D2 concluído |
| **E — Agenda** | `src/lib/db/migrations/**`, `src/modules/operacional/**` | E1 | todas | migrations de índice (G4, Onda 3) só após E1 concluída |
| **F — CI/docs/governança** | `.github/workflows/**`, `docs/**`, `scripts/**`, `AGENTS.md`, `CLAUDE.md`, `eslint.rules.json`, `src/services/api-handlers/health*` + `src/app/api/internal/readiness/**` (F2), shims `@deprecated` de `src/repositories/{leads,pipeline}` e `src/services/leads/*` (F3) | F1→F2→F3→F4→F5 | todas | F3 só após D2 e G1 (remove shims sobre código já migrado); cleanup de `permissions.ts` movido para **C3**; dedup de hooks movido para **G1** |
| **G — Frontend** | `src/lib/hooks/use-queries.ts`, `src/hooks/**`, `src/components/**`, `src/lib/auth/context.tsx`, `package.json` (G3) | G1→G2→G3→G4→G5 | A–F (por onda) | inicia na Onda 3, após D2 (contrato HTTP estável) e B1 (Onda 1); mudanças no readiness (G5) coordenadas com owner F, pós-F2 |

Sequência macro (respeita SPEC §38, ajustada pela auditoria e pela revisão):

```text
Onda 1 (Fase 1 — segurança/invariantes): A1→A2→A3→A4 | B1 | C1, C2, C3 | D1 | E1
Onda 2 (Fase 2 — confiabilidade):        D2→D3 | B2 | F1 | F2
Onda 3 (Fase 3 — otimização):            G1→G2→G3 | G4 (pós-E1) | G5 (pós-F2)
Onda 4 (Fase 4 — governança):            F3→F4 | F5 (smoke pós-deploy)
```

Checagem de dependências entre ondas (revisão): nenhuma trilha paralela modifica o mesmo arquivo; contratos consumidos simultaneamente foram serializados — envelope HTTP (D2 → G1), payload/tokens do `ia/chat` (B1, Onda 1 → G, Onda 3), contrato do readiness (F2, Onda 2 → G5, Onda 3), comportamento de `send.ts`/`channel-service` (A preserva assinaturas), migrations (E1, Onda 1 → G4, Onda 3).

`npm run test:e2e:production` roda em todas as ondas como verificação; o bloqueio (F1) só é ativado após a suíte estar estável.

---

## 2. Trilha A — Integrações: webhooks, idempotência outbound, resiliência (W7, W8, W30)

### A1 — Token Asaas com timingSafeEqual

- **Classificação:** CHANGE_REQUIRED (auditoria W7).
- **Arquivo:** `src/app/api/financeiro/webhooks/[provider]/route.ts`.
- **Mudança:** substituir comparação `===` do token (`asaas-access-token`/`x-asaas-token` vs `decryptGatewayCredentials()`) por `crypto.timingSafeEqual` com guard de tamanho, alinhado ao padrão de `whatsapp/webhook` e `cron/*`.
- **Testes:** security test de token inválido → 401; regressão do fluxo de webhook de pagamento (dedup existente não pode regredir).
- **Aceite:** comparação constant-time; nenhum token aceito extra; `npm run test:security` verde.

### A2 — Timeout/retry nos clients externos

- **Classificação:** CHANGE_REQUIRED (W30).
- **Arquivos:** `src/modules/atendimento/services/evolution-service.ts` (`request`), `src/modules/financeiro/gateways/providers/asaas/client.ts` (3 fetchs), `src/modules/atendimento/services/channel-service.ts` (`sendInstagram`, sidecar Playwright).
- **Mudança:** helper compartilhado de fetch (proposto: `src/lib/http/` — path novo, decidir na implementação se usa `src/lib/` existente) com: connect/request timeout explícito (`AbortSignal.timeout`), `retryableStatuses` (429/5xx/rede), retry **somente** para operações idempotentes (GET ou POST com `Idempotency-Key`), backoff com jitter, budget único de retry por operação. Migrar os clients para o helper. Padrão de referência: `src/lib/llm/providers/base.ts`.
- **Testes:** unit com fetch mockado — timeout dispara erro estruturado; status não-retryable não retrya; operação não-idempotente não retrya.
- **Aceite:** nenhum `fetch` externo sem timeout explícito nestes arquivos (grep).

### A3 — Idempotência no envio outbound

- **Classificação:** CHANGE_REQUIRED (W8).
- **Arquivos:** `evolution-service.ts:sendTextMessage`, `channel-service.ts:sendWhatsApp/sendInstagram`, `src/lib/whatsapp/send.ts`.
- **Mudança:** identificador estável por operação lógica (id da mensagem interna/registro de envio) passado como `Idempotency-Key` ao Evolution quando o provider suportar; quando não suportar, registro de claim antes do envio reutilizando `src/lib/idempotency` (`withIdempotency`) ou outbox para envios enfileiráveis. **Depende de A2** (mesmos arquivos).
- **Nota:** Asaas não entra nesta etapa — a idempotência de cobrança Asaas já é ALREADY_COMPLIANT (auditoria W8: `Idempotency-Key` em create/cancel) e não existe caso documentado de idempotência Asaas em mensageria.
- **Testes:** integração — retry duplicado não envia duas vezes (dedup comprovado).
- **Aceite:** `first execution → process; duplicate → ignore/return previous` verificável por teste.

### A4 — Replay/freshness nos transports inbound (Evolution + messages/inbound)

- **Classificação:** PARTIAL (W7) — gap explícito da auditoria.
- **Arquivos:** `src/app/api/whatsapp/evolution/route.ts`, `src/app/api/messages/inbound/route.ts`, `src/modules/atendimento/integrations/resolve-channel-installation.ts`.
- **Pré-requisito:** levantar as capacidades reais do provider (Evolution API webhook: suporta assinatura HMAC? timestamp assinado?) por documentação oficial/observação empírica. **Não inventar assinatura que o provider não suporte.**
- **Mudança por cenário:**
  - provider suporta assinatura → validar HMAC + timestamp como no padrão Meta (`whatsapp/webhook`/`instagram/webhook`);
  - provider **não** suporta → formalizar controles compensatórios, documentando cada um: shared secret por instalação (existe — `resolveChannelInstallation`), dedup por event-id (`messages_external_provider_event_unique`, existe), **timestamp/freshness** (implementar: janela máxima que rejeita payload antigo/futuro), idempotência downstream (existe).
- **Testes:** replay do mesmo payload → dedup sem reprocessar side-effects; timestamp fora da janela → rejeitado; secret inválido → 401.
- **Aceite:** controles implementados e limitações residuais documentadas no receipt da etapa e em `docs/security/`; nenhum replay aceito dentro da janela testada.

---

## 3. Trilha B — IA/Workers (W12, W13)

### B1 — Endurecimento do transporte e do prompt (núcleo P1)

- **Classificação:** PARTIAL/CHANGE_REQUIRED (auditoria W12/W13).
- **Arquivos:** `src/app/api/ia/chat/route.ts`, `src/core/ia-agent/personas.ts`, `src/lib/llm/providers/base.ts` (ou camada de orquestração), `src/core/ia-channel/agent-invoker.ts`, `src/core/ia-agent/provider-zen.ts`, `src/app/api/knowledge/*`.
- **Mudanças (contrato preservado; permitir versão v3 do rpc-contract se necessário):**
  1. Cap de payload em `/api/ia/chat` (`maxLength` de message + limite de contexto) antes de chegar ao DO/provider.
  2. `/api/ia/chat` não confia em `confirmedToken`/`identityVerifiedToken` do body sem validação própria (hoje confia no DO) — mover verificação para o boundary do app ou assinar com escopo de sessão.
  3. Delimitar conteúdo externo como **dado** no prompt (`personaSystemPrompt`): contexto do interlocutor e history entre marcadores cotados, instrução system separada; RAG/knowledge tratado como untrusted quando injetado.
  4. Validação runtime de **todo output estruturado do provider consumido pela aplicação** — hoje `JSON.parse` manual, e parse não é validação: envelope de resposta (`choices`/`message`/`tool_calls`/`usage`), `tool_calls[].function.arguments` e qualquer payload estruturado (classificação, `pendingAction`) passam por schema Zod (ou equivalente) **antes do uso**; `pendingAction.args` persistido no DO é revalidado contra o schema da action no `confirm`.
  5. Alinhar timeout budget: provider < invoker (30s vs 25s hoje) e teto total de retries por turn (5 iterações × provider retries — definir budget único).
  6. Propagar correlation/request id: app → `issueHandle` → `runTurn` → provider, presente em logs.
- **Testes determinísticos (gates de CI — prova estrutural, não probabilística):**
  1. conteúdo externo tratado como dado/untrusted — teste unitário do builder de prompt assegura que conteúdo externo (WhatsApp/RAG/interlocutor do banco) sai delimitado/cotado e separado do system;
  2. tools deny-by-default — contract test da allowlist (`AGENT_SAFE_ACTIONS`/`isAgentSafeAction`): ação não listada é recusada sem chamada ao modelo;
  3. args validados — schema Zod rejeita args e envelope malformados antes do consumo pela aplicação;
  4. autorização/RBAC fora do modelo — teste prova que o único caminho de execução passa por allowlist + `runAction` com RBAC (não existe rota que contorne);
  5. confirmation/identity tokens verificados e vinculados — `/api/ia/chat` recusa token não emitido ou vinculado a outro contexto (conversa/sessão); regressão do fluxo `pendingAction` (confirm/identity).
- **Eval adversarial de LLM (probabilística):** suíte separada, manual/periódica (ex.: script em `scripts/` + cenários em `docs/`), **complementar** — nunca substitui nem ocupa o lugar dos gates determinísticos como condição de merge.
- **Aceite:** nenhum output estruturado consumido sem schema; nenhuma string do body chega ao provider sem cap; gates 1–5 verdes no CI; `npm run typecheck:ia-agent`/`:ia-bridge` verdes.

### B2 — Correlation id ponta a ponta + telemetria mínima (conclui W12/W20 IA)

- **Depende de:** B1.
- **Arquivos:** `src/core/ia-agent/orchestrator-logic.ts`, `bridge-service.ts`, wranglers (`observability` já habilitado).
- **Mudança:** logs estruturados com requestId/clinicId/operação/latência nos workers; `LlmUsage` (tokens, já capturado) + latência por chamada no log `aiLogger`; erros estruturados do rpc-contract em vez de colapso para `FALLBACK`.
- **Testes:** contract test do bridge com erro estruturado; smoke manual de turno com log correlacionado.
- **Aceite:** um incidente simulado é rastreável por correlation id do request ao provider.

---

## 4. Trilha C — Auth/tenancy core (W1, W4)

### C1 — Senha async versionada

- **Classificação:** CHANGE_REQUIRED (W4).
- **Arquivos:** `src/lib/auth/password.ts`, chamadores `src/lib/auth/auth.ts:authorize`, `src/repositories/auth/*`.
- **Mudança:** `scrypt` callback/promise-based; formato versionado `scrypt$v1$<params>$<salt>$<hash>`; `verifyPassword` aceita legado (`salt:hash`) e v1; re-hash transparente para v1 no login bem-sucedido de hash legado. **Nenhuma senha atual é invalidada.**
- **Testes:** hash pré-existente continua autenticando (fixture de hash legado); novo formato; verificação sob carga concorrente não bloqueia event loop (smoke de tempo).
- **Aceite:** migração sem breaking; `timingSafeEqual` preservado; salt aleatório preservado.

### C2 — Eliminar repositories legados não-escopados

- **Classificação:** PARTIAL (núcleo ALREADY_COMPLIANT) (W1) — único gap real de tenancy.
- **Arquivos:** `src/repositories/appointments/index.ts:findById`, `src/repositories/dentists/index.ts:findById/update`, `src/repositories/procedures/index.ts:findById` + consumidores.
- **Mudança:** primeiro mapear todos os consumidores (`rg`); characterization tests nos fluxos atuais; migrar consumidores para as variantes escopadas dos modules (`operacional/repositories/*:findById(clinicId, id)` etc.); em seguida deprecar e remover as assinaturas não-escopadas. Se houver consumidor legítimo sem escopo (ex.: signup), documentar exceção explicitamente.
- **Testes:** negativos cross-tenant para cada fluxo migrado (clinic A → recurso B → 404); regressão funcional dos fluxos.
- **Aceite:** `rg "findById\(" src/repositories/appointments src/repositories/dentists src/repositories/procedures` não retorna assinatura sem clinicId; suíte cross-tenant existente permanece verde.

### C3 — Cleanup de helpers de autorização mortos

- **Classificação:** PARTIAL (W26) — movido de F3 por ownership (`src/lib/auth/permissions.ts` pertence à trilha C).
- **Arquivo:** `src/lib/auth/permissions.ts` (`hasMinRole`/`isAdminOrAbove` sem uso em routes — confirmar com `rg` antes de remover).
- **Testes:** suíte existente + lint.
- **Aceite:** zero referências residuais a esses helpers.

---

## 5. Trilha D — Rotas: política, contrato e validação (W3, W5, W6)

### D1 — routePolicy declarativa + teste filesystem

- **Classificação:** PARTIAL (W3).
- **Arquivos:** `src/middleware.ts` → extrair para `src/lib/route-policy.ts` (path proposto); novo teste em `src/__tests__/`.
- **Mudança:** mover `PUBLIC_EXACT`/`PUBLIC_PREFIXES`/`SIGNED_TRANSPORT` para estrutura declarativa consumida pelo middleware, **sem mudança de comportamento** (testes existentes `middleware.*` são a rede). Novo teste que enumera `src/app/api/**/route.ts` e falha se nenhuma classificação cobrir a rota (default = protegido).
- **Testes:** os existentes + o teste filesystem novo.
- **Aceite:** criar rota fictícia sem classificação → teste falha (demonstração no PR); middleware verde.

### D2 — Migração de rotas legadas para o contrato canônico (servidor + consumidor)

- **Classificação:** PARTIAL (W5) — gap de **adoção**, não de existência.
- **Arquivos (API):** ~69 usos legados de `validateApiAuth` + `NextResponse.json` direto (contar exato com `rg -l "validateApiAuth" src/app/api` como primeira tarefa). Fora de escopo: rotas A-owned (`financeiro/webhooks/**`, `whatsapp/evolution/**`, `messages/inbound/**`) e B-owned (`ia/**`, `knowledge/**`) — ver mapa de ownership.
- **Processo obrigatório por lote (mudança servidor + consumidor):**
  1. **identificar consumidores** de cada rota (`rg` pelo caminho/envelope — rotas do dashboard, hooks React Query, chamadas server-side);
  2. **characterization/contract tests** do contrato atual (status, shape de resposta, códigos de erro);
  3. migrar **API e consumidor atomicamente no mesmo PR**; quando o consumidor não puder mudar junto, introduzir **adapter temporário** (shaping de resposta no server ou na camada de fetch) para não quebrar o consumidor legado;
  4. remover adapter/compatibilidade **somente após zero consumidores legados** (verificação por `rg`).
- **Premissa proibida:** envelopes diferentes não são assumidos compatíveis por estarem na mesma origem — a prova é o contract test + o consumidor migrado.
- **Lotes sugeridos:** crm → comercial → financeiro → operacional → notifications/reports.
- **Testes:** contract test por lote (status/códigos/envelope) + teste do consumidor migrado; regressão E2E das telas afetadas.
- **Aceite:** `rg -l "validateApiAuth" src/app/api | wc -l` → 0 (ou lista mínima com justificativa registrada); zero adapters temporários remanescentes; envelope único nas respostas.
- **Ownership/serialização:** consumidores frontend (`src/lib/hooks/**`, `src/hooks/**`) ficam sob o lote D2 durante a Onda 2; **G1 inicia somente após D2 concluído**. Lotes são PRs independentes, sequenciais por domínio.

### D3 — Validação nos gaps + consolidação de schemas

- **Depende de:** D2 (mesmos arquivos de rotas).
- **Classificação:** PARTIAL (W6).
- **Arquivos:** `src/app/api/leads/route.ts` (POST sem schema), `src/app/api/whatsapp/webhook/route.ts:parseMetaMessage` (parser manual → Zod), validações inline duplicadas (`app/api/contacts/[id]/tags|notes`, `consents`, `treatment-plans`, `custom-fields`, `change-password`, `legacyCreateBudgetSchema`) → consolidar em `src/lib/validations/`.
- **Testes:** payload malformado → 400 com envelope canônico; regressão dos fluxos.
- **Aceite:** nenhum boundary externo listado aceitando shape não validado; duplicações removidas.

---

## 6. Trilha E — Agenda (W11) — **FECHADA: ALREADY_COMPLIANT**

### E1 — Constraint de slot de agenda — **fechada sem implementação**

- **Descoberta da investigação (2026-09-13):** a garantia de banco **já existe** — constraint `appointments_no_overlap` (`EXCLUDE USING gist` com `int8range` IMMUTABLE, adjacência `[)`, predicado `status NOT IN ('cancelled','no_show') AND deleted_at IS NULL`, `COALESCE(duration_minutes,30)`) criada pela migration `0001_dapper_overlap.sql` com preflight de overlaps, `btree_gist` habilitado e **testes de integração de overbooking** (`src/repositories/__tests__/overbooking/integration.test.ts`: overlap, concorrência, cancelled/no_show, duração NULL, adjacência). A criação de appointments não depende de `FOR UPDATE` de slot; o código traduz `23P01` → conflito de negócio (`scheduling-service.ts:44,64`).
- **Decisão (SPEC §3 — não reimplementar o que existe corretamente):** nenhuma migration nova. Criar uma segunda constraint duplicaria a garantia e/ou divergiria semântica (timezone/IMMUTABLE).
- **Residuais registrados (não-bloqueantes):** slots com `dentist_id NULL` não são barrados pela constraint (semântica intencional — mudança de produto, fora de escopo); checagem TOCTOU redundante no legado `src/repositories/appointments/index.ts:541-601` (sem bypass — o UPDATE continua barrado; tratado no escopo C2).
- **Ação operacional (EXTERNAL):** confirmar em staging/produção que a migration `0001` foi aplicada: `SELECT conname FROM pg_constraint WHERE conrelid='appointments'::regclass AND conname='appointments_no_overlap';` — registrar no runbook de deploy (`docs/ops/`).

---

## 7. Trilha F — CI, docs, governança (W17, W18, W23, W24, W25, W26)

### F1 — Production-mode E2E bloqueante

- **Classificação:** PARTIAL (W17).
- **Arquivo:** `.github/workflows/ci.yml` (job "Production E2E (no retries)", `continue-on-error: true` na linha ~98).
- **Mudança:** 1) renomear job/step para "Production-mode E2E"; 2) rodar a suíte N vezes (ou por alguns dias de PRs) para medir estabilidade; 3) remover `continue-on-error: true`. Se flaky, corrigir specs antes de remover a flag — a flag **não** sai com suíte vermelha.
- **Aceite:** job bloqueante e verde; nome reflete o que executa.

### F2 — Health/readiness semântica

- **Classificação:** PARTIAL (W19).
- **Arquivos:** `src/services/api-handlers/health.ts`, `health/db.ts`, `src/app/api/internal/readiness/route.ts`.
- **Mudança:** `/api/health` → liveness puro (sem DB), sem `error.message` do driver; `/api/health/db` → sanitizar (sem contagens/erros por tabela) ou exigir auth; `/api/internal/readiness` → readiness real (DB + dependências essenciais), sem detalhes internos.
- **Testes:** contrato dos 3 endpoints (payload shape + status).
- **Aceite:** nenhum detalhe de schema/erro interno exposto publicamente; liveness não fica 503 em flap de Hyperdrive.

### F3 — Boundaries progressivos + cleanup (W23, W26)

- **Classificação:** PARTIAL.
- **Arquivos:** `eslint.rules.json`; shims `@deprecated` sem consumidores (`src/repositories/leads`, `src/repositories/pipeline`, `src/services/leads/*`, rotas 410).
- **Mudança:** restrição progressiva do `default: allow` (começar por `src/services/*` legacy); remoção de código morto **com confirmação de zero referências** por item.
- **Movido por ownership:** cleanup de `src/lib/auth/permissions.ts` → **C3**; dedup de hooks de query (`use-kanban` vs `use-queries.ts:useKanbanLeads`) → **G1**.
- **Testes:** `npm run lint` + suíte existente; cada remoção lista o `rg` que prova ausência de consumo.
- **Aceite:** lint verde com regras endurecidas; nenhum shim removido com consumidor vivo.

### F4 — Documentação canônica + ADRs (W24, W25)

- **Depende de:** D2 concluído (para os números de rotas/suites refletirem o estado final) — pode iniciar correção factual antes.
- **Arquivos:** `AGENTS.md`, `CLAUDE.md`, `docs/adr/ADR-INDEX.md`, `docs/goals/roadmap-143-resume.md`.
- **Mudança:**
  1. Corrigir fatos desatualizados: contagens de suites/specs reais; roadmap antigo (29/58/39 → estado atual do ledger); ADR-BASE-14 status (is_master já removido por `0027_drop-is-master.sql`).
  2. `CLAUDE.md` deixa de ser cópia: passa a apontar `AGENTS.md` como fonte canônica.
  3. Novos ADRs temáticos: **ADR tenancy boundary** (sessão→membership→ActionContext) e **ADR política de timeout/retry/idempotência** das integrações; atualizar `ADR-INDEX.md`.
- **Aceite:** nenhum número divergente entre docs e `npm test --listTests`/ledger; ADR-INDEX reflete realidade.

### F5 — Smoke pós-deploy (W18)

- **Classificação:** GAP (P2).
- **Arquivo novo:** script `scripts/smoke-deploy.mjs` (proposto) + documentação em `docs/ops/`.
- **Mudança:** smoke pequeno e determinístico: health 200, endpoint de auth responde, DB acessível, rotas essenciais (login, dashboard asset), workers (ia-bridge ping) acessíveis. Sem mutação destrutiva. Executável contra staging e produção (base URL por env).
- **Aceite:** script rodando verde contra staging; documentado no runbook de deploy.

---

## 8. Trilha G — Frontend (W14, W15) e otimizações (W10, W16, W20, W28)

### G1 — Cache por clínica (W14)

- **Arquivos:** `src/lib/hooks/use-queries.ts` (helper `queryKeys`), `src/hooks/{useTreatmentPlans,usePayments,useFinancialSummary,use-kanban}.ts`, `src/components/clinic-selector.tsx`, `src/lib/auth/context.tsx`.
- **Movido de F3 por ownership:** consolidação dos hooks de query duplicados (`use-kanban` vs `use-queries.ts:useKanbanLeads`) nesta etapa.
- **Mudança:** helper que obriga `clinicId` em toda key multi-tenant; migrar as ~10 keys sem clínica; adicionar `cancelQueries` na troca antes do `clear()`; substituir o teste frágil (`readFileSync` assert) por teste comportamental da troca de clínica (React Testing Library + query client real).
- **Testes:** troca de clínica — nenhum request em voo contamina o novo contexto; keys isoladas por clínica.
- **Aceite:** `rg "queryKey" src` sem key multi-tenant sem clinicId (lista residual com justificativa).

### G2 — Performance frontend com profiling (W15)

- **Pré-requisito:** `@next/bundle-analyzer` (devDep + script `analyze`) — evidência antes de otimizar.
- **Mudanças candidatas (só o que o profiling justificar):** dynamic import dos 6 imports estáticos de recharts em folhas; lazy para PDF/editor se existirem; revisar as páginas 100% client de maior tráfego (dashboard, agenda) para server components parciais.
- **Aceite:** comparação before/after de bundle registrada no receipt; sem otimização sem número.

### G3 — Deps/toolchain (W16)

- **Arquivos:** `package.json` (+ `src/workers/ia-agent/package.json` se aplicável).
- **Mudança:** alinhar `playwright` → `^1.59.x` (mesma minor de `@playwright/test`); avaliar pins de `playwright-extra`/`chromium-bidi`; adicionar `engines.node >=22`.
- **Testes:** `npm ci` limpo + `npm run test:e2e` local estável.
- **Aceite:** `npm ls playwright @playwright/test` sem divergência major/minor relevante.

### G4 — Perf SQL com evidência (W10) — requer acesso a banco com dados representativos

- **Método:** `EXPLAIN ANALYZE` nas queries críticas (conversations/messages, leads, patients, appointments, dashboards/analytics); índices compostos candidatos (`clinic_id+created_at`, `clinic_id+status`, etc.) **somente** com antes/depois registrado (spike em `docs/spikes/`); depois migration de índice + re-medição.
- **Aceite:** toda criação de índice tem número antes/depois; zero índice especulativo.

### G5 — Baseline de performance (W28, P3)

- **Mudança:** registrar latência de DB no **readiness interno** (`/api/internal/readiness`) e/ou telemetria/log estruturado — **não** no `/api/health`, que permanece liveness puro sem banco (consistência com F2); capturar latência LLM no `aiLogger` (com B2); coletar p50/p95 dos endpoints críticos (script manual ou job leve) como baseline documental em `docs/goals/` ou `docs/spikes/`.
- **Testes:** contrato do readiness interno refletindo a nova métrica (coordenado com owner F — G5 roda após F2).
- **Aceite:** baseline documentado; `/api/health` sem consulta a banco; nenhum SLO imposto nesta fase (SPEC §33).

---

## 9. Verificações globais de aceite (mapeamento SPEC §36)

| # SPEC | Critério | Como verificar |
|---|---|---|
| 1–3 | `npm ci` limpo, lint, typecheck verdes | pipeline de comandos §0 |
| 4 | typechecks workers | `typecheck:ia-bridge` + `:ia-agent` |
| 5–8 | unit/integration/security/release | `npm test`, `test:integration:run`, `test:security`, `test:release` |
| 9 | Production-mode E2E verde e bloqueante | F1 concluído |
| 10–11 | Cloudflare build + wrangler dry-run | `npm run build:cf` + job cf-build do CI |
| 12 | Gitleaks sem finding | job gitleaks (bloqueante, já existente) |
| 13 | Nenhum endpoint protegido perdeu auth | teste filesystem de D1 + suíte security |
| 14 | Sem regressão funcional crítica | E2E + integration por etapa |
| 15 | Cross-tenant tests verdes | suíte existente + novos de C2 |
| 16 | Migrations reproduzíveis | CI (banco limpo) + banco com estado (E1) |
| 17 | Docs refletem estado final | F4 |
| 18 | Código morto da migração removido | F3 |
| 19 | Mudanças estruturais com evidência de teste | receipt por etapa (ciclo §0.2) |
| 20 | Review independente sem P0/P1 aberto | reviewer por PR (ciclo coder→tester→reviewer) |

## 10. Itens deliberadamente **não** iniciados agora

- **W9 auditoria de N+1/SELECT \*:** incorporada ao G4 (profiling com evidência) — não fazer varredura sem banco representativo.
- **W15 otimização de componentes pequenos:** bloqueada por profiling (SPEC §20).
- **Major upgrades de dependências:** proibidos nesta SPEC (§16) — exceto alinhamento Playwright (G3).
- **Cloudflare Queues nativas, novo ADR de infra:** ADR-BASE-13 já registra a alternativa como futura — fora de escopo.

## 11. Riscos do plano e contenção

| Risco | Mitigação |
|---|---|
| Migração de rotas (D2) quebra consumidor | processo servidor+consumidor por lote: consumidores identificados, contract tests, migração atômica no mesmo PR ou adapter temporário; compat removida só após zero consumidores legados |
| Remoção de `continue-on-error` com suíte flaky | F1 mede estabilidade antes; spec flaky é corrigida antes da flag sair |
| Constraint de agenda (E1) conflitar com dados existentes | migrar contra banco com estado representativo + rollback (drop constraint) |
| C2 (repos legados) tocar fluxo desconhecido | characterization tests antes; exceções documentadas |
| Compat de senha (C1) invalidar login | fixture de hash legado em teste + re-hash apenas pós-sucesso; rollback = código anterior aceita ambos os formatos |
| Timeouts novos (A2) cortar chamadas legítimas lentas | valores baseados no padrão LLM existente (30s) e ajustáveis por client; teste com latência simulada |
