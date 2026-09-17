# SPEC — Synkroo Hardening, Reliability & Scale v1.0

> **STATUS:** documentada e revisada em 2026-09-17. Aprovada para execução por etapas. **Não implementada.**
>
> **Baseline auditada:** `main@73754a9160eda732fc400a4f49c2f8870aa72ded` (verificada — HEAD confirma).
> **Predecessor obrigatório:** `docs/superpowers/specs/2026-09-13-consolidacao-hardening-v1-plano.md` (CONCLUÍDO) e sua auditoria. A regra nº 1 daquele plano permanece: **nada classificado ALREADY_COMPLIANT é reimplementado** — ver §5.1.
> **Documento par:** Plano de implementação em `2026-09-17-hardening-reliability-scale-v1-plano.md`.

**Projeto:** Synkroo
**Repositório:** `kust-projetos/synkroo`
**Data da auditoria:** 17/09/2026
**Tipo:** Hardening + correção + prevenção + preparação para escala

---

# 1. Objetivo

Esta SPEC consolida:

1. problemas atualmente identificados no repositório;
2. dívidas técnicas explicitamente registradas pelo próprio projeto;
3. inconsistências arquiteturais ou operacionais;
4. superfícies que precisam ser verificadas em runtime;
5. riscos que provavelmente surgirão conforme o Synkroo crescer;
6. proteções para evitar regressão;
7. requisitos necessários para elevar o Synkroo de uma aplicação funcional para uma plataforma SaaS mais robusta, segura e preparada para escala.

A meta não é fazer uma reescrita ampla.

A prioridade é:

> corrigir inconsistências existentes → eliminar ambiguidades → reforçar invariantes → impedir regressões → preparar escala.

---

# 2. Escopo da revisão

A auditoria considera:

- arquitetura;
- Next.js;
- frontend;
- backend;
- APIs;
- banco de dados;
- Drizzle;
- autenticação;
- autorização;
- multi-tenancy;
- cache;
- TanStack Query;
- appointments;
- sessions;
- pacientes;
- financeiro;
- integrações;
- IA;
- Cloudflare;
- OpenNext;
- Hyperdrive;
- segurança;
- privacidade;
- CI/CD;
- supply chain;
- testes;
- E2E;
- mutation testing;
- observabilidade;
- migrations;
- documentação;
- operação;
- recuperação;
- escalabilidade.

---

# 3. Classificação utilizada

## 3.1 Evidência

### CONFIRMADO

Problema observado diretamente no estado atual do repositório.

### CANDIDATO

Há evidência suficiente para investigação ou remoção, mas não para afirmar impacto funcional.

### VALIDAR EM RUNTIME

Não pode ser confirmado apenas por inspeção estática.

### RISCO FUTURO

Não necessariamente existe como defeito hoje, mas existe uma trajetória razoável para que se transforme em incidente conforme o produto evolua.

---

# 4. Prioridade

### P0 — Crítico

Pode causar:

- vazamento de dados;
- corrupção financeira;
- isolamento multi-tenant quebrado;
- perda permanente;
- comprometimento de autenticação;
- incidente grave de segurança.

### P1 — Alto

Pode causar:

- inconsistência de dados;
- comportamento funcional incorreto;
- incidentes relevantes;
- degradação operacional;
- regressões difíceis de detectar.

### P2 — Médio

Pode causar:

- UX inconsistente;
- manutenção mais difícil;
- desperdício de recursos;
- ambiguidade arquitetural;
- dívida crescente.

### P3 — Higiene

Não compromete diretamente o produto, mas aumenta custo futuro ou reduz clareza.

---

# 5. Diagnóstico geral

O Synkroo não possui atualmente a estrutura típica de um MVP improvisado.

O projeto já possui sinais claros de maturidade:

- TypeScript;
- Next.js;
- arquitetura organizada;
- Drizzle;
- PostgreSQL;
- Cloudflare/OpenNext;
- Hyperdrive;
- testes unitários;
- testes de integração;
- Playwright;
- mutation testing;
- Gitleaks;
- CI bloqueante;
- ADRs;
- documentação operacional;
- preocupação explícita com autorização e ownership.

Portanto, a principal ameaça atualmente não é ausência de engenharia.

É outra:

> conforme a quantidade de mecanismos de proteção aumenta, a consistência entre eles passa a ser tão importante quanto a existência deles.

As principais classes de risco identificadas são:

1. inconsistência de cache;
2. contratos legados acumulando-se;
3. drift documental;
4. supply chain do CI;
5. possibilidade de regressão multi-tenant;
6. condições de corrida em operações concorrentes;
7. evolução de banco e migrations;
8. observabilidade insuficiente para falhas distribuídas;
9. complexidade crescente de integrações e IA;
10. diferenças entre comportamento local e Cloudflare runtime.

---

# 5.1 Reconciliação obrigatória com o Hardening V1 (2026-09-13)

O repositório já executou um ciclo completo de hardening (trilhas A1–G5, 16 merges em `main`, bateria 10/10 verde). Esta SPEC **não reabre** itens fechados com evidência. Mapa de status por item — **verificado por wave `explorer` em 2026-09-17 contra o código**; validar novamente na execução de cada etapa, nunca reimplementar às cegas:

| Item desta SPEC | Status (verificado 2026-09-17) | Evidência / residual |
|---|---|---|
| SYN-CACHE-001 (RescheduleDialog) | **VÁLIDO** — residual de G1, descrição corrigida | `RescheduleDialog.tsx:117-123` invalida apenas faixas de calendário (`invalidateCalendarDateKeys`) — **não** invalida `["appointments"]`/detail/dashboard (AGENTS.md:175) |
| SYN-CACHE-002 (financial-summary) | **VÁLIDO** — residual de G1 | `useTreatmentPlans.ts:127-137`: `useUpdateSession` não possui `patientId` nas variáveis nem no retorno (handler retorna só `treatment_plan_item`); `financial-summary` do paciente fica stale |
| SYN-CACHE-003 (AppointmentDialog) | **RECLASSIFICADO — já pós-G1** | `AppointmentDialog.tsx:193-195` já usa `clinicScope(clinicId,'appointments')` + invalidação por faixa de calendário; `patient-appointments` = 0 hits no código. Residual: avaliar keys por paciente onde fizer sentido |
| SYN-CACHE-004 / SYN-FE-003 (query key factory + effects) | **PARCIAL** | Factory `clinicScope` existe e é ampla (`use-queries.ts:19-228`, ~20 domínios); gaps: treatment-plans/sessions usam literais, `financial-summary` sem factory (`useFinancialSummary.ts:47`, `usePayments.ts:89`) |
| SYN-API-001 (appointment_id legado) | **NÃO APLICÁVEL no baseline** | Endpoint `GET /api/appointments/sessions/:sessionId` não existe; rota real é `/api/treatment-plans/[id]/sessions`, sem `appointment_id`, ownership server-side (`verifyOwnership(planId, clinicId)`) |
| SYN-API-002 (patient_id no PUT) | **REFORMULADO** | snake `patient_id` é stripado pelo Zod (campo morto); camel `patientId` opcional é reatribuição legítima validada com `patientsRepo.findById(ctx.clinicId, ...)` + `WHERE clinic_id` — ownership preservado. Falta teste negativo desse caminho |
| SYN-API-004 (envelope de erro) | **JÁ ATENDIDO** | D2/D3 fechados 2026-09-14 (ADR-BASE-10); `change-password` manual já emite `Retry-After` em header corretamente — unificação no helper é cosmética |
| SYN-DATA-001 (double booking) | **PROTEÇÃO EXISTENTE E TESTADA (criação)** | Constraint `appointments_no_overlap` (`0001_dapper_overlap.sql:57-66`) cobre INSERT **e** UPDATE; teste concorrente de criação já existe (`overbooking/integration.test.ts:198-225`, espera 1 sucesso + `23P01`). Gap: concorrência em remarcação/edição |
| SYN-DATA-002 (idempotência) | **PARCIAL — mecanismos existem** | `idempotency_keys` UNIQUE (migration 0008), `messages(external_provider,external_message_id)` UNIQUE (0019), `gateway_events(provider,external_event_id)` UNIQUE (0003/0014); inbound com `onConflictDoNothing` (`messages/inbound/route.ts:20-22`). Gap: idempotency key em criação de appointment/pagamento via API |
| SYN-WEBHOOK-002 (replay) | **JÁ ATENDIDO — dedup persistente existe** | Uniques acima; escopo reduzido a testes de replay e cobertura de providers restantes |
| SYN-AI-001..005 (IA) | **PARCIAL** | B1: cap de custo, binding de principal, reserva atômica, deadline de turno, prompt delimitado, Zod em outputs; B2: telemetria estruturada com redaction. Faltam evals dataset e confirmation gates explícitos |
| SYN-OBS-001 / SYN-SEC-004 (redaction em logs) | **PARCIAL — filtro existe, não exportado** | `logger.ts:31-44` (`SENSITIVE_LOG_KEYS` + `redactLogValue` recursivo) é interno ao módulo, não exportado; workers edge não usam o módulo (`ia-agent/index.ts:71`). Gap: exportar e unificar como filtro central |
| SYN-OPS-002 (health/readiness) | **JÁ ATENDIDO** | F2: liveness puro, health/db sanitizado, readiness real com ledger de migrations |
| SYN-CI-003 (quality gates) | **JÁ ATENDIDO (maioria)** | CI bloqueante lint→typecheck→test→test:security→build→build:cf; E2E de produção-mode ainda não bloqueante (flag `continue-on-error` condicionada) |
| SYN-DB-002 (índices por evidência) | **PARCIAL** | G4: 2 índices aplicados com evidência, 4 avaliados e não aplicados |
| SYN-PERF-001 (budget/baseline) | **PARCIAL** | G5: baseline em `docs/goals/performance-baseline.md`; falta budget bloqueante |
| SYN-SEC-001..003 / SYN-SEC-005 (tenant, suíte negativa, rate limiting) | **VÁLIDO** | Não houve trilha dedicada a suíte negativa cross-tenant no Hardening V1 |

Regra de execução decorrente: cada etapa do Plano **começa** conferindo o status desta tabela contra a auditoria de 2026-09-13 e o código atual; classificar `ALREADY_COMPLIANT` antes de escrever código.

---

# 6. Problemas confirmados

## SYN-CACHE-001 — Reschedule não invalida todos os dados afetados

**Status:** CONFIRMADO
**Prioridade:** P1

O estado verificado em 2026-09-17: o `RescheduleDialog` invalida apenas as faixas de calendário envolvidas:

```text
invalidateCalendarDateKeys(queryClient, clinicId, originKey?, targetDateKey)
```

(`src/components/calendar/RescheduleDialog.tsx:117-123`)

Ele **não** invalida:

```text
["appointments"] (collection escopada por clínica)
appointmentKeys.detail(appointment.id)
["dashboard-summary"]
```

Isso cria a possibilidade de a alteração ser persistida corretamente no backend enquanto partes da UI continuam mostrando informações antigas. (Gap já registrado em AGENTS.md §Débitos "Frontend (G1)".)

### Cenário

1. usuário remarca um atendimento;
2. request termina com sucesso;
3. lista principal atualiza;
4. detalhe ou dashboard continua com data/horário anterior;
5. usuário interpreta o estado antigo como verdadeiro.

### Correção requerida

Centralizar todas as invalidações relacionadas à mutação.

Após sucesso:

- invalidar collection de appointments;
- invalidar detalhe do appointment alterado;
- invalidar dashboard relacionado;
- invalidar demais agregações que dependam daquele appointment.

### Critério de aceite

Depois de uma remarcação:

- lista apresenta o novo valor;
- detalhe apresenta o novo valor;
- dashboard apresenta o novo valor;
- nenhuma atualização manual da página é necessária.

### Teste obrigatório

Teste de integração do fluxo completo da mutação.

---

# 7. SYN-CACHE-002 — Financial summary não possui invalidação suficientemente específica

**Status:** CONFIRMADO
**Prioridade:** P1

O fluxo de atualização de sessão (`useUpdateSession`, `src/hooks/useTreatmentPlans.ts:129-137`) invalida apenas o detalhe do plano de tratamento:

```text
clinicScope(clinicId, 'treatment-plan', treatmentPlanId)
```

A mutação **não possui `patientId`** — nem nas variáveis (`{treatmentPlanId, treatmentPlanItemId}`) nem no retorno da API (o handler devolve somente `treatment_plan_item`). Resultado: o `financial-summary` **do paciente afetado fica stale** — não há invalidação nem global nem específica.

### Problema

Para invalidar corretamente é necessário:

```text
["financial-summary", patientId]
```

e a mutação hoje não tem de onde obter o `patientId`.

### Correção

Propagar `patientId` explicitamente pelo contrato da mutation (retorno da API ou variáveis).

Não reconstruir ownership a partir de dados enviados pelo cliente.

O ID deve servir exclusivamente para cache/UI quando a autorização já estiver determinada pelo servidor.

### Aceite

A mutation sabe explicitamente:

```text
sessionId
patientId
```

e invalida somente as queries necessárias — incluindo `financial-summary` do paciente.

---

# 8. SYN-CACHE-003 — Invalidação de patient appointments

**Status:** RECLASSIFICADO em 2026-09-17 — a versão original descrevia estado pré-G1
**Prioridade:** P3

**Verificação de 2026-09-17:** o `AppointmentDialog` (`src/components/calendar/AppointmentDialog.tsx:193-195`) já invalida via `clinicScope(clinicId, 'appointments')` + `invalidateCalendarDateKeys(...)`; o array literal `["patient-appointments"]` não existe mais no código (0 hits).

### Residual

Avaliar se keys por paciente (`['clinic', clinicId, 'appointments', 'by-patient', patientId]`) valem a pena onde listagens por paciente existirem. Não é bug: é refinamento de precisão de cache.

### Correção

Somente migrar para keys mais específicas se houver medição mostrando refetch desnecessário relevante; caso contrário, registrar como decisão tomada (escopo por clínica é suficiente).

---

# 9. SYN-CACHE-004 — Ausência de contrato central de invalidação

**Status:** RISCO ARQUITETURAL
**Prioridade:** P1

Os três problemas anteriores são sintomas do mesmo problema estrutural.

Mutations conhecem individualmente quais queries precisam ser invalidadas.

Conforme o sistema cresce:

```text
mutation
   ↓
appointments
   ↓
dashboard
   ↓
patient
   ↓
financial
   ↓
metrics
   ↓
reports
```

cada nova view derivada aumenta a possibilidade de esquecer uma invalidação.

### Requisito

Criar um padrão central para mutations.

Exemplo conceitual:

```text
AppointmentMutationEffects
SessionMutationEffects
PatientMutationEffects
FinancialMutationEffects
```

Cada domínio declara quais dados derivados precisam ser revalidados.

O objetivo não é criar uma abstração genérica exagerada.

É impedir que conhecimento de consistência fique espalhado em componentes React.

---

# 10. SYN-API-001 — Parâmetro legado `appointment_id`

**Status:** NÃO APLICÁVEL no baseline verificado (2026-09-17)
**Prioridade:** —

**Verificação:** o endpoint `GET /api/appointments/sessions/:sessionId` **não existe** no checkout atual. A rota de sessões real é `GET /api/treatment-plans/[id]/sessions`, que aceita apenas `treatment_plan_item_id` e resolve ownership server-side via `verifyOwnership(planId, clinicId)` — nenhum `appointment_id`.

### Ação

1. Nenhuma correção de código.
2. Manter o **princípio** como invariante: nenhum ownership pode derivar de parâmetro enviado pelo cliente.
3. Se o endpoint reaparecer em outra base/branch, aplicar o ciclo deprecated → telemetry → migration → removal (SYN-API-005).

---

# 11. SYN-API-002 — `patient_id` no PUT de appointment

**Status:** REFORMULADO em 2026-09-17 (verificação de código)
**Prioridade:** P2

**Estado verificado:**

- snake `patient_id` no body é **stripado** pelo Zod (`safeParse`) — campo morto, sem efeito;
- camel `patientId` é aceito como campo **opcional de atualização** e validado com `patientsRepo.findById(ctx.clinicId, input.patientId)` + update com `WHERE clinic_id` (`src/modules/operacional/actions/atualizar-consulta.ts:16-52`) — **ownership permanece tenant-scoped**, não há bypass cross-tenant.

### Risco residual

1. Alguém pode futuramente escrever `where(patientId === body.patient_id)` sem passar pelo repositório tenant-scoped, reintroduzindo dependência de dado controlado pelo cliente.
2. A reatribuição de paciente é uma decisão de negócio sensível (mover um appointment entre pacientes da mesma clínica) sem telemetria.

### Correção

1. adicionar teste negativo: `patientId` de outra clínica no body → 404/409, nunca reatribuição;
2. garantir que a atualização continue passando pelo action/repositório com filtro de clínica (gate de boundaries já existe — manter);
3. registrar telemetria de reatribuição de `patientId` (quem, quando, de→para);
4. remover menções a snake `patient_id` de schemas/docs se existirem.

---

# 12. SYN-DEP-001 — Dependência Neon aparentemente não utilizada

**Status:** CANDIDATO
**Prioridade:** P3

Existe:

```text
@neondatabase/serverless
```

nas dependências.

A busca no código não encontrou utilização correspondente.

A arquitetura declarada utiliza principalmente:

```text
pg
+
Cloudflare Hyperdrive
```

### Riscos

Mesmo uma dependência não utilizada aumenta:

- superfície de supply chain;
- tempo de instalação;
- lockfile;
- vulnerabilidades transitivas;
- custo de manutenção.

### Ação

Executar:

```text
depcheck / knip / análise equivalente
```

e confirmar que não existe utilização indireta.

Se confirmado:

```text
remover dependência.
```

---

# 13. SYN-DOC-001 — Contagem de testes divergente

**Status:** CONFIRMADO
**Prioridade:** P3

README e `AGENTS.md` relatam quantidades diferentes de testes.

Um documento apresenta aproximadamente:

```text
264 unit/integration
14 E2E
```

enquanto outro apresenta aproximadamente:

```text
319
46
```

### Impacto

A contagem em si não importa.

O problema é outro:

> documentação manual está tentando representar um estado automaticamente calculável.

Isso inevitavelmente gera drift.

### Correção

Não manter números manualmente quando eles podem ser derivados pela CI.

Preferencialmente utilizar:

```text
Tests: CI badge
Coverage: CI badge
E2E: CI badge
```

ou remover números absolutos.

---

# 14. SYN-DOC-002 — README referencia ADR index inexistente

**Status:** CONFIRMADO (ajustado na revisão de 2026-09-17)
**Prioridade:** P3

O README referencia:

```text
docs/adr/INDEX.md
```

mas esse caminho não existe. **Verificação de 2026-09-17:** o índice real existe como `docs/adr/ADR-INDEX.md`. A correção correta é a opção **B**:

### Correção

Escolher uma única abordagem:

```text
A. restaurar INDEX.md          (descartada — duplicaria o índice existente)
B. atualizar links para docs/adr/ADR-INDEX.md   (escolhida)
```

Adicionar verificação automatizada de links Markdown.

---

# 15. SYN-DOC-003 — Documentação não deve competir como fonte de verdade

**Status:** RISCO FUTURO
**Prioridade:** P2

Hoje existem diversas fontes:

```text
README
AGENTS
ADRs
código
testes
CI
schemas
```

Se números, endpoints ou comportamentos forem duplicados entre elas, inevitavelmente haverá divergência.

### Regra

Fonte de verdade deve seguir:

```text
contrato executável > documentação derivada
```

Exemplos:

```text
schema → API docs
tests → status
DB schema → modelo de dados
CI → quality status
```

---

# 16. SYN-CI-001 — GitHub Actions não pinadas por SHA

**Status:** CONFIRMADO
**Prioridade:** P2

Os workflows utilizam Actions por tags como:

```text
@v4
```

em vez de commit SHA imutável.

### Risco

Uma tag pode ser movida pelo mantenedor ou comprometida.

Para pipelines responsáveis por:

```text
build
secrets
deploy
release
```

o ideal é utilizar SHA.

### Correção

Exemplo:

```yaml
uses: actions/checkout@<sha>
```

Adicionar comentário:

```yaml
# v4.x.x
```

para legibilidade.

---

# 17. SYN-CI-002 — Binário Gitleaks sem verificação criptográfica

**Status:** CONFIRMADO
**Prioridade:** P2

O pipeline baixa release do Gitleaks através de:

```text
curl
→ tar
→ execução
```

sem validação de checksum ou assinatura.

Isso ocorre inclusive no workflow agendado.

### Risco

Supply-chain compromise.

### Correção

Preferência:

```text
Action oficial pinada por SHA
```

ou:

```text
download
→ SHA256 conhecido
→ sha256sum --check
→ executar
```

---

# 18. Segurança multi-tenant

## SYN-SEC-001 — Criar invariantes formais de ownership

**Status:** RISCO FUTURO CRÍTICO
**Prioridade:** P0

O Synkroo possui arquitetura multi-tenant.

Nesse tipo de sistema, uma das falhas mais perigosas é:

```text
Tenant A conhece um UUID do Tenant B
↓
API consulta somente pelo UUID
↓
dados atravessam tenants
```

Mesmo que os endpoints atuais estejam protegidos, cada endpoint novo reabre essa superfície.

### Regra obrigatória

Nenhum recurso multi-tenant pode ser buscado somente por:

```sql
WHERE id = ?
```

Quando aplicável:

```sql
WHERE id = ?
AND tenant_id = ?
```

ou ownership equivalente resolvido server-side.

### Nunca confiar em:

```text
tenant_id do body
user_id do body
patient_id como prova de ownership
organization_id do cliente
```

### Teste obrigatório

Para todo domínio sensível:

```text
Tenant A cria Resource A
Tenant B tenta:
GET
PUT
PATCH
DELETE
```

Todos devem resultar em comportamento seguro.

---

# 19. SYN-SEC-002 — Criar suíte negativa multi-tenant

**Prioridade:** P0

Testes de autorização normalmente verificam:

```text
usuário autorizado consegue acessar
```

Isso não é suficiente.

Adicionar testes sistemáticos:

```text
same tenant + owner
same tenant + wrong role
different tenant
unauthenticated
malformed identity
deleted membership
revoked membership
```

---

# 20. SYN-SEC-003 — Nunca permitir authorization by filtering client-side

**Prioridade:** P0

O frontend pode esconder elementos por role.

Isso é UX.

Não é autorização.

Todo endpoint deve repetir a autorização server-side.

---

# 21. SYN-SEC-004 — PII em logs

**Status:** VALIDAR EM RUNTIME
**Prioridade:** P1

Como o sistema trabalha com pacientes, dados pessoais podem aparecer em:

```text
logs
exceptions
telemetria
traces
AI prompts
webhook payloads
analytics
```

### Criar política de redaction

Não registrar integralmente:

```text
CPF
telefone
email
endereço
dados clínicos
tokens
cookies
Authorization
API keys
prompt com dados pessoais
```

---

# 22. Concorrência de agenda

## SYN-DATA-001 — Double booking

**Status:** RISCO FUTURO CRÍTICO (ajustado 2026-09-17: proteção DB já existe — ver §5.1)
**Prioridade:** P0

O risco aumenta conforme:

- usuários simultâneos;
- integrações;
- agentes;
- automações;
- múltiplas abas.

Cenário:

```text
Request A verifica 10:00 → livre
Request B verifica 10:00 → livre

A grava
B grava
```

**Nota de reconciliação (2026-09-17, verificada):** a constraint `appointments_no_overlap` (`0001_dapper_overlap.sql:57-66`) é um `EXCLUDE USING gist` que cobre **INSERT e UPDATE** (qualquer escrita na tabela, respeitando `status` e `deleted_at`). O teste concorrente de **criação** já existe (`src/modules/operacional/repositories/__tests__/overbooking/integration.test.ts:198-225`: N inserções paralelas → exatamente 1 sucesso + `23P01`). O gap restante é **concorrência em remarcação/edição** (o teste atual de remarcação cobre conflito sequencial, não corrida).

Validação de aplicação sozinha não garante integridade.

### Requisito

A proteção deve existir no nível transacional/DB sempre que possível — já existe; o trabalho é prová-la nos caminhos restantes.

### Teste

Enviar simultaneamente múltiplas reservas concorrentes para o mesmo recurso.

Resultado:

```text
somente uma deve ser confirmada.
```

Estender o teste para remarcação e edição (a criação já está coberta — preservar o teste existente).

---

# 23. SYN-DATA-002 — Idempotência

**Prioridade:** P0/P1

Operações sensíveis precisam considerar:

```text
retry do browser
retry de webhook
retry de Worker
timeout após commit
duplo clique
job reexecutado
```

Especialmente:

- criação de appointment;
- pagamentos;
- lançamento financeiro;
- mensagens;
- webhooks;
- ações executadas por IA.

**Nota de reconciliação (2026-09-17, verificada):** mecanismos de dedup/idempotência já existem no banco — `idempotency_keys` UNIQUE (migration 0008), `messages(external_provider,external_message_id)` UNIQUE (0019), `gateway_events(provider,external_event_id)` UNIQUE (0003/0014) — e o inbound usa `onConflictDoNothing` sem executar side-effect em duplicata. O gap restante é **idempotency key em criação de appointment/pagamento via API** (retry do browser / duplo clique).

### Regra

Requests críticas devem poder utilizar:

```text
idempotency key
```

ou possuir uma chave natural equivalente.

---

# 24. SYN-DATA-003 — Transações para operações compostas

**Prioridade:** P1

Sempre que uma ação altera vários registros relacionados:

```text
A
B
C
```

não aceitar:

```text
A sucesso
B sucesso
C falha
```

quando A/B/C fazem parte da mesma unidade de negócio.

Utilizar transação.

---

# 25. SYN-DATA-004 — Integridade deve existir no banco

**Prioridade:** P1

Regras críticas não devem existir exclusivamente no TypeScript.

Usar quando aplicável:

```text
NOT NULL
UNIQUE
FOREIGN KEY
CHECK
indexes
constraints
```

Aplicação melhora UX.

Banco preserva verdade.

---

# 26. Timezone

## SYN-TIME-001 — Padronizar semântica temporal

**Status:** RISCO FUTURO
**Prioridade:** P1

Agenda é altamente vulnerável a bugs de timezone.

Padronizar:

```text
persistência temporal → UTC
timezone do tenant → explícito
renderização → timezone do tenant/usuário
```

Nunca depender silenciosamente da timezone:

```text
do browser
do Worker
do PostgreSQL
da máquina local
```

### Testes

Incluir:

- mudança de dia;
- meia-noite;
- conversão UTC;
- horários extremos;
- timezone diferente entre usuário e clínica.

---

# 27. Financeiro

## SYN-FIN-001 — Precisão monetária

**Prioridade:** P0

Nunca representar dinheiro com lógica financeira dependente de floating point.

Preferir:

```text
integer cents
```

ou:

```text
Postgres numeric
+
biblioteca decimal
```

### Testes

```text
0.1 + 0.2
parcelamentos
descontos
somatórios
estornos
arredondamento
```

---

# 28. SYN-FIN-002 — Histórico financeiro deve ser auditável

Alterações financeiras importantes precisam permitir reconstruir:

```text
quem
quando
o quê
valor anterior
valor novo
origem
```

Evitar sobrescrever informação sem trilha quando possuir importância contábil ou operacional.

---

# 29. Webhooks e integrações

## SYN-WEBHOOK-001 — Autenticidade

Todo webhook deve, quando o fornecedor permitir:

```text
verificar assinatura
verificar timestamp
usar secret
```

---

# 30. SYN-WEBHOOK-002 — Replay

O mesmo webhook pode chegar várias vezes.

Guardar:

```text
provider_event_id
```

com constraint unique ou equivalente.

**Nota de reconciliação (2026-09-17, verificada):** JÁ ATENDIDO para messages (0019) e gateway events (0003/0014) com `onConflictDoNothing`. Ação restante: testes de replay explícitos e auditar providers/integrações restantes quanto a dedup.

---

# 31. SYN-WEBHOOK-003 — Ordem de eventos

Não assumir:

```text
event1
event2
event3
```

Eventos distribuídos podem chegar:

```text
event2
event1
event3
```

Estado deve ser calculado considerando versão/timestamp/status.

---

# 32. IA

## SYN-AI-001 — Prompt injection

**Status:** RISCO FUTURO
**Prioridade:** P1

Qualquer conteúdo vindo de:

```text
paciente
WhatsApp
documentos
integrações
internet
```

deve ser considerado não confiável.

Texto externo jamais deve ganhar autoridade sobre:

```text
system prompt
políticas
tools
authorization
```

**Nota de reconciliação (2026-09-17):** B1 já implementou prompt delimitado e Zod em outputs; manter e estender para evals.

---

# 33. SYN-AI-002 — Tool authorization

O modelo nunca deve decidir sozinho se possui permissão.

Fluxo correto:

```text
LLM sugere intenção
↓
backend valida usuário
↓
backend valida tenant
↓
backend valida role
↓
backend valida parâmetros
↓
backend executa
```

---

# 34. SYN-AI-003 — Structured output

Para ações:

```text
JSON/schema validado
```

não parsing livre de linguagem natural.

---

# 35. SYN-AI-004 — Custo

Adicionar limites por:

```text
tenant
usuário
feature
período
```

Registrar:

```text
modelo
tokens
latência
erro
feature
tenant
custo estimado
```

sem incluir conteúdo pessoal desnecessário.

**Nota de reconciliação (2026-09-17):** cap por turno/principal já implementado na B1; telemetria de custo na B2.

---

# 36. SYN-AI-005 — Falha de provider

Toda chamada externa precisa possuir:

```text
timeout
retry limitado
backoff
erro tipado
fallback quando justificável
```

Nunca retry infinito.

---

# 37. SYN-AI-006 — Evals

Criar dataset de casos reais anonimizados.

Testar pelo menos:

```text
task completion
tool selection
hallucination
security
tenant isolation
financial correctness
refusal when required
```

---

# 38. Cloudflare/OpenNext

## SYN-CF-001 — Limites de runtime

**Status:** VALIDAR EM RUNTIME
**Prioridade:** P1

Verificar:

- CPU;
- memória;
- tamanho de payload;
- subrequests;
- duração;
- streaming;
- compatibilidade Node;
- APIs Node utilizadas;
- comportamento de conexão;
- Hyperdrive.

O fato de funcionar localmente não garante equivalência completa no Worker.

---

# 39. SYN-CF-002 — Pool de banco

Sob concorrência:

```text
Workers
× requests
× connections
```

podem pressionar PostgreSQL.

Monitorar:

```text
active connections
waiting connections
query latency
timeouts
Hyperdrive pool
```

---

# 40. SYN-CF-003 — Runtime distribuído

Nunca depender de memória local do Worker para:

```text
locks
rate limit global
sessions críticas
idempotência
estado durável
```

Uma próxima request pode executar em outra instância.

---

# 41. Rate limiting

## SYN-SEC-005

Aplicar rate limiting principalmente em:

```text
login
password reset
OTP
webhooks
AI
search pesada
upload
endpoints públicos
```

Rate limit deve ser compartilhado/distribuído quando necessário.

---

# 42. Banco e performance

## SYN-DB-001 — Query growth

Endpoints rápidos com:

```text
100 pacientes
```

podem degradar em:

```text
100.000 appointments
```

Estabelecer observabilidade de queries.

### Detectar

```text
N+1
full scan
sort sem índice
COUNT caro
JOIN explosivo
```

---

# 43. SYN-DB-002 — Índices orientados por query

Não adicionar índice por intuição.

Registrar queries importantes e analisar:

```sql
EXPLAIN ANALYZE
```

**Nota de reconciliação (2026-09-17):** G4 já aplicou 2 índices com evidência e arquivou 4 avaliações negativas; continuar o método, não recomeçar.

---

# 44. SYN-DB-003 — Paginação

Listagens potencialmente grandes não devem crescer indefinidamente.

Preferir, quando aplicável:

```text
cursor pagination
```

em vez de offsets muito profundos.

---

# 45. Migrations

## SYN-MIG-001 — Deploy incompatível

**Prioridade:** P0/P1

Cenário perigoso:

```text
migration remove coluna
↓
instância anterior ainda executando
↓
crash
```

Adotar:

```text
expand
→ migrate/backfill
→ switch application
→ contract
```

---

# 46. SYN-MIG-002 — Backfills grandes

Nunca executar grandes backfills bloqueantes junto a migrations comuns sem avaliação.

Separar:

```text
schema migration
data migration
cleanup
```

---

# 47. SYN-MIG-003 — Rollback

Cada migration importante precisa responder:

```text
como recuperamos se isso falhar?
```

Rollback nem sempre significa `DOWN`.

Pode ser:

```text
forward fix
feature flag
restore
dual-read
dual-write temporário
```

---

# 48. Backup e disaster recovery

## SYN-OPS-001 — Backup não é suficiente

**Status:** VALIDAR EM RUNTIME
**Prioridade:** P0

A pergunta não é:

> temos backup?

É:

> conseguimos restaurá-lo?

Definir:

```text
RPO
RTO
frequência
retenção
restore test
```

Executar periodicamente restore em ambiente isolado.

---

# 49. Observabilidade

## SYN-OBS-001 — Logging estruturado

Usar logs estruturados com:

```text
request_id
tenant_id anonimizado
user_id anonimizado
route
status
latency
error_code
```

Sem PII desnecessária.

**Nota de reconciliação (2026-09-17, verificada):** o filtro de redaction já existe em `src/lib/logger.ts:31-44` (`SENSITIVE_LOG_KEYS` + `redactLogValue` recursivo, aplicado em `formatEntry`), porém **não é exportado** e os workers edge (`ia-agent`) não passam pelo módulo. Ação: exportar o filtro, unificar consumidores e cobrir o caminho edge.

---

# 50. SYN-OBS-002 — Correlation ID

Uma request que percorra:

```text
frontend
API
DB
AI
webhook
job
```

precisa ser rastreável.

---

# 51. SYN-OBS-003 — Métricas de produto e infraestrutura

Monitorar ao menos:

### HTTP

```text
request rate
error rate
p50
p95
p99
```

### DB

```text
latency
connections
slow queries
```

### integrações

```text
success
failure
retry
timeout
```

### AI

```text
tokens
cost
latency
errors
```

### jobs

```text
queued
completed
failed
retry
dead-letter
```

---

# 52. SYN-OBS-004 — Alertas

Logs sem alerta ainda exigem que alguém descubra o incidente por acaso.

Criar alertas para:

```text
5xx elevado
auth failures anormais
DB failures
AI cost spikes
webhook failures
queue failures
latency spike
```

---

# 53. Frontend

## SYN-FE-001 — Estados de mutation

Toda mutação deve possuir UX explícita para:

```text
idle
pending
success
error
retry
```

Evitar múltiplos submits.

---

# 54. SYN-FE-002 — Server state vs UI state

Informações vindas do servidor devem permanecer sob responsabilidade do mecanismo de server state.

Evitar duplicar dados em:

```text
React state
context
TanStack Query
URL
```

simultaneamente sem necessidade.

---

# 55. SYN-FE-003 — Query key factory

Formalizar factories por domínio:

```text
appointmentKeys
patientKeys
financialKeys
sessionKeys
dashboardKeys
```

Não espalhar arrays literais pelo projeto.

**Nota de reconciliação (2026-09-17, verificada):** G1 já criou `clinicScope` escopada por clínica (`use-queries.ts:19-228`) cobrindo ~20 domínios (appointments, patients, financial/budgets/payments, dashboard, etc.). Gaps: treatment-plans/sessions usam literais (`useTreatmentPlans.ts:72,81`) e `financial-summary` não tem factory (`useFinancialSummary.ts:47`, `usePayments.ts:89`). Este item restringe-se a completar esses gaps e eliminar arrays literais remanescentes.

---

# 56. SYN-FE-004 — Error boundaries

Falha localizada não deve necessariamente derrubar toda a aplicação.

Adicionar boundaries apropriados nas regiões principais.

---

# 57. Acessibilidade

## SYN-A11Y-001

Adicionar teste automatizado com axe ou equivalente para fluxos principais.

Cobrir:

```text
labels
keyboard navigation
focus
dialogs
contrast
ARIA
```

---

# 58. CI

## SYN-CI-003 — Quality gates obrigatórios

Antes de merge:

```text
lint
typecheck
unit
integration
security scan
build
```

Fluxos críticos também devem exigir E2E apropriado.

**Nota de reconciliação (2026-09-17):** gates principais já bloqueiam; E2E production-mode permanece com `continue-on-error` condicionado à estabilidade no CI (decisão F1 do Hardening V1).

---

# 59. SYN-CI-004 — Mutation testing

Mutation testing é valioso, mas não deve ser executado indiscriminadamente em toda alteração se o custo for excessivo.

Usar:

```text
scheduled
ou
áreas críticas
```

com baseline mínimo.

---

# 60. SYN-CI-005 — Dependency automation

Adicionar ou validar:

```text
Dependabot
ou Renovate
```

com:

- agrupamento;
- schedule;
- major versions separadas;
- CI obrigatório.

Não permitir auto-merge indiscriminado de major versions.

---

# 61. Supply chain

## SYN-SUPPLY-001

Além de Gitleaks:

```text
npm audit
OSV/Dependabot
lockfile integrity
SHA-pinned Actions
artifact checksums
```

---

# 62. Secrets

## SYN-SEC-006

Nenhum secret deve entrar em:

```text
repo
fixtures
logs
screenshots
E2E videos
CI output
error tracking
```

Documentar rotação de:

```text
DB credentials
AI keys
webhook secrets
Cloudflare tokens
auth secrets
```

---

# 63. LGPD e privacidade

## SYN-PRIV-001 — Inventário de dados

Como o Synkroo manipula dados relacionados a pacientes, criar catálogo de:

```text
dado
origem
finalidade
retenção
onde é armazenado
quem acessa
```

---

# 64. SYN-PRIV-002 — Exclusão

Excluir conta não deve necessariamente significar:

```text
DELETE everything
```

nem:

```text
guardar tudo eternamente.
```

Definir política por categoria de dado e obrigações legais aplicáveis.

---

# 65. SYN-PRIV-003 — Exportação

Preparar mecanismo de exportação de dados quando necessário.

---

# 66. SYN-PRIV-004 — IA e terceiros

Antes de enviar dados de pacientes a providers externos:

```text
minimizar
redigir
classificar
documentar
```

Não enviar automaticamente o objeto inteiro da entidade porque apenas um atributo é necessário.

---

# 67. Auditoria de eventos

## SYN-AUDIT-001

Criar audit trail para ações sensíveis:

```text
alteração financeira
exclusão
mudança de role
mudança de tenant
mudança de configuração
ação administrativa
ação executada por agente
```

Campos:

```text
actor
action
resource
timestamp
request_id
metadata segura
```

---

# 68. Background processing

## SYN-JOB-001

Não executar tarefas longas no request quando puderem exceder limites ou aumentar indisponibilidade.

Possíveis candidatos:

```text
relatórios
sincronizações
AI pesada
mensagens em lote
processamento de arquivos
importações
```

Utilizar mecanismo durável.

---

# 69. SYN-JOB-002 — Retry policy

Definir:

```text
max attempts
exponential backoff
jitter
retryable errors
non-retryable errors
```

---

# 70. SYN-JOB-003 — Dead-letter

Job que falhou repetidamente precisa ser visível.

Não desaparecer silenciosamente.

---

# 71. Contratos de API

## SYN-API-003 — Schemas compartilhados

Input deve possuir schema de runtime.

TypeScript sozinho não valida request externa.

Utilizar:

```text
Zod
ou equivalente
```

---

# 72. SYN-API-004 — Erros padronizados

Criar contrato:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "requestId": "..."
  }
}
```

Evitar frontend dependendo de comparação com strings arbitrárias.

**Nota de reconciliação (2026-09-17):** JÁ ATENDIDO — ADR-BASE-10 + migração D2/D3 concluída em 2026-09-14. Residuais em AGENTS.md §Débitos ("Residuais API menores"). Não reimplementar; apenas drenar residuais.

---

# 73. SYN-API-005 — Compatibilidade

Campos deprecated precisam possuir ciclo:

```text
deprecated
→ telemetry
→ migration
→ removal
```

e não:

```text
deprecated forever
```

---

# 74. Testes

## SYN-TEST-001 — Pirâmide funcional

### Unit

Regras puras.

### Integration

```text
API
DB
authorization
transactions
cache behavior
```

### E2E

Somente jornadas que representam valor real.

---

# 75. SYN-TEST-002 — Testes concorrentes

Adicionar testes para:

```text
double booking
idempotency
duplicate webhook
simultaneous updates
```

---

# 76. SYN-TEST-003 — Testes negativos de segurança

Exemplos:

```text
wrong tenant
wrong role
expired session
missing membership
forged patient ID
forged appointment ID
```

---

# 77. SYN-TEST-004 — Testes de migration

Em CI:

```text
DB vazia
→ todas migrations
→ schema final válido
```

Também:

```text
baseline suportado
→ migration atual
```

quando possível.

---

# 78. SYN-TEST-005 — Não perseguir coverage isoladamente

100% de cobertura não significa segurança.

Priorizar testes que provam invariantes.

Exemplo mais valioso:

```text
Tenant B jamais acessa appointment do Tenant A.
```

---

# 79. Feature flags

## SYN-ARCH-001

Funcionalidades de risco devem poder ser habilitadas gradualmente.

Especialmente:

```text
IA
novos fluxos financeiros
novas integrações
migrations comportamentais
```

Flags não devem permanecer indefinidamente.

Criar owner + data de remoção.

---

# 80. Configuração

## SYN-CONFIG-001

Validar environment variables na inicialização.

Não descobrir em produção após determinada rota ser acessada que:

```text
SOME_KEY === undefined
```

Criar schema de environment.

---

# 81. Health checks

## SYN-OPS-002

Diferenciar:

```text
liveness
readiness
```

Quando fizer sentido, readiness deve detectar dependências críticas sem criar DDoS interno ao DB.

**Nota de reconciliação (2026-09-17):** JÁ ATENDIDO pela trilha F2 (liveness puro, readiness real com ledger de migrations).

---

# 82. Resiliência de integrações

## SYN-INT-001

Toda integração precisa de:

```text
timeout
error mapping
retry policy
circuit-breaker quando justificável
observability
```

Não permitir que falha externa bloqueie indefinidamente request interna.

**Nota de reconciliação (2026-09-17):** PARCIAL — A2/A3 cobriram resiliência e idempotência outbound; auditar providers remanescentes.

---

# 83. Crescimento arquitetural

## SYN-ARCH-002 — Evitar microservices prematuros

O Synkroo ainda se beneficia de modular monolith.

Não extrair serviço somente porque um domínio cresceu.

Extrair quando existir:

```text
boundary claro
independência operacional
perfil de escala diferente
necessidade real de isolamento
```

---

# 84. SYN-ARCH-003 — Domínios explícitos

Conservar ou reforçar boundaries:

```text
Auth
Tenancy
Patients
Appointments
Sessions
Finance
Messaging
AI
Integrations
Reporting
```

Um domínio deve expor capacidades, não suas tabelas internas.

---

# 85. SYN-ARCH-004 — Evitar repository genérico universal

Evitar criar:

```text
GenericRepository<T>
```

que apaga a semântica dos domínios.

Queries críticas merecem nomes de negócio explícitos.

---

# 86. Performance

## SYN-PERF-001 — Budget

Definir orçamento para páginas principais:

```text
API p95
LCP
JS inicial
queries por request
```

Sem budget, degradação ocorre gradualmente.

**Nota de reconciliação (2026-09-17):** baseline existe em `docs/goals/performance-baseline.md` (G5); este item é transformá-lo em budget com gate.

---

# 87. SYN-PERF-002 — Dashboards

Dashboards agregados podem virar uma das maiores fontes de carga.

Evitar recalcular tudo a cada request conforme volume cresce.

Evolução possível:

```text
queries diretas
→ indexes
→ materialização seletiva
→ agregações incrementais
```

somente quando métricas mostrarem necessidade.

---

# 88. Plano de implementação

## Fase 0 — Baseline confiável

Executar primeiro:

```text
SYN-DOC-001
SYN-DOC-002
SYN-DEP-001
environment validation
baseline de testes
baseline de performance
baseline de security scans
```

Objetivo:

> garantir que todos trabalham sobre a mesma realidade.

---

# 89. Fase 1 — Consistência funcional

Implementar:

```text
SYN-CACHE-001
SYN-CACHE-002
SYN-CACHE-003
SYN-CACHE-004
SYN-FE-003
SYN-API-001
SYN-API-002
SYN-API-005
```

Objetivo:

> eliminar estados stale e contratos ambíguos.

---

# 90. Fase 2 — Invariantes críticas

Prioridade máxima:

```text
tenant isolation
negative authorization tests
double-booking
transactions
financial precision
idempotency
webhook replay
DB constraints
```

Nenhuma nova feature estrutural deve enfraquecer essas garantias.

---

# 91. Fase 3 — Supply chain e CI

Implementar:

```text
SHA pinning
Gitleaks verification
dependency automation
security scans
migration tests
link validation
```

---

# 92. Fase 4 — Runtime reliability

Validar:

```text
Cloudflare limits
Hyperdrive
connection pool
timeouts
rate limiting
background jobs
retries
```

---

# 93. Fase 5 — Observabilidade

Introduzir:

```text
request IDs
structured logs
metrics
tracing
alerts
slow-query monitoring
AI cost telemetry
integration health
```

---

# 94. Fase 6 — Disaster recovery

Implementar e testar:

```text
backup
restore
RPO
RTO
migration recovery
incident procedure
```

---

# 95. Fase 7 — IA

Antes de ampliar automações autônomas:

```text
tool authorization
structured output
quotas
prompt-injection defenses
evals
audit log
idempotency
human confirmation para ações críticas
```

---

# 96. Definition of Done global

Uma alteração no Synkroo só deve ser considerada concluída quando:

### Código

- TypeScript passa;
- lint passa;
- não existem suppressions novas injustificadas;
- boundaries arquiteturais são respeitados.

### Banco

- migration é segura;
- constraints necessárias existem;
- indexes foram avaliados;
- rollback/forward recovery foi considerado.

### Segurança

- tenant ownership permanece garantido;
- autorização é server-side;
- nenhuma credencial é exposta;
- input externo é validado.

### Testes

- unit tests relevantes;
- integration tests relevantes;
- negative authorization test quando aplicável;
- E2E quando fluxo de negócio principal é alterado.

### Operação

- erros são observáveis;
- timeout existe em integração externa;
- retry é limitado;
- ação pode ser diagnosticada por request ID.

### Documentação

- documentação afetada atualizada;
- nenhum número manual desnecessário criado;
- ADR criado para decisão arquitetural relevante.

---

# 97. Release gates

Uma release deve ser bloqueada se houver:

```text
typecheck failure
lint failure
unit failure
integration failure
critical E2E failure
migration failure
secret detection
critical dependency vulnerability sem avaliação
build failure
tenant-isolation regression
```

---

# 98. Runtime Validation Checklist

A auditoria estática não consegue comprovar integralmente os itens abaixo.

Eles devem ser verificados em ambiente controlado.

## Infra

- [ ] Cloudflare bindings corretos
- [ ] secrets separados por ambiente
- [ ] Hyperdrive configurado corretamente
- [ ] conexão máxima do PostgreSQL conhecida
- [ ] timeout de DB
- [ ] timeout de providers externos

## Security

- [ ] branch protection
- [ ] required status checks
- [ ] least-privilege Cloudflare token
- [ ] secret rotation
- [ ] rate limiting real
- [ ] cookies em produção
- [ ] CSP
- [ ] HSTS
- [ ] CORS
- [ ] CSRF strategy

## Database

- [ ] backups funcionando
- [ ] restore testado
- [ ] slow query monitoring
- [ ] pool observado sob carga
- [ ] migrations executáveis do zero

## Observability

- [ ] production error tracking
- [ ] alerts
- [ ] structured logs
- [ ] request IDs
- [ ] AI cost monitoring

## Load

- [ ] login
- [ ] appointments
- [ ] dashboard
- [ ] reports
- [ ] concurrent scheduling
- [ ] AI endpoints

---

# 99. Cenários obrigatórios de caos/falha

Simular:

### DB fica indisponível

Sistema deve:

```text
falhar rapidamente
não corromper estado
produzir erro observável
recuperar posteriormente
```

### Provider de IA timeout

Sistema não deve:

```text
ficar preso
executar duas vezes
cobrar indefinidamente
```

### Webhook duplicado

Resultado final deve permanecer único.

### Usuário dá duplo clique

Mutação crítica não deve duplicar.

### Dois usuários agendam simultaneamente

Somente uma operação conflitante deve sobreviver.

### Deploy durante migration

Versões adjacentes devem permanecer compatíveis durante a janela de rollout.

---

# 100. Matriz de risco principal

| Área | Probabilidade futura | Impacto | Prioridade |
|---|---:|---:|---:|
| Cross-tenant access | média | crítico | P0 |
| Double booking | alta | alto | P0 |
| Duplicação financeira | média | crítico | P0 |
| Migration incompatível | média | alto/crítico | P0 |
| Cache stale | alta | médio/alto | P1 |
| Webhook duplicate | alta | alto | P1 |
| AI executing unsafe action | média | alto/crítico | P1 |
| DB saturation | média | alto | P1 |
| Cloudflare runtime incompatibility | média | alto | P1 |
| PII em logs | média | alto | P1 |
| Docs drift | alta | médio | P2 |
| Supply-chain CI | baixa | crítico | P2 |
| Dependency accumulation | alta | baixo/médio | P3 |

---

# 101. Arquitetura-alvo

A arquitetura recomendada permanece próxima do projeto atual:

```text
                    ┌──────────────────┐
                    │    Web / PWA     │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ Next.js / API    │
                    │ authoritative    │
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │             │             │
        ┌──────▼──────┐ ┌────▼─────┐ ┌────▼────────┐
        │   Domains   │ │    AI    │ │ Integrations│
        └──────┬──────┘ └────┬─────┘ └────┬────────┘
               │             │             │
               └─────────────┼─────────────┘
                             │
                      authorization
                      validation
                      idempotency
                      auditing
                             │
                    ┌────────▼────────┐
                    │ PostgreSQL     │
                    │ authoritative  │
                    └────────────────┘
```

Frontend e IA não devem acessar dados ignorando regras de negócio do backend.

---

# 102. Princípios que devem virar invariantes do Synkroo

## 1.

```text
O banco é a fonte de verdade para dados persistentes.
```

## 2.

```text
O backend é a fonte de verdade para regras de negócio.
```

## 3.

```text
O cliente nunca prova ownership.
```

## 4.

```text
Todo recurso multi-tenant possui ownership verificável.
```

## 5.

```text
Dinheiro nunca depende de floating point impreciso.
```

## 6.

```text
Operações críticas devem ser idempotentes.
```

## 7.

```text
Consistência não pode depender de cache do frontend.
```

## 8.

```text
IA pode propor ações, mas autorização pertence ao sistema.
```

## 9.

```text
Falhas externas devem ser esperadas.
```

## 10.

```text
Observabilidade faz parte da feature.
```

---

# 103. O que NÃO fazer nesta SPEC

Não utilizar esta revisão como justificativa para:

```text
reescrever o Synkroo
migrar para microservices
introduzir Kafka
introduzir Redis sem necessidade
introduzir event sourcing integral
criar abstrações genéricas excessivas
trocar de framework
trocar banco
refatorar código saudável por estética
```

O Synkroo já possui uma base tecnicamente adequada.

A prioridade deve ser fortalecer suas invariantes, não substituir sua arquitetura.

---

# 104. Critério final de conclusão

Esta SPEC estará concluída quando o projeto puder demonstrar, através de código, testes e operação, que:

```text
1. cache não produz estado funcional incorreto;

2. contratos deprecated foram removidos ou possuem plano explícito de remoção;

3. tenant A não consegue acessar recursos do tenant B;

4. operações concorrentes não violam invariantes;

5. ações críticas são idempotentes;

6. regras financeiras preservam precisão e auditabilidade;

7. webhooks são autenticados e deduplicados;

8. migrations são compatíveis com rollout;

9. CI possui cadeia de supply chain endurecida;

10. backups podem ser restaurados;

11. incidentes podem ser diagnosticados;

12. integrações possuem timeout e retry controlados;

13. IA não consegue ultrapassar autorização do backend;

14. dados pessoais não vazam por logs ou prompts desnecessários;

15. Cloudflare/Hyperdrive permanecem estáveis sob carga;

16. documentação não diverge silenciosamente do produto;

17. cada nova feature preserva automaticamente os principais invariantes de segurança.
```

---

# 105. Ordem recomendada de execução

A sequência recomendada é:

```text
1. Baseline + documentação
        ↓
2. Cache + contratos legados
        ↓
3. Multi-tenancy + authorization tests
        ↓
4. Concorrência + idempotência
        ↓
5. Financeiro + integridade
        ↓
6. Webhooks + integrações
        ↓
7. CI + supply chain
        ↓
8. Migrations + recovery
        ↓
9. Cloudflare + load testing
        ↓
10. Observabilidade
        ↓
11. IA hardening
        ↓
12. LGPD + governança operacional
```

Não realizar tudo como uma única alteração.

Cada etapa deve manter `main` operacional, testável e implantável.

---

# 106. Resultado esperado

Após esta SPEC, o Synkroo deve evoluir de:

```text
SaaS tecnicamente bem estruturado
```

para:

```text
SaaS com invariantes explícitas,
defesas contra regressão,
maior segurança multi-tenant,
consistência operacional,
observabilidade,
recuperação
e preparação real para escala.
```

---

# 107. Alterações da revisão do Planner (2026-09-17)

Ajustes aplicados durante a documentação/revisão, sem alterar o mérito técnico:

## Rodada 1 (pré-wave)

1. **Baseline verificado:** HEAD local confirma `73754a9160eda732fc400a4f49c2f8870aa72ded` (commit de 2026-09-14, `main` limpo).
2. **Nova §5.1:** mapa de reconciliação com o Hardening V1 (2026-09-13) — evita reimplementar itens ALREADY_COMPLIANT.
3. **SYN-DOC-002 corrigido:** `docs/adr/ADR-INDEX.md` existe; a correção é atualizar o link do README (opção B).
4. **SYN-DATA-001 ajustado:** constraint `appointments_no_overlap` já existe; escopo reduzido a prova por teste.
5. **Notas de reconciliação** inline nos itens afetados.

## Rodada 2 (pós-wave explorer + reviewer — fatos verificados em código)

6. **SYN-CACHE-001 reescrito:** o RescheduleDialog invalida **apenas faixas de calendário** (`invalidateCalendarDateKeys`), não `["appointments"]` — a descrição original estava invertida; o gap real (collection/detail/dashboard) foi mantido.
7. **SYN-CACHE-002 reescrito:** hoje **não há invalidação nenhuma** de `financial-summary` no fluxo de sessão (nem global nem específica); a mutação não possui `patientId` em variáveis nem no retorno.
8. **SYN-CACHE-003 reclassificado (P3):** `["patient-appointments"]` não existe mais — o código já usa `clinicScope(clinicId,'appointments')` + faixas de calendário (pós-G1). Vira decisão de refinamento, não correção.
9. **SYN-API-001 reclassificado NÃO APLICÁVEL:** o endpoint `GET /api/appointments/sessions/:sessionId` não existe; a rota real de sessões é `treatment-plans/[id]/sessions` com ownership server-side. Princípio mantido como invariante.
10. **SYN-API-002 reformulado:** snake `patient_id` é stripado pelo Zod (morto); camel `patientId` é reatribuição legítima **validada com tenant-scope** (`findById(clinicId, ...)` + `WHERE clinic_id`). Ação virou teste negativo + telemetria, não remoção.
11. **SYN-WEBHOOK-002 e parte de SYN-DATA-002 marcados JÁ ATENDIDOS:** uniques de dedup já existem (`idempotency_keys` 0008, `messages` 0019, `gateway_events` 0003/0014) com `onConflictDoNothing` no inbound. Escopo reduzido a testes de replay + idempotency key para appointment/pagamento.
12. **SYN-DATA-001 refinado:** a constraint cobre INSERT e UPDATE, e o teste concorrente de criação já existe (asserta `23P01`). Gap real: concorrência em remarcação/edição.
13. **SYN-OBS-001/SYN-SEC-004 refinados:** o filtro de redaction existe em `logger.ts` mas não é exportado e não cobre o caminho edge (`ia-agent`).
14. **queryKeys (SYN-CACHE-004/SYN-FE-003) refinados:** factory `clinicScope` cobre ~20 domínios; gaps pontuais (treatment-plans/sessions, `financial-summary`).
15. **Contagens medidas nesta sessão:** 46 specs E2E (`e2e/**/*.spec.ts`) e **354 suites Jest** (`npx jest --listTests`) — nem o README (264/14) nem o AGENTS.md (319/46) refletem o estado atual. Revalidar na Etapa 0 e remover números manuais (SYN-DOC-001).
