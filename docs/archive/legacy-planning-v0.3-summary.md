# Legacy Planning v0.3 Summary

## Scope

Historical planning system from April–May 2026. It recorded calendar, WhatsApp, CRM, pipeline, finance, analytics, and LGPD delivery phases.

## Superseded Assumptions

- Supabase Auth and Supabase/RLS were recorded as runtime foundations.
- Claude Agent SDK was recorded as agent runtime.
- Legacy phase status must not guide current implementation.

## Current Direction

Use Drizzle ORM with PostgreSQL, NextAuth/Auth.js, Next.js 15, and Cloudflare/OpenNext migration guidance. Current roadmap source: `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md`.

## Immutable Source

Historical source remains available at Git commit `db080da9` and tag `archive/planning-v0.3`.
