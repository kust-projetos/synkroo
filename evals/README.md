# evals/

Regressão da configuração do agente. Roda quando `CLAUDE.md`, `.claude/**` ou skills mudam.

- 20–50 tarefas reais já resolvidas, com resultado aceito.
- Cada eval = `NNN-<slug>.json`: `prompt` + `allowedTools` + `checks[]` (comandos determinísticos: teste, lint, comportamento).
- Incidente de produção corrigido → vira eval de regressão.
- Skill/regra que derruba pass rate é revisada antes do merge.

Rodar um: `bash evals/check.sh evals/001-exemplo.json`
Rodar todos no CI: `evals/agent-evals.yml` (copiar para `.github/workflows/`).
