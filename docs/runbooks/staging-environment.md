# Staging environment

Staging uses a separate Worker name, PostgreSQL database, Hyperdrive, KV, Vectorize index, Queue and Durable Object namespace. Production IDs and secrets must not be copied.

## Provisioning contract

1. Owner provisions resource IDs in Cloudflare.
2. IDs are added to reviewed environment configuration.
3. Secrets are written with `wrangler secret put --env staging`; values never enter Git or logs.
4. Database is anonymized and disposable.

## Validation

```bash
npx wrangler whoami
npx wrangler secret list --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.toml
npx wrangler deploy --dry-run --env staging --config wrangler.ia-bridge.jsonc
npx wrangler deploy --dry-run --env staging --config src/workers/ia-agent/wrangler.jsonc
```

Missing approved resource IDs or required secrets is a No-Go, not a reason to use production resources.
