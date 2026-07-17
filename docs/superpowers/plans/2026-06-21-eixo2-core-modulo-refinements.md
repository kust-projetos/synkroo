# Eixo 2 Core — Refinements to Sequencing DoD

> Companion note for `docs/superpowers/specs/2026-06-21-eixo2-core-modulo-design.md`.

## Gates

Sequencing DoD said: gate `/api/*` module routes and crons in Onda 0.
Core refinement: Onda 0 closes gate mechanism, tests, documentation, and first genuine application when Core has a real target. Contractable module route/cron rollout happens in the owner module specs because no migrated contractable module exists yet.

## Menu

Sequencing DoD said: menu/routes through manifest + RBAC.
Core refinement: Core menu is manifest+RBAC now. Static items for CRM/Pipeline/Leads/Campaigns remain documented debt because their owner modules are not migrated. Each owner module spec must move its items into its manifest and remove static `navItems` entries.

## Contatos

`/dashboard/contatos` stays unavailable by direct URL until E-04 owns route/model. No redirect to `/crm` because CRM may not be contracted.
