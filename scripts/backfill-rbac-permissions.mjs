/**
 * RBAC Permission Backfill Script
 *
 * Idempotent: adds any catalog permissions not yet assigned to existing system roles.
 * Safe to run on any environment — only INSERTs missing rows, never DELETEs.
 *
 * Usage: node scripts/backfill-rbac-permissions.mjs
 * Requires: DATABASE_URL env var (defaults to local dev)
 *
 * Run after deploying new action modules (e.g., operacional) to ensure
 * existing clinics have their preset roles populated with the new permissions.
 */

import pg from 'pg';
const { Client } = pg;

const CONN_STRING =
  process.env.DATABASE_URL ||
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

const client = new Client({ connectionString: CONN_STRING });

async function getCatalogPermissions(client) {
  // Reads permissions table — populated by getPermissionCatalog() at seed time.
  // If new action modules were deployed after seed, their keys may not be here.
  const { rows } = await client.query(
    `SELECT key FROM permissions WHERE key NOT LIKE 'master:%'`
  );
  return new Set(rows.map(r => r.key));
}

async function getExistingRolePerms(client) {
  const { rows } = await client.query(`
    SELECT rp.role_id, rp.permission_key
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    WHERE r.is_system = true
  `);
  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.role_id)) map.set(row.role_id, new Set());
    map.get(row.role_id).add(row.permission_key);
  }
  return map;
}

async function main() {
  await client.connect();

  const catalog = await getCatalogPermissions(client);
  const existingPerms = await getExistingRolePerms(client);

  const { rows: systemRoles } = await client.query(
    `SELECT id, name, clinic_id FROM roles WHERE is_system = true`
  );

  let inserted = 0;
  for (const role of systemRoles) {
    const rolePerms = existingPerms.get(role.id) || new Set();
    const missing = [...catalog].filter(k => !rolePerms.has(k));

    if (missing.length === 0) {
      console.log(`[SKIP] ${role.name} (${role.id}) — no missing permissions`);
      continue;
    }

    for (const key of missing) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [role.id, key]
      );
      inserted++;
    }
    console.log(`[OK] ${role.name} (role_id=${role.id}, clinic=${role.clinic_id}) — +${missing.length} perms`);
  }

  console.log(`\nDone. Inserted ${inserted} missing role_permissions across ${systemRoles.length} system roles.`);
  await client.end();
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});
