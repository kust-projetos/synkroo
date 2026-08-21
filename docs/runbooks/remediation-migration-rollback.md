# Remediation migration and Worker rollback

## Schema sequence

Migrations `0013`–`0016` are additive or constraint changes. Apply to an anonymized staging database, run preflight checks, then execute:

```bash
DATABASE_URL="$STAGING_TEST_DATABASE_URL" npm run db:migrate
DATABASE_URL="$STAGING_TEST_DATABASE_URL" node scripts/verify-remediation-schema.mjs
```

Verification checks required remediation columns and the tenant-scoped unique keys for
`outbox_jobs` and `consents`. Missing columns or keys is an automatic No-Go.

Applied migrations are immutable. Incident rollback deploys a previous Worker compatible with the expanded schema; it does not drop or reverse migrations during an outage.

## Worker rehearsal

```bash
npx wrangler versions list --env staging --config wrangler.toml
npx wrangler rollback --env staging --config wrangler.toml
STAGING_BASE_URL="$STAGING_BASE_URL" node scripts/smoke-staging.mjs
```

Record candidate SHA, previous version, migration state, smoke result and owner approval. Failed schema verification or rollback smoke is automatic No-Go.
