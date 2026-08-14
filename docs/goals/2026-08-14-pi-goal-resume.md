# Retomada do goal após migração para @amaster.ai/pi-goal

- **Projeto:** `D:/projetos/synkroo`
- **Migração:** 2026-08-14
- **Ativação:** manual; este documento não inicia execução
- **Estado legado:** preservado no backup global da migração

## Goal legado

- **ID:** `20260804105503-40c3lj`
- **Status final no GLLA:** `paused`
- **Objetivo original:** quero que implemente todo o plano docs/superpowers/plans/2026-08-03-auditoria-remediacao-completa-implementation.md, sem interrupções, me de uma rubrica quando terminar
- **Plano original:** `docs/superpowers/plans/2026-08-03-auditoria-remediacao-completa-implementation.md`
- **Atualizado em:** `2026-08-13T15:37:44.992Z`
- **Telemetria:** 25 turns, 460 file writes, 1858 bash calls
- **Tokens registrados pelo GLLA:** 14,815,163
- **Auditorias registradas:** 20

## Cinco ondas marcadas como completas

| ID  | Onda                                | Subtasks completas |
| --- | ----------------------------------- | -----------------: |
| `1` | Onda 0–1: fechar cinco P0           |                5/5 |
| `2` | Onda 2: auth e efeitos idempotentes |                5/5 |
| `3` | Onda 3: hardening estrutural        |                5/5 |
| `4` | Onda 4: produto e E2E               |                5/5 |
| `5` | Onda 5: release e rubrica Go/No-Go  |                5/5 |

A retomada não deve repetir essas ondas. Ela deve fechar somente os gaps do candidato final identificados pela última auditoria.

## Última auditoria legada

- **Data:** `2026-08-13T15:37:44.991Z`
- **Modelo:** `openai-codex/gpt-5.6-luna`
- **Resultado:** `disapproved`

Pendências concretas extraídas do último relatório:

1. Aplicar scans fail-closed a todos os arquivos de implementação API/cron, incluindo `_handler.ts`, e migrar acesso direto ao DB para serviços/repositórios.
2. Executar Stryker contra o candidato final, preservar resultado bruto e conectá-lo ao gate JSON.
3. Executar `npm run build:cf`, dry-run Wrangler e análise de startup contra o candidato final.
4. Com consentimento para ações externas, redeploy/staging smoke/rollback do candidato final e evidência bruta redigida.
5. Reconciliar checkboxes dos planos subordinados com o estado e as evidências reais.

## Condição `/goal` pronta

Execute em uma nova sessão Pi aberta neste projeto:

```text
/goal Fechar somente os cinco gaps finais do goal legado synkroo 20260804105503-40c3lj: tornar o scan arquitetural fail-closed para todos os arquivos API e cron e remover acesso direto ao DB; executar Stryker no candidato final e ligar o resultado bruto ao gate; executar build:cf, dry-run Wrangler e startup checks; produzir evidência bruta redigida de staging smoke e rollback após consentimento para ações externas; e reconciliar os checkboxes dos planos subordinados. Encerrar apenas quando lint, typecheck, testes unitários, integração, segurança, release, Stryker, build:cf e dry-run passarem com outputs completos e hashes do current tree no transcript.
```

## Evidência esperada

- `npm run lint` e `npm run typecheck`.
- `npm test`, `npm run test:integration:run`, `npm run test:security` e `npm run test:release`.
- `npm run test:security:services` com relatório Stryker bruto do candidato final.
- `npm run build:cf`.
- `npx wrangler deploy --dry-run --config wrangler.toml`.
- Evidência redigida de staging smoke e rollback vinculada ao mesmo tree hash.
- Checkboxes dos planos subordinados reconciliados com links para evidência.

## Procedimento de retomada

1. Inicie uma nova sessão Pi em `D:/projetos/synkroo`.
2. Leia este documento, o plano original e o estado versionado em `docs/agent/`.
3. Crie ou retome um task contract no `pi-tasks` somente para os cinco gaps acima.
4. Cole a condição `/goal` pronta.
5. Solicite confirmação antes de redeploy, staging smoke contra ambiente externo ou rollback.
6. Se uma ação externa não for autorizada ou não houver credencial, registre o blocker; não fabrique evidência.
7. Se tentativas repetidas não produzirem nova evidência, mude de abordagem e registre o bloqueio.
