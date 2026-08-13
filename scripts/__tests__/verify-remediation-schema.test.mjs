import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_SCHEMA,
  validateSchemaMetadata,
} from "../verify-remediation-schema.mjs";

const MIGRATIONS_DIR = new URL("../../src/lib/db/migrations/", import.meta.url);

async function readMigration(name) {
  return (await import("node:fs/promises")).readFile(
    new URL(name, MIGRATIONS_DIR),
    "utf8",
  );
}

test("requires remediation columns and tenant-scoped unique keys", () => {
  const metadata = Object.fromEntries(
    Object.entries(REQUIRED_SCHEMA).map(([table, contract]) => [
      table,
      {
        columns: contract.columns,
        uniqueKeys: [contract.uniqueKey],
      },
    ]),
  );

  assert.doesNotThrow(() => validateSchemaMetadata(metadata));
});

test("rejects a schema without the outbox tenant idempotency key", () => {
  const metadata = {
    outbox_jobs: {
      columns: REQUIRED_SCHEMA.outbox_jobs.columns,
      uniqueKeys: [],
    },
    consents: {
      columns: REQUIRED_SCHEMA.consents.columns,
      uniqueKeys: [REQUIRED_SCHEMA.consents.uniqueKey],
    },
  };

  assert.throws(
    () => validateSchemaMetadata(metadata),
    /outbox_jobs.*unique key/i,
  );
});

test("message event migration preflights duplicates and is replay-safe", async () => {
  const sql = await readMigration("0019_next_cobalt_man.sql");
  assert.match(sql, /GROUP BY "external_provider", "external_message_id"/);
  assert.match(sql, /HAVING COUNT\(\*\) > 1/);
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/);
});

test("lead phone migration is replay-safe", async () => {
  const sql = await readMigration("0020_lead-phone-normalized-unique.sql");
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS/);
  assert.match(sql, /phone_normalized/);
});
