// ──────────────────────────────────────────────
// Drizzle schema — Synkroo PostgreSQL schema
// Ported from legacy SQL migrations
// RLS policies, auth-specific SQL, and service-role
// constructs are REMOVED per cutover design.
// ──────────────────────────────────────────────

export * from './enums';
export * from './core';
// Compatibility barrel. New module code must import its owning schema seam.
export * from '../../../modules/operacional/schema';
export * from '../../../modules/atendimento/schema';
export * from '../../../modules/comercial/schema';
export * from '../../../modules/followup/schema';
export * from '../../../modules/crm/schema';
export * from '../../../modules/financeiro/schema';
export * from '../../../modules/ia/schema';
export * from '../../../core/schema/infra';
export * from './audit';
export * from '../../../modules/core/schema/rbac';
export * from './modules';
