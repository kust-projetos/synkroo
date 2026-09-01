# Synkroo WhatsApp Sidecar (Playwright Fallback)

Microserviço Node.js para execução de fallback de automação WhatsApp via Playwright no VPS Synkroo.

## Visão Geral
- **Objetivo:** Isolar as dependências nativas e binários do Playwright (`playwright-core`, Chromium) fora do bundle serverless do Next.js / Cloudflare Workers.
- **Autenticação:** Header `Authorization: Bearer <WHATSAPP_FALLBACK_SECRET>` com validação em tempo constante (`crypto.timingSafeEqual`).
- **Persistência:** Volume Docker mapeado em `/app/.whatsapp-session`.

---

## Runbook de Provisionamento Manual no VPS

### 1. Requisitos no VPS
- Docker & Docker Compose instalados.
- Rede do Synkroo ou rede interna configurada.

### 2. Variáveis de Ambiente (`ops/vps/whatsapp-sidecar/.env`)
Defina no arquivo `.env` (nunca comitar valores no repositório):
```env
PORT=3030
WHATSAPP_FALLBACK_SECRET=definir_token_secreto_forte_min_32_chars
WHATSAPP_SESSION_PATH=/app/.whatsapp-session
WHATSAPP_HEADLESS=true
```

### 3. Deploy via Docker Compose
```bash
cd /opt/synkroo/ops/vps/whatsapp-sidecar
docker compose up -d --build
```

### 4. Healthcheck & Verificação
```bash
curl -f http://localhost:3030/health
```

---

## Variáveis no Cloudflare Worker (App Next.js)
No Cloudflare Workers / Dashboard / `wrangler.toml` (ou variáveis de ambiente da aplicação):
- `WHATSAPP_FALLBACK_URL`: `https://whatsapp-sidecar.seu-dominio.com` (HTTPS publicamente alcançável via Cloudflare Tunnel ou Nginx reverse proxy com TLS; nunca `http://127.0.0.1`/`http://localhost` — loopback não existe no runtime Cloudflare Workers)
- `WHATSAPP_FALLBACK_SECRET`: O mesmo token definido no sidecar VPS (`WHATSAPP_FALLBACK_SECRET`).

> **Nota:** `http://127.0.0.1:3030` é reservado exclusivamente para smoke test local dentro do próprio VPS (`curl -f http://localhost:3030/health`). O Worker em produção deve sempre apontar para a URL HTTPS pública do sidecar exposta via tunnel/proxy seguro.
