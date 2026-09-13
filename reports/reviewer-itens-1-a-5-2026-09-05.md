# Revisão do Reviewer — Itens 1–5 do Roadmap 143

**Data:** 2026-09-05  
**Papel:** Reviewer (pi dev), `code-craftsman` carregada  
**HEAD observado:** `78868048` (`main`)  
**Estado:** worktree suja; há alterações não commitadas além dos arquivos dos dois Coders.

## Veredito executivo

**NO-GO para promoção/piloto e não é possível considerar as cinco pendências encerradas.** O núcleo do Item 1 tem uma correção plausível (409/500 não chama `closeDialog()` e só invalida queries após sucesso), e o Item 2 tem evidência histórica de build Linux 123/123; porém há falha objetiva nos testes RBAC alterados, regressão de shape em contatos, E2E que passa sem provar a operação, smoke staging não verde, artefatos de piloto apenas documentais/dry-run, exposição de dados pessoais em fixture versionada e ausência de decisão formal do owner.

A recomendação é manter F12.01–F12.08 e `B-OWNER-GO-NO-GO` como **EXTERNAL / NO-GO pendente**, sem deploy, import, provisionamento, fault injection ou mudança do ledger para VERIFIED.

## Evidências executadas pelo Reviewer

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run lint` | PASS, exit 0 |
| `git diff --check` nos arquivos revisados | PASS, exit 0 |
| `AppointmentDialog.t6`, `conversas/page.t6`, `use-queries.t6` | 9/9 PASS, mas com limitações descritas abaixo |
| inbound security + settings T7 + `use-queries.test` | 47/47 PASS |
| `npm run test:release` | 13/13 PASS |
| `node --test scripts/__tests__/smoke-staging.test.mjs` | 4/4 PASS |
| `node scripts/roadmap-ledger.mjs --check` | `143 unique=143`, `126 VERIFIED / 14 EXTERNAL / 3 DEFERRED`, exit 0 |
| `ci_33018206821.log` | contém os dois `next build` com 123/123 e OpenNext concluído, mas é histórico e foi executado no SHA `83fc1f5`, não no HEAD atual |

PASS de testes contratados não basta para GO quando o teste é tautológico, o artefato é histórico ou o ambiente real está degradado.

## Findings bloqueantes e de alta prioridade

### F1 — Suítes RBAC quebram com a mudança de `syncRolePermissions` (P1 — release-blocker)

A implementação nova insere primeiro em `permissions` e depois em `role_permissions` (`src/core/rbac/seed.ts:33-55`). Os mocks existentes dos testes não distinguem as tabelas. Verificação direta:

```text
node ...jest.js src/core/rbac/__tests__/seed.test.ts src/core/rbac/__tests__/sync-role-permissions.test.ts --no-coverage --runInBand
2 suites failed; 9 passed, 2 failed (11 tests total)
```

Falhas: `seed.test.ts` esperava 2 inserções e recebeu 3; `sync-role-permissions.test.ts` esperava 2 e recebeu 4, pois as linhas da tabela `permissions` foram contabilizadas como grants. Portanto o gate unitário atual falha, apesar de os relatórios não destacarem isso.

Além disso, o `catch` abrangente em torno do insert de `permissions` engole erro de banco/rede e prossegue para inserir FK em `role_permissions`. Isso obscurece a causa original e não é uma recuperação segura. A sincronização deve ser atômica/observável e validar chaves contra catálogo, ou os testes devem mockar as tabelas corretamente antes de qualquer claim verde.

### F2 — `fetcher` introduz regressão no painel de contatos (P1)

`src/lib/hooks/use-queries.ts:64-69` sempre desembrulha `{ data, meta }` para `data`. Isso corrige consumidores que esperam `{ appointments, conversations }`, mas quebra o shape já consumido por `src/components/contacts/contact-list-panel.tsx:35-36`:

- `listContactsService` retorna `{ data: ContactListRow[], total }`;
- `handleCanonicalAction` serializa isso como `{ data: ContactListRow[], meta: { total } }`;
- o novo `fetcher` retorna diretamente `ContactListRow[]`;
- `ContactListPanel` ainda faz `data?.data || []`, resultando em lista vazia.

É uma regressão funcional verificável por inspeção do contrato, não coberta pelos testes T6. Deve haver normalização por endpoint/tipo ou atualização coordenada dos consumidores, com teste que leia uma lista de contatos real do envelope canônico. O mesmo contrato merece revisão nos consumidores de listas de dentistas/procedimentos, que ainda esperam propriedades nomeadas enquanto as Actions retornam arrays.

### F3 — E2E de envio/retry é falso positivo e o teste unitário não exerce falha (P1)

`e2e/conversations.spec.ts:111-120` aceita qualquer mensagem existente ou o botão de retry. `lastMessage.count() > 0` não verifica o texto recém-enviado nem aumento de contagem; uma conversa pré-existente pode fazer o teste passar sem envio e sem retry.

`src/app/dashboard/conversas/__tests__/page.t6.test.tsx:70-85` diz explicitamente que não executa o envio que falha: apenas verifica que não há botão inicialmente, que `mockToast` existe e lê o fonte procurando `refetchInterval`. Não prova rollback, toast após erro, reenvio nem inbound sem reload.

A implementação da página tem rollback otimista e botão, mas a evidência entregue não prova o fluxo crítico. O teste deve forçar `fetch('/api/messages/send')` a falhar, verificar remoção do temporário, conteúdo preservado no retry, segundo request e sucesso/erro subsequente; o E2E deve exigir o conteúdo enviado ou um retry associado àquela mensagem.

### F4 — E2E/unit de settings não prova persistência após reload (P1)

`e2e/settings.spec.ts` e `e2e/settings/settings.spec.ts` só validam cabeçalho, campos, navegação e presença de botões. O suposto teste `reload preserva settings` em `src/app/dashboard/configuracoes/__tests__/page.t7.test.tsx:67-89` termina com `expect(savedSettings).toBeNull()` antes de clicar em `Aplicar`, salvar ou remontar a página.

A lógica de `BusinessHoursCard` mantém o modal/painel em erro e envia PUT, mas a propriedade “salvar → reload → recuperar horário e preservar `whatsapp_phone_number_id`” continua sem teste de comportamento. Adicionar um teste de integração de UI ou E2E que preencha, aplique, confirme request/response, remonte/recarregue e verifique os valores persistidos; não usar apenas inspeção de fonte.

### F5 — Tratamento de 500/409 funciona no caminho principal, mas pode emitir toast duplicado (P2)

`AppointmentDialog.tsx:179-210` mostra toast de `Erro ao agendar` e lança `Error(msg)`. Para um 500 cujo corpo seja `{"error":"Erro interno"}`, o `catch` não reconhece o status nem o toast anterior e exibe também `Erro ao salvar`. Para um 409 cujo servidor retorne uma mensagem diferente de `Horário já ocupado`, ocorre o mesmo. Isso não fecha o modal, mas degrada UX e faz o contrato depender do texto do erro.

Os testes T6 verificam que algum toast foi chamado, não que exista exatamente um, nem que o segundo retry preserve o formulário. O estado de `open` foi mockado indiretamente via ausência de `closeDialog`, portanto ainda falta uma asserção de comportamento de retry no componente real.

### F6 — Asserções de calendário foram relaxadas demais (P2)

`e2e/calendar.spec.ts:81-85,187-189` aceita `set|ago` literalmente, além de `currentMonthName` e `Date.now()-7d`. Isso pode passar para um título incorreto e fica preso a nomes de agosto/setembro. A asserção deve derivar os limites da semana exibida e validar o mês esperado, sem palavras fixas de uma data de execução.

## Item 2 — build Linux/CI, Windows e OpenNext

**Resultado:** parcialmente confirmado, não certificado para o worktree atual.

- O log `ci_33018206821.log` é evidência útil: checkout no SHA `83fc1f519b...` e jobs com `Compiled successfully`, `Generating static pages (123/123)`, `Worker saved` e `inject-pg-global`; o build Linux histórico é verde.
- O HEAD atual é `78868048` com worktree não commitada. Logo o run não valida as mudanças atuais dos Coders. É necessária execução CI no SHA candidato ou uma evidência de build equivalente do mesmo snapshot.
- O workflow `.github/workflows/ci.yml:129-131` executa `wrangler deploy --dry-run --config ...` sem `--env staging`. No log, o app lista `HYPERDRIVE be5a...`, KV `8f2a...` e `OUTBOX_WORKER_URL https://synkroo...`, que são bindings de produção no `wrangler.toml` base, não o ambiente staging. `--dry-run` não aplicou mudança, mas o relatório não pode apresentar essa etapa como validação de recursos staging isolados.
- OpenNext emitiu warning `duplicate-case` durante o bundle. Não bloqueou o exit 0, mas deve ser triado antes de tratar o bundle como sem ressalvas.
- A falha Windows `ENOENT ... .next/export/500.html` é compatível com o contraste documentado, mas não substitui CI do snapshot candidato. A recomendação operacional de usar Linux/CI ou WSL é aceitável.

## Item 3 — staging smoke sem tocar produção

**Resultado:** a segurança operacional da execução é parcialmente confirmada; o smoke real está **vermelho/parcial**, não GREEN.

O relatório registra execução sem `wrangler deploy`, migration, provisionamento ou secrets reais. Os checks com credenciais sintéticas, `redirect: manual`, timeout de 10s e serialização são boas salvaguardas. O contrato local passa 4/4 e `test:release` passa 13/13. Contudo, o próprio resultado live mais recente registra:

```text
pass 4/10; blocked 4/10; fail 2/10
liveness: 503/AbortError (database/Hyperdrive flap)
invalid-webhook: 500 (contrato esperava 400/403)
valid-auth/session/switch-clinic/agenda-tenant-scope: blocked sem credencial sintética staging
protected-readiness: 401; widget.js: 200; invalid-auth/route-protection: 307
```

Consequentemente não há evidência atual de sessão autenticada, troca de clínica ou escopo de agenda no staging. O health flap (`SELECT 1 FROM clinics` com latência/timeout) é bloqueante para piloto até investigação do Hyperdrive `e003...` e nova execução.

Há dois defeitos no próprio contrato de smoke:

1. `valid-auth` e `session` fazem o mesmo GET em `/api/auth/session`; o mock aceita 200 até sem autenticação e nenhum check valida `body.authenticated === true`.
2. `validateAgendaTenant` espera `payload.appointments` na raiz (`scripts/smoke-staging.mjs:38-46`), mas a rota atual `/api/appointments` usa `handleCanonicalAction` e entrega `{ data: { appointments, ... }, meta? }`. Assim, o teste autenticado pode falhar por shape ou deixar de provar o contrato correto. O smoke precisa desembrulhar o envelope canônico e afirmar simultaneamente status, autenticação e `clinicId` de cada linha.

A divergência live `500` versus `400/403` para webhook inválido também deve ser resolvida ou documentada como falha de contrato, não como sucesso “fail-closed”. Um 500 pode não vazar dados, mas não demonstra o comportamento operacional esperado e pode mascarar falha de banco.

## Item 4 — piloto e seis outage drills

**Resultado:** preparação documental e dry-runs confirmados; execução externa não verificada.

- `docs/ops/pilot-charter.md` está explicitamente `CHARTER-DRAFTED`, sem provisionamento/import, com checklist de entrada pendente e checksum placeholder de zeros.
- `docs/ops/outage-drill-matrix.md` está explicitamente `MATRIX-DRAFTED`; o gatilho exige owner, candidato staging, monitoramento, notificação e integridade.
- `docs/ops/outage-drill-receipts.md` é `DRY-RUN` local. As seis linhas descrevem comportamento esperado/“observado”, mas não trazem injeção de falha real, alerta recebido, recovery time mensurado, comando reproduzível por drill ou evidência de integridade no ambiente. O único teste operacional concreto citado é o `dispatch-dlq` unitário.
- O relatório faz a distinção charter/matrix/dry-run na tabela final, o que é correto; porém os textos “6 drills executados” e “comportamento observado” não devem ser usados para promover F12.04 para VERIFIED.
- A janela proposta `2026-09-01T02:00Z` já passou em relação à revisão de 2026-09-05. Deve ser replanejada e assinada antes de qualquer exercício.

Há ainda risco de implementação: `scripts/provision-client.mjs` e `scripts/import-client-data.mjs` são geradores de preview. Mesmo com `--apply`, ambos apenas alteram o campo `status/action/message` e não escrevem infraestrutura ou banco. O import também não valida `optOutMarketing` (o campo é exigido no header mas omitido do destructuring). Portanto os comandos atuais são seguros como dry-run, mas não podem ser apresentados como caminho de aplicação real; “applied” sem mutação seria perigoso se o owner autorizar o piloto.

### Privacidade/LGPD — bloqueante

A afirmação de que não há PII no material não é sustentada pelo checkout: `git ls-files` confirma `docs/pilot/approved-import.csv` versionado; a fixture contém 10 linhas com campos diretos `name`, `phone`, `email` e `birthDate`. O arquivo pode ser sintético, mas não está marcado/provado como tal e continua sendo dado pessoal por formato. Além disso, receipts/scorecards reproduzem nome de paciente e valores de identificação de dataset, apesar do charter afirmar “sem PII”.

Antes de qualquer promoção, remover a fixture identificável dos artefatos versionados ou substituí-la por dados inequivocamente fictícios/placeholder, eliminar nomes de paciente dos reports e recalcular/registrar apenas checksum sanitizado. Reexecutar scanner e revisar retenção/base legal; não chamar esses artefatos de “privacy-safe” enquanto a contradição existir.

## Item 5 — governança formal GO/NO-GO do owner

**Resultado: NO-GO / decisão pendente; nenhum agente deve preencher o GO do owner.**

Evidência direta:

- `docs/ops/w12-pilot-readiness.md:1-10`: `EXTERNAL`, owner, tenant e janela ainda `_a preencher`; checklist de preparação desmarcado.
- `docs/superpowers/audits/roadmap-143-final-rubric.md` seção “Decisão”: `Owner: _owner assina_`, decisão é apenas template (`GO ... / NO-GO`) e execução real é pendente.
- `docs/superpowers/audits/roadmap-143-ledger.json`: F12.01–F12.08 continuam `EXTERNAL`; F12.08 exige revisão do scorecard e registra “no decision authority or pilot record supplied”.
- O próprio scorecard é `DRY-RUN` e depende de piloto, a11y/perf, training e drills reais ainda não executados.

O Reviewer pode recomendar **NO-GO até que o owner formalize o registro**, mas não pode converter isso em decisão do owner. O registro final precisa conter owner identificável, data/janela futura, SHA candidato, scorecard atual, hard gates, riscos aceitos, condições de abort e rollback, sem secrets/PII.

## Matriz de conclusão

| Item | Estado após revisão | Condição para reabrir/fechar |
|---|---|---|
| 1 — agenda 409/500, retry, inbound, settings reload | **PARTIAL / NO-GO** | Corrigir F1/F2; substituir E2E tautológicos por cenários comportamentais; repetir agenda, envio/retry, inbound e save/reload com tenant |
| 2 — build Linux/Windows/OpenNext | **PARTIAL** | CI no snapshot candidato; confirmar explicitamente `--env staging`; triagem do warning OpenNext; manter Linux/WSL como gate |
| 3 — staging smoke | **NO-GO** | Resolver Hyperdrive health flap e webhook 500; corrigir envelope/auth assertions; executar checks autenticados com credenciais staging sintéticas e receipt sanitizado |
| 4 — charter/drills | **CHARTER/MATRIX/DRY-RUN ONLY** | Remover PII; owner autorizar janela futura; implementar/validar apply; executar seis drills reais somente em staging com alertas, recovery e integridade comprovados |
| 5 — owner governance | **NO-GO / PENDING OWNER** | Owner preencher decisão formal GO/NO-GO após evidências atuais; não promover ledger automaticamente |

## Ações recomendadas antes de novo review

1. Corrigir os dois testes RBAC quebrados, remover o `catch` abrangente ou tornar a transação/erro explícito e revalidar `npm test`.
2. Definir um contrato único de envelope para hooks/consumidores; corrigir `useContacts` e adicionar testes com `{ data: [...], meta }` e `{ data: { appointments: [...] } }`.
3. Reescrever E2E/unit de retry e settings para provocar falha/sucesso e verificar estado/requests, não presença de fonte ou elementos preexistentes.
4. Corrigir `smoke-staging.mjs` para envelope canônico, autenticação real no corpo e agenda tenant-scoped; executar Wrangler dry-run com `--env staging` e registrar SHA.
5. Investigar Hyperdrive `e003...`, corrigir o status esperado do inbound inválido e obter receipt live verde.
6. Retirar dados pessoais de CSV/reports e revisar claims de “sem PII/secret”.
7. Tornar `--apply` realmente mutante e auditável, ou renomear explicitamente os scripts como preview-only até existir implementação.
8. Solicitar decisão formal do owner somente depois dos gates acima; manter F12 EXTERNAL até lá.

**Conclusão do Reviewer:** qualidade e segurança não sustentam GO neste snapshot. O caminho seguro é **NO-GO**, preservar produção intocada, corrigir as regressões/testes e repetir a revisão com evidência do SHA candidato e autorização formal do owner.
