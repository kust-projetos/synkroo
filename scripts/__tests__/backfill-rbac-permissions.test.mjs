/**
 * Tests for scripts/backfill-rbac-permissions.mjs — backfill function
 * with fake PG client (no real DB needed).
 *
 * Cobre:
 *  - policy JSON shape invariants (4 presets, extras corretos)
 *  - backfill com fake client: 2 clínicas, Owner + presets + Agente
 *  - Idempotência: segunda chamada insere zero novos registros
 *  - Owner: todos os non-master permissions do catálogo
 *  - Staff: só policy-defined (não expande automaticamente)
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');
const policyPath = resolve(ROOT, 'src', 'core', 'rbac', 'preset-policy.json');
const policy = JSON.parse(readFileSync(policyPath, 'utf-8'));

const SCRIPT_PATH = resolve(ROOT, 'scripts', 'backfill-rbac-permissions.mjs');

// ─── Helpers — fake PG client ───────────────────────────────────────────────

function makeFakeClient() {
  const tables = {
    roles: [],
    role_permissions: [],
    permissions: [],
    clinics: [],
  };

  const client = {
    tables,

    query: async (text, params) => {
      // INSERT INTO permissions — seed do catálogo canônico
      // Remove ON CONFLICT clause first para evitar que `(key)` seja capturada como tuple
      const insertPermsTable = text.match(/INSERT INTO permissions/i);
      if (insertPermsTable) {
        const cleanText = text.replace(/\s+ON CONFLICT.*$/i, '');
        const valuePart = cleanText.split('VALUES')[1];
        if (!valuePart) return { rows: [], rowCount: 0 };
        let insertedCount = 0;
        const tuples = valuePart.match(/\([^)]+\)/g) || [];
        for (const tuple of tuples) {
          const arr = tuple.match(/'([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']*)'/);
          if (!arr) continue;
          const [, key, module, label] = arr;
          if (!tables.permissions.find((p) => p.key === key)) {
            tables.permissions.push({ key, module, label });
            insertedCount++;
          }
        }
        return { rows: [], rowCount: insertedCount };
      }

      // INSERT INTO roles
      const insertRoles = text.match(/INSERT INTO roles/i);
      if (insertRoles) {
        const clinicId = params[0];
        const name = params[1];
        const exists = tables.roles.find((r) => r.clinic_id === clinicId && r.name === name);
        if (!exists) {
          const id = `role-${tables.roles.length + 1}`;
          tables.roles.push({ id, clinic_id: clinicId, name });
          return { rows: [{ id }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // INSERT INTO role_permissions
      const insertPerms = text.match(/INSERT INTO role_permissions/i);
      if (insertPerms) {
        const cleanText = text.replace(/\s+ON CONFLICT.*$/i, '');
        let insertedCount = 0;
        const valuePart = cleanText.split('VALUES')[1];
        if (valuePart) {
          const tuples = valuePart.match(/\([^)]+\)/g) || [];
          for (const tuple of tuples) {
            const [roleId, permKey] = tuple.replace(/[\s'()]/g, '').split(',');
            if (!tables.role_permissions.find((rp) => rp.role_id === roleId && rp.permission_key === permKey)) {
              tables.role_permissions.push({ role_id: roleId, permission_key: permKey });
              insertedCount++;
            }
          }
        }
        return { rows: [], rowCount: insertedCount };
      }

      // SELECT * FROM permissions (catálogo canônico)
      const selectPermissions = text.match(/FROM permissions/i) && text.includes('SELECT');
      if (selectPermissions) {
        return {
          rows: tables.permissions.map((p) => ({ key: p.key, module: p.module })),
        };
      }

      // SELECT id FROM clinics
      const selectClinics = text.match(/FROM clinics/i) && text.includes('SELECT');
      if (selectClinics) {
        return { rows: tables.clinics.map((c) => ({ id: c.id })) };
      }

      // SELECT id FROM roles (ensureRole fallback)
      const selectRoles = text.match(/FROM roles/i) && text.includes('SELECT');
      if (selectRoles) {
        const rows = tables.roles.filter((r) => r.clinic_id === params[0] && r.name === params[1]);
        return { rows };
      }

      return { rows: [], rowCount: 0 };
    },
  };

  return client;
}

// ─── Policy invariants ──────────────────────────────────────────────────────

describe('preset-policy.json — canonical invariants', () => {
  it('has 4 presets', () => {
    assert.equal(policy.presets.length, 4);
  });

  it('Administrador includes crm + financeiro modules', () => {
    const a = policy.presets.find((p) => p.name === 'Administrador');
    assert.ok(a.modules.includes('crm'));
    assert.ok(a.modules.includes('financeiro'));
  });

  it('Recepcionista extras contains ONLY crm:view', () => {
    const r = policy.presets.find((p) => p.name === 'Recepcionista');
    assert.deepEqual(r.extraKeys, ['crm:view']);
  });

  it('Comercial extras is EXACTLY [crm:view, crm:manage_notes, crm:manage_tags] — no operacional:view, mantém módulos', () => {
    const c = policy.presets.find((p) => p.name === 'Comercial');
    assert.deepEqual(c.extraKeys, ['crm:view', 'crm:manage_notes', 'crm:manage_tags']);
    assert.ok(
      !c.extraKeys.includes('operacional:view'),
      'Comercial extraKeys must NOT include operacional:view',
    );
    // Comercial MANTÉM seus módulos (comercial + followup) — só extraKeys foi limpa
    assert.deepEqual(c.modules, ['comercial', 'followup'], 'Comercial modules preservado');
  });

  it('policy.modulePermissions.crm e .financeiro são arrays de PermissionEntry {key, module, label}', () => {
    assert.ok(policy.modulePermissions, 'modulePermissions deve existir no JSON');
    assert.equal(typeof policy.modulePermissions, 'object');

    // crm: objetos {key, module, label}
    const crmPerms = policy.modulePermissions.crm;
    assert.ok(Array.isArray(crmPerms));
    assert.ok(crmPerms.length >= 6);
    const crmView = crmPerms.find((p) => p.key === 'crm:view');
    assert.ok(crmView, 'crm:view deve existir');
    assert.equal(crmView.module, 'crm');
    assert.equal(typeof crmView.label, 'string');
    assert.ok(crmView.label.length > 0);
    const crmManageNotes = crmPerms.find((p) => p.key === 'crm:manage_notes');
    assert.ok(crmManageNotes, 'crm:manage_notes deve existir');
    assert.equal(crmManageNotes.module, 'crm');

    // financeiro: objetos {key, module, label}
    const finPerms = policy.modulePermissions.financeiro;
    assert.ok(Array.isArray(finPerms));
    assert.ok(finPerms.length >= 3);
    const finView = finPerms.find((p) => p.key === 'financeiro:view');
    assert.ok(finView, 'financeiro:view deve existir');
    assert.equal(finView.module, 'financeiro');
    assert.equal(typeof finView.label, 'string');
    assert.ok(finView.label.length > 0);

    // Módulos sem actions são arrays vazios
    assert.ok(Array.isArray(policy.modulePermissions.comercial));
    assert.ok(Array.isArray(policy.modulePermissions.analytics));
    assert.equal(policy.modulePermissions.comercial.length, 0);
  });

  it('owner excludes master:* prefix', () => {
    assert.ok(policy.owner.excludePrefixes.includes('master:'));
  });
});

// ─── Backfill with fake client ──────────────────────────────────────────────

describe('backfill function — fake PG client', () => {
  let backfill;
  let client;

  before(async () => {
    const mod = await import(pathToFileURL(SCRIPT_PATH).href);
    backfill = mod.backfill;
  });

  beforeEach(() => {
    client = makeFakeClient();
    client.tables.clinics = [
      { id: 'clinic-a-0000-0000-0000-000000000001' },
      { id: 'clinic-b-0000-0000-0000-000000000002' },
    ];
  });

  it('processes 2 clinics and creates Owner + 4 presets + Agente per clinic', async () => {
    const result = await backfill(client);
    assert.equal(result.processed, 2);
    const roleNames = client.tables.roles.map((r) => r.name);
    assert.ok(roleNames.includes('Owner'));
    assert.ok(roleNames.includes('Administrador'));
    assert.ok(roleNames.includes('Recepcionista'));
    assert.ok(roleNames.includes('Comercial'));
    assert.ok(roleNames.includes('Dentista'));
    assert.ok(roleNames.includes('Agente'));
  });

  it('creates roles for both clinics (clinic-a and clinic-b)', async () => {
    await backfill(client);
    assert.equal(
      client.tables.roles.filter((r) => r.clinic_id === client.tables.clinics[0].id).length,
      6,
    );
    assert.equal(
      client.tables.roles.filter((r) => r.clinic_id === client.tables.clinics[1].id).length,
      6,
    );
  });

  it('is idempotent — second call inserts ZERO new permissions', async () => {
    const first = await backfill(client);
    const totalBefore = client.tables.role_permissions.length;

    const second = await backfill(client);
    const totalAfter = client.tables.role_permissions.length;

    // No new rows should be inserted
    assert.equal(totalAfter, totalBefore);

    // All role insert attempts should have been no-ops
    for (const c of second.results) {
      for (const r of c.roles) {
        assert.equal(r.inserted, 0, `role ${r.role} should have 0 inserts on rerun, got ${r.inserted}`);
      }
    }
  });

  it('Owner role gets all catalog non-master permissions', async () => {
    // Seed some permissions in catalog
    client.tables.role_permissions.push(
      { role_id: 'existing', permission_key: 'operacional:view' },
      { role_id: 'existing', permission_key: 'financeiro:view' },
      { role_id: 'existing', permission_key: 'master:admin' },
    );
    const result = await backfill(client);
    // Owner should have non-master keys only (master:admin excluded)
    const ownerPerms = client.tables.role_permissions
      .filter((rp) => client.tables.roles.some((r) => r.id === rp.role_id && r.name === 'Owner'))
      .map((rp) => rp.permission_key);
    assert.ok(ownerPerms.includes('operacional:view'));
    assert.ok(ownerPerms.includes('financeiro:view'));
    assert.ok(!ownerPerms.some((k) => k.startsWith('master:')));
  });

  // Helper: retorna permission keys de um role name específico para uma clínica
  function rolePermsForName(clinicId, roleName) {
    const roleIds = client.tables.roles
      .filter((r) => r.name === roleName && r.clinic_id === clinicId)
      .map((r) => r.id);
    return client.tables.role_permissions
      .filter((rp) => roleIds.includes(rp.role_id))
      .map((rp) => rp.permission_key)
      .sort();
  }

  it('Comercial role recebe followup:* + crm:view/notes/tags (sem operacional:view, sem merge/review)', async () => {
    await backfill(client);
    const comercialPerms = rolePermsForName(client.tables.clinics[0].id, 'Comercial');
    // Comercial modules=[comercial,followup]; comercial modulePermissions é vazio,
    // followup modulePermissions tem 4 keys. extraKeys = 3 CRM keys.
    const followupKeys = ['followup:manage_campaigns', 'followup:manage_followups', 'followup:manage_segments', 'followup:view'];
    const extraCrmKeys = ['crm:manage_notes', 'crm:manage_tags', 'crm:view'];
    const expected = [...followupKeys, ...extraCrmKeys].sort();
    assert.deepEqual(comercialPerms, expected);
    assert.ok(
      !comercialPerms.includes('operacional:view'),
      'Comercial NÃO deve receber operacional:view',
    );
    assert.ok(
      !comercialPerms.some((k) => k.startsWith('crm:merge') || k.startsWith('crm:review')),
      'Comercial NÃO deve receber chaves de merge/review',
    );
  });

  it('Comercial grants permanecem idênticos no rerun (exatas 7 keys, 0 inserts)', async () => {
    await backfill(client);
    const before = rolePermsForName(client.tables.clinics[0].id, 'Comercial');

    const second = await backfill(client);

    const after = rolePermsForName(client.tables.clinics[0].id, 'Comercial');

    assert.deepEqual(after, before, 'Comercial grants devem permanecer idênticos');
    assert.equal(before.length, 7, 'Comercial deve ter exatas 7 keys (followup: + CRM extras)');

    // Result do Comercial no rerun deve ter inserted=0
    const comercialResult = second.results
      .flatMap((c) => c.roles)
      .find((r) => r.role === 'Comercial');
    assert.equal(comercialResult.inserted, 0, 'Comercial no rerun deve inserir 0 keys');
  });

  it('staff grant expande do catalog: pre-seed permissions table → Comercial recebe comercial:*', async () => {
    // Preenche a tabela permissions com keys que NÃO estão no policy modulePermissions
    // (simula o que aconteceria com módulos que têm entries no JSON)
    client.tables.permissions.push(
      { key: 'comercial:view', module: 'comercial', label: 'Ver Comercial' },
      { key: 'comercial:capture_leads', module: 'comercial', label: 'Capturar leads' },
    );

    await backfill(client);

    // Verifica ambas as clínicas
    for (const clinicId of ['clinic-a-0000-0000-0000-000000000001', 'clinic-b-0000-0000-0000-000000000002']) {
      const comercialPerms = client.tables.role_permissions
        .filter((rp) =>
          client.tables.roles.some((r) => r.id === rp.role_id && r.name === 'Comercial' && r.clinic_id === clinicId),
        )
        .map((rp) => rp.permission_key)
        .sort();

      // Comercial deve incluir comercial:* do catalog + followup:* + CRM extras
      assert.ok(comercialPerms.includes('comercial:view'), `comercial:view ausente para ${clinicId}`);
      assert.ok(comercialPerms.includes('comercial:capture_leads'), `comercial:capture_leads ausente para ${clinicId}`);
      assert.ok(comercialPerms.includes('followup:view'), `followup:view ausente para ${clinicId}`);
      assert.ok(comercialPerms.includes('crm:view'), `crm:view ausente para ${clinicId}`);
    }

    // Rerun: idempotente
    const second = await backfill(client);
    const rerunInserted = second.results
      .flatMap((c) => c.roles)
      .filter((r) => r.role === 'Comercial')
      .reduce((sum, r) => sum + r.inserted, 0);
    assert.equal(rerunInserted, 0, 'Rerun deve inserir 0 novas permissions para Comercial');
  });

  it('dry run does NOT mutate anything', async () => {
    const rolesBefore = client.tables.roles.length;
    const permsBefore = client.tables.role_permissions.length;
    const permsCatBefore = client.tables.permissions.length;
    const result = await backfill(client, { dryRun: true });
    assert.equal(client.tables.roles.length, rolesBefore, 'dryRun não cria roles');
    assert.equal(client.tables.role_permissions.length, permsBefore, 'dryRun não insere role_permissions');
    assert.equal(client.tables.permissions.length, permsCatBefore, 'dryRun não insere permissions');
    assert.ok(result.results.every((c) => c.dryRun === true), 'todos os resultados são dryRun');
  });
});

// ─── presets.ts derives from JSON (via seed.test.ts Jest) ──────────────────

// A verificação de que presets.ts carrega corretamente o JSON é feita em
// seed.test.ts (Jest, que resolve o alias @/ e __dirname CJS).
// Aqui no node --test testamos apenas o JSON diretamente.

describe('preset-policy.json — presets derivam da fonte canônica', () => {
  it('policy JSON tem 4 presets que batem com o esperado', () => {
    assert.equal(policy.presets.length, 4);
    assert.ok(policy.presets.find((p) => p.name === 'Administrador'));
    assert.ok(policy.presets.find((p) => p.name === 'Recepcionista'));
    assert.ok(policy.presets.find((p) => p.name === 'Comercial'));
    assert.ok(policy.presets.find((p) => p.name === 'Dentista'));
  });

  it('Recepcionista extras: only crm:view (policy JSON)', () => {
    const r = policy.presets.find((p) => p.name === 'Recepcionista');
    assert.deepEqual(r.extraKeys, ['crm:view']);
  });

  it('Comercial extras: EXATAMENTE crm:view + manage_notes + manage_tags, modules preservado [comercial,followup]', () => {
    const c = policy.presets.find((p) => p.name === 'Comercial');
    assert.deepEqual(c.extraKeys, ['crm:view', 'crm:manage_notes', 'crm:manage_tags']);
    assert.deepEqual(c.modules, ['comercial', 'followup'], 'Comercial modules preservado');
    assert.ok(!c.extraKeys.includes('operacional:view'));
    assert.ok(!c.extraKeys.some((k) => k.startsWith('crm:merge') || k.startsWith('crm:review')));
  });
});