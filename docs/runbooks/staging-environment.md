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

## Privacy-safe smoke contract

The smoke runner requires a synthetic staging session and clinic UUID for authenticated checks;
it never accepts production credentials and never prints response bodies:

```bash
STAGING_BASE_URL="$STAGING_BASE_URL" \
STAGING_AUTH_COOKIE="$STAGING_AUTH_COOKIE" \
STAGING_CLINIC_ID="$STAGING_CLINIC_ID" \
node scripts/smoke-staging.mjs
```

It must report `pass` for liveness, invalid auth, valid auth, session, switch-clinic,
route protection, tenant-scoped agenda, invalid webhook, protected readiness and assets.
Missing synthetic auth reports `blocked` and exits non-zero; it is never silently skipped.

The offline contract is reproducible with:

```bash
npm run test:release
```
