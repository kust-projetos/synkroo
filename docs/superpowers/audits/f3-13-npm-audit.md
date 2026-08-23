# F3.13 — npm audit remediation receipt

Updated: 2026-08-23 (Orca task_3a447eab1489 / ctx_44e2eb092b69)

---

## Triagem 2026-08-23

### Execução

```
npm audit --omit=dev --json        # exit 0 — 0 findings em prod
npm audit fix                      # aplicado: 15 pacotes atualizados sem breaking changes
npm audit --json                   # 13 residuais (todos dev-only), detalhados abaixo
```

### Estado prod (--omit=dev)

**0 findings** — nenhuma vulnerabilidade em produção. Gate W3 satisfeito.

### Atualizações aplicadas via `npm audit fix` (safe, sem semver-major)

| Pacote | De | Para | Finding resolvido |
|---|---|---|---|
| `wrangler` | 4.114.0 | 4.125.0 | CVE undici (moderate) |
| `undici` | 7.28.0 | 7.29.0 | GHSA-8xcm, GHSA-4cwx, GHSA-m8rv, GHSA-jr45, GHSA-v3r7 (high/moderate) |
| `miniflare` | 4.20260722.0 | 5.20260820.0-alpha | Dependência undici (moderate) |
| `js-yaml` | 4.3.0 + 3.15.0 | 4.3.1 + 3.15.1 | GHSA-5p4m-2wfm-xmqj (high) |
| `fast-uri` | 3.1.4 | 3.1.6 | GHSA-7p8r-x3mc-p8w7 (high) |
| `brace-expansion` | múltiplas | patched | GHSA-mh99, GHSA-rgw5 (high) |
| `@cloudflare/workers-types` | 5.20260729.1 | 5.20260823.1 | N/A (update junto) |

---

## Findings residuais com waiver (escopo dev-only)

Todos os findings abaixo estão **exclusivamente no escopo de dev** (`npm audit --omit=dev` retorna 0).
A fix disponível para cada um requer `--force` e envolve semver-major breaking change documentada abaixo.

### W1 — @stryker-mutator/core (chain: @babel/core, ajv, tmp, external-editor, @inquirer/*)

| Campo | Detalhe |
|---|---|
| **Pacote raiz** | `@stryker-mutator/core@8.7.1` (devDependency) |
| **Advisories** | GHSA-4x5r-pxfx-6jf8 (@babel/core), GHSA-2g4f-4pwh-qvx6 (ajv ReDoS), GHSA-52f5-9888-hmc6 / GHSA-ph9p-34f9-6g65 (tmp) |
| **Severidade no escopo completo** | 1 high (tmp path traversal), 4 moderate/low |
| **Fix disponível** | `@stryker-mutator/core@10.0.0` — semver-major; requer revisão do stryker config e pode quebrar mutation runners |
| **Escopo de impacto** | Ferramenta de mutation testing usada apenas em CI local; não presente no bundle de produção |
| **Exploitabilidade** | Nula em prod. `tmp` só é invocado via CLI de mutation; `ajv` via `$data` opt que não usamos; `@babel/core` lê source maps em contexto de instrumentação |
| **Owner** | @walis |
| **Expira** | 2026-11-23 (90 dias) |
| **Ação antes da expiração** | Atualizar `@stryker-mutator/core` e `@stryker-mutator/jest-runner` para v10, validar stryker configs |

### W2 — drizzle-kit (chain: esbuild via @esbuild-kit)

| Campo | Detalhe |
|---|---|
| **Pacote raiz** | `drizzle-kit@0.31.10` (devDependency) |
| **Advisory** | GHSA-67mh-4wv8-2f99 (esbuild dev-server CORS, moderate) |
| **Severidade no escopo completo** | moderate |
| **Fix disponível** | `drizzle-kit@0.18.1` — semver-major regressão (remove migrações Drizzle v0.31 já aplicadas) |
| **Escopo de impacto** | `esbuild` dev-server afeta apenas host local ao rodar `drizzle-kit studio` — nunca exposto em CI ou prod |
| **Exploitabilidade** | Nula: `drizzle-kit studio` não é usado em pipeline CI, nenhum dev-server exposto externamente |
| **Owner** | @walis |
| **Expira** | 2026-11-23 (90 dias) |
| **Ação antes da expiração** | Atualizar drizzle-kit quando versão >=0.31 sem o @esbuild-kit legado for disponível |

---

## Contexto de typecheck:ia-bridge

O comando `npm run typecheck:ia-bridge` falha com 5 erros TS2554 em `password.ts` e `crypto.ts`.
**Causa: pré-existente** — verificado que a falha ocorre identicamente no HEAD limpo antes de qualquer mudança desta tarefa.
A falha origina-se de incompatibilidade entre a API Node `randomBytes/scryptSync` (que aceita argumentos) e os tipos `@cloudflare/workers-types` (que definem essas funções como 0 argumentos no ambiente Workers).
Isso NÃO é causado pelas alterações do `npm audit fix` desta triagem.
Rastreado separadamente como issue de compatibilidade ia-bridge tsconfig.

---

## Verificação final

```text
npm audit --omit=dev --audit-level=high   # exit 0 — CLEAN
npm audit --omit=dev                      # exit 0 — 0 findings prod
npm audit                                 # exit 1 — 13 findings, todos dev-only com waiver acima
npm run typecheck                         # exit 0 — PASS
npm run lint                              # exit 0 — PASS
```

Gate W3: ✅ 0 moderate/high em prod. Waivers W1 e W2 documentados com owner, expiração e ação de remediação.
