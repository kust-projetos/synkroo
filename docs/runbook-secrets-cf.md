# Runbook: Secrets do Worker

> W4.5 — Documentação de secrets para deploy Cloudflare Workers.

---

## 1. Secrets obrigatórios

Cada Worker (instância de cliente) precisa dos seguintes secrets. Use `wrangler secret put` para provisionar.

| Secret | Tamanho mínimo | Descrição |
|---|---|---|
| `AUTH_SECRET` | ≥ 32 chars | Hash do NextAuth/JWT. Usado pelo middleware para validar sessões. |
| `JWT_SECRET` | ≥ 16 chars | Chave adicional para tokens JWT internos. |

### Comandos de provisionamento

```bash
# Gerar um valor aleatório de 64 chars
openssl rand -base64 48

# Provisionar no Worker
npx wrangler secret put AUTH_SECRET
# (colar o valor gerado)

npx wrangler secret put JWT_SECRET
# (colar o valor gerado)
```

---

## 2. Secrets por funcionalidade

Estes secrets são necessários apenas se a funcionalidade correspondente estiver ativa na instância.

| Secret | Funcionalidade | Descrição |
|---|---|---|
| `MINIMAX_API_KEY` | LLM / Agente IA | Chave da API MiniMax para o agente conversacional. |
| `OPENAI_API_KEY` | LLM (alternativa) | Chave da API OpenAI como fallback/provider alternativo. |
| `EVOLUTION_API_KEY` | WhatsApp | Chave da Evolution API para envio/recebimento de mensagens. |
| `WEBHOOK_SECRET` | Webhook WhatsApp/Instagram | Segredo usado para validar webhooks inbound (timingSafeEqual). |
| `CRON_SECRET` | Jobs agendados | Segredo para autenticar chamadas a `/api/cron/*`. |

### Comandos de provisionamento

```bash
npx wrangler secret put MINIMAX_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put EVOLUTION_API_KEY
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put CRON_SECRET
```

---

## 3. Variáveis de ambiente (não secrets)

Estas podem ser definidas no `wrangler.toml` `[vars]` ou via `wrangler secret put`:

| Var | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Postgres. Em Workers, o Hyperdrive (`env.HYPERDRIVE.connectionString`) substitui esta var — mas pode ser mantida como fallback para dev local. |
| `NEXT_PUBLIC_APP_URL` | URL pública da instância (ex.: `https://clinica.synkroo.com`). |
| `NEXT_PUBLIC_USE_MOCKS` | Se `"true"`, usa dados mock em dev. **NÃO** definir em produção. |

---

## 4. Modelo multi-instância

Cada clínica tem seu próprio Worker + secrets. O provisionamento é por instância:

```bash
# Exemplo: clínica "Sorriso Dental"
wrangler secret put AUTH_SECRET --env sorriso-dental
wrangler secret put JWT_SECRET --env sorriso-dental
# ...
```

Ou, usando Workers separados com um `wrangler.toml` por instância (recomendado para isolamento de dados — cada Worker = 1 DB Hyperdrive = 1 clínica).

---

## 5. Verificação pós-deploy

```bash
# Listar secrets do Worker
npx wrangler secret list

# Validar que o middleware está ativo (deve redirecionar para /login)
curl -I https://<worker-url>/dashboard

# Validar que o health check responde
curl https://<worker-url>/api/health
```
