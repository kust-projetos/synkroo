# Rubrica Final — Provisionamento Demo Admin e Smoke E2E — 2026-09-06

**Papel:** Reviewer independente (pi dev)

**Autorização operacional:** Owner — seed sintético isolado em `synkroo_staging`

**Candidato staging auditado:** `08d7a1b0-f43d-4543-9809-8235dbbaecba`

## 1. Veredito executivo

> ## **GO TÉCNICO — CONTA DEMO ADMINISTRADOR VALIDADA**
>
> O provisionamento definitivo da conta `admin@clinicademo.com` foi auditado como Administrador com privilégios plenos: roles de sistema `Owner` e `Administrador`, vínculo efetivo `Owner` em `user_clinic_access`, módulos contratáveis habilitados e autorização financeira case-insensitive para `Owner`, `admin` e `administrador`.
>
> O candidato OpenNext `08d7a1b0-f43d-4543-9809-8235dbbaecba` completou o smoke canônico com **10/10 PASS, 0 BLOCKED e 0 FAIL** usando a credencial sintética autorizada. O resultado valida end-to-end o edge worker/NextAuth, Hyperdrive, PostgreSQL 17, RBAC financeiro e isolamento multi-tenant no staging.

Nenhuma promoção a produção está implícita. A credencial e os dados são exclusivamente sintéticos e devem ser limpos/rotacionados conforme a decisão do Owner antes de qualquer uso fora da janela de teste.

## 2. Auditoria do seed definitivo

### 2.1 RBAC e vínculo da conta

` scripts/seed-test-clinic.mjs` foi auditado nos seguintes pontos:

- Cria ou reconcilia os roles de sistema `Owner` e `Administrador`.
- Persiste o usuário demo com papel base `owner` e credencial sintética com hash `scrypt` salteado.
- Cria/atualiza `user_clinic_access` para a clínica demo apontando para o role `Owner`, sem revogação nem expiração.
- Mantém o role `Administrador` disponível no catálogo da clínica para compatibilidade do perfil administrativo.
- Todos os writes relevantes ocorrem dentro de uma transação; falha executa `ROLLBACK`.

### 2.2 Módulos da instância

O seed habilita os sete módulos contratáveis — `operacional`, `comercial`, `atendimento`, `crm`, `financeiro`, `followup` e `ia` — além de `core`, que é sempre-on no catálogo de módulos. O `ON CONFLICT (module_id) DO UPDATE SET enabled = true` torna o provisionamento idempotente e evita que uma execução posterior desabilite o contrato.

**Resultado:** **SANADO / GO TÉCNICO**.

### 2.3 Evidência local do seed

| Verificação | Resultado |
|---|---:|
| `node --test scripts/__tests__/seed-test-clinic.test.mjs` | **1/1 PASS** |
| Presença de clínica, usuário, credenciais, dentists e procedures | **PASS** |
| Presença de `INSERT INTO roles` | **PASS** |
| Presença de `INSERT INTO user_clinic_access` | **PASS** |
| Presença de `INSERT INTO instance_modules` | **PASS** |

## 3. Auditoria do acesso financeiro

Em `src/app/dashboard/financeiro/financeiro-client.tsx`, o papel é normalizado antes da autorização:

```ts
const role = (profile?.role ?? '').toLowerCase();
const canManageBudget = role === 'owner' || role === 'admin' || role === 'administrador';
```

Isso cobre `Owner`, `OWNER`, `admin`, `ADMIN`, `Administrador` e demais variações de caixa, mantendo perfis como `receptionist` sem permissão de gerenciamento de orçamento.

| Verificação | Resultado |
|---|---:|
| `npx jest src/app/dashboard/financeiro/__tests__/financeiro-client.t7.test.tsx --runInBand --no-coverage` | **3/3 PASS** |
| Owner pode gerenciar orçamento | **PASS** |
| Perfil sem privilégio não gerencia orçamento | **PASS** |
| CTA sem permissão não fica inerte | **PASS** |

**Resultado:** **SANADO / GO TÉCNICO**.

## 4. Deploy e smoke canônico

| Evidência | Resultado auditado | Status |
|---|---|---|
| Build | `npm run build:cf` concluído | **PASS** |
| Deploy | OpenNext Cloudflare staging, Version ID `08d7a1b0-f43d-4543-9809-8235dbbaecba` | **PASS** |
| URL | `https://synkroo-staging.walissonead.workers.dev` | **PASS** |
| Banco | `synkroo_staging` no PostgreSQL 17 via Hyperdrive staging | **PASS** |
| Clínica demo | `00000000-0000-0000-0000-000000000001` | **PASS** |
| Usuário demo | `admin@clinicademo.com` com credencial sintética autorizada | **PASS** |
| Smoke canônico | **10/10 PASS, 0 BLOCKED, 0 FAIL** | **GO TÉCNICO** |

### 4.1 Matriz do smoke — todos os checks PASS

| Check | HTTP | Resultado | Validação |
|---|---:|---|---|
| `liveness` | 200 | **PASS** | `/api/health` saudável com banco acessível |
| `invalid-auth` | 307 | **PASS** | Rota protegida sem autenticação redireciona |
| `valid-auth` | 200 | **PASS** | NextAuth aceita a conta demo no edge worker |
| `session` | 200 | **PASS** | Sessão autenticada é retornada corretamente |
| `switch-clinic` | 200 | **PASS** | Troca de clínica autorizada funciona |
| `route-protection` | 307 | **PASS** | Dashboard sem autenticação permanece protegido |
| `agenda-tenant-scope` | 200 | **PASS** | Agenda fica confinada à clínica demo |
| `invalid-webhook` | 403 | **PASS** | Webhook sem credencial válida é rejeitado |
| `protected-readiness` | 401 | **PASS** | Readiness permanece protegido sem credencial |
| `assets` | 200 | **PASS** | `/widget.js` é servido pelo worker publicado |

### 4.2 Interpretação E2E

- **NextAuth edge:** `valid-auth`, `session` e `switch-clinic` passaram contra o worker Cloudflare publicado.
- **RBAC financeiro:** o usuário provisionado como Owner/Admin pleno recebe `canManageBudget=true` sem depender de casing.
- **Hyperdrive/PostgreSQL:** liveness, sessão e agenda autenticada completaram o fluxo contra o banco de staging.
- **Multi-tenant:** `agenda-tenant-scope` retornou apenas dados da clínica sintética `00000000-0000-0000-0000-000000000001`.
- **Fail-closed:** autenticação inválida, rota protegida, webhook inválido e readiness protegido mantiveram os códigos esperados.
- **Contrato completo:** a autorização do seed eliminou os bloqueios de credencial sintética; nenhum check ficou `blocked`.

## 5. Rubrica técnica consolidada

| Área | Evidência | Veredito |
|---|---|---|
| Importador LGPD, CSV RFC 4180 e quoting | `scripts/import-client-data.mjs`; testes 24/24 | **SANADO / GO TÉCNICO** |
| `patients`, `consents`, `legal_hold` e `opt_out_at` | Testes transacionais e contrato de importação | **SANADO / GO TÉCNICO** |
| Auditoria em `audit_logs` sem PII | Query e schema `src/core/schema/infra.ts` | **SANADO / GO TÉCNICO** |
| CRM, filtros e abas | Rota, actions e testes CRM/UI | **SANADO / GO TÉCNICO** |
| Webhooks, HMAC timing-safe e quota pre-auth | WhatsApp, Instagram, inbound e testes | **SANADO / GO TÉCNICO** |
| Logs e redaction | Resolver e testes de segurança | **SANADO / GO TÉCNICO** |
| `migrate-vps.ts` | Credencial staging separada e target estrito | **SANADO / GO TÉCNICO** |
| `update-hyperdrive.ts` | `stdio: 'pipe'` e redaction stdout/stderr/erros | **SANADO / GO TÉCNICO** |
| Seed RBAC demo | Owner + Administrador, vínculo Owner e módulos | **SANADO / GO TÉCNICO** |
| Financeiro | Casing-insensitive Owner/admin/administrador | **SANADO / GO TÉCNICO** |
| Gates locais | Typecheck, lint, `test:release` 38/38 e roadmap 143/143 | **SANADO / GO TÉCNICO** |
| PostgreSQL 17 / Hyperdrive | Banco staging, binding correto e TLS | **SANADO / GO TÉCNICO** |
| OpenNext / edge worker | Deploy `08d7a1b0-f43d-4543-9809-8235dbbaecba` | **SANADO / GO TÉCNICO** |
| Smoke canônico | **10/10 PASS, 0 BLOCKED, 0 FAIL** | **SANADO / GO TÉCNICO** |

## 6. Integridade e limites

- O deploy auditado é explicitamente de `staging`; não há promoção automática a produção.
- O seed usa apenas a clínica e o usuário sintéticos autorizados pelo Owner.
- O valor literal da senha `demo123` não é reproduzido neste relatório; a credencial deve ser tratada como temporária e descartável.
- A versão anterior `45495402-04d2-4bf2-afd4-e13f62cfb5c5` fica preservada como baseline; o candidato atual é `08d7a1b0-f43d-4543-9809-8235dbbaecba`.
- Nenhum dado real de paciente, segredo produtivo ou alteração de produção faz parte desta validação.

## 7. Checklist final para deliberação do Owner

### Evidências concluídas

- [x] Owner autorizou o seed sintético isolado.
- [x] Roles `Owner` e `Administrador` provisionados.
- [x] `user_clinic_access` vinculado ao Owner com acesso pleno.
- [x] Sete módulos contratáveis habilitados, mais `core` always-on.
- [x] Conta `admin@clinicademo.com` provisionada com hash sintético.
- [x] `canManageBudget` compatível com Owner/admin/administrador sem sensibilidade a caixa.
- [x] Deploy OpenNext confirmado na versão `08d7a1b0-f43d-4543-9809-8235dbbaecba`.
- [x] Smoke canônico confirmado: **10/10 PASS, 0 BLOCKED, 0 FAIL**.
- [x] NextAuth edge, Hyperdrive e isolamento multi-tenant validados end-to-end.

### Decisões ainda exclusivas do Owner

- [ ] Confirmar formalmente a versão `08d7a1b0-f43d-4543-9809-8235dbbaecba` como candidato de homologação.
- [ ] Definir retenção e limpeza do usuário, credencial e fixtures sintéticos.
- [ ] Confirmar janela, monitoramento, backup e rollback do piloto.
- [ ] Confirmar que qualquer uso de dados reais exige autorização separada e checklist LGPD.
- [ ] Registrar decisão formal: **GO para piloto staging** / **NO-GO**.
- [ ] Para produção, abrir autorização independente com candidato, janela e rollback próprios.

**Owner:** ____________________  
**Data/hora UTC:** ____________________  
**Decisão:** ____________________  
**Assinatura/registro:** ____________________

## 8. Conclusão

**GO TÉCNICO.** O provisionamento definitivo da conta demo como Administrador/Owner pleno, a autorização case-insensitive do financeiro e o smoke canônico no deploy `08d7a1b0-f43d-4543-9809-8235dbbaecba` estão **SANADOS**, com **10/10 PASS**. A única decisão restante é a formalização do Owner sobre retenção do seed e promoção além do staging.
