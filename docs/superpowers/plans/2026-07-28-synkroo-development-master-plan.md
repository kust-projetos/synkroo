# Plano mestre de desenvolvimento do Synkroo

**Data:** 2026-07-28  
**Status:** pronto para execução faseada  
**Spec:** `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md`  
**Auditoria:** `docs/superpowers/audits/2026-07-28-project-direction-audit.md`

## 1. Contexto

Base possui 197 suites unitárias verdes, mas deploy está bloqueado por autorização cross-clinic,
PII em audit logs, sessão não revogada, IDOR, possível exposição de secrets e runtime IA sem smoke.
Plano preserva código útil, fecha segurança primeiro, restaura contratos ponta a ponta e entrega
plataforma ampla. Reescrita e expansão fora da spec estão proibidas.

## 2. Stack congelada

| Camada | Tecnologia | Razão |
|---|---|---|
| App | Next.js 15, React 19, TypeScript 5.6 | base atual |
| Runtime | Cloudflare Workers + OpenNext | alvo atual |
| DB | PostgreSQL 17, Drizzle, `pg`, Hyperdrive | stack validada |
| Vetores | pgvector, dimensão única por modelo | uma fonte de verdade |
| Auth | NextAuth v4 JWT | remover auth paralela |
| Estado IA | Durable Object por conversa | manter se smoke passar |
| Jobs | Cloudflare Queues | retry/idempotência distribuída; DO somente por conversa |
| UI | Tailwind, Radix, TanStack Query, Zustand local | padrão existente |
| Testes | Jest, PostgreSQL real, Playwright, Stryker | gates atuais ampliados |

## 3. Arquitetura de execução

```text
src/
├── app/                         # transporte e composição
├── core/                        # Actions, RBAC, módulos, bridge
├── modules/<domain>/
│   ├── actions/                 # entrada de negócio
│   ├── services/                # invariantes
│   ├── repositories/            # Drizzle tenant-scoped
│   ├── schema/                  # ownership de dados
│   ├── ui/                      # UI do domínio
│   ├── integrations/            # adapters externos
│   └── index.ts                 # única interface pública
└── workers/
    ├── ia-bridge/
    └── ia-agent/

apps/whatsapp-sidecar/           # criar somente quando fase 6 iniciar
```

Regras:

1. Uma fase ativa por vez; hotfix P0 pode interromper.
2. Cada mudança começa por teste RED e termina com gates da fase.
3. Sem refactor amplo junto de feature ou migration.
4. Migration aplicada nunca é editada; correção cria nova migration.
5. Nenhum PR pode alterar spec/stack silenciosamente.
6. PRs pequenos por capability; proibido squash massivo que remove testes junto do código.

## 4. Schemas e invariantes

| Área | Mudança necessária |
|---|---|
| users | e-mail normalizado unique por instância; `isActive`; session version |
| access | role e user access com clínica coerente; anti-lockout |
| instance_modules | permanece instance-scoped, pois DB é dedicado por cliente |
| entities | indexes por `clinicId`; composite ownership checks/FKs onde viável |
| messages | unique `(clinicId, channel, externalMessageId)` |
| conversations | unique `(clinicId, channel, externalConversationId)` |
| jobs | idempotency key, status, attempts, nextAttemptAt, lastErrorCode |
| treatments | update exige item + plan + clinic |
| action_logs | metadata allowlist, classificação e retentionAt |
| campaigns | status parcial/falha; delivery counters confiáveis |
| charges | provider obrigatório; external ID unique; webhook event unique |
| knowledge | embedding pgvector com dimensão única e clinic scope |

Toda constraint recebe migration de preflight/dedup e integration test do catálogo PostgreSQL.

## 5. Contratos HTTP prioritários

| Família | Contrato alvo | Fase |
|---|---|---:|
| `/api/auth/*` | NextAuth único; sem JWT manual | 3 |
| `/api/patients/*` | `{data}` camelCase | 5 |
| `/api/dentists/*` | `{data}` camelCase | 5 |
| `/api/procedures/*` | `{data}` camelCase | 5 |
| `/api/appointments/*` | `{data}`; availability tipada | 5 |
| `/api/waitlist/*` | `{data,meta}` | 5 |
| `/api/conversations/*` | `{data,meta}`; mensagens separadas | 6 |
| `/api/messages/*` | idempotente e tenant-scoped | 6 |
| `/api/leads/*` | filtros tipados; `{data,meta}` | 8 |
| `/api/pipeline/*` | `{data:{stages}}` | 8 |
| `/api/contacts/*` | read model CRM | 8 |
| `/api/campaigns/*` | estados de entrega reais | 7 |
| `/api/financeiro/*` | fail-closed + webhook público exato | 9 |
| `/api/lgpd/*` | permission forte + transação | 10 |
| `/api/health` | liveness mínimo | 11 |
| `/api/internal/readiness` | DB/bridge protegido | 11 |

Rotas legadas recebem inventário de consumidor antes da remoção. Sem compatibilidade preventiva.

## 6. Componentes de produto

```text
dashboard/
├── inicio                         # KPIs reais, alertas, atividade
├── agenda                         # calendário, waitlist, conflitos
├── pacientes                      # lista, detalhe, tratamento
├── conversas                      # inbox, mensagens, takeover
├── comercial                      # leads, pipeline, tarefas
├── contatos                       # CRM read model e dedup
├── campanhas                      # segmentos, criação, entrega
├── financeiro                     # orçamento, parcelas, cobrança
├── analytics                      # métricas e relatórios
└── configuracoes
    ├── clinica
    ├── equipe-e-acessos
    ├── canais
    ├── agente
    └── compliance
```

## 7. Milestones

| Fase | Nome | Estimativa | Entregável |
|---:|---|---:|---|
| 0 | conter incidente de secrets | 1-3 dias | credenciais rotacionadas antes de merge/push |
| 1 | estabilizar Git e baseline | 1-2 dias | PR #6 resolvido; baseline reproduzível |
| 2 | fechar P0 de autorização/LGPD | 4-6 dias | cross-clinic, IDOR, revogação e audit corrigidos |
| 3 | fundação auth/env/DB/CI | 5-8 dias | auth única, constraints, indexes, verify gate |
| 4 | contrato e shell do produto | 4-6 dias | serializer, client e navegação uniformes |
| 5 | operacional ponta a ponta | 5-8 dias | pacientes, catálogo, agenda, waitlist, tratamento |
| 6 | atendimento, canais e IA | 7-10 dias | Evolution, widget, bridge, agent, sidecar |
| 7 | follow-up e campanhas | 4-6 dias | jobs e entrega idempotentes |
| 8 | comercial e CRM | 5-8 dias | lead→pipeline→paciente→contato |
| 9 | financeiro | 5-8 dias | orçamento→cobrança→webhook→conciliação |
| 10 | gestão, analytics e LGPD | 5-8 dias | dashboard, relatórios e compliance |
| 11 | deploy e observabilidade | 4-7 dias | staging, migration, rollout, smoke, rollback |
| 12 | piloto e go/no-go | 3-5 dias | jornada ampla validada com clínica piloto |

Estimativa preliminar: 53-85 dias para uma pessoa-equipe, sem esperas de owner/provider e sem
contingência. Não usar como prazo externo; recalibrar após Fase 3 e decompor novamente Fases 6/11.

## 8. Tarefas por fase

### Fase 0: conter incidente de secrets

**Objetivo:** remover credencial suspeita antes de autenticar GitHub, mergear ou propagar histórico.

- [ ] Congelar release, merge, push e novos clones.
- [ ] Preservar evidência e backup sem registrar valores.
- [ ] Inventariar `.gitleaksignore` por fingerprint e classificar `confirmed/test/false-positive`.
- [ ] Revogar/rotacionar GitHub, Cloudflare, DB, LLM, Evolution, Asaas e auth secrets afetados.
- [ ] Verificar forks, Actions logs, artifacts e caches.
- [ ] Restaurar `gh auth` somente com credencial nova.
- [ ] Sanear histórico com coordenação; invalidar clones antigos.
- [ ] Reduzir suppressions a fixtures falsas comprovadas.
- [ ] Adicionar Gitleaks em pre-commit e CI sobre tree + history relevante.
- [ ] Registrar credencial, owner, rotação e evidência, nunca valor.

**Gate:** zero credencial suspeita ativa; scanner bloqueante verde.

### Fase 1: estabilizar Git e baseline

**Objetivo:** não construir sobre branches empilhadas ou estado desconhecido.

- [ ] Consultar e revisar PR #6 usando credencial rotacionada.
- [ ] Confirmar commits esperados de RBAC, CRM, Financeiro, cron e migration journal.
- [ ] Mergear PR aprovado ou recriar PR sem alterar conteúdo.
- [ ] Rebasear nova branch de execução sobre `main` atualizado.
- [ ] Preservar alteração local de `AGENTS.md`; não sobrescrever.
- [ ] Rodar lint, typechecks, unit, integration segura e builds.
- [ ] Criar baseline machine-readable de gates e coverage.
- [ ] Remover execução real de DB do arquivo nomeado como teste antes de qualquer suíte agregada.

**Saída:** `main` limpo, baseline registrado, nenhum processo de teste muta dev/prod.

### Fase 2: fechar P0 de autorização/LGPD

- [ ] Remover login JWT artesanal e exigir NextAuth + `AUTH_SECRET` único.
- [ ] Desabilitar `/signup` e `/api/auth/signup` em produção antes de session revocation.
- [ ] RED: tentar `input.clinicId != ctx.clinicId` em cada Core Action.
- [ ] Remover clinic scope controlável de payload ou comparar fail-closed.
- [ ] Validar role/user/entidade na mesma clínica.
- [ ] RED: webhook inbound tenta escolher `clinicId`; derivar somente de channel credential registrado.
- [ ] RED: treatment item de outro plano/clínica e POST repetido.
- [ ] Implementar update tenant-scoped, atômico e idempotente; testar concorrência.
- [ ] RED: usuário desativado com JWT ainda válido.
- [ ] Adicionar session version/revocation ao contexto e middleware.
- [ ] Revogar também após logout, senha, role e access change.
- [ ] Substituir audit payload por allowlist; provar ausência de PII top-level/aninhada.
- [ ] Corrigir webhook Asaas para evento + charge transition na mesma transaction.
- [ ] Injetar Hyperdrive na IA bridge e testar uma tool DB-backed fail-closed.
- [ ] Inventariar paths públicos exatos; remover prefix allowlists amplos.
- [ ] Validar Origin/CSRF em Actions e APIs cookie-authenticated sensíveis.
- [ ] Sanitizar `redirectTo` para path interno.
- [ ] Corrigir agent permission fallback para `[]`.
- [ ] Ampliar Stryker para auth, RBAC, Actions e audit; executar target focado >=70%.

**Gate:** security unit + integration + mutation >=70%; deploy continua bloqueado se falhar.

### Fase 3: fundação auth/env/DB/CI

- [ ] Definir e migrar e-mail normalizado unique por instância.
- [ ] Criar env schema por runtime: app, bridge, agent e sidecar.
- [ ] Validar secrets obrigatórios no startup/smoke.
- [ ] Corrigir constraints Drizzle não emitidas e deduplicar antes da migration.
- [ ] Adicionar índices tenant/date/status/FK guiados por query e scale seed.
- [ ] Garantir `vector` e `btree_gist` antes do schema dependente.
- [ ] Separar CLI RBAC em função pura; `--dry-run` default; `--apply` explícito.
- [ ] Implementar Cloudflare Queues, outbox, retry, idempotência e DLQ antes de integrações.
- [ ] Corrigir lint boundaries sem side-effect imports cruzados.
- [ ] Alinhar Jest/jsdom major.
- [ ] Reparar E2E: setup de auth obrigatório; remover catches, tautologias e skips por defeito.
- [ ] Criar banco E2E isolado e runner reproduzível.
- [ ] Triar `npm audit`; atualizar, mitigar ou criar waiver owner-expirável por finding.
- [ ] Criar `npm run verify` com lint, app/workers typecheck, coverage e contract tests.
- [ ] CI: PostgreSQL 17, scripts auxiliares, security e CF dry-run.
- [ ] Subir walking skeleton staging: app + bridge + agent + PostgreSQL 17 + Hyperdrive.
- [ ] Corrigir lifecycle de pool para Worker e validar concorrência no `workerd`.

**Gate:** fresh DB e fixture N-1 produzem mesmo catálogo; `verify` e smoke OpenNext verdes.

### Fase 4: contrato e shell do produto

- [ ] Criar `ApiSuccess`, `ApiFailure` e request ID centralizados.
- [ ] Criar um route adapter compartilhado para Action Layer.
- [ ] Padronizar camelCase e `{data,meta?}` sem duplicar serializers.
- [ ] Criar contract tests entre hooks e endpoints antes de migrar tela.
- [ ] Fazer sidebar derivar exclusivamente de manifest + RBAC.
- [ ] Corrigir paths inexistentes em manifests.
- [ ] Impedir página protegida de depender apenas de guard client-side.
- [ ] Disabled representa módulo não contratado; implementação parcial nunca conta como entregue.
- [ ] Criar seletor de clínica visível para multi-clínica e oculto para single-clinic.
- [ ] Invalidar cache/query ao trocar clínica e testar roles diferentes por unidade.
- [ ] Remover rota, componentes e testes Pi Finance após confirmar preservação no projeto separado.

**Gate:** manifest path test; authz server-side; zero item duplicado ou rota morta no menu.

### Fase 5: operacional ponta a ponta

- [ ] Pacientes: lista, detalhe, criação, edição, dedup e preferências.
- [ ] Dentistas/procedimentos: contratos, PATCH/DELETE e validação monetária/duração.
- [ ] Agenda: disponibilidade, calendário, conflito DB e timezone por clínica.
- [ ] Waitlist: CRUD e preenchimento de vaga idempotente.
- [ ] Tratamentos: ownership, sessões e estados.
- [ ] Migrar routes para Action Layer; remover caminhos legados sem consumidor.

**E2E J-04:** criar paciente → catálogo → agendar → remarcar → confirmar → no-show/waitlist.

### Fase 6: atendimento, canais e IA

- [ ] Mensagens/conversas com external IDs únicos e transação.
- [ ] Evolution inbound/outbound com contract tests, timeout, replay window e tenant binding.
- [ ] Chat widget no mesmo pipeline, com rate limit distribuído.
- [ ] Executar smoke app + bridge + agent local/preview.
- [ ] Se raw DO passar, criar ADR ratificando. Se falhar, comparar Agents SDK em spike limitado.
- [ ] ADR escolhe LLM provider, embedding model e dimensão produzida pelo modelo antes de ingestão.
- [ ] Implementar níveis R0-R3 e proof server-side imutável, expirável e single-use.
- [ ] Identificar IA, oferecer takeover e escalar sintoma/diagnóstico/medicação/urgência.
- [ ] Criar LLM adapter real; falhar fechado sem provider/bridge/DB e preservar contexto.
- [ ] Restaurar CRUD knowledge, ingestão, busca vetorial, re-embedding, purge e evals.
- [ ] Consolidar pgvector e remover binding/código Vectorize da v1.
- [ ] Versionar estado DO e definir retention, purge, recovery e RPC contract version.
- [ ] Criar sidecar Playwright como package/deploy próprio, sessão criptografada e um owner por clínica.
- [ ] Autenticar sidecar por mTLS + HMAC com nonce; definir timeout, idempotência e egress allowlist.
- [ ] Proibir fallback automático; sidecar é entregue e testado, mas default off.

**E2E J-03/J-05/J-10:** mensagem → IA → Action → resposta; proof R2; aprovação R3;
takeover; falha/recuperação de Evolution, LLM, DB e sidecar.

### Fase 7: follow-up e campanhas

- [ ] Jobs idempotentes para reminder, follow-up, inactive e campaign dispatch.
- [ ] Consumir Queue/outbox da Fase 3; nenhuma chamada externa inline.
- [ ] Resolver recipient phone antes de dispatch.
- [ ] Rejeitar `null` incompatível com schemas Zod.
- [ ] Estados `draft/scheduled/running/partial/failed/completed/cancelled`.
- [ ] Campanha 100% falha termina `failed`.
- [ ] Retry com backoff, limite e dead-letter observável.
- [ ] Aplicar consentimento versionado e opt-out antes de cada envio não transacional.

**E2E J-07:** segmento consentido → campanha → opt-out → falha → retry → métricas.

### Fase 8: comercial e CRM

- [ ] Leads com filtros, paginação, detalhe e create response corretos.
- [ ] Pipeline hook e endpoint no mesmo contrato.
- [ ] Tarefas e hot-lead notification reais.
- [ ] Conversão lead→paciente transacional e deduplicada.
- [ ] CRM permanece read model sobre lead/paciente; notas/tags via owner Action pública.
- [ ] Fechar boundaries por `index.ts`; remover side-effect dispatcher.
- [ ] Merge com self-FK/tenant invariants e proteção contra ciclos.

**E2E J-06:** capturar lead → pipeline → tarefa → converter → timeline CRM → dedup.

### Fase 9: financeiro

- [ ] Remover cobrança simulada; provider ausente falha.
- [ ] Asaas secrets e webhook secret separados.
- [ ] Liberar somente rota exata de webhook no middleware.
- [ ] Verificar assinatura/token constant-time e evento idempotente.
- [ ] Resolver gateway→clínica→charge local; nunca aceitar tenant de query/header livre.
- [ ] Persistir gateway event + payment/charge transition em uma transaction.
- [ ] Orçamento, parcelas, pagamento e cobrança em transações coerentes.
- [ ] Race tests para criação, webhook duplicado/simultâneo, falha parcial, settlement e cancelamento.
- [ ] Outbox para chamada externa e reconciliação.

**E2E J-06:** tratamento → orçamento → aceite → cobrança → webhook → parcela paga.

### Fase 10: gestão, analytics e LGPD

- [ ] Dashboard com métricas reais, período e definição documentada.
- [ ] Criar metric dictionary: fórmula, fonte, janela, timezone, freshness e clínica.
- [ ] Eliminar previsão/ROI apresentado como dado quando for heurística.
- [ ] Relatórios CSV/PDF tenant-scoped e redacted.
- [ ] CRUD de perfis, clone, assign/revoke e anti-escalation.
- [ ] Configuração de clínica, timezone, horário, canais e agente persistida.
- [ ] LGPD export/anonymize com permission, confirmação e transaction.
- [ ] Política de retenção para mensagens, DO, audit, gateway events e exports.
- [ ] Minimizar/redact payload bruto de gateway, traces, errors e logs.
- [ ] Implementar legal hold, purge verificável e opt-out global não transacional.

**E2E J-02/J-08/J-09:** equipe e clínica → role → métricas → export → anonymize → purge.

### Fase 11: deploy e observabilidade

- [ ] IaC/config gerada por cliente; sem editar IDs Wrangler manualmente.
- [ ] Onboarding invite-only: owner, clínicas, módulos, equipe, import, canais e consulta de teste.
- [ ] Importação com preview, rejeições, idempotência e rollback.
- [ ] Offboarding com export, revogação, retenção e destruição auditada.
- [ ] Pipeline: backup/preflight → expand migration → workers → app → smoke → contract cleanup.
- [ ] Deploy bridge e agent antes do app dependente.
- [ ] Liveness público mínimo; readiness protegido e barato.
- [ ] Logs JSON com request/correlation ID e redaction.
- [ ] Métricas/SLO: auth, DB, webhook, queue, agent, provider e sidecar.
- [ ] Alertas e runbooks acionáveis.
- [ ] Ensaiar rollback app/workers e compatibilidade DB.
- [ ] Versionar app/bridge/agent, RPC, schema e estado DO por release/cliente.
- [ ] Provar old/new compatibility e version skew; lifecycle DO não pode cruzar rollback/rollout gradual.
- [ ] Definir thresholds de abort; DB aplicada recebe roll-forward, não down destrutivo.
- [ ] Security headers: CSP, HSTS, nosniff, referrer e permissions policy.

**Gate J-01..J-12:** release candidate ampla, staging novo provisionado do zero e todas as
jornadas com evidência nominal verde antes de iniciar piloto.

### Fase 12: piloto e go/no-go

- [ ] Provisionar cliente piloto via onboarding gerenciado.
- [ ] Importar dados anonimizados ou aprovados.
- [ ] Executar J-01 a J-12 sem capacidade baseline beta.
- [ ] Testar indisponibilidade Evolution, LLM, DB, Queue e sidecar.
- [ ] Validar mobile/desktop, acessibilidade e performance.
- [ ] Treinar equipe e registrar feedback sem alterar scope automaticamente.
- [ ] Produzir scorecard de defects, segurança, SLO e operação.
- [ ] Owner decide go/no-go.

**Gate:** 100% J-01..J-12; zero Sev-0/Sev-1; zero perda/vazamento; WCAG 2.2 AA nas
jornadas; 360x800 e 1440x900 sem ação bloqueada; p75 LCP <=2,5s, INP <=200ms, CLS <=0,1;
100% do safety dataset R2/R3 confirmado, aprovado ou bloqueado corretamente.

## 9. Traceability spec → execução

| Requisitos | Fase | Jornada/gate |
|---|---:|---|
| CORE-01, CORE-06 | 11 | J-01; provisionamento dedicado |
| CORE-02..05, CORE-07..09 | 2, 4 | J-02; matriz cross-clinic/session |
| OPS-01..06 | 2, 5 | J-04; DB ownership/concurrency |
| ATD-01..06 | 2, 6 | J-03/J-10; webhook/channel contracts |
| IA-01..07 | 2, 6 | J-05/J-10; safety dataset |
| COM-01..02, CRM-01..02 | 8 | J-06; conversion/merge |
| FUP-01..02 | 7 | J-07; Queue/retry/failure |
| FIN-01..03 | 2, 9 | J-06; race/transaction |
| GES-01..02 | 10 | J-09; metric dictionary |
| LGPD-01..05 | 2, 7, 10 | J-07/J-08; consent/purge |
| SEC-01..06 | 0, 2, 3 | security gates bloqueantes |

Antes de iniciar fase, expandir grupo afetado em matriz por requirement com: teste RED, comando
GREEN, runtime evidence e status. Nenhum requisito fecha por inferência.

## 10. Protocolo de migrations

Toda migration shall provar:

1. preflight com contagens e fingerprint de catálogo;
2. expand backward-compatible com `lock_timeout`/`statement_timeout`;
3. backfill paginado, idempotente e retomável;
4. índice/constraint sem bloqueio incompatível;
5. old app + expanded schema e new app + expanded schema;
6. fresh DB + fixture N-1 com catálogo equivalente;
7. cleanup somente após janela de rollback.

Rollback padrão reverte app/workers; DB aplicada recebe roll-forward corretivo. Backup possui
restore ensaiado, RPO/RTO e ledger por cliente. Migration aplicada nunca é editada.

## 11. Protocolo de testes obrigatório

| Tipo | Ferramenta | Aplicação |
|---|---|---|
| ATDD | Jest/Playwright | requirement EARS falha antes da feature |
| Unit | Jest | regra/invariante; RED → GREEN → refactor |
| Snapshot | Jest | somente shell/render estável; <=50 linhas |
| Contract | Jest + Zod/MSW | toda API externa, webhook e UI/API |
| Integration | Jest + PostgreSQL 17 | schema, transaction, tenancy, concorrência |
| E2E | Playwright | jornadas críticas listadas por fase |
| Mutation | Stryker | auth, RBAC, Actions, financeiro, LGPD; >=70% |
| Coverage | Jest | >=80% novo; ratchet global até 80% |
| Security | Gitleaks + tests ofensivos | IDOR, session, input, replay, race, secrets |

E2E não pode capturar assertion, usar condição sempre verdadeira ou ignorar defeito com skip.

## 12. Quality gates por PR

```text
lint
typecheck app + ia-bridge + ia-agent (+ sidecar quando existir)
unit + contract + coverage ratchet
integration focada
security focada
build Next/OpenNext afetado
E2E da jornada afetada
mutation para boundary crítico
secret scan
npm audit/waivers vigentes
```

Gate universal de fase: requirements vinculados PASS; RED/GREEN anexados; unit/contract/integration
verdes em PostgreSQL 17; mutation crítica >=70%; app/workers build; OpenNext smoke quando afetado;
migration/rollback evidence quando schema mudar; WCAG/mobile/performance budget quando UI mudar.
Full regression roda antes de merge de milestone e release.

## 13. Trade-offs

| Decisão | Razão | Rejeitado |
|---|---|---|
| corrigir incrementalmente | base útil e testes extensos | rewrite |
| plataforma ampla sequenciada | escolha do owner | piloto estreito primeiro |
| instance per customer | isolamento e serviço gerenciado | shared multi-tenant |
| multi-clínica no DB dedicado | grupos com várias unidades | DB por unidade |
| pgvector único | reduz drift 768/1536 | pgvector + Vectorize |
| raw DO condicionado a smoke | evitar troca especulativa | Agents SDK imediato |
| Playwright entregue, default off | requisito do owner sem quebrar Worker | Chromium no app |
| CRM read model | preserva ownership de domínio | entidade universal |
| no public signup | onboarding gerenciado | self-service v1 |
| Stateless Goal Loop | gates já são determinísticos | loops 03/04/05 durante implementação |

## 14. Dependências do owner

| Momento | Necessário |
|---|---|
| Fase 0 | acesso para rotacionar credenciais e coordenar histórico |
| Fase 1 | decidir merge do PR #6 após review |
| Fase 3 | conta Cloudflare, Hyperdrive e staging para walking skeleton |
| Fase 6 | instância Evolution e decisão operacional sobre risco Playwright |
| Fase 9 | sandbox Asaas + segredo de webhook separado |
| Fase 11 | domínio e aprovações de rollout por cliente |
| Fase 12 | clínica piloto, dados autorizados e responsáveis de teste |

## 15. Loop de execução via `/goal`

**Método:** `01-stateless-goal`, de `github.com/giovani-junior-dev/loops`; menor loop determinístico.
Estado vive em `docs/superpowers/audits/goal-ledger.md`, nunca somente no contexto.
| Aspecto | Regra |
|---|---|
| Unidade | 1 Goal ID/summary + cycle rows, 1 mudança de produção e REQs; nunca fase/jornada inteira |
| Oráculo | testes/fixtures/expected outputs RED ficam imutáveis; editar, pular ou apagar = `BLOCKED` |
| UI | `/goal` só após aprovação visual/UX; código mede Playwright, a11y e performance definidos |
| Estado/budget | ledger por ciclo: contador, timestamp, métrica e failure signature; cap 8/90 min |
| Estagnação | cap, 3 falhas iguais ou 3 ciclos sem melhora objetiva obrigam `BLOCKED` no ledger |
| Término | GREEN + gate + diff apenas em paths permitidos + review + ledger concluído |
| Stop P0 | secret, ADR, data model, migration/PII/dado real; owner approval ID obrigatório no ledger |
| Stop externo | deploy/envio/cobrança/purge/rewrite/push/merge; retomar só em novo `/goal` com approval ID |
| Git | registrar known-good SHA; checkpoint GREEN/revert só se autorizado; sem reset/checkout/amend/force |
```text
/goal executar <Goal ID + Task + REQ IDs> até <RED, GREEN e gates> passarem;
máx 8 ciclos/90min; não alterar oráculos; atualizar ledger; parar nos stop gates.
```
Reviewer read-only independente valida P0, auth, financeiro, LGPD e dados antes do merge.

## 16. Mecanismo anti-deriva

Cada PR deve declarar:

```text
Spec requirements: REQ-...
ADR impact: none | ADR-...
Plan phase/task: F...
Tests: RED evidence + GREEN commands
Scope changes: none | approved spec patch
```

Plan status muda somente com evidência anexada. Descoberta nova entra em seção “registro de
mudanças”; não vira nova direção verbal. Repriorização não muda arquitetura. Mudança arquitetural
não aprovada bloqueia PR.

## 17. Próxima ação única

Auditoria de remediação 2026-08-04: ver `docs/superpowers/audits/2026-08-03-remediation-go-no-go.md`. Estado permanece NO-GO até integração PostgreSQL, E2E completo, staging e rollback comprovados.

Executar **Fase 0**. Não autenticar GitHub, mergear PR #6, iniciar feature, smoke IA ou refactor
antes de preservar evidência e rotacionar credenciais potencialmente expostas.
