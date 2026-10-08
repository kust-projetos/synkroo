/**
 * scripts/lib/pg-ddl.mjs
 *
 * SQL text builders for the staging role plus a secrets-safe error summariser.
 *
 * DDL safety: PostgreSQL cannot carry a NUL byte inside a string literal and
 * cannot parameterise utility statements such as CREATE/ALTER ROLE, so the
 * password must be quoted in the statement text. Quoting is done here — never
 * by template interpolation at the call site — using an `E'…'` literal so the
 * result is independent of the `standard_conforming_strings` GUC.
 *
 * Error safety: driver errors embed the failing statement, and those statements
 * carry the role password. `safeDbErrorSummary` therefore never returns raw
 * error text: only operator-authored preflight messages (tagged with a
 * SYNKROO_* code, built only from paths and key names) or an allowlisted code.
 */

export class SqlLiteralError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SqlLiteralError';
    this.code = 'SYNKROO_SQL_LITERAL_REJECTED';
  }
}

const NUL = '\0';

/**
 * Quotes an SQL identifier (double quotes, embedded quotes doubled).
 *
 * @param {string} value
 * @returns {string}
 */
export function quotePgIdentifier(value) {
  const raw = String(value ?? '');
  if (raw.includes(NUL)) {
    throw new SqlLiteralError('Refusing to build SQL: identifier contains a NUL byte.');
  }
  return `"${raw.replace(/"/g, '""')}"`;
}

/**
 * Quotes an SQL string literal as `E'…'`: backslashes and single quotes are
 * escaped, and a NUL byte is rejected instead of silently truncating.
 *
 * @param {string} value
 * @returns {string}
 */
export function quotePgLiteral(value) {
  const raw = String(value ?? '');
  if (raw.includes(NUL)) {
    throw new SqlLiteralError('Refusing to build SQL: value contains a NUL byte.');
  }
  const escaped = raw.replace(/\\/g, '\\\\').replace(/'/g, "''");
  return `E'${escaped}'`;
}

/**
 * @param {{role: string, password: string}} params
 * @returns {string}
 */
export function createRoleWithPasswordDdl({ role, password }) {
  return `CREATE ROLE ${quotePgIdentifier(role)} WITH LOGIN CREATEDB PASSWORD ${quotePgLiteral(password)};`;
}

/**
 * @param {{role: string, password: string}} params
 * @returns {string}
 */
export function alterRolePasswordDdl({ role, password }) {
  return `ALTER ROLE ${quotePgIdentifier(role)} WITH CREATEDB PASSWORD ${quotePgLiteral(password)};`;
}

/**
 * @param {{database: string, owner: string}} params
 * @returns {string}
 */
export function createDatabaseOwnedByDdl({ database, owner }) {
  return `CREATE DATABASE ${quotePgIdentifier(database)} OWNER ${quotePgIdentifier(owner)};`;
}

/**
 * GRANT targets a role NAME, not a string value: PostgreSQL expects a role
 * specifier (identifier), so `TO 'role'` is a syntax error and the statement
 * would fail. Quoted as an identifier, not as a literal.
 *
 * @param {{role: string}} params
 * @returns {string}
 */
export function grantAllOnSchemaPublicDdl({ role }) {
  return `GRANT ALL ON SCHEMA public TO ${quotePgIdentifier(role)};`;
}

/** Preflight errors raised by this repo carry a SYNKROO_* code and are safe to show. */
export const SAFE_PREFLIGHT_CODE_PREFIX = 'SYNKROO_';

/**
 * Transport/auth/SQLSTATE codes with no free-form text — safe to echo verbatim.
 * Membership is checked against this exact set, so a hostile `code` cannot be
 * injected into the log line.
 */
const ALLOWLISTED_DB_CODES = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '25006',
  '28000',
  '28P01',
  '3D000',
  '42501',
  '42P04',
  '42710',
  '53300',
  '57P03',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'EPROTO',
  'ETIMEDOUT',
]);

export const SAFE_DB_ERROR_MESSAGE =
  'database operation failed (details redacted to avoid leaking credentials)';

/**
 * Secrets-safe one-liner for operator output. Raw `error.message` is never
 * returned for driver errors, because it embeds the statement text.
 *
 * @param {unknown} error
 * @returns {string}
 */
export function safeDbErrorSummary(error) {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (code.startsWith(SAFE_PREFLIGHT_CODE_PREFIX)) {
    return message || 'setup failed during preflight';
  }
  if (ALLOWLISTED_DB_CODES.has(code)) {
    return `database operation failed (code: ${code})`;
  }
  return SAFE_DB_ERROR_MESSAGE;
}