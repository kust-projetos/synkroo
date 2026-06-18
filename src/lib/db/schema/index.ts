// ──────────────────────────────────────────────
// Drizzle schema — Synkroo PostgreSQL schema
// Ported from legacy SQL migrations
// RLS policies, auth-specific SQL, and service-role
// constructs are REMOVED per cutover design.
// ──────────────────────────────────────────────

export * from './enums';
export * from './core';
export * from './appointments';
export * from './conversations';
export * from './crm';
export * from './business';
export * from './agent';
export * from './infra';
export * from './audit';
export * from './rbac';
