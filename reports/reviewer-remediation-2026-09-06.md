# Revisão independente das remediações P1 — validação final — 2026-09-06

**Papel:** Reviewer independente (Coder 1 + Coder 2)

**Status de código/conformidade:** **100% SANADO**

**Parecer:** **GO técnico condicionado somente às etapas operacionais externas**

A validação final confirma o fechamento dos dois últimos apontamentos de scripts do Coder 2. Em `scripts/migrate-vps.ts`, o staging não reutiliza mais `prodPassword`, a credencial é exigida de forma separada e `--target` inválido é rejeitado estritamente. Em `scripts/update-hyperdrive.ts`, a execução usa `stdio: 'pipe'`, captura stdout/stderr e aplica `redactSecrets` antes de qualquer saída ou erro chegar ao terminal. Os quatro gates locais também estão verdes.

Não há apontamento de código ou conformidade pendente nesta revisão. Restam somente etapas operacionais externas: validar conectividade/autorização no VPS e Hyperdrive, executar o deploy de staging e realizar os smoke tests autorizados no ambiente publicado.

## Método e limites

- Leitura independente do worktree atual, dos scripts e dos schemas reais.
- Nenhum deploy, migration remoto, alteração de segredo ou operação contra VPS/Hyperdrive foi executado pelo Reviewer.
- A validação local confirma contratos, tipos, lint e testes; não substitui a execução operacional autorizada nos ambientes externos.
- Nenhum segredo ou valor de credencial foi reproduzido neste relatório.

## Evidência de execução

| Comando | Resultado |
|---|---|
| `npm run typecheck` | **PASS**, `tsc --noEmit` terminou com exit code 0 |
| `npm run lint` | **PASS**, ESLint sem diagnósticos |
| `npm run test:release` | **PASS**, 38/38 testes |
| `npm run roadmap:check` | **PASS**, 143/143 únicos; VERIFIED=126, EXTERNAL=14, DEFERRED=3 |

## Fechamento dos apontamentos do Coder 2

### 1. `scripts/migrate-vps.ts`

**Status: SANADO.**

- `stagingPassword` vem exclusivamente de `VPS_STAGING_PASSWORD` no ambiente do processo ou no `.env` privado; não existe fallback para `prodPassword` (`scripts/migrate-vps.ts:107-110`).
- `--target` aceita somente `production`, `staging` ou `all`; qualquer outro valor lança erro explícito (`scripts/migrate-vps.ts:112-117`).
- A ausência de `VPS_POSTGRES_PASSWORD` bloqueia `production`/`all`, e a ausência de `VPS_STAGING_PASSWORD` bloqueia `staging`/`all` (`scripts/migrate-vps.ts:120-125`).
- A inspeção estática não encontrou literais de host, porta ou senha nos scripts de operação revisados.

### 2. `scripts/update-hyperdrive.ts`

**Status: SANADO.**

- A chamada ao Wrangler usa `execSync(command, { stdio: 'pipe', encoding: 'utf8' })`; stdout não é herdado diretamente (`scripts/update-hyperdrive.ts:49-55`).
- stdout de sucesso é convertido e passado por `redactSecrets` antes de `console.log` (`scripts/update-hyperdrive.ts:53-55`).
- stdout e stderr de falhas do processo filho são coletados, incorporados ao diagnóstico e redigidos com as credenciais conhecidas antes do erro ser relançado (`scripts/update-hyperdrive.ts:56-65`).
- O catch final também redige a mensagem antes de `console.error` (`scripts/update-hyperdrive.ts:110-116`).

## Matriz de aceite

| Área | Veredicto | Evidência | Observação |
|---|---|---|---|
| Data calendário | **PASS local** | `isValidCalendarDate` em `scripts/import-client-data.mjs`; testes do importador | Datas impossíveis são rejeitadas pela comparação dos componentes UTC. |
| CSV quoted/RFC 4180 | **PASS local** | `parseCsvContent` em `scripts/import-client-data.mjs`; testes de release | O fluxo parseia o conteúdo inteiro, suporta vírgulas, `""`, LF/CRLF multiline, linha final sem newline e rejeita quoting inválido. |
| `--apply` patients | **PASS local** | `importClientData` e testes com fake client | Persiste `opt_out_marketing`, `opt_out_at` e `legal_hold=true`/razão em insert e update. |
| `--apply` consents | **PASS local** | `importClientData` e testes com fake client | Faz insert/update de `granted`, `revoked_at` e `version` com escopo da clínica. |
| `--apply` audit log | **PASS local/contrato** | `INSERT INTO audit_logs`; `src/core/schema/infra.ts` | Usa `clinic_id`, `action`, `entity_type`, `entity_id`, `new_values` e `created_at`; os metadados não carregam PII. A confirmação PostgreSQL real é etapa operacional externa. |
| Transação/replay/rollback | **PASS local limitado** | Testes do importador | `BEGIN/COMMIT/ROLLBACK`, replay e falha de insert passam nos testes; a execução real no VPS permanece pendente. |
| GET `/api/contacts?type=` | **PASS local** | Rota de contatos e testes CRM | `patient`/`lead` são encaminhados à action e tipo desconhecido é sanitizado. |
| Alternância de abas CRM | **PASS local** | `contact-list-panel-readonly.test.tsx` | Há cobertura de Pacientes, Leads e Todos. |
| Logs do resolver | **PASS** | `resolve-channel-installation.ts` e testes | Mensagens, stacks e DSNs injetados não vazam. |
| Quota inbound pre-auth | **PASS local** | Rota inbound e testes de segurança | Somente instalação válida consome bucket tenant-scoped. |
| HMAC timing-safe | **PASS nos webhooks HMAC nomeados** | WhatsApp, Instagram e resolver | Assinaturas usam `timingSafeEqual` após guard de tamanho. |
| Credenciais e targets dos scripts | **PASS estático / SANADO** | `setup-staging-db.ts`, `migrate-vps.ts`, `update-hyperdrive.ts` | Sem literais de host/porta/senha; staging separado e target inválido rejeitado. |
| Redação do updater Hyperdrive | **PASS estático / SANADO** | `update-hyperdrive.ts:35-65,110-116` | stdout, stderr e mensagens de erro passam por `redactSecrets`; child output não é herdado. |
| Conectividade VPS/Hyperdrive | **PENDENTE EXTERNO** | Não executada nesta revisão | Requer credenciais/autorização e execução operacional fora do Reviewer. |
| Deploy e smoke de staging | **PENDENTE EXTERNO** | Não executados nesta revisão | Requer publicar a versão e validar liveness/readiness/webhooks no ambiente autorizado. |

## Pendências operacionais externas

1. Confirmar conectividade e autorização do PostgreSQL no VPS.
2. Aplicar/validar a configuração do Hyperdrive em staging e produção conforme o procedimento operacional autorizado.
3. Executar o deploy de staging.
4. Repetir smoke de liveness/readiness, webhook assinado e webhook inválido no staging publicado, sem registrar credenciais.
5. Anexar receipts sanitizados das operações externas; nenhuma alteração adicional de código é requerida por esta revisão.

## Conclusão

**100% dos apontamentos de código e conformidade estão SANADOS.** O resultado técnico é **GO condicionado exclusivamente às etapas operacionais externas** de conectividade VPS/Hyperdrive, deploy de staging e smoke pós-publicação; não há bloqueador de código residual identificado nesta revisão.
