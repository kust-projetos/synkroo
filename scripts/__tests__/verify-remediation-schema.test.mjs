import test from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_SCHEMA, validateSchemaMetadata } from '../verify-remediation-schema.mjs';

test('requires remediation columns and tenant-scoped unique keys', () => {
  const metadata = Object.fromEntries(Object.entries(REQUIRED_SCHEMA).map(([table, contract]) => [
    table,
    {
      columns: contract.columns,
      uniqueKeys: [contract.uniqueKey],
    },
  ]));

  assert.doesNotThrow(() => validateSchemaMetadata(metadata));
});

test('rejects a schema without the outbox tenant idempotency key', () => {
  const metadata = {
    outbox_jobs: { columns: REQUIRED_SCHEMA.outbox_jobs.columns, uniqueKeys: [] },
    consents: { columns: REQUIRED_SCHEMA.consents.columns, uniqueKeys: [REQUIRED_SCHEMA.consents.uniqueKey] },
  };

  assert.throws(
    () => validateSchemaMetadata(metadata),
    /outbox_jobs.*unique key/i,
  );
});
