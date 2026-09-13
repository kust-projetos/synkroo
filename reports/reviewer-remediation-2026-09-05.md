# Revisão independente das remediações P1 — 2026-09-05

**Papel:** Reviewer independente  
**Escopo:** F1 RBAC, F2 Contatos, F3 LGPD/importação, F5 inbound webhook, Hyperdrive/staging e gates de pipeline.  
**Veredicto:** **NO-GO para piloto/produção nesta revisão.**

Há correções locais reais em F1, F2, F3 e F5, e os gates estáticos/release estão verdes. Isso não supera o bloqueador reproduzido de Hyperdrive/staging nem as lacunas de conformidade e integração do importador. A evidência local continua sendo de mocks/fakes ou de código não publicado; não foi tratada como evidência de produção.

## Método, evidência e limites

- Revisão direta do worktree atual, com leitura independente do código, testes e configuração; nenhum deploy, migration, restart, mudança operacional ou alteração de segredo foi feito pelo Reviewer.
- Evidência focada atual: F1 passou 66 testes dirigidos; F2 passou `routes.test.ts` 28/28 e testes de CRM/UI; F3 passou `node --test scripts/__tests__/import-client-data.test.mjs` 10/10; F5 passou seis suítes dirigidas, 51/51. Esses testes são locais e usam mocks/fakes onde indicado.
- `npm run test:release` atual passou 24/24; ele inclui os testes de release, smoke contract, verificador de schema e importador. O teste do importador permanece não rastreado no estado do worktree.
- Hyperdrive foi consultado com Wrangler; a VPS foi inspecionada somente por SSH read-only; staging foi sondado pelo smoke runner privacy-safe e por probes HTTP sem corpos de resposta.
- Nenhum segredo, cookie, senha, token ou valor de conexão foi registrado neste relatório. IDs de recurso, hostname/IP e portas abaixo são configuração operacional, não credenciais.

## Sumário de aceite

| Área | Veredicto | Motivo |
|---|---|---|
| F1 RBAC | **PASS local / limitado** | Reconciliação do Agente e proteção contra catálogo vazio estão implementadas; faltam transação/corrida em banco real. |
| F2 Contatos | **PASS local / limitado** | A API atual propaga `type` e o read-model seleciona a fonte correta; falta assert direto da rota raiz e validação live. |
| F3 LGPD/importação | **FAIL/PARTIAL** | `--apply` agora é transacional e idempotente nos fakes, mas aceita data calendário impossível e não grava consentimento/auditoria como entidades integradas. |
| F5 inbound | **PASS local / staging não comprovado** | Resolução fail-closed e isolamento por `clinicId` estão cobertos localmente; runtime saudável e matriz negativa completa não foram provados. |
| Hyperdrive/staging | **FAIL** | Origin configurado em `187.77.249.47:15432` continua inalcançável e o smoke real falha em liveness/webhook. |
| Pipeline | **PASS local** | Typecheck, lint, release e ledger passaram no worktree atual; isso não converte evidência local em evidência live. |

## Achados detalhados

### F1 — RBAC

**Evidência:** `src/core/rbac/seed.ts:24-159`; `src/core/rbac/agent-access.ts`; `src/core/rbac/presets.ts`; `src/core/rbac/__tests__/seed.test.ts`; `src/core/rbac/__tests__/sync-role-permissions.test.ts`.

- `syncRolePermissions` filtra `master:*`, usa `onConflictDoNothing()` e aceita lista vazia.
- `seedRbacForClinic` lança por padrão com catálogo vazio, insere o catálogo e permissões faltantes antes dos vínculos e reconcilia o role `Agente` em reruns.
- Os testes cobrem presets derivados do catálogo, permissões conservadoras, catálogo vazio, rerun e idempotência simulada.

Risco residual **P2**: os testes usam fakes em memória e não demonstram a transação Drizzle, a inserção real na tabela `permissions` nem dois seeds concorrentes tentando criar o mesmo role. O veredicto é somente local/limitado.

### F2 — Contatos read-only e filtro por tipo

**Evidência:** `src/app/api/contacts/route.ts:13-23`; `src/modules/crm/actions/listar-contatos.ts:6-18`; `src/modules/crm/repositories/contact-read-repository.ts:73-186`; `src/modules/crm/__tests__/routes.test.ts:161-184`.

- A rota raiz agora aceita `type=patient|lead` e passa o valor para `listarContatos`; valores desconhecidos viram `undefined`.
- O read-model usa `patientQuery` somente para `patient`, `leadQuery` somente para `lead` e `UNION ALL` sem tipo para a lista combinada, incluindo contagem correspondente.
- O componente segue read-only e os testes confirmam a rota CRM, a lista e a ausência de criação.

A antiga acusação de que a rota raiz sempre descartava o filtro está **superada pelo código atual**. Permanece uma lacuna **P2/F2-INT-01**: `routes.test.ts` testa `search/limit/offset`, mas não faz assert direto de `type` no `GET /api/contacts`; os testes de UI não clicam nas duas abas e não há prova live de que o envelope/resultado filtrado chega ao navegador. O aceite, portanto, é limitado.

### F3 — LGPD e importador

**Evidência:** `docs/pilot/approved-import.csv:1-11`; `scripts/import-client-data.mjs:37-90,93-239`; `src/modules/crm/schema/contacts.ts:14-31`; `src/modules/operacional/schema/patients.ts:22-29`; `scripts/__tests__/import-client-data.test.mjs`.

Progressos confirmados:

- O CSV atual contém dez registros determinísticos de piloto e uma linha explícita com `optOutMarketing=true`; não há nomes reais aparentes no arquivo aprovado.
- `--apply` valida todas as linhas antes de iniciar, abre `BEGIN`, resolve a clínica por slug, faz insert/update por `clinic_id + phone`, persiste `opt_out_marketing`, `legal_hold` e `legal_hold_reason`, faz `COMMIT` e executa `ROLLBACK` em falha.
- Os 10 testes dedicados passaram, incluindo insert com fake client, replay idempotente, rollback, rejeição sem `DATABASE_URL` e abort em linha inválida. Isso supersede a evidência anterior de que o código atual não persistia nada, mas continua sem provar PostgreSQL real.

Bloqueios e lacunas:

- A validação `DATE_REGEX + Date.parse` aceita `2024-02-31`. Probe read-only: `validateRow(...)` retornou `valid=true` para essa data impossível. A validação precisa conferir calendário, não apenas forma/parser permissivo.
- O parser usa `split(',')`; uma vírgula dentro de campo quoted não é tratada como CSV. A amostra aprovada não exercita essa borda.
- O apply grava `consentVersion` somente dentro de `patients.notes`; não há insert/update em `consents`, nem registro em `audit_logs`, nem preenchimento de `opt_out_at`. O `legal_hold` do paciente é persistido, mas a integração de consentimento/auditoria exigida pelo fluxo LGPD não está demonstrada.
- Não foi executado `--apply` contra banco remoto real por restrição de segurança; não há receipt live de contagem, idempotência ou rollback em PostgreSQL/Hyperdrive.

Veredicto **FAIL/PARTIAL**: a persistência transacional fake é uma melhoria substantiva, mas não autoriza piloto enquanto a borda de data e o contrato de consentimento/auditoria permanecerem sem implementação/evidência.

### F5 — Inbound Webhook

**Evidência:** `src/modules/atendimento/integrations/resolve-channel-installation.ts:21-155`; `src/app/api/messages/inbound/route.ts:9-38`; `src/app/api/whatsapp/webhook/route.ts:22-83,104-112`; `src/app/api/whatsapp/evolution/route.ts`; `src/app/api/widget/messages/route.ts`; seis suítes F5, 51/51.

- Entradas ausentes, instalação desabilitada, hash ausente/malformado, segredo divergente e falha de DB resultam em `null` no resolver.
- O segredo é SHA-256 e `timingSafeEqual` só é chamado depois de conferir o tamanho dos buffers; Evolution também restringe `provider='evolution'`; widget restringe provider, enabled e origin.
- Inbound genérico, Evolution, Meta e widget usam o `clinicId` retornado pela instalação resolvida, sem aceitar `clinicId` forjado do corpo. Meta valida a assinatura antes de resolver a instalação.

O veredicto local é **PASS limitado**, não aceite live. Resíduos **P2**: inbound genérico consome rate limit antes da autenticação; a verificação HMAC Meta usa `signature === expected` em vez de comparação constante; os `catch` do resolver ainda imprimem a mensagem bruta do erro no `console.error`; e as suítes não substituem execução contra instalação/DB reais. O smoke de staging abaixo demonstra que a rota publicada não está produzindo a resposta 4xx esperada para webhook inválido.

## Diagnóstico Hyperdrive / VPS / staging

### Configuração efetiva

`npx --no-install wrangler hyperdrive get e0033a75f4e2449084b00b41e22e49a6` retornou exit 0 e confirmou:

- nome `synkroo-staging-db`;
- origin PostgreSQL `187.77.249.47:15432`;
- database `synkroo_staging`, user `synkroo_staging`;
- `sslmode=require`, caching desabilitado.

O ID também está em `wrangler.toml:77-79`.

### Estado observado na VPS

SSH read-only para `srv1773156` mostrou:

- `synkroo-prod-postgres` saudável, mas sem publicação de porta no host (`5432/tcp` sem mapping);
- `synkroo-prod-db-tunnel` `cloudflared` em execução;
- o compose contém `postgres` e `cloudflared`;
- `ss -ltnH` mostra `127.0.0.1:5432`, sem listener em `15432`.

Probe TCP read-only deste ambiente para `187.77.249.47:15432` expirou em 5s (também expirou para `:5432`). Nenhuma exposição de banco, firewall ou túnel foi alterada. O tunnel outbound running não demonstra que exista um endpoint TCP público compatível com o origin do Hyperdrive.

### Staging real, sem credenciais

`STAGING_BASE_URL=https://synkroo-staging.walissonead.workers.dev node scripts/smoke-staging.mjs` produziu:

| Check | Resultado |
|---|---|
| `liveness` | **fail**, `TimeoutError` |
| `invalid-auth` | pass, HTTP 307 |
| `valid-auth`, `session`, `switch-clinic`, `agenda-tenant-scope` | **blocked**, auth sintética ausente |
| `route-protection` | pass, HTTP 307 |
| `invalid-webhook` | **fail**, HTTP 500 (contrato esperava 400/403) |
| `protected-readiness` | pass, HTTP 401 |
| `assets` | pass, HTTP 200 |

Probes adicionais sem corpo de resposta deram timeout de aproximadamente 8s em `/api/health`, `/api/health/db` e no POST com instalação/segredo sintéticos inválidos. O asset 200 e os redirects de proteção não demonstram conectividade do Worker com o banco nem a versão local remediada.

**Conclusão de infraestrutura:** o origin configurado não é alcançável na topologia observada e o staging não satisfaz o smoke de liveness/webhook. Hyperdrive/staging permanece bloqueador P1 para piloto/produção.

## Gates de pipeline atuais

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **PASS**, exit 0, `tsc --noEmit` sem saída |
| `npm run lint` | **PASS**, exit 0, ESLint sem diagnósticos |
| `npm run test:release` | **PASS**, 24/24, 0 falhas, 0 skips |
| `npm run roadmap:check` | **PASS**, 143 registros/143 únicos; VERIFIED=126, EXTERNAL=14, DEFERRED=3 |

O ledger permanece honesto em **126 VERIFIED / 14 EXTERNAL / 3 DEFERRED**. Gates locais não promovem evidência externa nem staging indisponível.

## Condições verificáveis para reavaliar GO

1. Corrigir a validação de data calendário e o parsing CSV; implementar no apply o contrato de consentimento, opt-out temporal, legal hold e auditoria, com testes de PostgreSQL/rollback/replay ou receipt equivalente autorizado.
2. Adicionar teste direto de `GET /api/contacts?type=patient` e `?type=lead`, testar as duas abas e validar o envelope/resultado filtrado no staging.
3. Alinhar o origin Hyperdrive a um endpoint PostgreSQL realmente alcançável, com TLS e controles de rede documentados; repetir probe e health/DB health sem expor a porta de forma insegura.
4. Publicar a versão remediada no staging e repetir o smoke com credenciais sintéticas autorizadas, incluindo liveness, readiness, webhook inválido 4xx e webhook assinado; registrar SHA e status.
5. Expandir a matriz negativa F5, substituir logs brutos por contexto sanitizado e avaliar comparação constante no HMAC e rate limiting pré-auth.
6. Reexecutar os quatro gates após as correções e somente então atualizar a rubrica/ledger com evidências atribuídas.

**Conclusão final do Reviewer: NO-GO.**
