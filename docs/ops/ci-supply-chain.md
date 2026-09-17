# CI / Supply Chain — endurecimento (Etapa 7)

## O que foi endurecido

- **SHA-pin de todas as actions** (`ci.yml` + `gitleaks-scheduled.yml`):
  cada `uses:` referencia o SHA completo do commit, com a tag como
  comentário YAML na mesma linha. Estado atual:
  | Action | SHA | Versão |
  |---|---|---|
  | `actions/checkout` | `11d5960a326750d5838078e36cf38b85af677262` | v4.4.0 |
  | `actions/setup-node` | `49933ea5288caeca8642d1e84afbd3f7d6820020` | v4.4.0 |
  | `gitleaks/gitleaks-action` | `ff98106e4c7b2bc287b24eaf42907196329070c7` | v2.3.9 |
- **Gitleaks via action, sem curl\|tar**: os dois blocos
  `curl …/gitleaks_8.24.0_linux_x64.tar.gz | tar xz` foram substituídos
  por `gitleaks/gitleaks-action` (SHA acima). A versão do binário do
  scanner continua travada via `GITLEAKS_VERSION: 8.24.0` (sem prefixo
  `v`, conforme interface documentada da action). Semântica preservada:
  `fetch-depth: 0` + scan bloqueante em push/PR (`ci.yml`) e revalidação
  semanal do histórico completo (`gitleaks-scheduled.yml`, seg 06:00 UTC).
  Grafo de jobs inalterado: `gitleaks → ci → cf-build`
  (`migrations-from-zero` também depende só de `gitleaks`, em paralelo
  com `ci`).
- **Dependabot** (`.github/dependabot.yml`, novo): `npm` na raiz, semanal,
  minor+patch agrupados / majors desagrupados (um PR por major);
  `github-actions` semanal agrupado. **Sem auto-merge** — todo bump vira
  PR, roda o CI completo e exige review humano.
- **Gate `npm audit` existente** (job `ci`): `npm audit --omit=dev
  --audit-level=high` continua bloqueante antes de build/E2E.

## Procedimento de bump de action (SHA)

1. Escolha a nova tag (ex. `actions/checkout` v4.4.1) e resolva o SHA do
   **objeto commit** da tag — não o SHA da tag anotada
   (`git ls-remote` no repo da action ou API do GitHub).
2. Atualize o `uses:` + comentário `# vX.Y.Z` nos dois workflows.
3. Abra PR: o Dependabot (`github-actions`, semanal) também propõe esses
   bumps automaticamente — prefira o PR dele quando existir.
4. Merge só com CI verde (gitleaks + ci + migrations-from-zero + cf-build).
5. Atualize a tabela de SHAs no topo deste documento.

## Decisão SYN-CI-003 / Etapa 7.6 — estado real do E2E production-mode

Estado verificado em `.github/workflows/ci.yml` (step `Production-mode
E2E` + comentário de política): o E2E em modo produção (`next build` +
`next start` local + Playwright, **não** smoke contra produção real) é
**BLOQUEANTE** — sem `continue-on-error` nem condição de execução em
nenhum step do workflow (verificação por busca: nenhum
`continue-on-error` no arquivo). O comentário no workflow registra
política F1 (concluída 2026-09-14): bloqueante após estabilidade
comprovada (runs verdes a partir do 34846166474). **A hipótese do
Hardening V1 de que o E2E production-mode estaria condicionado/não
bloqueante foi superada pelos fatos**: o arquivo atual já o trata como
gate. Nenhuma mudança foi feita nesse step nesta etapa.
