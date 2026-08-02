# Auditoria de direção do Synkroo

**Data:** 2026-07-28  
**Escopo:** produto, arquitetura, segurança, dados, frontend, testes, CI e deploy  
**Método:** inspeção predominantemente read-only, histórico Git, documentação e gates locais  
**Baseline Git:** `f7be12f8a23b7519bfebbdf201b6e06a2bf92e1c` com worktree já modificado  
**Veredicto:** **deploy bloqueado** até conclusão dos bloqueadores P0

## 1. Resumo executivo

Synkroo não precisa de reescrita. Núcleo técnico aproveitável existe: modular monolith,
Action Layer, RBAC dinâmico, Drizzle/PostgreSQL, Workers separados e 1.414 testes unitários
verdes. Problema principal é consolidação incompleta: quatro gerações arquiteturais convivem,
contratos UI/API divergem, documentação antiga declara capacidades incompletas como prontas e
gates não cobrem riscos mais graves.

### Evidência medida nesta auditoria

| Gate | Resultado |
|---|---|
| `npm run typecheck` | passou |
| `npm run typecheck:ia-bridge` | passou |
| `npm run typecheck:ia-agent` | passou |
| `npm test -- --runInBand --coverage=false` | 197 suites; 1.414 passaram; 5 ignorados |
| `npm run lint` | falhou: 6 erros de boundary e 3 warnings |
| `npm audit --audit-level=high` | falhou: 40 high, 6 moderate, 5 low |
| OpenSpec CLI | indisponível; repositório usa `docs/superpowers/{specs,plans}` |
| GitHub CLI | credencial local inválida; PR #6 não pôde ser consultado |

## 2. Arquitetura encontrada

```text
Browser
  -> Next.js/OpenNext Worker
     -> middleware + NextAuth
     -> Route Handler / Server Action
     -> Action Layer
     -> service
     -> repository
     -> Drizzle -> Hyperdrive -> PostgreSQL

Canal
  -> app Worker
  -> IA bridge Worker
  -> IA agent Durable Object
  -> IA bridge -> Action Layer -> PostgreSQL
```

Implementação real mistura:

1. `src/core/*`: Action Layer, RBAC, módulos e IA nova.
2. `src/modules/*`: fatias modulares novas.
3. `src/services/*` e `src/repositories/*`: camada legada ainda usada.
4. `src/app/api/*`: 141 route handlers, vários com regra e DB direto.

Direção correta já existe, mas cutover parou no meio.

## 3. Pontos sólidos

| Área | Evidência |
|---|---|
| Action Layer | auth, module gate, RBAC, Zod e auditoria em `src/core/actions/run.ts` |
| RBAC | roles por clínica, overrides e acesso multi-clínica em `src/core/rbac/resolve.ts` |
| IA | allowlist deny-by-default e handles HMAC em `src/core/agent-bridge/*` |
| Dados | Drizzle + pool lazy + Hyperdrive em `src/lib/db/client.ts` |
| CRM | invariantes fortes para deduplicação em `src/modules/crm/schema/duplicates.ts` |
| Testes | 197 suites unitárias verdes; integration runner fail-closed |
| Runtime | app, bridge e agente possuem typecheck independente verde |

## 4. Bloqueadores P0

### P0-01: operações administrativas cross-clinic

**Evidência:** handlers usam `input.clinicId` depois de autorizar `ctx.clinicId`.

- `src/modules/core/actions/assign-user-access.ts`
- `src/modules/core/actions/remove-user-access.ts`
- `src/modules/core/actions/deactivate-user.ts`
- `src/modules/core/actions/create-role.ts`
- `src/modules/core/ui/actions.ts`

**Impacto:** usuário autorizado na clínica A pode tentar alterar clínica B.

**Decisão:** clinic scope vem do contexto. Payload não escolhe tenant em Action comum.

### P0-02: IDOR em sessão de tratamento

**Evidência:** `src/app/api/treatment-plans/[id]/sessions/route.ts` valida plano da URL,
mas `treatment_plan_item_id` do body é atualizado apenas por ID em
`src/services/treatment-plans/treatment-plan.service.ts`.

**Impacto:** item de outro plano ou clínica pode ser alterado.

**Decisão:** update atômico por `(itemId, planId, clinicId)` e idempotency key.

### P0-03: JWT de usuário desativado continua aceito pelo middleware

**Evidência:** middleware verifica somente token e JWT dura 30 dias. `validateApiAuth()` e RBAC
consultam `isActive` e negam operações, mas páginas/handlers que confiam só no token permanecem
acessíveis e não há revogação central de sessão.

**Impacto:** revogação é inconsistente e depende do caminho chamado.

**Decisão:** sessão única NextAuth, estado ativo validado e revogação versionada.

### P0-04: auditoria duplica PII e dados clínicos

**Evidência:** `src/core/actions/run.ts` envia input completo; redaction é denylist opcional.
`criarPaciente` e mensagens não classificam campos sensíveis.

**Impacto:** CPF, telefone, e-mail, nascimento, notas e mensagens podem ficar duplicados em
`action_logs`, sem retenção definida.

**Decisão:** audit allowlist; IDs e metadados mínimos; retenção e acesso explícitos.

### P0-05: possível exposição histórica de secrets

**Evidência:** `.gitleaksignore` contém suppressions para GitHub PAT, JWT, private key e scripts
de provider em commits históricos.

**Impacto:** credenciais antigas podem ser recuperadas do Git.

**Decisão do owner:** assumir comprometimento, rotacionar e sanear histórico.

### P0-06: IA bridge não injeta Hyperdrive

**Evidência:** binding existe em `wrangler.ia-bridge.jsonc`, mas
`src/workers/ia-bridge/index.ts` não chama `setDbConnectionString()`.

**Impacto:** tools DB-backed podem falhar em produção.

### P0-07: script nomeado como teste muta banco real

**Evidência:** importar `scripts/backfill-rbac-permissions.mjs` executa `main()` imediatamente.
`scripts/__tests__/backfill-rbac-permissions.test.mjs` importa esse arquivo esperando export.

**Confirmação:** execução agregada desta auditoria inseriu permissões no banco local configurado
por `DATABASE_URL` antes de falhar com `backfill is not a function` e expirar.

**Estado:** nenhuma reversão automática aplicada. Não há produção/staging segundo registro de
2026-07-28. Banco local já possuía artefatos deliberados de testes anteriores.

**Decisão:** separar biblioteca pura de CLI, exigir `--apply`, default `--dry-run`, bloquear host
não permitido e proibir testes com side effect de import.

### P0-08: webhook inbound aceita seleção de clínica pelo payload

**Evidência:** `/api/messages/inbound` recebe `clinicId` do body; adapter cria contexto privilegiado;
`receberMensagem` pode preferir input ao contexto.

**Impacto:** posse do secret global permite tentar escrita cross-clinic.

**Decisão:** clínica deriva exclusivamente de instância/credencial/channel ID registrado.

### P0-09: reconciliação Asaas não é transacional

**Evidência:** webhook faz check-then-insert e separa persistência do evento e do pagamento.

**Impacto:** falha parcial pode marcar evento como visto sem liquidar cobrança; retry é descartado.

**Decisão:** resolver gateway→clínica→charge local e aplicar evento + transição em uma transaction.

### P0-10: signup público contradiz instância dedicada

**Evidência:** `/signup` e `/api/auth/signup` são públicos e criam clínica/owner/RBAC dentro do DB.

**Impacto:** terceiro pode criar tenant paralelo na instância dedicada de um cliente.

**Decisão:** produção retorna 404; provisionamento é gerenciado e autenticado fora do fluxo público.

## 5. Riscos P1

| ID | Risco | Evidência resumida |
|---|---|---|
| P1-01 | Auth duplicada | NextAuth e JWT/cookie manual em `/api/auth/login` |
| P1-02 | Identidade ambígua | login por e-mail sem unique físico confiável |
| P1-03 | RBAC duplicado | enum legado e permissions dinâmicas convivem |
| P1-04 | Contratos UI/API quebrados | raw/camelCase versus envelopes/snake_case |
| P1-05 | Constraints ausentes | descriptors Drizzle não emitidos em migration |
| P1-06 | Rate limit local | `Map` por isolate em `src/lib/rate-limit.ts` |
| P1-07 | Idempotência não atômica | KV read-then-write; mensagens sem unique externo |
| P1-08 | Financeiro fail-open | cobrança simulada quando provider falta |
| P1-09 | Webhook financeiro bloqueado | middleware não libera rota externa exata |
| P1-10 | Campanhas concluem sem enviar | telefone indefinido e 100% falha ainda conclui |
| P1-11 | LGPD incompleta | anonimização sem permission/transação e `phone=null` inválido |
| P1-12 | E2E permissivo | catches, tautologias, skips e setup sem assert de login |
| P1-13 | CI incompleta | sem coverage, Workers, E2E, security e mutation gates |
| P1-14 | Deploy incompleto | sem migration, smoke, bridge/agent e rollback de DB |
| P1-15 | Dependências vulneráveis | `npm audit`: 40 high |

Suppressions de Gitleaks são indício, não prova individual de credencial válida. Ledger do incidente
deve classificar cada finding como `confirmed`, `test` ou `false-positive`, sem armazenar valor.

## 6. Estado de capacidades

| Capacidade | Estado real | Principal lacuna |
|---|---|---|
| Auth/onboarding | parcial | fluxo duplicado, signup público incoerente |
| RBAC/módulos | parcial | cross-clinic, UI incompleta, gate stale |
| Pacientes/catálogo | parcial | contratos de detalhe/lista |
| Agenda/waitlist | parcial | contratos de disponibilidade/calendário |
| Conversas/WhatsApp | parcial | contratos UI e provider/runtime |
| Chat widget | parcial | fluxo real e gestão do canal |
| Agente IA | parcial | smoke cross-worker, Hyperdrive, policy de confirmação |
| Follow-up/campanhas | parcial | dispatch e estados de falha |
| Comercial/pipeline | parcial | envelope de stages, filtros e detalhe |
| CRM | parcial | boundaries e edição direta definida pela spec |
| Financeiro | parcial | provider fail-closed e webhook |
| Analytics | parcial | métricas não validadas e constantes heurísticas |
| LGPD | parcial | anonymize, retenção e auditoria |
| Knowledge/RAG | parcial | escrita 501; dois vector stores divergentes |
| Pi Finance | fora do produto | remover do Synkroo; preservar projeto separado |

## 7. Drift documental

| Documento | Problema |
|---|---|
| `README.md` | afirma factory LLM e MVP implementado sem corresponder ao runtime |
| `docs/planning/product-brief.md` | stack Supabase/Claude, claims e roadmap antigos |
| `docs/MVP-CHECKLIST.md` | marca RLS, Instagram outbound, RAG e E2E como concluídos |
| roadmap de 2026-06-17 | mistura decisão per-instance com Agents SDK e Vectorize não usados |
| `docs/ux-design/ENTREGAS.md` | protótipos HTML tratados como features entregues |
| runbook de deploy | smoke usa endpoints/respostas inexistentes; sem migration |

## 8. Causa da mudança constante

1. Documento antigo permanece “canônico” depois de arquitetura mudar.
2. Status de implementação é baseado em arquivo existente, não fluxo E2E comprovado.
3. PR grande reverteu código e testes juntos; suíte continuou verde.
4. Agentes escolhem stack a partir de docs conflitantes.
5. Ausência de ADR ativo permite reabrir decisão técnica em qualquer sessão.
6. Planos sucessivos não possuem traceability para requisito e gate.

## 9. Decisões congeladas pela nova spec

- Plataforma ampla antes do primeiro piloto.
- Infra dedicada por cliente/organização; multi-clínica dentro da instância.
- Onboarding gerenciado; sem signup público no MVP.
- Autonomia IA graduada por risco.
- WhatsApp Evolution + chat widget no app.
- Playwright somente em sidecar Node isolado, nunca dentro do Worker.
- Pi Finance removido deste repositório.
- Modular monolith; Action Layer como entrada de negócio.
- NextAuth único; Drizzle + `pg`; pgvector único no MVP.
- Durable Object atual mantido se smoke cross-worker passar.

Fonte normativa: `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`.
