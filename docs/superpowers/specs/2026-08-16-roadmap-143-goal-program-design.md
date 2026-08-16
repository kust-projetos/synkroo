# Synkroo — Programa autônomo para verificar 143 pendências

**Data:** 2026-08-16  
**Status:** design aprovado em brainstorming; aguardando revisão final do arquivo pelo owner  
**Owner:** Walis  
**Destino:** 143 de 143 itens do roadmap em `VERIFIED`

## 1. Objetivo

Transformar as 143 pendências reconciliadas do Synkroo em uma DAG executável e retomável. O programa deve resolver autonomamente todo trabalho que o agente consiga executar com segurança, antecipar blockers previsíveis e interromper apenas quando uma ação depender realmente de intervenção humana.

O programa termina somente quando:

- os 143 itens estiverem em `VERIFIED` com evidência nominal;
- não restar item `PARTIAL`, `UNVERIFIED`, `EXTERNAL`, `DEFERRED` ou `OPEN`;
- todos os gates não compensáveis estiverem verdes;
- a rubrica final atingir pelo menos 90/100;
- a decisão formal do owner for `GO`.

## 2. Fontes de autoridade

A ordem de precedência é:

1. `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md` define produto e arquitetura alvo.
2. Este documento define o modelo de execução do programa.
3. `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` fornece os IDs estáveis e a reconciliação dos 143 itens.
4. O futuro plano de implementação define pacotes, dependências, comandos e ordem detalhada.
5. Auditorias, código e testes demonstram o estado atual; não alteram requisitos por acidente.
6. Planos anteriores permanecem históricos quando divergirem das fontes acima.

Uma mudança de escopo, tenancy, autonomia de IA, dados clínicos, stack ou fronteira arquitetural exige ADR, atualização da spec e aprovação do owner.

## 3. Restrições

- Não criar um `/goal` monolítico para o roadmap inteiro.
- Não marcar item como `VERIFIED` por presença de código, teste indireto ou inferência.
- Não reduzir thresholds, ampliar exclusões de coverage, adicionar retries ou enfraquecer asserts para obter gate verde.
- Não executar produção, criar custo novo, revelar/rotacionar secrets ou realizar ação irreversível sem gate humano explícito.
- Não presumir receipt de provider, staging, CI, outage drill ou piloto.
- Não misturar writers no mesmo worktree nem executar migrations concorrentes.
- Não sobrescrever o working tree atual antes de preservar, revisar e reconciliar suas mudanças.

Commits, push, abertura de PR e operação em staging previamente configurado estão autorizados. Toda ação deve preservar rollback e evidência sanitizada.

## 4. Arquitetura de execução

### 4.1 Plano de controle

`pi-tasks` é o plano persistente. Ele mantém:

- os 143 IDs do roadmap;
- dependências e ordem;
- pacote e onda proprietários;
- risco;
- status;
- blocker ativo;
- critérios de aceitação;
- evidências e receipts;
- commit, PR e ambiente verificado;
- risco residual e rollback.

O plano persiste entre sessões. Após reinício, o agente retoma `pi-tasks`, lê o documento de continuidade e emite um novo `/goal` para a próxima entrega.

### 4.2 Unidade autônoma

Cada `/goal` possui exatamente uma entrega verificável. Um pacote pode agrupar de um a cinco itens apenas quando eles compartilham a mesma fronteira, mudança e prova. O goal deve declarar:

- IDs cobertos;
- estado final falsificável;
- comandos e outputs esperados;
- arquivos e boundaries permitidos;
- perfil de risco;
- proibições contra atalhos;
- condição de blocker;
- evidência que deve aparecer no transcript.

Ao finalizar, o goal encerra. O supervisor consulta a DAG antes de emitir o próximo; o próprio goal não inicia uma fila independente.

### 4.3 Ondas

| Onda | Escopo | Fases preservadas | Saída mínima |
|---|---|---|---|
| O0 | Recovery e verdade | transversal | working tree preservado/reconciliado, documentos classificados, baseline e blocker registry |
| O1 | Segurança e fundação | F0–F3 | auth, tenancy, env, DB, CI e runtime comprovados |
| O2 | Contratos e operação clínica | F4–F5 | Action/API shell e jornada clínica verificadas |
| O3 | Canais, IA e assíncronos | F6–F7 | canais, agent safety, Queue/outbox/retry/DLQ e consentimento comprovados |
| O4 | CRM, financeiro, analytics e LGPD | F8–F10 | invariantes transacionais, providers, métricas e lifecycle de dados comprovados |
| O5 | Release, observabilidade e piloto | F11–F12 | rollout/rollback/SLO, drills, piloto e GO formal |

Os IDs `F0.01–F12.08` não mudam. As seis ondas são uma visão operacional, não uma renumeração do roadmap.

### 4.4 Lanes e paralelismo

Pacotes só podem rodar em paralelo quando não compartilham schema, migration, contrato central, CI ou arquivos. Cada lane de mutação usa worktree próprio e um writer. DB, CI, auth central, contratos HTTP e runtime Cloudflare ficam em lanes seriais.

Reviewers usam contexto fresco e são read-only. O supervisor integra resultados e mantém autoridade sobre status, merge, deploy e fechamento.

## 5. Ciclo de um pacote

1. **Selecionar:** escolher somente nó `READY`, confirmar dependências e reservar lane.
2. **Preflight:** verificar working tree, ambiente, banco, serviços, permissões, comandos, riscos e blockers previsíveis.
3. **Contratar:** registrar tarefa atômica em `pi-tasks` e condição mensurável do `/goal`.
4. **RED:** criar reprodução/teste capaz de falhar pelo requisito ausente.
5. **GREEN:** implementar a menor mudança que satisfaz o requisito.
6. **REFACTOR:** melhorar estrutura sem ampliar escopo.
7. **Desafiar:** executar testes adversariais proporcionais ao risco.
8. **Revisar:** obter revisão independente e processar achados tecnicamente válidos.
9. **Verificar:** rodar perfil de gate, ecoar outputs e anexar evidências.
10. **Integrar:** commit atômico, push/PR quando aplicável e staging autorizado.
11. **Pontuar:** aplicar rubrica do pacote; abaixo do mínimo retorna para correção.
12. **Checkpoint:** atualizar matriz, pi-tasks e documento de retomada; escolher o próximo nó `READY`.

Resultado parcial nunca fecha o item. Se a implementação existir mas faltar prova, o status permanece `PARTIAL` ou `EVIDENCE_PENDING` no plano de controle.

## 6. Estado e ledger de evidências

O plano de controle usa os estados operacionais `QUEUED`, `READY`, `ACTIVE`, `BLOCKED_R4`, `BLOCKED_R5`, `EVIDENCE_PENDING` e `VERIFIED`. Eles não substituem os status documentais do roadmap; apenas tornam a execução determinística.

Cada item `VERIFIED` deve registrar:

- ID e requisito exato;
- risco e perfil de teste;
- teste RED ou verificação que expôs o gap;
- mudança implementada;
- comandos executados;
- output observado;
- commit e PR;
- ambiente;
- reviewer e achados;
- receipt externo sanitizado, se aplicável;
- risco residual;
- rollback ou roll-forward;
- data e owner da evidência.

A matriz deve ser validável automaticamente quanto a IDs ausentes, duplicados, transições inválidas e `VERIFIED` sem evidência.

## 7. Protocolo de blockers

### 7.1 Taxonomia

- **R1 — resolvível:** código, teste, configuração, documento ou dependência local. O agente resolve.
- **R2 — ambiental:** container, serviço, porta, versão, fixture ou recurso local. O agente repara ou cria fallback reproduzível.
- **R3 — externo autorizado:** CI, PR, staging ou provider previamente configurado. O agente executa, monitora e coleta prova.
- **R4 — gate humano:** segredo, custo novo, produção, dado real, comunicação ou ação irreversível.
- **R5 — decisão:** alternativas materialmente diferentes sem autoridade delegada.

Após duas falhas iguais, o agente para de repetir, registra causa raiz e tenta uma abordagem ortogonal. Repetição sem nova evidência é proibida.

### 7.2 Gate pronto

Um R4 ou R5 só pausa após toda preparação autônoma estar concluída. O pacote entregue ao owner contém:

- IDs e goal bloqueados;
- motivo e evidências;
- ações já tentadas;
- ação humana mínima e exata;
- precondições;
- riscos;
- rollback;
- receipt sanitizado esperado;
- instrução de retomada;
- nós independentes que podem continuar.

O programa continua em outros nós `READY`. A pausa global ocorre somente quando toda a fronteira da DAG depende de gates humanos.

### 7.3 Blockers conhecidos e prevenção

| Blocker conhecido | Tratamento preventivo |
|---|---|
| Working tree não commitado | snapshot, diff review, testes focados, associação a IDs e commits separados antes de novo trabalho |
| Planos/specs antigos com checkboxes stale | classificar canônico, superseded, histórico ou ativo; impedir contagem duplicada |
| Duplicatas antes de normalização de e-mail | preflight read-only, relatório tenant-scoped, remediation aprovada e migration expand |
| Hyperdrive real | validar config/bindings sem valores, preparar staging smoke, rollback e receipt |
| Coverage abaixo de 70% | baseline por módulo, pacotes de testes comportamentais e proibição de gaming |
| Mutation survivors em auth | mutação focada, separar equivalentes e criar testes que matem survivors válidos |
| Corridas financeiras e cross-domain | PostgreSQL real isolado, barreiras de concorrência e matriz de estados/falhas |
| CI remoto não comprovado | push/PR autorizado, monitoramento e receipt do commit exato |
| Asaas/Evolution/LLM | contrato local primeiro; sandbox e secrets por gate pronto |
| Secret rotation e auditoria externa | checklist sanitizado, owner/provider e receipt por fingerprint |
| Piloto e outage drills | ambiente, dataset, participantes, janela, rollback e scorecard preparados antes do gate |

## 8. Testes e verificação por risco

### 8.1 Perfil simples

Para documento ou mudança mecânica sem comportamento: validação focada, `git diff --check`, lint/diagnóstico do escopo e revisão de diff.

### 8.2 Perfil relevante

Para comportamento de domínio sem fronteira crítica: TDD unitário, integração afetada, lint, typecheck, suite do módulo, LSP e revisão independente.

### 8.3 Perfil crítico

Para auth, tenancy, LGPD, dinheiro, webhooks, IA com side effects, migration, concorrência ou deploy:

- contratos;
- PostgreSQL real isolado;
- testes adversariais e race conditions;
- segurança e mutation quando aplicável;
- E2E sem retries;
- build Next/OpenNext;
- preflight e rollback/roll-forward;
- revisão independente antes de integração.

### 8.4 Gate de onda

No mesmo commit candidato, executar os gates aplicáveis entre:

- `npm run lint`;
- `npm run typecheck`;
- unit tests;
- integração PostgreSQL;
- security e release contracts;
- coverage configurado;
- `npm run build`;
- E2E de produção;
- `npm run build:cf` e Wrangler dry-run;
- CI remoto.

Flakiness exige reprodução e causa raiz; retries não contam como correção. Thresholds e exclusões não podem ser alterados somente para obter verde.

## 9. Migrations, falhas e rollback

Toda mudança de dados usa preflight read-only, backup/restore comprovável, migration imutável e estratégia expand/contract. Depois de migration aplicada em ambiente compartilhado, rollback de aplicação deve usar versão compatível ou roll-forward; down migration destrutiva não é padrão.

Integrações externas usam timeout, idempotency key, estado observável, retry limitado e DLQ/reconciliação. Falha de provider, bridge, DB ou Queue deve ser visível e fail-closed quando houver risco de autorização, dinheiro, LGPD ou side effect duplicado.

## 10. Rubrica

| Dimensão | Peso |
|---|---:|
| Fechamento nominal dos 143 itens | 25 |
| Jornadas J-01–J-12 | 15 |
| Segurança, tenancy e LGPD | 15 |
| Dados, migrations e concorrência | 15 |
| Testes, coverage, mutation e revisão | 15 |
| Runtime, deploy, observabilidade e rollback | 10 |
| Operação, piloto e rastreabilidade | 5 |
| **Total** | **100** |

Faixas:

- 95–100: excelente, pronto para operação;
- 90–94: aprovado se todos os gates não compensáveis estiverem verdes;
- 80–89: incompleto, exige onda corretiva;
- abaixo de 80: reprovado.

### 10.1 Gates não compensáveis

- 143 itens `VERIFIED` e zero nos demais status;
- CI verde no commit candidato;
- coverage configurado de no mínimo 70% sem gaming;
- zero finding crítico/alto não aceito;
- migrations, catálogo, preflight e rollback/roll-forward comprovados;
- J-01–J-12 aprovadas;
- receipts de staging, providers, outage drills e piloto;
- decisão formal `GO` do owner.

Qualquer gate ausente torna o programa `não concluído`, independentemente da pontuação.

## 11. Relatório final

O relatório ao owner deve conter:

- contagem antes/depois por status;
- tabela dos 143 IDs e evidências;
- goals, commits, PRs e CI;
- comandos e outputs dos gates;
- receipts externos sanitizados;
- score por dimensão e justificativa;
- achados de revisão e sua resolução;
- riscos residuais;
- rollback/roll-forward disponível;
- decisão final `GO` ou `NO-GO`.

## 12. Fora de escopo

O programa não redefine o produto, não troca a stack canônica e não adiciona funcionalidades fora dos 143 requisitos para elevar score. Melhorias arquiteturais são permitidas somente quando servem diretamente a um requisito, removem blocker ou reduzem risco comprovado.

Planos antigos não são reexecutados por seus checkboxes. Eles são evidência histórica e só geram trabalho quando um requisito canônico ou item reconciliado ainda exigir resultado não comprovado.
