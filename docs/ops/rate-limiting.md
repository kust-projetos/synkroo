# Rate limiting — Synkroo (Etapa 10.4)

Util canônico: `src/lib/rate-limit.ts` (store **in-memory** por instância,
limpeza a cada 60 s — `rate-limit.ts:18-30`). Resposta 429 canônica:
`apiRateLimited(requestId, retryAfter, message)` em
`src/lib/api/response.ts:104-112` — envelope `{ error: { code:
'TOO_MANY_REQUESTS', message, requestId } }` com `Retry-After` **só no
header**, nunca no body (ADR-BASE-10).

## Presets (`rate-limit.ts:125-140`)

| Preset | Janela | Máximo | Uso |
|---|---|---|---|
| `auth` | 60 s | 10 req | login, signup, change-password, widget/session |
| `messages` | 60 s | 30 req | envio de mensagens, widget/messages, ia/chat |
| `api` | 60 s | 60 req | CRUD padrão, knowledge/search, lgpd/export |
| `webhook` | 60 s | 100 req | webhooks inbound (WhatsApp/Instagram/generic) |
| `cron` | 60 s | 20 req | jobs `/api/cron/*` (chave fixa `'cron'`) |

## Tabela endpoint × preset × limite × chave

| Endpoint | Preset | Limite | Chave do bucket | Ordem |
|---|---|---|---|---|
| `POST /api/auth/login` (stub; credencial real no NextAuth) | `auth` | 10/min | IP (`getClientIdentifier`) | limiter → 404 stub |
| `POST /api/auth/signup` (fora de prod) | `auth` | 10/min | IP | 404-prod → limiter → lógica |
| `POST /api/auth/change-password` | `auth` | 10/min | IP | limiter → auth (pré-existente) |
| `POST /api/widget/session` | `auth` (`keyPrefix: widget-session`) | 10/min | IP | origin/install/token → limiter |
| `POST /api/widget/messages` | `messages` (`keyPrefix: widget-message`) | 30/min | `installationId:IP` | token → limiter |
| `POST /api/messages/send` | `messages` | 30/min | IP | limiter → auth da action |
| `POST /api/messages/inbound` | `webhook` (`keyPrefix: msg-inbound`) | 100/min | `tenant:clinicId` | webhook-secret → limiter |
| `POST /api/whatsapp/webhook` | `webhook` (`keyPrefix: wa-webhook`) | 100/min | IP | assinatura → limiter (estouro vira `200 ignored`, sem retry do provider) |
| `POST /api/instagram/webhook` | `webhook` (`keyPrefix: ig-webhook`) | 100/min | IP | assinatura → limiter |
| `POST /api/ia/chat` | `messages` (`keyPrefix: ia-chat`) | 30/min | `user:userId` | sessão + RBAC `ia:chat` → limiter |
| `POST /api/knowledge/search` | `api` (`keyPrefix: knowledge-search`) | 60/min | `tenant:clinicId` | auth → limiter |
| `POST /api/lgpd/export` | `api` (`keyPrefix: lgpd-export`) | 60/min | `user:userId` | contexto → limiter (ctx reaproveitado no `runAction`) |
| `GET/POST /api/appointments` | `api` | 60/min | IP | limiter → auth |
| `GET/POST /api/patients` | `api` | 60/min | IP | limiter → auth |
| `POST /api/waitlist` (+ `fill`) | `api` (`keyPrefix: waitlist-create` / `waitlist-fill`) | 60/min | IP | limiter → auth |
| `POST /api/cron/{smart-triggers,reminders,crm-duplicates}` | `cron` | 20/min | chave fixa `'cron'` | `CRON_SECRET` → limiter |

## Convenção de ordem

- **Auth antes do limiter** — transports com credencial prévia
  (cron via `CRON_SECRET`, webhooks via assinatura/secret, widget via token)
  e rotas com sessão (`ia/chat`, `knowledge/search`, `lgpd/export`):
  credencial inválida **nunca consome quota** legítima.
- **Limiter antes da auth** — rotas onde a autenticação vive dentro da
  action/adapter (`appointments`, `patients`, `messages/send`) ou legado
  (`change-password`): segue o padrão pré-existente dessas rotas.

## LIMITAÇÃO CONHECIDA (decisão registrada, sem implementar agora)

O store é **in-memory por instância/isolado** (`rate-limit.ts:18`).
No OpenNext/Cloudflare (SYN-CF-003) cada isolado tem memória própria, logo
sob múltiplas instâncias o limite efetivo é **N × configurado**. Isso é
aceitável para abuso casual e contenção de custo de IA/busca, mas **não é**
proteção anti-DDoS distribuída.

**Decisão:** migrar para limitador distribuído (Durable Object ou KV) somente
quando houver evidência de necessidade (múltiplas instâncias em prod com
abuso real). Ver `docs/ops/cloudflare-runtime-checklist.md` (item rate
limiting) e `docs/ops/observability.md` (alertas) para os sinais que disparam
essa migração: taxa de 429 por rota/5min, custo IA/hora, falhas de webhook.

## Lacunas conhecidas (fora do escopo desta etapa)

- `POST /api/lgpd/anonymize` — sem limiter (mesmo perfil de `export`;
  candidato natural ao preset `api` com chave por usuário).
- `POST /api/cron/{cleanup,outbox,hot-leads,followups,financeiro-collections}`
  — sem limiter (só 3 das 8 rotas cron têm preset `cron`).
- `[...nextauth]` (credencial real de login, `src/app/api/auth/[...nextauth]/route.ts`)
  — handler framework-owned, sem limiter na camada de rota; brute-force real
  depende de proteção nesse handler.
- `src/app/api/crm/stats/route.test.ts` mocka `@/lib/rate-limit`, mas a rota
  não usa o limiter — mock obsoleto (inofensivo).

## Testes

Padrão estabelecido (copiado de `widget/messages` e `change-password`):
mock de `@/lib/rate-limit` com `allowed: true` por padrão + um caso 429
(`Retry-After` só em header, sem `X-RateLimit-*`) + um caso
"credencial inválida não consome quota" onde a ordem é auth-antes-limiter.
Suíte do util: `src/lib/__tests__/rate-limit.test.ts`.
