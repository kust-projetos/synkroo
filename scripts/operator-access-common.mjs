import pg from 'pg';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { Client } = pg;

export const OPERATOR_ROLE_NAME = 'Synkroo Operator';
export const DEFAULT_CONNECTION_STRING =
  process.env.DATABASE_URL ||
  'postgres://synkroo:change-me-local-dev-password@localhost:55432/synkroo';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPTION_NAMES = new Set([
  '--user-id',
  '--clinic-id',
  '--permission',
  '--permission-key',
  '--expires-at',
  '--reason',
  '--actor',
  '--actor-id',
]);

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function required(options, key, flag) {
  if (!options[key]) throw new Error(`${flag} is required`);
}

export function parseOperatorArgs(args = [], { requireExpiresAt = false } = {}) {
  const options = { apply: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }
    if (!OPTION_NAMES.has(arg)) {
      throw new Error(`Unknown option: ${arg}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${arg} requires a value`);
    }
    index += 1;
    if (arg === '--permission' || arg === '--permission-key') options.permission = value;
    else if (arg === '--actor' || arg === '--actor-id') options.actor = value;
    else options[arg.slice(2).replaceAll('-', '_')] = value;
  }

  required(options, 'user_id', '--user-id');
  required(options, 'clinic_id', '--clinic-id');
  required(options, 'permission', '--permission');
  required(options, 'reason', '--reason');
  required(options, 'actor', '--actor');

  for (const [key, flag] of [
    ['user_id', '--user-id'],
    ['clinic_id', '--clinic-id'],
    ['actor', '--actor'],
  ]) {
    if (!isUuid(options[key])) throw new Error(`${flag} must be a UUID`);
  }

  if (!options.permission.startsWith('master:') || options.permission.length <= 'master:'.length) {
    throw new Error('--permission must be a non-empty master:* permission');
  }
  if (options.reason.length > 500) throw new Error('--reason must be at most 500 characters');

  if (requireExpiresAt) {
    required(options, 'expires_at', '--expires-at');
  }
  if (options.expires_at) {
    const expiresAt = new Date(options.expires_at);
    if (Number.isNaN(expiresAt.getTime())) throw new Error('--expires-at must be a valid timestamp');
    if (expiresAt.getTime() <= Date.now()) throw new Error('--expires-at must be in the future');
    options.expires_at = expiresAt.toISOString();
  }

  return options;
}

async function getActiveActor(client, actorId) {
  const result = await client.query(
    'SELECT id FROM users WHERE id = $1 AND is_active = true LIMIT 1',
    [actorId],
  );
  if (!result.rows[0]) throw new Error('Operational actor was not found or is inactive');
}

async function getTarget(client, options, { actorRequired = true, targetMustBeActive = false } = {}) {
  const user = await client.query(
    targetMustBeActive
      ? 'SELECT id FROM users WHERE id = $1 AND is_active = true LIMIT 1'
      : 'SELECT id FROM users WHERE id = $1 LIMIT 1',
    [options.user_id],
  );
  if (!user.rows[0]) throw new Error('Target user was not found');

  const clinic = await client.query('SELECT id FROM clinics WHERE id = $1 LIMIT 1', [options.clinic_id]);
  if (!clinic.rows[0]) throw new Error('Target clinic was not found');

  if (actorRequired) await getActiveActor(client, options.actor);
}

async function assertCatalogPermission(client, permission) {
  const result = await client.query(
    'SELECT key FROM permissions WHERE key = $1 LIMIT 1',
    [permission],
  );
  if (!result.rows[0]) throw new Error(`Permission is not present in the RBAC catalog: ${permission}`);
}

async function getOperatorRole(client, clinicId) {
  const result = await client.query(
    `SELECT id, is_system
       FROM roles
      WHERE clinic_id = $1 AND name = $2
      LIMIT 1
      FOR UPDATE`,
    [clinicId, OPERATOR_ROLE_NAME],
  );
  return result.rows[0] ?? null;
}

async function ensureOperatorRole(client, clinicId) {
  const existing = await getOperatorRole(client, clinicId);
  if (existing) {
    if (!existing.is_system) throw new Error('Reserved operator role is not a system role');
    return { id: existing.id, created: false };
  }

  const created = await client.query(
    `INSERT INTO roles (clinic_id, name, description, is_system)
     VALUES ($1, $2, $3, true)
     RETURNING id`,
    [clinicId, OPERATOR_ROLE_NAME, 'Temporary platform operator access.'],
  );
  return { id: created.rows[0].id, created: true };
}

async function getRolePermissions(client, roleId) {
  const result = await client.query(
    `SELECT permission_key
       FROM role_permissions
      WHERE role_id = $1`,
    [roleId],
  );
  return result.rows.map((row) => row.permission_key);
}

async function getMembership(client, userId, clinicId) {
  const result = await client.query(
    `SELECT user_id, clinic_id, role_id, expires_at, revoked_at, grant_reason
       FROM user_clinic_access
      WHERE user_id = $1 AND clinic_id = $2
      FOR UPDATE`,
    [userId, clinicId],
  );
  return result.rows[0] ?? null;
}

function assertOnlyRequestedPermission(masterPermissions, requestedPermission) {
  const unexpected = masterPermissions.find((permission) => permission !== requestedPermission);
  if (unexpected) {
    throw new Error(`Operator role already contains a different permission: ${unexpected}`);
  }
}

async function insertAudit(client, {
  options,
  action,
  oldValues,
  newValues,
}) {
  await client.query(
    `INSERT INTO audit_logs
      (clinic_id, user_id, action, entity_type, entity_id, old_values, new_values)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      options.clinic_id,
      options.actor,
      action,
      'user_clinic_access',
      options.user_id,
      oldValues,
      newValues,
    ],
  );
}

async function inTransaction(client, work) {
  await client.query('BEGIN');
  try {
    const result = await work();
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original database error.
    }
    throw error;
  }
}

export async function grantOperatorAccess(client, options) {
  const normalized = { ...options };
  if (!normalized.expires_at) throw new Error('--expires-at is required for an operator grant');
  const expiresAt = new Date(normalized.expires_at);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    throw new Error('--expires-at must be in the future');
  }

  if (!normalized.apply) {
    await getTarget(client, normalized, { targetMustBeActive: true });
    await assertCatalogPermission(client, normalized.permission);
    const existingRole = await client.query(
      'SELECT id, is_system FROM roles WHERE clinic_id = $1 AND name = $2 LIMIT 1',
      [normalized.clinic_id, OPERATOR_ROLE_NAME],
    );
    const membership = await client.query(
      'SELECT role_id, expires_at, revoked_at FROM user_clinic_access WHERE user_id = $1 AND clinic_id = $2 LIMIT 1',
      [normalized.user_id, normalized.clinic_id],
    );
    if (existingRole.rows[0] && !existingRole.rows[0].is_system) {
      throw new Error('Reserved operator role is not a system role');
    }
    if (membership.rows[0] && existingRole.rows[0] && membership.rows[0].role_id !== existingRole.rows[0].id) {
      throw new Error('Target user already has a different clinic membership role');
    }
    return {
      dryRun: true,
      userId: normalized.user_id,
      clinicId: normalized.clinic_id,
      permission: normalized.permission,
      expiresAt: expiresAt.toISOString(),
      role: OPERATOR_ROLE_NAME,
      wouldCreateRole: !existingRole.rows[0],
      wouldGrantMembership: !membership.rows[0] || membership.rows[0].revoked_at !== null,
    };
  }

  return inTransaction(client, async () => {
    await getTarget(client, normalized, { targetMustBeActive: true });
    await assertCatalogPermission(client, normalized.permission);
    const role = await ensureOperatorRole(client, normalized.clinic_id);
    const permissions = await getRolePermissions(client, role.id);
    assertOnlyRequestedPermission(permissions, normalized.permission);

    const membership = await getMembership(client, normalized.user_id, normalized.clinic_id);
    if (membership && membership.role_id !== role.id) {
      throw new Error('Target user already has a different clinic membership role');
    }

    await client.query(
      `INSERT INTO role_permissions (role_id, permission_key)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [role.id, normalized.permission],
    );

    if (membership) {
      await client.query(
        `UPDATE user_clinic_access
            SET expires_at = $3,
                revoked_at = NULL,
                grant_reason = $4,
                granted_by = $5
          WHERE user_id = $1 AND clinic_id = $2`,
        [normalized.user_id, normalized.clinic_id, expiresAt.toISOString(), normalized.reason, normalized.actor],
      );
    } else {
      await client.query(
        `INSERT INTO user_clinic_access
          (user_id, clinic_id, role_id, expires_at, grant_reason, granted_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [normalized.user_id, normalized.clinic_id, role.id, expiresAt.toISOString(), normalized.reason, normalized.actor],
      );
    }

    await client.query(
      `UPDATE users
          SET session_version = session_version + 1, updated_at = now()
        WHERE id = $1`,
      [normalized.user_id],
    );

    await insertAudit(client, {
      options: normalized,
      action: 'rbac.operator_grant',
      oldValues: membership
        ? { roleId: membership.role_id, expiresAt: membership.expires_at, revokedAt: membership.revoked_at }
        : { membership: 'absent' },
      newValues: { roleId: role.id, permission: normalized.permission, expiresAt: expiresAt.toISOString(), reason: normalized.reason },
    });

    return {
      dryRun: false,
      userId: normalized.user_id,
      clinicId: normalized.clinic_id,
      roleId: role.id,
      permission: normalized.permission,
      expiresAt: expiresAt.toISOString(),
      createdRole: role.created,
    };
  });
}

async function getOperatorMembership(client, options) {
  const result = await client.query(
    `SELECT a.role_id, a.expires_at, a.revoked_at
       FROM user_clinic_access a
       JOIN roles r ON r.id = a.role_id AND r.clinic_id = a.clinic_id
      WHERE a.user_id = $1
        AND a.clinic_id = $2
        AND r.name = $3
        AND r.is_system = true
      LIMIT 1
      FOR UPDATE`,
    [options.user_id, options.clinic_id, OPERATOR_ROLE_NAME],
  );
  return result.rows[0] ?? null;
}

export async function revokeOperatorAccess(client, options) {
  if (!options.apply) {
    await getTarget(client, options);
    const membership = await client.query(
      `SELECT a.role_id, a.expires_at, a.revoked_at
         FROM user_clinic_access a
         JOIN roles r ON r.id = a.role_id AND r.clinic_id = a.clinic_id
        WHERE a.user_id = $1 AND a.clinic_id = $2
          AND r.name = $3 AND r.is_system = true
        LIMIT 1`,
      [options.user_id, options.clinic_id, OPERATOR_ROLE_NAME],
    );
    return {
      dryRun: true,
      userId: options.user_id,
      clinicId: options.clinic_id,
      permission: options.permission,
      wouldRevoke: Boolean(membership.rows[0] && membership.rows[0].revoked_at === null),
    };
  }

  return inTransaction(client, async () => {
    await getTarget(client, options);
    const membership = await getOperatorMembership(client, options);
    if (!membership) {
      return {
        dryRun: false,
        userId: options.user_id,
        clinicId: options.clinic_id,
        permission: options.permission,
        revoked: false,
      };
    }

    const now = new Date().toISOString();
    await client.query(
      `UPDATE user_clinic_access
          SET revoked_at = now(), grant_reason = $3, granted_by = $4
        WHERE user_id = $1 AND clinic_id = $2`,
      [options.user_id, options.clinic_id, options.reason, options.actor],
    );

    await client.query(
      `UPDATE users
          SET session_version = session_version + 1, updated_at = now()
        WHERE id = $1`,
      [options.user_id],
    );

    const activeUsers = await client.query(
      `SELECT count(*)::int AS count
         FROM user_clinic_access a
         JOIN users u ON u.id = a.user_id
        WHERE a.role_id = $1
          AND a.revoked_at IS NULL
          AND (a.expires_at IS NULL OR a.expires_at > now())
          AND u.is_active = true`,
      [membership.role_id],
    );
    if (activeUsers.rows[0].count === 0) {
      await client.query(
        'DELETE FROM role_permissions WHERE role_id = $1 AND permission_key = $2',
        [membership.role_id, options.permission],
      );
    }

    await insertAudit(client, {
      options,
      action: 'rbac.operator_revoke',
      oldValues: { roleId: membership.role_id, expiresAt: membership.expires_at, revokedAt: membership.revoked_at },
      newValues: { revoked: true, revokedAt: now, permission: options.permission, reason: options.reason },
    });

    return {
      dryRun: false,
      userId: options.user_id,
      clinicId: options.clinic_id,
      permission: options.permission,
      revoked: true,
    };
  });
}

export async function main(command, options, { ClientClass = Client, connectionString = DEFAULT_CONNECTION_STRING } = {}) {
  const client = new ClientClass({ connectionString });
  await client.connect();
  try {
    const result = command === 'grant'
      ? await grantOperatorAccess(client, options)
      : await revokeOperatorAccess(client, options);
    console.log(JSON.stringify({ command, ...result }));
    return result;
  } finally {
    await client.end();
  }
}

export function isMainModule(metaUrl, argv1) {
  if (!metaUrl || !argv1) return false;
  return pathToFileURL(resolve(argv1)).href === metaUrl;
}
