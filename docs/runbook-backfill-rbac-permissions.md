# Runbook: Backfill RBAC Permissions

## Purpose

Ensures every clinic has the canonical set of roles (Owner + 4 system presets + Agente)
with the correct permission keys. Reads from `src/core/rbac/preset-policy.json` as the
single source of truth.

## When to run

- **Initial deploy** of the RBAC system (every clinic needs roles).
- **After adding a new module** (e.g., a new module's permissions need to be assigned
  to existing roles).
- **After modifying `preset-policy.json`** to update the permission policy for all
  existing clinics.

## Prerequisites

- PostgreSQL connection string in `DATABASE_URL` environment variable.
- Node.js 20+.
- Package `pg` installed (`npm install pg`).

## Usage

### Backfill all clinics

```bash
node scripts/backfill-rbac-permissions.mjs
```

### Dry run (log only, no mutations)

```bash
node scripts/backfill-rbac-permissions.mjs --dry-run
```

### Single clinic

```bash
node scripts/backfill-rbac-permissions.mjs --clinic=<clinic-uuid>
```

## How it works

1. Reads `src/core/rbac/preset-policy.json` for canonical definitions.
2. For each clinic (or the specified clinic):
   - **Owner role**: Gets ALL non-master permissions from the catalog.
   - **Preset roles** (Administrador, Recepcionista, Comercial, Dentista):
     Gets module-scoped permissions + extra keys as defined in the policy.
   - **Agente role**: Gets the conservative default permissions from the policy.
3. All inserts use `ON CONFLICT DO NOTHING` — completely idempotent.

## Verification

After running, verify the roles were created:

```sql
SELECT r.name, COUNT(rp.permission_key) as permissions
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
WHERE r.clinic_id = '<clinic-uuid>'
GROUP BY r.name
ORDER BY r.name;
```

Expected output:
```
Administrador | <N>
Agente        | 10
Comercial     | <N>
Dentista      | <N>
Owner         | <N>  (all non-master)
Recepcionista | <N>
```

## Safety

- Idempotent: running multiple times is safe (duplicates are ignored).
- Dry run: `--dry-run` flag logs what WOULD be done without mutating.
- Security plan (`docs/superpowers/plans/2026-07-15-eixo2-security-integrity-hardening-implementation.md`)
  is NEVER touched by this script.
