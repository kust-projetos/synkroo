# Plano de Implementação — Synkroo Hardening & Scale v1.0

> **STATUS:** documentado e revisado em 2026-09-17. Aprovado para execução por etapas. **Não implementado.**
>
> **SPEC par:** `docs/superpowers/specs/2026-09-17-hardening-reliability-scale-v1-spec.md` (baseline `main@73754a9`, verificado).
> **Predecessor:** `2026-09-13-consolidacao-hardening-v1-plano.md` (CONCLUÍDO) — regra nº 1 herda-se: **nada ALREADY_COMPLIANT é reimplementado**; cada etapa começa pela reconciliação da §5.1 da SPEC.

**Objetivo:** executar o hardening do Synkroo de forma incremental, verificável e segura, mantendo `main` funcional durante todo o processo.

---

# 1. Estratégia de execução

A implementação deve seguir esta regra:

```text
Auditar
→ confirmar problema
→ implementar correção mínima
→ criar proteção contra regressão
→ validar
→ documentar
→ avançar
```

Não executar grandes refatorações preventivas sem evidência.

Para cada item da SPEC:

```text
CONFIRMADO
→ corrigir

CANDIDATO
→ investigar antes de alterar

VALIDAR EM RUNTIME
→ medir/testar antes de alterar

RISCO FUTURO
→ implementar proteção proporcional ao risco
```

**Regra 0 (reconciliação):** antes de qualquer etapa, confrontar o item com a §5.1 da SPEC (mapa de status frente ao Hardening V1) e com a auditoria de 2026-09-13. Item ALREADY_COMPLIANT → apenas verificação/manutenção. Item PARCIAL → drenar o residual, não recriar o mecanismo.

---

# 2. Estrutura geral

O trabalho será dividido em 15 etapas (0–14):

| Etapa | Objetivo | Prioridade | Itens SPEC principais |
|---|---|---:|---|
| 0 | Estabelecer baseline confiável | P0 | SYN-DOC-001/002/003, SYN-DEP-001 |
| 1 | Corrigir inconsistências funcionais (cache) | P0/P1 | SYN-CACHE-001..004, SYN-FE-003 |
| 2 | Contratos legados de API | P1/P2 | SYN-API-001/002/005 |
| 3 | Blindar multi-tenancy e autorização | P0 | SYN-SEC-001/002/003 |
| 4 | Garantir integridade e concorrência | P0 | SYN-DATA-001/002/003/004, SYN-TIME-001 |
| 5 | Endurecer financeiro | P0/P1 | SYN-FIN-001/002 |
| 6 | Webhooks e integrações | P0/P1 | SYN-WEBHOOK-001/002/003, SYN-INT-001 |
| 7 | Hardening de CI e supply chain | P1 | SYN-CI-001/002/004/005, SYN-SUPPLY-001, SYN-SEC-006 |
| 8 | Banco e migrations | P0/P1 | SYN-MIG-001/002/003, SYN-TEST-004 |
| 9 | Backup e disaster recovery | P0 | SYN-OPS-001 |
| 10 | Runtime Cloudflare e performance | P1 | SYN-CF-001/002/003, SYN-PERF-001/002, SYN-DB-001/002/003, SYN-SEC-005 |
| 11 | Observabilidade e operação | P1 | SYN-OBS-001..004, SYN-AUDIT-001, SYN-JOB-001..003 |
| 12 | IA, privacidade e LGPD | P1/P2 | SYN-AI-001..006, SYN-PRIV-001..004 |
| 13 | Frontend, acessibilidade, caos e testes | P2 | SYN-FE-001/002/004, SYN-A11Y-001, SYN-TEST-001..005, cenários §99 |
| 14 | Auditoria final e Definition of Done | — | §104/§96 da SPEC, SYN-ARCH-001..004 |

Correspondência com as Fases da SPEC (§88–95):

| Fase da SPEC | Etapas deste plano |
|---|---|
| Fase 0 — Baseline | 0 |
| Fase 1 — Consistência funcional | 1, 2 |
| Fase 2 — Invariantes críticas | 3, 4, 5, 6 |
| Fase 3 — Supply chain e CI | 7 |
| Fase 4 — Runtime reliability | 10 |
| Fase 5 — Observabilidade | 11 |
| Fase 6 — Disaster recovery | 9 |
| Fase 7 — IA | 12 |

Matriz de rastreabilidade dos itens sem subetapa óbvia (exigência da revisão):

| Item SYN | Onde é executado | Gate/evidência |
|---|---|---|
| SYN-CONFIG-001 | Etapa 0.5 | env validada na inicialização; teste |
| SYN-API-003 | Etapa 2.5 | Zod em todo input de rota auditada |
| SYN-API-004 (residuais) | Etapa 2.6 | `change-password` no helper; `handleApiError` deprecado |
| SYN-TIME-001 | Etapa 4.6 | testes de UTC/meia-noite/tz do tenant |
| SYN-SEC-005 | Etapa 10.4 | rate limit distribuído nos endpoints listados |
| SYN-CI-003 (residual) | Etapa 7.6 | decisão documentada sobre `continue-on-error` do E2E |
| SYN-ARCH-001..004 | Etapa 14 | checklist de princípios + boundaries lint verdes |

---

# 3. Etapa 0 — Baseline e inventário

## Objetivo

Garantir que as próximas decisões sejam baseadas no estado real do projeto.

## 0.1 Congelar baseline

Registrar:

```text
branch
commit
Node version
package manager
Cloudflare/OpenNext version
Next.js version
Drizzle version
PostgreSQL version
```

Criar um documento:

```text
docs/audit/hardening-v2-baseline.md
```

> Nota da revisão: `hardening-v1-baseline` já existe conceitualmente pelo ciclo de 2026-09-13 (`docs/goals/performance-baseline.md` + receipts do plano anterior); numerar como **v2** evita colisão.

com:

```text
commit inicial
status do build
status dos testes
status do lint
status do typecheck
estado das migrations
```

## 0.2 Rodar quality gates

Executar:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration:run
npm run test:e2e
npm run build
```

Registrar falhas existentes antes de qualquer alteração.

### Critério de saída

Temos uma resposta objetiva para:

```text
O projeto passa hoje?
O que já está quebrado?
Quais testes são flaky?
```

## 0.3 Verificar dependências

Investigar especialmente:

```text
@neondatabase/serverless
```

Rodar ferramenta como:

```text
knip
```

ou equivalente.

Classificar dependências em:

```text
utilizada
utilização indireta
dev-only
não utilizada
```

Remover somente após confirmação.

## 0.4 Corrigir drift documental

Resolver (ajustado na revisão de 2026-09-17):

```text
README x AGENTS test counts
README aponta para docs/adr/INDEX.md — o arquivo real é docs/adr/ADR-INDEX.md → corrigir o link (opção B)
links quebrados
documentação duplicada
```

Contagens de teste: substituir números absolutos por derivação (badge de CI) ou remover — não atualizar manualmente.

Adicionar verificação automática de links Markdown se viável.

## 0.5 Validar schema de configuração

(SYN-CONFIG-001.) `src/lib/env.ts` já valida env obrigatórias com fail-fast em prod. Verificar cobertura completa (opcionais por feature, workers `ia-bridge`/`ia-agent` com wrangler vars) e adicionar teste do fail-fast.

### Resultado da etapa

Baseline confiável e documentação alinhada com a realidade.

---

# 4. Etapa 1 — Cache e consistência funcional

Esta deve ser a primeira alteração funcional. (SPEC §6–9, §55; residuais registrados de G1.)

## 1.1 Mapear query keys

Levantar todas as keys existentes relacionadas a:

```text
appointments
patients
sessions
financial
dashboard
```

Identificar arrays literais espalhados.

**Partir do que G1 já criou** (`queryKeys` escopadas por clínica + gate) — completar domínios, não duplicar.

## 1.2 Introduzir query key factories

Padronizar, sem overengineering:

```ts
appointmentKeys
patientKeys
sessionKeys
financialKeys
dashboardKeys
```

Exemplo conceitual:

```ts
appointmentKeys.all
appointmentKeys.detail(id)
appointmentKeys.byPatient(patientId)
```

## 1.3 Corrigir RescheduleDialog

Após reschedule:

invalidar:

```text
appointments
appointment detail
dashboard summary
```

e qualquer query comprovadamente derivada.

### Testes

Criar teste que confirme:

```text
mutação
→ sucesso
→ caches afetados revalidados
```

## 1.4 Corrigir atualização de sessão

**Estado verificado (2026-09-17):** `useUpdateSession` não invalida `financial-summary` de forma nenhuma — a mutação não possui `patientId` nas variáveis nem no retorno (só invalida o detalhe do plano).

Propagar:

```text
patientId
```

na mutation quando necessário para cache (retorno da API ou variáveis).

Não utilizar esse ID como autorização.

Resultado esperado:

```text
["financial-summary", patientId]
```

— invalidação específica, nunca global.

## 1.5 Invalidação de patient appointments

**Reclassificado (2026-09-17):** o `AppointmentDialog` já usa `clinicScope(clinicId, 'appointments')` + faixas de calendário; `["patient-appointments"]` não existe mais.

Ação: avaliar se keys por paciente (`['clinic', clinicId, 'appointments', 'by-patient', patientId]`) valem a pena onde houver listagem por paciente — apenas com evidência de refetch desnecessário; caso contrário, registrar decisão (escopo por clínica é suficiente).

## 1.6 Centralizar efeitos de mutations

Não criar um sistema genérico complexo.

Criar pequenos helpers por domínio, por exemplo:

```text
invalidateAppointmentChanges()
invalidateSessionChanges()
```

Objetivo:

> componentes não precisam conhecer todas as consequências indiretas de uma mutation.

### Gate da etapa

Não avançar enquanto:

```text
reschedule
session update
appointment update
```

não tiverem testes de consistência.

---

# 5. Etapa 2 — Contratos legados de API

(SPEC §10, §11, §71–73.)

## 2.1 Inventariar campos deprecated

Começar pelos confirmados:

```text
appointment_id   (GET /api/appointments/sessions/:sessionId)
patient_id       (PUT /api/appointments/:appointmentId)
```

Identificar:

```text
rota
consumidores
testes
telemetria
```

## 2.2 Garantir independência de autorização

Adicionar testes antes da remoção.

Exemplo:

```text
client envia patient_id de outro tenant
→ autorização permanece baseada no recurso real
```

## 2.3 Remover consumidores

Atualizar frontend ou integrações que ainda enviem campos desnecessários.

## 2.4 Remover contratos legados

Somente depois de confirmar inexistência de consumidores necessários.

Atualizar:

```text
validation schema
types
tests
docs
API examples
```

### Gate

Nenhuma autorização deve depender de dados de ownership enviados pelo cliente.

## 2.5 Schemas de runtime nos gaps

(SYN-API-003.) Auditar rotas fora do envelope canônico que ainda leem `request.json()` sem Zod; toda input externa passa por schema de runtime.

## 2.6 Drenar residuais do envelope

(SYN-API-004 — JÁ ATENDIDO; apenas residuais registrados em AGENTS.md §Residuais API menores.) Migrar `auth/change-password` para o helper `apiRateLimited` (comportamento `Retry-After` já correto — unificação cosmética) e deprecar `handleApiError`/`RateLimitError` (`src/lib/errors.ts`) se sem uso em produção para 429.

---

# 6. Etapa 3 — Multi-tenancy e autorização

Esta é a parte de maior prioridade de segurança. (SPEC §18–20.)

## 3.1 Criar matriz de recursos

Listar recursos multi-tenant:

```text
patients
appointments
sessions
financial records
users
clinics
integrations
settings
AI resources
```

Para cada um:

```text
owner
tenant boundary
roles permitidas
queries que acessam
endpoints que alteram
```

## 3.2 Auditar queries

Procurar consultas semelhantes a:

```sql
WHERE id = ?
```

em recursos multi-tenant.

Confirmar que o tenant é derivado de contexto autenticado.

Quando necessário:

```sql
WHERE id = ?
AND tenant_id = ?
```

## 3.3 Centralizar contexto autenticado

Idealmente cada request deve resolver algo como:

```ts
{
  userId,
  tenantId,
  role
}
```

server-side.

Evitar repetir parsing/autorização manual em cada rota.

**Nota de reconciliação:** o projeto já possui `modules/core` (RBAC, tenant context, access, roles) — auditar cobertura e adotar onde ausente, não recriar.

## 3.4 Criar suíte negativa

Para cada domínio crítico:

```text
Tenant A cria recurso
Tenant B tenta ler
Tenant B tenta alterar
Tenant B tenta excluir
```

Testar também:

```text
não autenticado
role incorreta
membership removida
membership desabilitada
```

### Gate obrigatório

Nenhum recurso pertencente ao Tenant A pode ser acessado pelo Tenant B.

Critérios de saída verificáveis (exigência da revisão):

1. matriz de recursos concluída e revisada (escopo enumerado, sem "e outros");
2. suíte negativa cobrindo **todos** os recursos da matriz — não uma amostra;
3. suíte rodando como gate de CI (job dedicado) com falha bloqueante;
4. evidência persistida no relatório de progresso (lista recurso × casos × resultado).

---

# 7. Etapa 4 — Integridade, concorrência e idempotência

(SPEC §22–25; reconciliar com E1/A2/A3/A4 do Hardening V1 — ver §5.1 da SPEC.)

## 4.1 Mapear operações críticas

Classificar mutations em:

### Alta criticidade

```text
criar appointment
remarcar appointment
cancelar appointment
financeiro
webhooks
ações de IA com side effect
```

### Baixa criticidade

```text
preferências visuais
filtros
dados não transacionais
```

## 4.2 Double booking

**Status pré-verificado (2026-09-17):** a constraint `appointments_no_overlap` (`0001_dapper_overlap.sql:57-66`) é um `EXCLUDE USING gist` que vale para **qualquer escrita** na tabela (INSERT e UPDATE), respeitando `status` e `deleted_at` (E1, ALREADY_COMPLIANT). O trabalho desta etapa é:

Auditar os caminhos que escrevem agenda (criação, **remarcação e edição**) e confirmar que todos passam pela proteção do banco — incluindo paths de importação/seed que possam desabilitar triggers/constraints.

Se algum caminho contornar:

```text
constraint
transaction
lock
ou estratégia equivalente
```

## 4.3 Teste concorrente

**A criação concorrente já está coberta:** `src/modules/operacional/repositories/__tests__/overbooking/integration.test.ts:198-225` executa inserções paralelas e exige exatamente 1 sucesso + `23P01`. **Preservar esse teste** — não duplicar.

Escopo novo desta etapa: mesma prova para **remarcação e edição** (o teste atual de remarcação cobre conflito sequencial, não corrida — `actions/__tests__/scheduling/integration.test.ts:248-275`).

Critério:

```text
1 operação vence
N-1 recebem conflito controlado
```

Nunca:

```text
duas reservas válidas
```

## 4.4 Idempotência

Adicionar idempotência inicialmente apenas onde o custo de duplicação é alto.

Prioridade:

```text
financial
webhook (JÁ ATENDIDO — uniques de dedup existem; apenas testes de replay)
appointment creation
external messaging (JÁ ATENDIDO — A2/A3; apenas verificação)
AI actions (parcialmente atendido — B1; drenar residual)
```

Estratégia possível:

```text
idempotency_key
+ tenant_id
+ operation
```

com uniqueness.

Gap específico remanescente (verificado 2026-09-17): idempotency key na **criação de appointment e pagamentos via API** (retry do browser / duplo clique). A infraestrutura de tabela `idempotency_keys` (migration 0008) já existe — reutilizar, não recriar.

## 4.5 Transações

Mapear ações que escrevem múltiplos registros.

Transformar em transação quando representarem uma única ação de negócio.

## 4.6 Semântica temporal

(SYN-TIME-001.) Padronizar e provar:

```text
persistência → UTC
timezone do tenant → explícita
renderização → timezone do tenant/usuário
```

Testes obrigatórios: mudança de dia, meia-noite, conversão UTC, horários extremos, timezone do usuário ≠ timezone da clínica.

### Gate da etapa (exigência da revisão)

A Etapa 4 só conclui quando:

1. criação, remarcação e edição concorrentes produzem **no máximo uma** gravação válida, com conflito determinístico (`23P01` mapeado para erro de API adequado);
2. todos os caminhos de escrita de agenda inventariados passam pela constraint (sem bypass);
3. criação de appointment e pagamento aceitam idempotency key com teste de duplicata;
4. operações compostas inventariadas estão em transação ou têm exceção justificada;
5. testes temporais da 4.6 verdes.

---

# 8. Etapa 5 — Financeiro

(SPEC §27–28.)

## 5.1 Revisar representação de valores

Confirmar se valores utilizam:

```text
integer cents
```

ou:

```text
numeric/decimal
```

Evitar `number` para cálculos financeiros sensíveis.

## 5.2 Adicionar testes financeiros

Cobrir:

```text
descontos
totais
parcelas
estornos
pagamentos parciais
arredondamento
```

## 5.3 Audit trail

Para alterações relevantes, registrar:

```text
actor
operation
before
after
timestamp
requestId
```

Sem armazenar PII desnecessária.

**Nota de reconciliação:** `ADR-BASE-12` (audit allowlist) já define o mecanismo de auditoria — estender a allowlist, não criar trilha paralela.

---

# 9. Etapa 6 — Webhooks e integrações

(SPEC §29–31, §82; reconciliar com A4/A2+A3.)

## 6.1 Inventariar integrações

Para cada provider:

```text
endpoint
auth
timeout
retry
idempotência
logging
secret
```

## 6.2 Assinaturas de webhook

Quando disponível:

```text
validar signature
validar timestamp
validar secret
```

Falhar antes de processar payload inválido.

## 6.3 Deduplicação

Persistir identificador do evento.

Exemplo:

```text
provider
event_id
```

com uniqueness.

(Gap confirmado do Hardening V1: A4 trouxe freshness, não dedup persistente.)

## 6.4 Out-of-order events

Não assumir ordem de chegada.

Criar tratamento por:

```text
timestamp
version
status
```

quando relevante.

---

# 10. Etapa 7 — CI e supply chain

(SPEC §16, §17, §58–62.)

## 7.1 Pin de GitHub Actions

Substituir gradualmente:

```yaml
uses: xxx@v4
```

por:

```yaml
uses: xxx@<SHA>
```

Manter comentário com versão legível.

## 7.2 Gitleaks

Substituir:

```text
curl
→ tar
→ execute
```

por:

```text
Action oficial pinada
```

ou validação de SHA256.

## 7.3 Dependabot/Renovate

Configurar:

```text
weekly updates
group minor/patch
major separado
CI obrigatório
```

## 7.4 Security scanning

Integrar ou validar:

```text
Gitleaks
dependency scan
npm audit/OSV
```

Evitar pipeline excessivamente ruidoso.

## 7.5 Gate obrigatório

PR não pode ser mergeado se falhar:

```text
lint
typecheck
unit
integration
build
security scan crítico
tenant isolation
```

## 7.6 Residual E2E production-mode

(SYN-CI-003 — decisão do Hardening V1.) O E2E de produção-mode roda com `continue-on-error` condicionado à estabilidade no CI. Definir critério objetivo (ex.: N execuções verdes consecutivas) e remover a flag quando cumprido; documentar a decisão no ADR/relatório da etapa.

---

# 11. Etapa 8 — Migrations e banco

(SPEC §45–47, §77.)

## 8.1 Auditar migrations existentes

Verificar:

```text
ordem
idempotência operacional
indexes
constraints
backfills
breaking changes
```

## 8.2 Testar do zero

CI deve conseguir:

```text
criar banco vazio
→ rodar todas migrations
→ iniciar aplicação/testes
```

## 8.3 Adotar expand/contract

Para mudanças destrutivas:

### Deploy A

```text
adicionar nova estrutura
```

### Deploy B

```text
app passa a usar nova estrutura
```

### Deploy C

```text
remover antiga
```

**Proibição (exigência da revisão):** é vedado executar contract/remoção em produção sem, cumulativamente:

```text
backup restaurado com evidência
confirmação de que todas as versões ativas não leem/escrevem a estrutura antiga
período mínimo de observação sem erro após o Deploy B
plano de forward-fix documentado
aprovação operacional explícita
```

Na dúvida, manter a estrutura antiga e interromper a etapa.

(Método expand/contract já declarado como regra nº 3 do plano de 2026-09-13 — manter como invariante.)

## 8.4 Separar backfills

Backfill grande não deve ficar escondido numa migration comum.

Criar processo específico.

### Critério de saída da etapa (exigência da revisão)

1. CI executa, em banco vazio, `db:migrate` até o schema final e os testes sobem contra ele (job verificável);
2. cada migration destrutiva pendente possui plano expand/contract documentado com as condições da proibição acima;
3. inventário de migrations sem rollback/forward-fix explícito = zero, ou exceções registradas com owner.

---

# 12. Etapa 9 — Backup e disaster recovery

(SPEC §48.)

## 9.1 Definir objetivos

Documentar:

```text
RPO
RTO
retenção
responsável
```

## 9.2 Testar restore

Criar ambiente isolado:

```text
backup
→ restore
→ migrations
→ smoke tests
```

### Regra

Backup só é considerado válido após restore comprovado.

## 9.3 Runbook

Criar:

```text
docs/runbooks/database-recovery.md
```

com procedimentos para:

```text
DB corrompido
migration com problema
deploy incompatível
credencial comprometida
```

> Nota: o Hardening V1 (F5) já produziu runbook de smoke pós-deploy — estender a árvore existente em `docs/runbooks/` em vez de criar convenção paralela.

---

# 13. Etapa 10 — Cloudflare/OpenNext

(SPEC §38–40.)

## 10.1 Confirmar limites atuais

Testar em ambiente equivalente à produção:

```text
CPU
memory
request duration
payload
subrequests
streaming
Node compatibility
```

## 10.2 Hyperdrive

Observar:

```text
connections
pool usage
wait time
query latency
timeouts
```

## 10.3 Teste de carga inicial

Começar pequeno.

Cenários:

```text
login
appointments
dashboard
patient listing
reports
```

Registrar:

```text
p50
p95
p99
error rate
DB connections
```

Partir do baseline existente em `docs/goals/performance-baseline.md` (G5).

## 10.4 Rate limiting distribuído

(SYN-SEC-005.) O projeto já limita auth/login, agent/classify, leads, messages/send, instagram/webhook (AGENTS.md §Segurança), mas o estado é in-process. Auditar se o limite precisa ser compartilhado/distribuído (SYN-CF-003: instâncias não compartilham memória) e cobrir os endpoints restantes da lista da SPEC (password reset, AI, search pesada, upload).

---

# 14. Etapa 11 — Observabilidade

(SPEC §21, §49–52, §67–70.)

## 11.1 Request ID

Toda request recebe:

```text
requestId
```

e esse identificador acompanha:

```text
API
DB log
provider externo
job
AI
```

(O envelope canônico já gera `requestId` — propagar, não reinventar.)

## 11.2 Logging estruturado

Criar formato comum.

Exemplo:

```json
{
  "requestId": "...",
  "route": "...",
  "status": 200,
  "latencyMs": 42
}
```

Tenant/user devem ser anonimizados quando apropriado.

Reutilizar o mecanismo de redaction da B2 (telemetria) como base do filtro central.

## 11.3 Redaction

Criar filtro central para remover:

```text
Authorization
cookie
password
token
CPF
telefone
email
dados clínicos
```

## 11.4 Métricas

Prioridade:

```text
5xx
latency
DB
integrations
jobs
AI
```

## 11.5 Alertas

Começar somente com alertas acionáveis:

```text
error rate alto
DB indisponível
latência anormal
webhook failure elevado
AI cost spike
```

---

# 15. Etapa 12 — IA e LGPD

Executar somente depois das invariantes de segurança estarem sólidas. (SPEC §32–37, §63–66; reconciliar com B1/B2 — drenar residuais, não recriar.)

## 12.1 Boundary de execução

Separar:

```text
LLM decide intenção
```

de:

```text
sistema autoriza execução
```

## 12.2 Tool layer

Toda tool deve:

```text
validar schema
resolver tenant server-side
validar role
validar recurso
executar
auditar
```

## 12.3 Structured outputs

Não interpretar ações críticas a partir de texto livre.

Utilizar schemas explícitos.

(Já adotado na B1 via Zod — verificar cobertura completa das tools.)

## 12.4 Confirmation gates

Ações irreversíveis ou de alto impacto devem poder exigir confirmação humana.

## 12.5 Custos

Registrar:

```text
provider
model
feature
tokens
cost estimate
latency
```

(Cap e telemetria base já existem — B1/B2.)

## 12.6 Evals

Criar casos para:

```text
hallucination
wrong tool
cross-tenant access attempt
prompt injection
financial request
dangerous mutation
```

## 12.7 Data inventory (LGPD)

Catalogar:

| Dado | Origem | Uso | Storage | Retenção |
|---|---|---|---|---|
| Paciente | usuário | operação | DB | definir |
| Telefone | paciente | contato | DB | definir |
| Financeiro | sistema | operação | DB | definir |
| AI prompt | aplicação | IA | provider/log | definir |

## 12.8 Data minimization

Enviar para terceiros apenas os dados necessários.

## 12.9 Exportação/exclusão

Definir processos claros.

Não implementar exclusão indiscriminada antes de definir requisitos legais e operacionais.

---

# 16. Etapa 13 — Performance, caos e testes

Guiado por métricas. Não otimizar antecipadamente. (SPEC §74–78, §86–87, §99.)

## 13.1 Monitorar primeiro

```text
slow queries
N+1
dashboard aggregation
large lists
bundle size
API latency
```

Somente depois considerar:

```text
novos índices
materialized views
cache
jobs
paginação por cursor
```

## 13.2 Estados de mutation e error boundaries (frontend)

Toda mutação com UX para `idle/pending/success/error/retry`; boundaries nas regiões principais; acessibilidade (axe) nos fluxos principais.

## 13.3 Testes de migration e caos

Em CI: DB vazia → todas migrations → schema válido. Simular os 6 cenários de falha da SPEC §99.

---

# 17. Etapa 14 — Auditoria final

Depois de todas as etapas, executar uma nova revisão de ponta a ponta contra a SPEC §104 e o DoD §96.

Revalidar especialmente:

```text
multi-tenancy
auth
appointments
financial
webhooks
AI
migrations
Cloudflare
DB
CI
observability
recovery
```

Também procurar regressões introduzidas pelo próprio processo de hardening.

Checklist adicional de princípios arquiteturais (SYN-ARCH-001..004 — princípios contínuos, evidência = revisão + boundaries lint verdes):

```text
feature flags com owner e data de remoção (SYN-ARCH-001)
nenhuma extração prematura de serviço (SYN-ARCH-002)
domínios expondo capacidades, não tabelas (SYN-ARCH-003)
sem GenericRepository<T> (SYN-ARCH-004)
```

---

# 18. Ordem prática para o agente

A ordem de trabalho recomendada é:

1. Criar baseline da auditoria e garantir que lint, typecheck, testes e build estejam conhecidos.
2. Corrigir drift documental e dependências comprovadamente órfãs.
3. Padronizar query keys (a partir do que G1 já criou).
4. Corrigir `RescheduleDialog`.
5. Corrigir invalidação de `financial-summary`.
6. Adicionar invalidação específica de `financial-summary` por paciente (hoje inexistente no fluxo de sessão) e avaliar keys por paciente nos appointments.
7. Centralizar efeitos de mutations por domínio.
8. Mapear e remover contratos legados `appointment_id` e `patient_id`.
9. Criar matriz multi-tenant.
10. Auditar queries de ownership.
11. Criar testes negativos cross-tenant.
12. Auditar concorrência de appointments (constraint já cobre INSERT/UPDATE — provar remarcação/edição).
13. Cobrir concorrência de remarcação/edição contra double booking (criação já testada — preservar).
14. Introduzir idempotência nas operações críticas restantes (dedup de webhook, appointment/pagamento).
15. Revisar transações e constraints.
16. Auditar financeiro e precisão monetária.
17. Criar audit trail de ações críticas (estendendo ADR-BASE-12).
18. Auditar webhooks, autenticação, deduplicação e replay.
19. Endurecer GitHub Actions e Gitleaks.
20. Validar migrations do zero.
21. Adotar expand/contract para mudanças destrutivas.
22. Validar backup e restore.
23. Testar Cloudflare/OpenNext/Hyperdrive em runtime real.
24. Adicionar logging estruturado e correlation IDs.
25. Adicionar métricas e alertas essenciais.
26. Endurecer IA e tool authorization (drenando residuais B1/B2).
27. Criar inventário de dados/LGPD.
28. Executar testes de carga.
29. Corrigir gargalos encontrados por métricas.
30. Executar auditoria final contra a SPEC.

---

# 19. Estratégia de commits

Não criar um único commit ou PR gigante.

Preferir unidades como:

```text
fix(cache): invalidate appointment dependent queries

refactor(query): centralize appointment query keys

test(auth): add cross-tenant appointment isolation

fix(api): remove deprecated appointment_id contract

security(ci): pin GitHub Actions by commit SHA

test(db): validate migration chain from empty database
```

Cada commit deve possuir escopo claro.

---

# 20. Estratégia de branches/PRs

Agrupar por domínio.

Sugestão:

```text
hardening2/01-baseline
hardening2/02-cache
hardening2/03-api-contracts
hardening2/04-tenant-security
hardening2/05-data-integrity
hardening2/06-integrations
hardening2/07-ci
hardening2/08-migrations
hardening2/09-observability
hardening2/10-ai
```

> Nota da revisão: prefixo `hardening2/` para não colidir com as branches `feat/hardening-*` do ciclo anterior (histórico preservado).

Evitar branches extremamente longas.

---

# 21. Regra para refatoração

Se durante a implementação for encontrada uma estrutura ruim, o agente deve perguntar internamente:

```text
Isso impede a correção atual?
Isso representa risco real?
Há teste demonstrando o problema?
```

Se não:

```text
registrar dívida
não ampliar escopo
```

---

# 22. Stop conditions

O agente deve interromper a alteração específica e investigar antes de continuar se encontrar:

```text
breaking migration inesperada
risco de perda de dados
cross-tenant access
inconsistência financeira
mudança incompatível de API
falha de restore
segredo real versionado
```

---

# 23. Critérios de conclusão por etapa

Toda etapa só termina quando possuir:

```text
implementação
+
testes
+
validação
+
documentação necessária
+
zero regressões conhecidas
```

Não considerar concluído apenas porque o código compila.

---

# 24. Relatório de progresso

Ao final de cada fase, registrar:

```markdown
## Implementado

## Problemas encontrados adicionalmente

## Problemas resolvidos

## Problemas adiados

## Testes adicionados

## Riscos restantes

## Próxima fase
```

Isso evita perder descobertas durante o hardening.

---

# 25. Definition of Done final

O plano estará concluído somente quando:

```text
main está verde
```

e puder ser demonstrado que:

```text
cache permanece consistente;

tenant isolation possui testes automáticos;

double booking possui proteção comprovada por teste (criação, remarcação e edição);

operações críticas são idempotentes;

financeiro possui precisão e auditabilidade;

webhooks são autenticados e deduplicados (com teste de replay);

migrations são verificadas, inclusive do zero;

contratos deprecated foram removidos ou possuem owner, telemetria, data e plano de remoção;

migrations possuem prova de compatibilidade entre versões adjacentes (rollout);

links e docs derivados são validados em CI (sem drift silencioso);

invariantes de tenancy, autorização e integridade possuem gates regressivos obrigatórios;

os seis cenários de caos da SPEC §99 têm evidência de execução;

restore de backup funciona;

CI possui supply-chain hardening;

Cloudflare/Hyperdrive foram validados;

logs permitem diagnóstico;

PII possui redaction;

IA não controla autorização;

integrações possuem timeout/retry;

riscos críticos da SPEC possuem teste ou controle explícito.
```

---

# 26. Resultado esperado

Ao final do plano, a evolução será:

```text
Estado atual
    ↓
correções pontuais
    ↓
invariantes explícitas
    ↓
testes contra regressões
    ↓
hardening operacional
    ↓
observabilidade
    ↓
resiliência
    ↓
preparação para crescimento
```

O objetivo final não é deixar o Synkroo mais complexo.

É fazer com que ele seja:

```text
mais previsível
mais verificável
mais seguro
mais fácil de operar
mais difícil de quebrar
```

sem perder a simplicidade arquitetural atual.

---

# 27. Evidências da revisão (preenchido pelo Planner, 2026-09-17)

**Rodada 1 — verificação de fatos e revisão independentes (wave explorer + reviewer, paralela, read-only):**

- **Explorer (fatos):** 14 claims verificadas com evidência arquivo:linha. 3 afirmações desatualizadas foram corrigidas na SPEC (SYN-CACHE-003 já pós-G1; SYN-API-001 sem alvo no checkout; SYN-API-002 reformulada — snake stripado, camel tenant-scoped). 2 "gaps" já fechados identificados (dedup de webhook com uniques + `onConflictDoNothing`; teste concorrente de double-booking com `23P01`). Contagem E2E confirmada: 46 specs.
- **Reviewer (documentos):** `CHANGES_REQUIRED` com 6 majors — todos aplicados: (1) tabela de etapas 8–14 e mapa fase↔etapa realinhados ao corpo; (2) SYN-DATA-001 deixou de reabrir teste existente; (3) matriz de rastreabilidade para itens sem subetapa (SEC-005, API-003, CONFIG-001, TIME-001, ARCH-001..004, CI-003 residual, API-004 residual); (4) gates de saída verificáveis nas etapas 3, 4 e 8; (5) DoD estendido (remoção de deprecated, compat de rollout, docs validados, gates regressivos, evidência dos cenários §99); (6) proibição explícita de contract/migration destrutiva sem backup restaurado + observação + forward-fix + aprovação.
- **Reconciliação com Hardening V1:** `2026-09-13-consolidacao-hardening-v1-plano.md` (concluído, 10/10 verde) — mapa na §5.1 da SPEC.
- **Decisões da revisão:** ver §107 da SPEC (Rodadas 1 e 2).

**Estado pós-ajustes:** documentos aprovados para execução por etapas. Residual consciente: nº exato de suites Jest a medir na Etapa 0 (`npx jest --listTests`).
