# Patients Contacts Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clarify boundary between `patients` (clínico) and `contacts` (CRM) without risky consolidation.

**Architecture:** Add one source of truth for copy about domain ownership. Wire patient-facing pages to clinical copy and contact-facing page to CRM copy. Add an explicit CRM note on patient detail page to reduce ambiguity.

**Tech Stack:** Next.js 15, React 19, TypeScript, Jest

**Agent Orchestration:** Single-Agent Looped

## Tasks
- [x] RED: add failing test for domain boundary copy module
- [x] GREEN: create `src/lib/domain-boundaries.ts`
- [x] REFACTOR: reuse boundary copy in `dashboard/pacientes` and `dashboard/contatos`
- [x] REFACTOR: add explicit CRM note in `dashboard/pacientes/[id]`
- [ ] VERIFY: run focused test, typecheck, full tests
