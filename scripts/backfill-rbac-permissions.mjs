/**
 * backfill-rbac-permissions.mjs — Task 8 / Eixo 2 Integration Closure.
 *
 * Parameterized idempotent script + exported `backfill(client)` function.
 *
 * Pipeline:
 *   1. Lê preset-policy.json (readFileSync + new URL + JSON.parse).
 *   2. Insere PermissionEntry objects na tabela `permissions` (ON CONFLICT DO NOTHING).
 *   3. Para cada clínica, cria role Owner + 4 presets + Agente e sincroniza grants:
 *      - Owner: TODAS as chaves não-master do catálogo `permissions`.
 *      - Staff: chaves da tabela `permissions` filtradas por módulo do preset + extraKeys.
 *      - Agente: agentPermissions do policy.
 *
 * Export:
 *   import { backfill } from './scripts/backfill-rbac-permissions.mjs';
 *   const client = { query: async (text, params) => await pool.query(text, params) };
 *   const result = await backfill(client, { clinicId: 'uuid', dryRun: false });
 *
 * CLI:
 *   node scripts/backfill-rbac-permissions.mjs [--dry-run] [--clinic=<id>]
 *
 * Runbook:
 *   docs/runbook-backfill-rbac-permissions.md
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// ─── Load canonical policy from JSON ─────────────────────────────────────────

const policy = JSON.parse(readFileSync(new URL('../src/core/rbac/preset-policy.json', import.meta.url), 'utf-8'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function keyEscape(k) {
  return k.replace(/'/g, "''");
}

async function ensurePolicyPermissions(client) {
  const entries = [];
  for (const [mod, perms] of Object.entries(policy.modulePermissions ?? {})) {
    for (const p of perms) {
      entries.push(`('${keyEscape(p.key)}', '${keyEscape(p.module)}', '${keyEscape(p.label)}')`);
    }
  }
  if (entries.length === 0) return 0;
  const result = await client.query(
    `INSERT INTO permissions (key, module, label)
     VALUES ${entries.join(',')}
     ON CONFLICT (key) DO NOTHING`,
  );
  return result.rowCount ?? 0;
}

async function queryCatalogKeys(client) {
  const { rows } = await client.query(
    `SELECT p.key, p.module FROM permissions p ORDER BY p.key`,
  );
  return rows;
}

async function ensureRole(client, clinicId, name) {
  const { rows } = await client.query(
    `INSERT INTO roles (clinic_id, name)
     VALUES ($1, $2)
     ON CONFLICT (clinic_id, name) DO NOTHING
     RETURNING id`,
    [clinicId, name],
  );
  if (rows.length > 0) return rows[0].id;
  const { rows: existing } = await client.query(
    'SELECT id FROM roles WHERE clinic_id = $1 AND name = $2 LIMIT 1',
    [clinicId, name],
  );
  return existing[0]?.id;
}

async function syncRolePermissions(client, roleId, permissionKeys) {
  if (!permissionKeys || permissionKeys.length === 0) return 0;
  const values = permissionKeys.map((key) => `('${roleId}', '${keyEscape(key)}')`).join(',');
  const result = await client.query(
    `INSERT INTO role_permissions (role_id, permission_key)
     VALUES ${values}
     ON CONFLICT DO NOTHING`,
  );
  return result.rowCount ?? 0;
}

// ─── Backfill function (exportada) ───────────────────────────────────────────

/**
 * @param {import('node:child_process').ExecSyncOptions['query']} client - PG client com .query(text, params)
 * @param {{ clinicId?: string; dryRun?: boolean }} options
 */
export async function backfill(client, options = {}) {
  const { clinicId, dryRun = false } = options;
  const results = [];

  // Step 1: Policy permission entries → `permissions` table (catálogo canônico)
  if (!dryRun) {
    await ensurePolicyPermissions(client);
  }

  const clinics = clinicId
    ? [{ id: clinicId }]
    : (await client.query('SELECT id FROM clinics WHERE deleted_at IS NULL ORDER BY created_at')).rows;

  if (clinics.length === 0) {
    return { processed: 0, results: [] };
  }

  for (const clinic of clinics) {
    const clinicResults = [];

    if (dryRun) {
      results.push({ clinicId: clinic.id, dryRun: true, roles: [] });
      continue;
    }

    // Catálogo canônico (já populado pelo step 1)
    const catalog = await queryCatalogKeys(client);

    // Owner — all non-master permissions from catalog
    const ownerRoleId = await ensureRole(client, clinic.id, policy.reservedRole);
    const ownerKeys = catalog
      .filter((p) => !policy.owner.excludePrefixes.some((pre) => p.key.startsWith(pre)))
      .map((p) => p.key);
    const ownerInserted = await syncRolePermissions(client, ownerRoleId, ownerKeys);
    clinicResults.push({ role: policy.reservedRole, inserted: ownerInserted, total: ownerKeys.length });

    // Presets (staff) — deriva grants do catálogo + extraKeys do policy JSON
    for (const preset of policy.presets) {
      const roleId = await ensureRole(client, clinic.id, preset.name);
      const permissionKeys = [];

      // Expande módulos do preset via catálogo (permissions table)
      for (const p of catalog) {
        if (preset.modules.includes(p.module) && !policy.owner.excludePrefixes.some((pre) => p.key.startsWith(pre))) {
          permissionKeys.push(p.key);
        }
      }
      // Adiciona extraKeys do policy JSON (verbatim, sem passar pelo catálogo)
      for (const extra of preset.extraKeys ?? []) {
        if (!permissionKeys.includes(extra)) permissionKeys.push(extra);
      }

      const inserted = await syncRolePermissions(client, roleId, permissionKeys);
      clinicResults.push({ role: preset.name, inserted, total: permissionKeys.length });
    }

    // Agent
    const agentRoleId = await ensureRole(client, clinic.id, policy.agentRoleName);
    const agentInserted = await syncRolePermissions(client, agentRoleId, policy.agentPermissions);
    clinicResults.push({ role: policy.agentRoleName, inserted: agentInserted, total: policy.agentPermissions.length });

    results.push({ clinicId: clinic.id, roles: clinicResults });
  }

  return { processed: clinics.length, results };
}

// ─── CLI entry point ─────────────────────────────────────────────────────────

async function mainCLI() {
  const dryRun = process.argv.includes('--dry-run');
  const clinicFilter = process.argv.find((a) => a.startsWith('--clinic='))?.split('=')[1];

  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const client = {
    query: async (text, params) => {
      const conn = await pool.connect();
      try { return await conn.query(text, params); } finally { conn.release(); }
    },
  };

  if (dryRun) console.log('═══ DRY RUN — no mutations ═══');
  console.log('Reading policy from JSON, seeding permissions table...');

  const result = await backfill(client, { clinicId: clinicFilter, dryRun });
  console.log(`Processed ${result.processed} clinic(s):`, JSON.stringify(result.results, null, 2));

  await pool.end();
}

const isMainScript = process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('backfill-rbac-permissions.mjs');
if (isMainScript) {
  mainCLI().catch((err) => { console.error('Fatal:', err); process.exit(1); });
}
