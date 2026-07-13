// ──────────────────────────────────────────────
// Drizzle schema — Synkroo PostgreSQL schema
// Ported from legacy SQL migrations
// RLS policies, auth-specific SQL, and service-role
// constructs are REMOVED per cutover design.
// ──────────────────────────────────────────────

export * from './enums';
export * from './core';
// Appointments schema moved to modules/operacional/schema
// (maintained as deprecated re-export for backward compat)
export * from '../../../modules/operacional/schema';
export * from './conversations';
export * from './crm';
export * from '../../../modules/crm/schema';
export * from './business';
export * from './agent';
export * from './infra';
export * from './audit';
export * from '../../../modules/core/schema/rbac';
export * from './modules';
export * from '../../../modules/comercial/schema';
