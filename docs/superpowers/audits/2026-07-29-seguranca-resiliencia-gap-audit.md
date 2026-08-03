# Segurança e Resiliência — Gap Audit (REQ-SEC-01 a 06)

**Data:** 2026-07-29  
**Escopo:** código, migrations, histórico Git local, CI, testes e ambiente local.

## Requirements

| REQ | Status | Evidência local |
|---|---|---|
| SEC-01 | ✅ | Rotas de domínio passam por `withModuleRoute` + `runActionRoute`/adapter; `buildUserContext` carrega perfil ativo, RBAC e módulos; handlers de webhook/seed usam segredo/assinatura própria. |
| SEC-02 | ⚠️ externo | CI e pre-commit executam Gitleaks sobre tree + histórico; histórico local saneado conforme inventário. Rotação de credenciais, invalidação de clones/forks e force-push remoto não são executáveis sem owner/remote. |
| SEC-03 | ✅ | `src/middleware.ts` rejeita `Content-Length > 1 MiB` antes do handler; Actions usam Zod; guards de payload têm testes; mensagens limitam conteúdo. |
| SEC-04 | ✅ | `scripts/seed-local-scale.ts` é import-safe, dry-run por default, exige `--apply`, restringe aplicação a PostgreSQL loopback e persiste em transaction; testes cobrem parsing, dry-run e apply. |
| SEC-05 | ✅ local | `users.session_version` é inteiro; migration `0011_session_version_integer.sql`; login/Auth.js carregam versão; `getUserProfile` rejeita token obsoleto; alteração de acesso e desativação incrementam versão em DB. |
| SEC-06 | ✅ | `src/middleware.ts` chama `shouldRejectCsrf` antes de autenticação/handler e devolve 403 para mutação cookie-authenticated sem Origin/Referer same-origin; teste de integração cobre o middleware. |

## Verification evidence

| Gate | Resultado |
|---|---|
| `npm run db:health` | ✅ Database healthy |
| `npm run db:migrate` | ✅ migrations aplicadas; `session_version` convertido para integer |
| `npm run typecheck` | ✅ sem erros |
| Focused security/auth suite | ✅ 5 suites, 32 tests passed |
| Full Jest suite | ✅ 209 suites, 1.493 tests passed, 5 skipped |
| `npm audit --omit=dev --audit-level=high` | ✅ 0 high/critical; 1 low esbuild advisory remains, no release-blocking severity; Next/PostCSS/sharp atualizados/forçados por override |
| `npm run db:seed:scale -- --dry-run` | ✅ large preset, 2.000 patients/5.000 appointments planejados, sem writes |
| Gitleaks histórico local | ✅ zero findings no histórico saneado; suppressions restritas a fixtures/documentação comprovados |
| Staging J-10/J-11/J-12 | ⏸️ sem URL/credenciais/segredos de staging neste ambiente |

## J-10/J-11/J-12 status

| Jornada | Evidência disponível | Gap restante |
|---|---|---|
| J-10 recuperação/fault injection | fault injection local executado: 4 suites/24 testes; bridge, binding, DO exception/hang, LLM failure, Evolution indisponível e DB unhealthy cobertos; `db:health` saudável | executar com Evolution/LLM/DB/sidecar desligados em staging e anexar logs nominais |
| J-11 import dry-run/apply/replay/rollback | dry-run e transaction testados localmente | executar apply, replay e rollback em staging |
| J-12 export/revogação/destruição | export com escopo/redaction (`redactPII`) e revogação local testados | executar export, revogação e destruição sob retenção em staging |

### Evidência nominal — J-10 local

Comando:

```text
npx jest --runInBand --no-coverage src/core/ia-channel/__tests__/agent-invoker.test.ts src/core/ia-agent/__tests__/orchestrator-failures.test.ts src/modules/atendimento/services/__tests__/channel.test.ts src/__tests__/api/health/route.test.ts
```

Resultado: **4 suites passed, 24 tests passed**, 11,32 s. Os cenários incluem `issueHandle` com erro, binding `AGENT` ausente, `runTurn` com exceção, RPC travado com timeout/fallback, completion LLM vazia/argumentos inválidos, Evolution indisponível/erro de envio e banco indisponível retornando health `unhealthy`. `npm run db:health` também retornou `Database healthy`.

Esta é evidência local de recuperação; não é evidência de staging. J-10 permanece pendente no contrato externo.

### Evidência nominal — J-11 local

- `npx tsx scripts/seed-local-scale-data.ts --preset small --dry-run --seed=1337`: dry-run concluído sem writes; plano de 200 pacientes/500 appointments e dados suplementares emitido.
- Harness de `scripts/seed-local-scale.ts` com `buildFixture` small/seed 1337: **2 transactions**, aplicação repetida com o mesmo plano (`replaySamePlan: true`), ownership por `clinic-real`, delete antes de upsert.
- `npm run db:health`: `Database healthy (via DATABASE_URL)`.

A aplicação/replay demonstrados são locais e o harness não substitui rollback real em staging; J-11 externo permanece pendente.

### Evidência nominal — J-12 local

Comando:

```text
npx jest --runInBand --no-coverage src/services/contacts/__tests__ src/__tests__/api/lgpd/anonymize/route.test.ts src/__tests__/api/lgpd/export/route.test.ts src/__tests__/api/reports/export/route.test.ts
```

Resultado: **6 suites passed, 35 tests passed**, 3,51 s. Inclui consent grant/revoke, autenticação, exportação com escopo de clínica/consents, anonimização com audit log e relatórios CSV.

Esta é evidência local de export/revogação; não comprova destruição sob retenção nem execução em staging. J-12 externo permanece pendente.

## Remaining blockers

1. **Staging:** executar J-10 recovery/fault injection, J-11 import apply/replay/rollback e J-12 export/revogação/destruição contra staging provisionado.
2. **SEC-02:** owner deve revogar/rotacionar credenciais históricas, invalidar clones/forks e atualizar remote canônico após saneamento.

## Atualização — Infraestrutura externa provisionada

### OpenCode Zen (LLM)
`OPENCODE_ZEN_API_KEY` configurada em `src/workers/ia-agent/.dev.vars`. Wrangler config (`vars`) já possui `IA_LLM_BASE_URL` e `IA_LLM_MODEL`. Para deploy: `wrangler secret put OPENCODE_ZEN_API_KEY`.

### Evolution API (WhatsApp) na VPS
| Item | Status |
|---|---|
| Docker evolution-go v0.7.2 | ✅ Rodando 5 semanas |
| Instância "Testes Synkroo" (ted) | ✅ Connected=true, LoggedIn=true |
| Auth | Instance token `d602c031-*` via header `apikey` |
| Endpoints corretos | `/send/text` (POST), `/instance/status` (GET) |
| Traefik routing | `evo.synkroo.com.br` → evolution-go:4000 via proxy network |

`evolution-service.ts` atualizado para Evolution Go v0.7.2 (endpoints `/send/text`, `/send/media`, `/instance/status`). `tsc --noEmit` limpo, 30 testes passando.

## Atualização — validação do deploy Cloudflare (2026-07-30)

- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm run build:cf`: passou; OpenNext gerou `.open-next/worker.js`.
- `npx wrangler deploy --config wrangler.toml --dry-run --env=""`: passou e validou ASSETS, Hyperdrive, KV, Vectorize, IA_BRIDGE e AGENT.
- O `wrangler.toml` foi corrigido de `pages_build_output_dir` para `main = ".open-next/worker.js"` + `[assets]`; o deploy anterior como Pages produzia previews 404 porque `.open-next` não é diretório estático de Pages.
- `npx wrangler deploy --config wrangler.toml --env=""` foi tentado, mas o upload foi rejeitado pela conta Cloudflare no plano atual: bundle de **22.455 KiB**, limite de **3 MiB** (erro API `10027`).
- Os Workers `synkroo-ia-agent` e `synkroo-ia-bridge` continuam com deployments ativos; o app principal `synkroo` não foi atualizado por causa do limite de tamanho.

### Pesquisa de alternativas

Fontes oficiais consultadas em 2026-07-30:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/): Worker comprimido limitado a 3 MiB no Free e 10 MiB no Paid; recomenda remover dependências, mover dados/ativos para bindings e dividir funcionalidades por Service Bindings.
- [OpenNext Cloudflare](https://opennext.js.org/cloudflare): confirma os limites de 3/10 MiB e mostra que o bundle comprimido é o valor aplicado.
- [OpenNext multi-worker](https://opennext.js.org/cloudflare/howtos/multi-worker): divisão é avançada, exige deploy manual por Worker e não suporta Preview URLs — portanto não atende bem ao staging J-10/J-11/J-12.
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/): Workers Paid tem cobrança mínima de US$5/mês por conta; Pages Functions também são cobradas como Workers.

**Recomendação:** ativar Workers Paid é o caminho de menor risco: o bundle atual de 4,07 MiB comprimido cabe no limite de 10 MiB sem refatorar o monólito Next/OpenNext. Redução de bundle ou multi-worker deve ser um projeto posterior; não é uma correção segura de staging imediato.

### Atualização — deploy após upgrade (2026-07-31)

- Deploy concluído: `synkroo` versão `279a9b54-b7ee-48ae-bc4b-da7592bcba5b`.
- URL pública: `https://synkroo.walissonead.workers.dev`.
- `GET /` e `GET /login`: HTTP 200; OpenNext/Next.js respondendo no Worker.
- `GET /api/auth/session`: HTTP 200, sessão anônima correta.
- `GET /api/health`: HTTP 503 com `status: unhealthy`; o Worker alcança a rota, mas a consulta Hyperdrive falha.
- `GET /api/health/db`: HTTP 200, porém 0/16 tabelas detectadas. O deploy não substitui a migração/provisionamento do banco de staging.
- O ambiente atualmente usa o Worker `synkroo` e o Hyperdrive `synkroo-db`; não existe configuração isolada `env.staging`.
- A connection string Neon foi disponibilizada localmente em `.env.neon` sem ser exibida. O banco existente tinha schema legado não registrado no ledger Drizzle; foi criada uma marca de baseline até `0007` e o migrator Drizzle aplicou `0008`–`0011`, deixando `users.session_version` inteiro e as tabelas novas presentes. O `drizzle-kit migrate` continua encerrando com falha silenciosa nesse banco legado, enquanto o migrator direto e o health remoto confirmam o schema.
- Os secrets ausentes foram configurados seletivamente no Worker: `AUTH_SECRET`, `JWT_SECRET`, `WEBHOOK_SECRET`, `CRON_SECRET`, `SEED_SECRET`, credenciais Evolution e `AUTH_URL`; `AUTH_SECRET`/`JWT_SECRET` foram gerados novos com 48 bytes porque os valores locais tinham apenas 31 caracteres.
- O build foi repetido com `NEXTAUTH_URL=https://synkroo.walissonead.workers.dev` para impedir que `localhost:3004` fosse embutido nos cookies Auth.js. O cookie agora usa `__Host-next-auth.csrf-token` e callback URL HTTPS correto.
- Deploy final antes do último patch: versão `0558465b-89bd-41dc-92e1-619ffd123f6c`; depois dele, o `/api/health` passou a HTTP 200 e `/api/health/db` confirmou 16/16 tabelas.
- Correção adicional preparada: o wrapper OpenNext agora injeta `env.HYPERDRIVE.connectionString` em `globalThis` antes dos handlers; páginas `/dashboard/contatos` e `/dashboard/financeiro` são `force-dynamic`; login/logout/troca de clínica usam cookie `__Secure-next-auth.session-token` em produção. Build e testes locais passam.
- Três tentativas do deploy final retornaram HTTP 522 da API Cloudflare (`workers/services/synkroo`/`workers/scripts/synkroo/deployments`); o patch de cookie ainda aguarda nova tentativa de upload.

## Verdict

**BLOQUEADO 🚫** — deploy do Worker resolvido após upgrade. J-10/J-11/J-12 continuam bloqueados até existir banco de staging isolado, com migrations aplicadas e credenciais/URL de teste; não é seguro executar os cenários destrutivos no Hyperdrive atualmente configurado.
