# Plano consolidado — pós-sessão de 2026-07-27/28

**Propósito:** substituir a sequência de recomendações que foi mudando ao longo da sessão por **uma lista única, ordenada e estável**. Daqui pra frente, a ordem abaixo só muda com evidência nova — e a mudança fica registrada aqui, com a razão.

---

## 0. Por que a ordem mudou tantas vezes (leia primeiro)

Durante a sessão eu recomendei "o próximo passo" cerca de oito vezes, e mudei quase toda vez. As causas foram **duas**, e elas não são equivalentes:

**(a) Descoberta legítima — 6 das mudanças.** Cada investigação encontrou algo mais grave que o plano anterior. A sequência real foi: destravar o Docker → rodar a suíte de integração → ela expôs uma regressão de RBAC → investigar a regressão expôs um commit que revertera 61 arquivos → restaurar isso expôs telas vazias → validar em runtime expôs um bug que atinge todo cadastro novo. Cada passo dependia do anterior ter sido executado. Não havia como saber do último no começo.

**(b) Erro meu — 5 ocorrências.** Afirmei coisas erradas com confiança e tive de reverter. Todas por medição mal colhida, nunca por raciocínio: lista truncada por `head`, exit code escondido por `tail`, direção do fix invertida por não ler o commit de origem, conclusão sobre quem-chama-quem por dedução em vez de `grep`, e snapshot de UI tirado antes do carregamento assíncrono resolver.

**O que muda daqui pra frente:** o tipo (a) é inevitável em trabalho de diagnóstico, mas passa a ser registrado aqui em vez de virar uma recomendação verbal nova a cada turno. O tipo (b) é o que eu tenho de reduzir — a regra que adoto é separar explicitamente **o que medi** do **que inferi**, e medir de novo antes de afirmar qualquer coisa cara de reverter.

---

## 1. Estado atual — o que está pronto e verificado

**10 commits, 3 branches empilhadas, todas no remoto, working tree limpa.**

```
fix/rbac-preset-policy-drift             4 commits   (base)
restore/crm-financeiro-tier1             7 commits   (contém a anterior)
fix/rbac-seed-bootstrap-and-menu-dedupe 10 commits   (contém as duas)
```

Como são empilhadas, **mergear apenas a terceira traz tudo**.

### Gates no topo da pilha (medidos por mim, não relatados)

| Gate | Início da sessão | Agora |
|---|---|---|
| `typecheck` | 0 erros | 0 erros |
| `npm test` | 191 suites / 1362 testes | **197 suites / 1414 testes** |
| `test:integration:run` | não rodava (Docker fora) | **24/24, 183/183** |
| `npm run lint` | falha (3 warnings pré-existentes) | falha — **não é nosso**, ver §4 |

### Bugs corrigidos

| # | Bug | Impacto | Onde |
|---|---|---|---|
| 1 | `presets.ts` divergiu do `preset-policy.json` canônico | Nenhum perfil recebia permissão de CRM | `27c38555` |
| 2 | `bootstrap.ts` sem registro de crm/financeiro | Módulos invisíveis no seed **e** na UI de perfis | `3d98654a` |
| 3 | `crmActions = []` | 12 ações de CRM fora do registry | `8d1daa48` |
| 4 | CRM/Financeiro fora do menu | Telas inalcançáveis pela navegação | `5b0b0947` |
| 5 | owner-merge pendurado em import morto | Um autofix de lint mataria a feature em silêncio | `9f84250d` |
| 6 | Telas com arrays vazios hardcoded | Contatos e Financeiro estruturalmente vazios | `3add9363` |
| 7 | **Signup criava clínica com RBAC vazio** | **Todo cliente novo, em produção** | `2c32f856` |
| 8 | Rota de cron perdida em merge + 5 testes que nunca rodavam | Contrato divergente, invisível | `e976d87e`, `5a8ce953` |

**Validado em runtime** (dev server + browser, não só teste): CRM e Financeiro aparecem no menu, as duas telas carregam dados via hooks. Bug 7 provado com contagem no banco: perfil Administrador saiu de **0 para 38 permissões** num signup real.

**7 guards novos**, cada um quebrado de propósito por mim para confirmar que falha quando deve.

### A causa-raiz comum

O commit `8447795e` (squash de 865 arquivos, PR #3, "Security and integrity hardening") reverteu **61 dos 102 arquivos** do commit que fechara CRM+Financeiro. Mais grave: ele não quebrou só código — **quebrou os mecanismos que detectariam a quebra**. Testes revertidos junto com o código, testes que afirmavam o estado quebrado como esperado, testes fora do `testMatch`, dois `catch` cegos, e uma suíte de integração que não rodava por falta de Docker.

Por isso tudo ficou verde por 10 dias com módulos inteiros inacessíveis.

---

## 2. O que fazer — lista única e ordenada

Ordenada por **risco × custo**. Os itens marcados **[DECISÃO]** dependem de você; os **[EXECUÇÃO]** eu (ou outro agente) faço.

### P1 — Consolidar e mergear as branches **[DECISÃO]**

Nada mais deve ser construído em cima de três branches empilhadas não mergeadas. Duas opções:

- **1 PR** a partir de `fix/rbac-seed-bootstrap-and-menu-dedupe` (traz os 10 commits). Mais simples, review maior.
- **3 PRs sequenciais**, na ordem da pilha. Review menor por PR, mas exige merge em ordem.

Recomendo **1 PR**, porque os 10 commits contam uma história só (a regressão do `8447795e` e seu conserto) e separá-los cria PRs que não fazem sentido isolados.

### P2 — Reparar RBAC das instâncias já existentes **[DECISÃO + EXECUÇÃO]**

O fix do bug 7 vale só para clínicas **novas**. Qualquer instância já rodando continua com perfis sem permissão — e o bypass do Owner esconde isso de quem testa.

Ação: rodar `scripts/migrate-userrole-to-rbac.ts` (já corrigido no `2c32f856`) em cada ambiente.
Preciso saber de você: **existem instâncias em produção/staging hoje?** Se não, este item cai para P5.

### P3 — Migrations: journal com timestamps forjados no futuro **[DECISÃO]**

`src/lib/db/migrations/meta/_journal.json` tem `when` fora de ordem e no futuro (0002 = 2026-09-25, 0007 = 2026-10-03). O drizzle aplica **apenas** migrations com timestamp maior que o último gravado no banco — ignora a ordem do journal.

Duas consequências, ambas confirmadas empiricamente:
1. **`0003` é pulado para sempre** em aplicação incremental. Ele cria o schema inteiro de gateways do Financeiro (`payment_gateways`, `payment_charges`, `collection_attempts`, `gateway_events`, `gateway_routing_rules`).
2. **Toda migration gerada antes de outubro/2026 seria pulada em silêncio** — `db:generate` usa `Date.now()`.

Banco criado do zero (CI) aplica tudo em ordem e funciona; só ambientes **incrementais** são atingidos.

Por que é decisão sua: corrigir o journal **não basta** — ambientes que já gravaram os valores futuros seguem bloqueados, porque o bloqueio vive no banco. Cada ambiente precisa de reparo próprio. Alternativa a considerar: `db:push` em dev, migrations só em produção.

**Até decidir: não confie em `db:migrate` incremental.**

*(Já feito, escopo local: carimbei o ledger do banco de dev — `db:migrate` local sai com exit 0. Hashes validados contra as linhas boas antes de escrever.)*

### P4 — Smoke do trio local em Workers **[EXECUÇÃO]**

Era a recomendação nº 1 no começo da sessão, antes das regressões aparecerem. Continua sendo a maior incógnita da arquitetura do Agente IA: `dev:ia-bridge` + `dev:ia-agent` + Next, conforme §P5 do spike. Nunca foi executado.

Responde a pergunta que nenhum teste responde: **o `DurableObject` cru funciona cross-worker em runtime?** Se passar, o ADR que ratifica a decisão é trabalho de 10 minutos. Se falhar, a decisão reabre.

### P5 — Restante, sem urgência **[EXECUÇÃO]**

- **Tier 4 da restauração**: `stryker.services.config.json` (cosmético) e `scripts/backfill-rbac-permissions.mjs` (+165/−57). Este último **não é código de produto** e já causou mutação acidental no banco — o problema real não é a versão, é o design: um arquivo em `__tests__/` que muta banco de produção. Vale decidir se ele deveria existir nesse formato.
- **UI de gestão de perfis e acessos**: registrada no roadmap em `§9.2` (commit `1b99345a`). Hoje a tela só **cria** perfil; não edita, não exclui, não atribui perfil a usuário, e não há API de roles. É feature, não correção.
- **Menu com itens duplicados**: já corrigido no `2c32f856` via dedupe por path.
- **Auditar o resto do `8447795e`**: 29 dos 61 arquivos revertidos já divergiram por outros caminhos e não foram analisados um a um.

---

## 3. O que eu recomendo fazer agora

**P1.** Abrir o PR único e mergear. Dez commits que corrigem oito bugs — incluindo um que atinge todo cliente novo — não deveriam ficar mais tempo fora da `main`.

Só depois disso vale abrir qualquer frente nova.

---

## 4. Coisas que parecem problema e não são

Para não voltarem à discussão a cada sessão:

- **`npm run lint` falha.** São 3 warnings `no-console` em `.github/workflows/__tests__/branch-filter.test.mjs`. **Pré-existente na `main`** — verifiquei rodando o lint no commit base. Não foi introduzido por nenhum commit desta leva.
- **Telas de Contatos e Financeiro aparecem vazias no ambiente demo.** A clínica demo tem 0 pacientes e 0 orçamentos. É vazio de **dados**, não de código — o carregamento por hook foi confirmado funcionando.
- **`crm` e `financeiro` não aparecem no menu de uma instância nova.** Ambos são `alwaysOn: false`; o módulo precisa estar habilitado em `instance_modules`. É design de produto modular, não bug.
- **Testes de integração "não rodam".** Rodam, mas exigem Docker de pé e `TEST_DATABASE_URL` apontando para `synkroo_test`. O runner é fail-closed de propósito e nunca toca o banco de dev.

---

## 5. Estado do ambiente local (para quem retomar)

- Porta 3000 é do projeto `pi-financeiro`. Subir o Synkroo com `PORT=3007 npm run dev`.
- Cookies de `localhost` não são por porta — a sessão vaza entre projetos. Testar em contexto isolado no browser.
- Login demo: `admin@clinicademo.com` / `demo123` (a própria tela de login exibe).
- Banco de dev tem artefatos deliberados desta sessão: módulos `crm`/`financeiro` habilitados, cutover de RBAC rodado, clínica `Clinica Prova <timestamp>` criada para provar o bug 7, e ledger de migrations carimbado.
- **Nunca rodar** `scripts/__tests__/backfill-rbac-permissions.test.mjs`: apesar do nome, executa um backfill real contra o banco de `DATABASE_URL`.
