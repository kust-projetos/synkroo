# CI, Seed Local Seguro e Arquivamento — Design

## Objetivo

Corrigir preparação do banco do build em CI, substituir seed local perigoso por CLI segura e arquivar dois worktrees já revisados. Nenhum merge/cherry-pick integral será feito.

## Decisões

| Área | Decisão | Rejeitado |
|---|---|---|
| CI | Preparar `synkroo` antes do build: criar, habilitar pgvector, migrar e seedar | Build apontando para banco inexistente |
| CI | Teste de contrato lê `.github/workflows/ci.yml` | Confiar só em revisão manual |
| Seed | CLI pequena em `scripts/`, dry-run padrão e `--apply` obrigatório | Script legado de 1.584 linhas |
| Seed | Aceita apenas host loopback, banco `synkroo` e clínica `clinica-demo` | Execução contra banco remoto/produção |
| Seed | Transação, dados determinísticos e limpeza limitada à clínica demo | `session_replication_role`, `as any`, limpeza global |
| Arquivamento | Remover worktrees `eixo2-task1-allowlist` e `spike-ia-agente-referencia` via Git; preservar branches | Apagar branches/backups |

## Requisitos

- REQ-1 (event-driven): Quando CI executar `npx next build` com `DATABASE_URL` apontando para `synkroo`, workflow deverá criar banco, habilitar extensão, executar migrations e seed antes do build.
- REQ-2 (ubiquitous): Workflow deverá aceitar pushes em branches com `/` através de `branches: ['**']`.
- REQ-3 (state-driven): Enquanto seed não receber `--apply`, CLI deverá apenas reportar plano e não escrever no banco.
- REQ-4 (unwanted): Se URL do seed não usar loopback ou banco diferente de `synkroo`, CLI deverá falhar antes de qualquer query mutável.
- REQ-5 (event-driven): Quando `--apply` for usado, CLI deverá modificar apenas dados da clínica `clinica-demo`, em transação.
- REQ-6 (ubiquitous): Mesma seed deverá produzir resultados determinísticos para mesma chave.
- REQ-7 (event-driven): Quando arquivamento ocorrer, Git deverá remover apenas os dois worktrees aprovados, mantendo branches, seis backup refs e backups D:/E:.

## Limites

- Não migrar `feat/seed-local-scale` nem `fix/security-integrity-hardening`.
- Não executar seed no banco durante esta entrega sem autorização explícita.
- Não usar `--force`, `prune`, `gc`, remoção manual ou exclusão de branch.

## Testes

| Escopo | Tipo | Evidência |
|---|---|---|
| Workflow CI | Unit/contract | Teste RED detecta ausência de setup do banco e filtro de branch incorreto |
| Seed CLI | Unit | URL remota, DB errado, dry-run, `--apply`, escopo demo e determinismo |
| Seed DB | Integration opt-in | PostgreSQL local real; transação/rollback e isolamento de clínica |
| Arquivamento | Git pre/post check | Worktrees ausentes; OIDs/refs preservados |

## Ordem

1. Contrato CI e preparação de `synkroo`.
2. CLI de seed segura e testes.
3. Decisão E2E/integration do seed.
4. Arquivamento Git aprovado.
