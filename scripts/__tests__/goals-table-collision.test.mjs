import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationDir = new URL('../../src/lib/db/migrations/', import.meta.url);

test('0041 creates business_goals separately from the OBSERVE goals table', async () => {
  const observeMigration = await readFile(new URL('0037_ai_observe_ingest.sql', migrationDir), 'utf8');
  const businessMigration = await readFile(new URL('0041_goals.sql', migrationDir), 'utf8');

  const observeTables = [...observeMigration.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"([^"]+)"/gi)]
    .map((match) => match[1]);
  const businessTables = [...businessMigration.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+"([^"]+)"/gi)]
    .map((match) => match[1]);

  assert.ok(observeTables.includes('goals'));
  assert.ok(businessTables.includes('business_goals'));
  assert.notEqual('goals', 'business_goals');
  assert.match(businessMigration, /CREATE TABLE\s+"business_goals"/i);
  assert.doesNotMatch(businessMigration, /CREATE TABLE\s+IF NOT EXISTS/i);
  assert.match(businessMigration, /"title"\s+text/i);
  assert.match(businessMigration, /"description"\s+text/i);
  assert.match(businessMigration, /"metadata"\s+jsonb/i);
});
