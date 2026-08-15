/**
 * RBAC permission backfill.
 *
 * The exported `backfill` function is deterministic and injectable for tests.
 * The CLI is dry-run by default; pass `--apply` before allowing INSERTs.
 */

import fs from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const POLICY = JSON.parse(fs.readFileSync(resolve(ROOT, 'src/core/rbac/preset-policy.json'), 'utf8'));
const DEFAULT_CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function policyPermissionEntries() {
  return Object.values(POLICY.modulePermissions)
    .flat()
    .map(({ key, module, label }) => ({ key, module, label }));
}

function mergeCatalogRows(rows) {
  const byKey = new Map(policyPermissionEntries().map((entry) => [entry.key, entry]));
  for (const row of rows) {
    if (!byKey.has(row.key)) byKey.set(row.key, { key: row.key, module: row.module, label: row.label || row.key });
  }
  return [...byKey.values()].filter((entry) => !entry.key.startsWith('master:'));
}

async function getCatalogRows(client) {
  const { rows } = await client.query('SELECT key, module, label FROM permissions WHERE key NOT LIKE \'master:%\'');
  return rows;
}

async function seedPolicyPermissions(client) {
  const entries = policyPermissionEntries();
  if (entries.length === 0) return;
  const values = entries.map((entry) =>
    `(${sqlLiteral(entry.key)}, ${sqlLiteral(entry.module)}, ${sqlLiteral(entry.label)})`,
  ).join(', ');
  await client.query(
    `INSERT INTO permissions (key, module, label) VALUES ${values} ON CONFLICT (key) DO NOTHING`,
  );
}

async function ensureRole(client, clinicId, name, dryRun) {
  const existing = await client.query(
    'SELECT id FROM roles WHERE clinic_id = $1 AND name = $2 LIMIT 1',
    [clinicId, name],
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;
  if (dryRun) return `dry-run:${clinicId}:${name}`;
  const created = await client.query(
    'INSERT INTO roles (clinic_id, name, is_system) VALUES ($1, $2, true) RETURNING id',
    [clinicId, name],
  );
  return created.rows[0]?.id;
}

function permissionsForRole(roleName, catalog) {
  if (roleName === POLICY.reservedRole) return catalog.map((entry) => entry.key);
  if (roleName === POLICY.agentRoleName) return POLICY.agentPermissions.filter((key) => !key.startsWith('master:'));

  const preset = POLICY.presets.find((entry) => entry.name === roleName);
  if (!preset) return [];
  const keys = new Set();
  for (const moduleName of preset.modules) {
    for (const entry of catalog) if (entry.module === moduleName) keys.add(entry.key);
  }
  for (const key of preset.extraKeys || []) if (!key.startsWith('master:')) keys.add(key);
  return [...keys];
}

async function applyRolePermissions(client, roleId, keys, dryRun) {
  if (dryRun || keys.length === 0) return 0;
  const values = keys.map((key) => `(${sqlLiteral(roleId)}, ${sqlLiteral(key)})`).join(', ');
  const result = await client.query(
    `INSERT INTO role_permissions (role_id, permission_key) VALUES ${values} ON CONFLICT DO NOTHING`,
  );
  return result.rowCount || 0;
}

export async function backfill(client, { dryRun = false } = {}) {
  if (!dryRun) await seedPolicyPermissions(client);
  const catalog = mergeCatalogRows(await getCatalogRows(client));
  const { rows: clinics } = await client.query('SELECT id FROM clinics');
  const roleNames = [POLICY.reservedRole, ...POLICY.presets.map((preset) => preset.name), POLICY.agentRoleName];
  const results = [];

  for (const clinic of clinics) {
    const clinicResult = { clinicId: clinic.id, dryRun, roles: [] };
    for (const roleName of roleNames) {
      const roleId = await ensureRole(client, clinic.id, roleName, dryRun);
      const keys = permissionsForRole(roleName, catalog);
      const inserted = await applyRolePermissions(client, roleId, keys, dryRun);
      clinicResult.roles.push({ role: roleName, inserted, dryRun });
    }
    results.push(clinicResult);
  }

  return {
    processed: clinics.length,
    inserted: results.flatMap((clinic) => clinic.roles).reduce((sum, role) => sum + role.inserted, 0),
    dryRun,
    results,
  };
}

export function parseArgs(args = []) {
  if (args.length === 0) return { apply: false };
  if (args.length === 1 && args[0] === '--apply') return { apply: true };
  throw new Error('Usage: node scripts/backfill-rbac-permissions.mjs [--apply]');
}

export function isMainModule(metaUrl, argv1) {
  return Boolean(metaUrl && argv1 && pathToFileURL(resolve(argv1)).href === metaUrl);
}

export async function main({ apply = false, connectionString = DEFAULT_CONNECTION_STRING, ClientClass = Client } = {}) {
  const client = new ClientClass({ connectionString });
  await client.connect();
  try {
    const result = await backfill(client, { dryRun: !apply });
    console.log(`${apply ? 'APPLY' : 'DRY-RUN'}: ${result.processed} clinics, ${result.inserted} new role permissions`);
    return result;
  } finally {
    await client.end();
  }
}

if (isMainModule(import.meta.url, process.argv[1])) {
  try {
    await main({ apply: parseArgs(process.argv.slice(2)).apply });
  } catch (error) {
    console.error('ERROR:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
