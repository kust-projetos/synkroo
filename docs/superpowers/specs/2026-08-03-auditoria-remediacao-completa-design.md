# Synkroo — remediação completa da auditoria

**Data:** 2026-08-03
**Status:** aprovado para planejamento
**Owner:** Walis
**Base auditada:** `f521d401..13e688405578007c5f63ddc7ee4b42852eb5231a`
**Autoridade:** complementa a spec canônica e o plano mestre; não altera produto ou stack

## 1. Contexto

Auditoria ponta a ponta encontrou bloqueadores em tenancy, webhooks, pagamentos, revogação e
minimização de PII. Gates estáticos, unitários, integração e build passaram; E2E, audit completo de
dependências e jornadas mobile permaneceram vermelhos. Esta spec define remediação integral por
risco, sem novas funcionalidades e sem declarar fases futuras concluídas.

## 2. Objetivo e não objetivos

**Objetivo:** remover todos os achados reproduzíveis, restaurar contratos canônicos e produzir
evidência suficiente para decisão de deploy.

**Não objetivos:**

- adicionar canais, módulos ou features fora da spec canônica;
- trocar Next.js, PostgreSQL, Drizzle, NextAuth ou Cloudflare;
- reescrever domínios sem relação com achado;
- ativar Cloudflare Queues antes de segurança e integridade transacional;
- mascarar falhas por retry, skip, catch vazio ou atualização de expectativa.

## 3. Stack congelada

| Camada | Tecnologia | Regra |
|---|---|---|
| App | Next.js 15, React 19, TypeScript 5.6 | preservar App Router |
| Auth | NextAuth v4 JWT | autoridade única |
| DB | PostgreSQL 17, Drizzle, `pg`, Hyperdrive | testes de integridade em DB real |
| Runtime | Cloudflare Workers, OpenNext | validar em WSL + dry-run Wrangler |
| Jobs | Cloudflare Queues | somente após outbox transacional |
| UI | Tailwind, Radix, TanStack Query, Zustand | corrigir sem redesign amplo |
| Testes | Jest, Playwright, Stryker | RED → GREEN → REFACTOR |

## 4. Arquitetura de remediação

```text
request autenticado ──> requireAuth/context ──> Action ──> repository tenant-scoped
                              │                    │
                              │                    └─> audit metadata allowlist
                              └─> user active + sessionVersion + clinic access

webhook ──> assinatura ──> provider installation ──> tenant ──> inbox transaction
                                                               │
command ──> domain transaction ──> outbox ──> queue/dispatcher ─┴─> provider
```

### Regras de boundary

1. `clinicId` de payload nunca autoriza nem seleciona tenant.
2. Rotas autenticadas derivam clínica do contexto ativo e validam ownership no banco.
3. Webhooks derivam clínica de credencial, instalação ou identificador de canal registrado.
4. Evento inbound recebe chave única por provider; estado `processed` só após commit de domínio.
5. Efeito outbound nasce na mesma transação do estado de negócio e sai por outbox observável.
6. Logs de Action persistem somente campos allowlisted por definição da Action.
7. Migrations aplicadas permanecem imutáveis; toda correção cria migration nova com preflight.
8. Cada onda termina verde antes da próxima; exceção somente para hotfix P0 isolado.

## 5. Requisitos EARS

| ID | Requisito |
|---|---|
| REM-01 | Quando rota autenticada receber tenant no payload, sistema shall usar clínica do contexto. |
| REM-02 | Se recurso não pertencer à clínica ativa, então o sistema shall rejeitar sem revelar sua existência. |
| REM-03 | Quando webhook chegar, o sistema shall derivar tenant do vínculo autenticado do provider. |
| REM-04 | Se processamento falhar após persistir evento, então replay shall retomar sem perder ou duplicar efeito. |
| REM-05 | Enquanto usuário estiver inativo ou sessão revogada, toda operação privilegiada shall falhar. |
| REM-06 | O sistema shall persistir somente metadados de auditoria allowlisted, nunca PII clínica bruta. |
| REM-07 | Quando cobrança ou campanha repetir ou concorrer, o sistema shall produzir um único efeito externo. |
| REM-08 | Se provider falhar, então estado shall permanecer recuperável, observável e elegível a retry limitado. |
| REM-09 | Enquanto campanha estiver futura, dispatcher shall mantê-la agendada e não enviar mensagens. |
| REM-10 | Quando usuário trocar clínica, sistema shall atualizar contexto e invalidar cache scoped. |
| REM-11 | Se exportação iniciar célula com fórmula, então sistema shall neutralizá-la antes de gerar CSV. |
| REM-12 | Dashboard shall exibir somente dados reais ou estado indisponível explícito. |
| REM-13 | Enquanto viewport tiver 360px, jornadas shall preservar conteúdo, foco e ações sem overflow. |
| REM-14 | Se teste de setup, login ou seed falhar, então suíte E2E shall abortar com causa explícita. |
| REM-15 | Deploy shall permanecer bloqueado enquanto qualquer gate P0 ou P1 estiver vermelho. |

## 6. Ondas de execução

| Onda | Prazo | Escopo | Gate de saída |
|---:|---:|---|---|
| 0 | 1–2 dias | ledger, severidade, reproduções RED, baseline limpo | todos os P0 reproduzidos |
| 1 | 4–6 dias | tenancy, webhooks, Asaas, revogação master, audit PII | AppSec + integração verdes |
| 2 | 6–9 dias | auth única, switch-clinic, idempotência, outbox cobranças/campanhas | concorrência e replay verdes |
| 3 | 4–6 dias | headers, CSV, consentimento, embeddings, migrations, architecture tests | gates técnicos verdes |
| 4 | 5–8 dias | mobile, rotas, KPIs, acessibilidade, E2E, docs | E2E completo verde duas vezes |
| 5 | 2–3 dias | OpenNext, Cloudflare, smoke, rollback, reauditoria | decisão Go/No-Go |

**Estimativa:** 22–34 dias para uma pessoa-equipe, sem espera de provider ou owner.

## 7. Onda 0 — evidência e testes RED
### Entregáveis

- ledger único: achado, severidade, arquivo/linha, requisito canônico, teste e onda;
- baseline reproduzível sem servidor concorrente escrevendo `.next`;
- fixtures de duas clínicas, dois usuários, provider e eventos externos;
- testes ofensivos que falham pela causa esperada, não por mock incompleto;
- inventário de consumidores das rotas manuais de auth e rotas públicas.

### Arquivos principais

- `docs/superpowers/audits/goal-ledger.md`
- `src/__tests__/security/`
- `src/**/__tests__/`
- `e2e/global-setup.ts`
- `playwright.config.ts`

## 8. Onda 1 — bloqueadores P0
| Capability | Mudança | Evidência obrigatória |
|---|---|---|
| Confirmação | remover `clinicId` do input; usar `ctx.clinicId` | ataque cross-clinic não altera DB |
| Mensagem inbound | assinatura por instalação; tenant derivado server-side | body forjado não muda clínica |
| Asaas inbound | chave tipada; inbox + transição atômica | falha intermediária permite replay único |
| Provisionamento | exigir identidade operacional revogável | token inativo ou stale falha |
| Audit Actions | trocar denylist por allowlist | PII e conteúdo clínico ausentes do log |

### Arquivos principais

- Tenancy: `src/modules/operacional/actions/processar-confirmacao-resposta.ts`,
  `src/app/api/appointments/confirm-response/route.ts`, `src/app/api/messages/inbound/route.ts`.
- Financeiro/auth: `src/modules/financeiro/gateways/providers/asaas/webhook.ts`,
  `src/app/api/admin/provision/route.ts`.
- Audit/schema: `src/core/actions/{types,run,audit-writer}.ts`,
  `src/lib/db/schema/{audit,business}.ts`.

## 9. Onda 2 — auth, idempotência e side effects
### Auth

- NextAuth permanece única autoridade de sessão;
- rotas manuais são removidas ou viram adapters temporários após inventário de consumidores;
- `isActive`, `sessionVersion` e acesso à clínica são validados em operações privilegiadas;
- `/signup` e `/api/auth/signup` retornam 404 em produção;
- logout e alteração de senha/role/estado invalidam sessão incompatível;
- switch-clinic emite contexto ativo verificável e invalida TanStack Query/Zustand scoped.

### Idempotência e entrega

```text
domain transaction:
  mutate state
  insert outbox(unique tenant + operation + business key)

worker/dispatcher:
  claim pending atomically
  call provider with stable idempotency key
  mark delivered or retryable failure
```

- corrigir `tryClaimIdempotencyKey` para distinguir insert de conflito;
- campanhas executam somente `scheduledAt <= now`;
- status parcial/falha deriva de recipients, não de tentativa iniciada;
- cobrança não persiste sucesso local antes de resposta válida do provider;
- cancelamento e criação concorrentes usam transição condicional;
- retries têm limite, `nextAttemptAt`, código estável e dead-letter observável.

### Arquivos principais

- Auth: `src/lib/auth/{auth,session}.ts`, `src/lib/auth/context.tsx`, `src/app/api/auth/**`.
- Side effects: `src/lib/idempotency/index.ts`, `src/modules/financeiro/services/charge-service.ts`,
  `src/services/followup/campaign.service.ts`.
- Estado: `src/lib/db/schema/{infra,business}.ts`.

## 10. Onda 3 — hardening e integridade estrutural

| Área | Correção |
|---|---|
| Middleware | allowlist de rotas públicas exatas; negar famílias por prefixo |
| Headers | CSP, HSTS em produção, frame-ancestors, nosniff, Referrer e Permissions Policy |
| CSV | neutralização de `=`, `+`, `-`, `@`, tab e CR antes do escape CSV |
| Consentimento | uniqueness inclui `clinicId`; preflight de duplicatas antes da constraint |
| Embeddings | provider único, dimensão única, timeout, abort e update tenant-scoped |
| Migrations | migration aditiva; catálogo PostgreSQL validado em integração |
| Arquitetura | scans apontam para arquivos reais e falham com conjunto vazio |
| Dependências | remover/atualizar highs de dev sem downgrade de segurança |

### Arquivos principais

- HTTP/dados: `src/middleware.ts`, `next.config.ts`, `src/app/api/reports/export/route.ts`,
  `src/services/contacts/consents.service.ts`, `src/lib/db/schema/infra.ts`.
- IA/testes: `src/lib/embeddings/{generate,search}.ts`, `src/__tests__/architecture/`.
- Migrations/deps: `src/lib/db/migrations/`, `package.json`, `package-lock.json`.

## 11. Onda 4 — produto, UX, E2E e documentação

| Jornada | Aceite |
|---|---|
| Navegação | remover ou implementar `/api/docs` e `/dashboard/ia`; nenhum link interno 404 |
| Dashboard | remover status, tendências e atividades fictícias; preservar `0` com `??` |
| Contatos | 360px usa lista→detalhe, sem split comprimido |
| Financeiro | cards e tabs refluem sem corte ou scroll acidental |
| Header | CTA, menu e foco permanecem utilizáveis em 360px |
| Acessibilidade | contraste AA, headings, labels, foco e teclado |
| E2E setup | login via API/UI validado; storageState não pode ser vazio |
| E2E runtime | rate limiter isolado/resetado em teste; servidor não pode ser reutilizado silenciosamente |
| Docs | ADRs, runbook e fases refletem código e evidência real |

### Rotas E2E críticas

1. login, revogação, logout e switch-clinic;
2. agenda e confirmação sem acesso cross-clinic;
3. contatos desktop/mobile;
4. campanha agendada, opt-out e entrega idempotente;
5. cobrança, webhook, replay e cancelamento;
6. dashboard com zero, vazio e erro;
7. navegação, 404 intencional e acessibilidade básica.

## 12. Tratamento de erros e rollback

- erros externos usam códigos estáveis, sem payload sensível;
- evento inválido não cria inbox; evento válido com falha fica retryable;
- retry exponencial limitado; esgotamento vai para dead-letter e alerta;
- rollout de schema segue expand → backfill → validate → contract;
- nenhuma migration destrutiva entra na mesma entrega que muda aplicação;
- feature flag só é aceita com owner, issue, data de remoção e fail-closed;
- rollback de Worker deve continuar compatível com schema expandido anterior.

## 13. Estratégia de testes

| Tipo | Ferramenta | Escopo | Meta |
|---|---|---|---|
| Unit RED-first | Jest | policies, transitions, allowlist, serializers | ≥80% código novo |
| Integração | Jest + PostgreSQL real | tenancy, constraints, concorrência, replay | zero mocks de DB |
| Contract | Jest + Zod/MSW | Asaas, Evolution, LLM/embeddings | request/response e erro |
| Mutation | Stryker | auth, tenancy, idempotência, audit | ≥70% |
| Snapshot | Jest/RTL | somente UI alterada e estados | snapshots focados |
| E2E | Playwright | sete jornadas críticas + 360/1440 | duas execuções verdes |
| Cloudflare | OpenNext/Wrangler | bindings, Hyperdrive, bundle, health | dry-run + smoke staging |

Testes de concorrência usam pelo menos duas conexões PostgreSQL e barreira controlada. Testes de
segurança comprovam ausência de mutação e ausência de vazamento, não somente status HTTP.

## 14. Gates globais

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
npm run test:integration
npm run test:security
npm run build
npm run test:e2e
npm run test:e2e
npm audit --omit=dev --audit-level=high
gitleaks detect --source . --no-banner --redact --log-opts='--all'
```

Validação Cloudflare ocorre em WSL:

```bash
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run --config wrangler.toml
```

## 15. Critérios Go/No-Go

**Go somente se:**

- zero achado P0/P1 aberto ou rebaixado sem evidência;
- todos os requisitos REM rastreados para teste verde;
- lint, typecheck, unit, integração, segurança e build verdes;
- E2E completo verde duas vezes consecutivas, sem catch/skip silencioso;
- zero high/critical em dependências de produção;
- Gitleaks full history sem leak;
- OpenNext/Wrangler dry-run e smoke staging verdes;
- rollback de Worker e migration ensaiado;
- plano mestre, ADRs e ledger descrevem estado real.

**No-Go automático:** bypass de auth/tenant, PII em log, efeito externo duplicável, evento financeiro
não reprocessável, jornada crítica 404, E2E setup não determinístico ou rollback não demonstrado.

## 16. Trade-offs

| Decisão | Razão | Rejeitado |
|---|---|---|
| ondas sequenciais por risco | reduz blast radius e produz gates intermediários | paralelismo amplo |
| inbox/outbox PostgreSQL | atomicidade com estado de domínio | chamada externa dentro da transaction |
| NextAuth único | elimina cookie/JWT divergente | manter auth paralela |
| audit allowlist por Action | minimização verificável | denylist crescente |
| correção mobile focada | resolve jornadas sem redesign | redesign completo |
| atualizar documentos por evidência | evita fechamento fictício | marcar fase por intenção |

## 17. Rastreabilidade

Fontes:

- `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`
- `docs/superpowers/plans/2026-07-28-synkroo-development-master-plan.md`
- `docs/superpowers/audits/2026-07-28-plano-consolidado.md`
- `docs/superpowers/audits/2026-07-31-pendencias-closure.md`
- review ponta a ponta de 2026-08-03

Esta spec não fecha achado. Somente teste reproduzível, correção integrada e gate da onda podem
mudar estado no ledger.
