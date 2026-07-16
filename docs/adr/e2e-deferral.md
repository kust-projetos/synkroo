# ADR: Deferral of E2E Tests

**Date:** 2026-07-16  
**Status:** Accepted  
**Context:** Eixo 2 CRM/Financeiro integration closure

## Decision

Playwright E2E coverage is deferred by the Eixo 2 implementation plan. Unit, integration, mutation, typecheck, lint, build and audit gates are the closure criteria for this MVP scope.

## Rationale

- Eixo 2 closes module boundaries, authorization, API contracts, and component behavior with focused automated tests.
- Browser flows are deferred until UX flows and selectors stabilize.
- This decision does not attribute the deferral to a user request and requires no git commit, push, or merge.

## Revisit

Add E2E coverage when cross-module browser workflows are stabilized or E2E work is explicitly prioritized.

## Impact

Cross-module browser flows remain a known risk; CRM duplicate execution integration coverage mitigates backend concurrency and tenant-isolation risk.
