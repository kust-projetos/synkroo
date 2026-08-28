# Synkroo Planning Index

This index is the navigation authority for planning documents. It does not duplicate the 143-item ledger; it defines which document owns decisions and which documents are executable.

## Canonical

- Product/architecture: [`../specs/2026-07-28-synkroo-canonical-product-architecture.md`](../specs/2026-07-28-synkroo-canonical-product-architecture.md)
- Program design: [`../specs/2026-08-16-roadmap-143-goal-program-design.md`](../specs/2026-08-16-roadmap-143-goal-program-design.md)
- Program execution: [`2026-08-16-roadmap-143-master-implementation.md`](2026-08-16-roadmap-143-master-implementation.md)
- Current reconciliation: [`2026-08-15-synkroo-roadmap-pendencias-master-plan.md`](2026-08-15-synkroo-roadmap-pendencias-master-plan.md)

## Source snapshot

- [`2026-07-28-synkroo-development-master-plan.md`](2026-07-28-synkroo-development-master-plan.md) — original 143 unchecked requirements and historical source context. Its IDs are owned by the current reconciliation; its checkboxes are not an independent backlog.

## Active wave plans

- [`2026-08-16-roadmap-143-wave-0-recovery.md`](2026-08-16-roadmap-143-wave-0-recovery.md)
- [`2026-08-16-roadmap-143-wave-1-foundation.md`](2026-08-16-roadmap-143-wave-1-foundation.md)
- [`2026-08-16-roadmap-143-wave-2-clinical.md`](2026-08-16-roadmap-143-wave-2-clinical.md)
- [`2026-08-16-roadmap-143-wave-3-channels-ai.md`](2026-08-16-roadmap-143-wave-3-channels-ai.md)
- [`2026-08-16-roadmap-143-wave-4-business-lgpd.md`](2026-08-16-roadmap-143-wave-4-business-lgpd.md)
- [`2026-08-16-roadmap-143-wave-5-release-pilot.md`](2026-08-16-roadmap-143-wave-5-release-pilot.md)
- [`2026-08-27-synkroo-teste-producao-plan.md`](2026-08-27-synkroo-teste-producao-plan.md) — Teste em produção W11/W12 (child de Wave 5, baseado em resume 22:07 92/100)

## Historical

- [`ui-redesign/phase-1-foundation.md`](ui-redesign/phase-1-foundation.md) — historical UI work, not active unless explicitly linked by a canonical plan.
- Any other plan under this directory is research, evidence, or historical context unless the master execution plan links it as an active dependency.

Historical unchecked boxes never create duplicate backlog. New work must first receive an item/goal assignment in the current reconciliation and master execution plan.

## Execution rule

Precedence is:

1. Canonical product/architecture spec for product boundaries.
2. Canonical program design spec for autonomy, evidence, gates and rubric.
3. Master execution plan for DAG, ownership, wave order and stop conditions.
4. Current reconciliation for the status and evidence of each `F0.01`–`F12.08` item.
5. Active wave plan for implementation steps under the master plan.
6. Audit/evidence artifacts for receipts; they cannot silently change scope or status.

When documents disagree, stop status mutation, cite the conflict in the owning audit, and follow the higher-precedence document. Do not promote a roadmap item based only on a green wave gate; attach item-level evidence first.
