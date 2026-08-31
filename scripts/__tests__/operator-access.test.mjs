import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { grantOperatorAccess, parseArgs as parseGrantArgs } from '../grant-operator-access.mjs';
import { revokeOperatorAccess, parseArgs as parseRevokeArgs } from '../revoke-operator-access.mjs';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const CLINIC_ID = '00000000-0000-4000-8000-000000000002';
const ACTOR_ID = '00000000-0000-4000-8000-000000000003';
const PERMISSION = 'master:manage_modules';

function options(extra = {}) {
  return {
    user_id: USER_ID,
    clinic_id: CLINIC_ID,
    permission: PERMISSION,
    expires_at: '2099-01-01T00:00:00.000Z',
    reason: 'support incident',
    actor: ACTOR_ID,
    apply: false,
    ...extra,
  };
}

function fakeClient() {
  const state = {
    users: new Map([
      [USER_ID, { id: USER_ID, is_active: true, session_version: 0 }],
      [ACTOR_ID, { id: ACTOR_ID, is_active: true, session_version: 0 }],
    ]),
    clinics: new Set([CLINIC_ID]),
    permissions: new Set([PERMISSION]),
    roles: [],
    rolePermissions: [],
    memberships: [],
    audits: [],
    writes: 0,
  };

  const client = {
    state,
    async query(text, params = []) {
      const sql = text.replace(/\s+/g, ' ').trim();
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [], rowCount: 0 };

      if (sql.startsWith('SELECT id FROM users')) {
        const user = state.users.get(params[0]);
        if (!user || (sql.includes('is_active = true') && !user.is_active)) return { rows: [] };
        return { rows: [{ id: user.id }] };
      }
      if (sql.startsWith('SELECT id FROM clinics')) {
        return { rows: state.clinics.has(params[0]) ? [{ id: params[0] }] : [] };
      }
      if (sql.startsWith('SELECT key FROM permissions')) {
        return { rows: state.permissions.has(params[0]) ? [{ key: params[0] }] : [] };
      }
      if (sql.startsWith('SELECT id, is_system FROM roles')) {
        const role = state.roles.find((entry) => entry.clinic_id === params[0] && entry.name === params[1]);
        return { rows: role ? [{ id: role.id, is_system: role.is_system }] : [] };
      }
      if (sql.startsWith('SELECT permission_key FROM role_permissions')) {
        return {
          rows: state.rolePermissions
            .filter((entry) => entry.role_id === params[0] && (!sql.includes('master:%') || entry.permission_key.startsWith('master:')))
            .map((entry) => ({ permission_key: entry.permission_key })),
        };
      }
      if (sql.startsWith('SELECT user_id, clinic_id, role_id')) {
        const membership = state.memberships.find((entry) => entry.user_id === params[0] && entry.clinic_id === params[1]);
        return { rows: membership ? [membership] : [] };
      }
      if (sql.startsWith('SELECT role_id, expires_at, revoked_at')) {
        const membership = state.memberships.find((entry) => entry.user_id === params[0] && entry.clinic_id === params[1]);
        return { rows: membership ? [membership] : [] };
      }
      if (sql.startsWith('SELECT a.role_id')) {
        const membership = state.memberships.find((entry) => {
          const role = state.roles.find((candidate) => candidate.id === entry.role_id);
          return entry.user_id === params[0]
            && entry.clinic_id === params[1]
            && role?.name === params[2]
            && role?.is_system === true;
        });
        return { rows: membership ? [{ role_id: membership.role_id, expires_at: membership.expires_at, revoked_at: membership.revoked_at }] : [] };
      }
      if (sql.startsWith('SELECT count(*)')) {
        const count = state.memberships.filter((entry) => {
          const user = state.users.get(entry.user_id);
          return entry.role_id === params[0] && entry.revoked_at === null && user?.is_active;
        }).length;
        return { rows: [{ count }] };
      }
      if (sql.startsWith('INSERT INTO roles')) {
        const role = { id: `role-${state.roles.length + 1}`, clinic_id: params[0], name: params[1], is_system: true };
        state.roles.push(role);
        state.writes += 1;
        return { rows: [{ id: role.id }], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO role_permissions')) {
        if (!state.rolePermissions.some((entry) => entry.role_id === params[0] && entry.permission_key === params[1])) {
          state.rolePermissions.push({ role_id: params[0], permission_key: params[1] });
          state.writes += 1;
        }
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO user_clinic_access')) {
        state.memberships.push({
          user_id: params[0], clinic_id: params[1], role_id: params[2], expires_at: params[3],
          revoked_at: null, grant_reason: params[4], granted_by: params[5],
        });
        state.writes += 1;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE user_clinic_access')) {
        const membership = state.memberships.find((entry) => entry.user_id === params[0] && entry.clinic_id === params[1]);
        if (sql.includes('expires_at = $3')) {
          Object.assign(membership, { expires_at: params[2], revoked_at: null, grant_reason: params[3], granted_by: params[4] });
        } else {
          Object.assign(membership, { revoked_at: '2099-01-01T00:00:00.000Z', grant_reason: params[2], granted_by: params[3] });
        }
        state.writes += 1;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('UPDATE users')) {
        state.users.get(params[0]).session_version += 1;
        state.writes += 1;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('DELETE FROM role_permissions')) {
        state.rolePermissions = state.rolePermissions.filter((entry) => !(entry.role_id === params[0] && entry.permission_key === params[1]));
        state.writes += 1;
        return { rows: [], rowCount: 1 };
      }
      if (sql.startsWith('INSERT INTO audit_logs')) {
        state.audits.push({ action: params[2], oldValues: params[5], newValues: params[6] });
        state.writes += 1;
        return { rows: [], rowCount: 1 };
      }
      throw new Error(`Unhandled query: ${sql}`);
    },
  };
  return client;
}

describe('operator access scripts', () => {
  it('keeps grant dry-run as the default and validates its security arguments', () => {
    const parsed = parseGrantArgs([
      '--user-id', USER_ID,
      '--clinic-id', CLINIC_ID,
      '--permission', PERMISSION,
      '--expires-at', '2099-01-01T00:00:00.000Z',
      '--reason', 'incident',
      '--actor', ACTOR_ID,
    ]);
    assert.equal(parsed.apply, false);
    assert.throws(() => parseGrantArgs([
      '--user-id', USER_ID, '--clinic-id', CLINIC_ID,
      '--permission', PERMISSION, '--reason', 'incident', '--actor', ACTOR_ID,
    ]), /--expires-at is required/);
    assert.throws(() => parseGrantArgs([
      '--user-id', USER_ID, '--clinic-id', CLINIC_ID,
      '--permission', 'financeiro:view', '--expires-at', '2099-01-01T00:00:00.000Z',
      '--reason', 'incident', '--actor', ACTOR_ID,
    ]), /master/);
  });

  it('does not write during grant dry-run', async () => {
    const client = fakeClient();
    const result = await grantOperatorAccess(client, options());
    assert.equal(result.dryRun, true);
    assert.equal(client.state.writes, 0);
    assert.equal(client.state.roles.length, 0);
  });

  it('grants one expiring operator permission and audits the technical change', async () => {
    const client = fakeClient();
    const result = await grantOperatorAccess(client, options({ apply: true }));
    assert.equal(result.permission, PERMISSION);
    assert.equal(client.state.rolePermissions.length, 1);
    assert.equal(client.state.memberships.length, 1);
    assert.equal(client.state.users.get(USER_ID).session_version, 1);
    assert.equal(client.state.audits[0].action, 'rbac.operator_grant');
    assert.equal(client.state.audits[0].newValues.permission, PERMISSION);
  });

  it('revokes the temporary membership and removes the unused operator grant', async () => {
    const client = fakeClient();
    await grantOperatorAccess(client, options({ apply: true }));
    const result = await revokeOperatorAccess(client, options({ apply: true, reason: 'incident closed' }));
    assert.equal(result.revoked, true);
    assert.notEqual(client.state.memberships[0].revoked_at, null);
    assert.equal(client.state.rolePermissions.length, 0);
    assert.equal(client.state.users.get(USER_ID).session_version, 2);
    assert.equal(client.state.audits[1].action, 'rbac.operator_revoke');
  });

  it('requires a reason and actor for revoke', () => {
    assert.throws(() => parseRevokeArgs([
      '--user-id', USER_ID, '--clinic-id', CLINIC_ID,
      '--permission', PERMISSION, '--actor', ACTOR_ID,
    ]), /--reason is required/);
  });
});
