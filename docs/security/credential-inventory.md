# Inventário de Credenciais Expostas

**Data:** 2026-07-29
**Fase:** 0 — contenção de incidente
**Status:** classificação concluída; rotação pendente (owner)

## Legenda

| Classificação | Significado |
|---|---|
| `confirmed` | Credencial real vazada — requer rotação imediata |
| `test` | Fixture/mock de teste — valor placeholder, não funcional |
| `false-positive` | Documentação/exemplo — sem credencial real |

---

## CONFIRMED — GitHub PATs

| # | Fingerprint | Arquivo | Commit | Linha | Ação Owner |
|---|---|---|---|---|---|
| C01 | `github-fine-grained-pat:1` | `.open-next/cloudflare/next-env.mjs` | `359dce6` | 1 | Rotacionar GH_TOKEN — GitHub → Settings → Developer settings → PAT |
| C02 | `github-fine-grained-pat:2` | `.open-next/cloudflare/next-env.mjs` | `359dce6` | 2 | Rotacionar GITHUB_TOKEN (mesmo valor de C01) |
| C03 | `generic-api-key:*` | `.open-next/cloudflare/next-env.mjs` | `359dce6` | — | Contém GH_ORG_TOKEN + GITHUB_ORG_TOKEN (2 PATs adicionais) |

**Risco:** Acesso total ao GitHub (repos, workflows, secrets). Revogar imediatamente.

## CONFIRMED — Supabase

| # | Fingerprint | Arquivo | Commit | Linha | Ação Owner |
|---|---|---|---|---|---|
| C04 | `jwt:1` | `.open-next/cloudflare/next-env.mjs` | `359dce6` | 1 | Rotacionar NEXT_PUBLIC_SUPABASE_ANON_KEY no dashboard Supabase |
| C05 | `jwt:2` | `.open-next/cloudflare/next-env.mjs` | `359dce6` | 2 | Rotacionar SUPABASE_SERVICE_ROLE_KEY (crítico — bypass RLS) |
| C06 | `jwt:6` | `scripts/seed-e2e-data.js` | `7ba34ec` | 6 | Mesma SERVICE_ROLE_KEY de C05 hardcoded como fallback |
| C07 | `jwt:11` | `scripts/seed-scale-data.js` | `ce6348b` | 11 | Mesma SERVICE_ROLE_KEY de C05 hardcoded |
| C08 | `jwt:4` | `scripts/seed-e2e-clinic.js` | `dda6bee` | 4 | JWT de seed; verificar se é derivado da mesma chave |

**Risco:** SERVICE_ROLE_KEY exposta = bypass total de Row Level Security. ANON_KEY exposta = acesso público ao projeto Supabase.

## CONFIRMED — LLM API Keys

| # | Fingerprint | Arquivo | Commit | Linha | Ação Owner |
|---|---|---|---|---|---|
| C09 | `generic-api-key:2` | `api-glm.bat` | `67f72ab` | 2 | Rotacionar token GLM (api.z.ai) |
| C10 | `generic-api-key:2` | `api-minimax.bat` | `67f72ab` | 2 | Rotacionar token MiniMax (api.minimax.io) |
| C11 | `generic-api-key:2` | `api-nemotron.bat` | `9b79dc2` | 2 | Rotacionar token OpenRouter (cc.yovy.app) |

**Risco:** Consumo de créditos via API keys expostas. Revogar/rotacionar em cada provider.

## CONFIRMED — Build Artifacts (.open-next/)

| # | Fingerprint | Arquivo | Commit | Ação Owner |
|---|---|---|---|---|
| C12 | `generic-api-key:*` + `private-key:*` | `.open-next/middleware/handler.mjs` | `359dce6`, `8447795`, `dd8422b` | Conteúdo é build artifact com secrets inlined. Remover do histórico junto com C01-C05. |
| C13 | `generic-api-key:*` | `.open-next/server-functions/default/handler.mjs` | `359dce6`, `8447795`, `dd8422b` | Mesmo caso de C12 |
| C14 | `generic-api-key:*` | `.open-next/server-functions/default/index.mjs` | `359dce6`, `8447795`, `dd8422b` | Mesmo caso de C12 |

**Risco:** Build artifacts contêm todas as env vars em texto plano (GitHub PATs + Supabase + DB URL + AUTH_SECRET + JWT_SECRET).

---

## TEST — Fixtures de Teste

| # | Arquivo | Fingerprint | Justificativa |
|---|---|---|---|
| T01 | `src/components/pi-finance/__tests__/pi-finance-app.test.tsx:12` | `generic-api-key` | Mock de API key para teste unitário (Pi Finance) |
| T02 | `src/components/pi-finance/__tests__/slice-c-drilldowns.test.tsx:81,86` | `generic-api-key` | Mock de API key para teste unitário (Pi Finance) |
| T03 | `src/lib/pi-finance/seed.ts:7` | `generic-api-key` | Seed data do Pi Finance — valores placeholder |
| T04 | `src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts:170` | `stripe-access-token` | Mock Stripe token (`sk_test_...`) |
| T05 | `src/modules/financeiro/actions/__tests__/financeiro-actions.test.ts:289,299,306,307` | `stripe-access-token` | Mock Stripe tokens — valores de teste |
| T06 | `src/modules/followup/__tests__/cron/integration.test.ts:17,20` | `generic-api-key` | API key placeholder para teste de integração |
| T07 | `src/repositories/auth/__tests__/integration.test.ts:44,45` | `generic-api-key` | API key placeholder para teste de integração |

**Nota:** Pi Finance é projeto separado conforme spec canônica §2 (Fora da v1). Remover da árvore na Fase 4.

---

## FALSE-POSITIVE — Documentação e Exemplos

| # | Arquivo | Fingerprint | Justificativa |
|---|---|---|---|
| F01 | `docs/CONFIGURACAO-LEMBRETES.md:62,67` | `curl-auth-header` | Exemplo de curl com token placeholder |
| F02 | `docs/GUIA-CONFIGURACAO.md:176,184` | `curl-auth-header` | Exemplo de curl com token placeholder |
| F03 | `docs/DATABASE_SETUP.md:37,38` | `generic-api-key` | Template de configuração com valores exemplo |
| F04 | `docs/supabase-setup.md:42,43` | `generic-api-key` | Template de configuração Supabase |
| F05 | `docs/superpowers/plans/2026-06-19-fechamento-fundacao-rbac.md:139` | `generic-api-key` | Documento de plano — referência a token |
| F06 | `scripts/setup-env.sh:17,62` | `generic-api-key` | Script de setup com placeholders |
| F07 | `.github/workflows/ci.yml:40` | `jwt` | CI placeholder (`fake-jwt-secret-for-ci`) — não funcional |

---

## Resumo

| Classificação | Contagem |
|---|---|
| CONFIRMED (requer rotação) | 14 |
| TEST (fixtures) | 7 |
| FALSE-POSITIVE (docs) | 7 |
| **Total classificado** | **28** |

## Ações pendentes do owner

1. **IMEDIATO:** Revogar GitHub PATs (C01-C03) em https://github.com/settings/tokens
2. **IMEDIATO:** Revogar Supabase keys (C04-C08) no dashboard Supabase → Project Settings → API
3. **IMEDIATO:** Revogar API keys LLM (C09-C11) em cada provider (GLM, MiniMax, OpenRouter)
4. Rotacionar AUTH_SECRET e JWT_SECRET (expostos nos build artifacts)
5. Rotacionar DATABASE_URL credentials
6. Coordenar sanitização do histórico Git (BFG/git-filter-repo) para remover commits `359dce6`, `67f72ab6`, `9b79dc21`, `7ba34ec`, `ce6348b`, `dda6bee`, `8447795`, `dd8422b`
7. Verificar forks do GitHub, Actions logs, artifacts e caches
8. Invalidar clones antigos após sanitização

## Ações concluídas (agente)

- [x] Classificação de todas as entradas do `.gitleaksignore`
- [x] Criação deste inventário
- [ ] `.gitleaks.toml` com regras específicas
- [ ] Remoção de suppressions `confirmed` do `.gitleaksignore`
- [ ] Pre-commit hook Gitleaks
- [ ] CI job Gitleaks bloqueante
