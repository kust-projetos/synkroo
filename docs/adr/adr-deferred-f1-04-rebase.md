# ADR-DEFERRED-F1.04 — Rebase branch de execução sobre main

**Status:** DEFERRED — Decision Record
**Data:** 2026-08-24
**Wave:** W1 F1.04

## Contexto
F1.04 rebasear nova branch de execução sobre `main` atualizado. Requer `main` estável e owner approval para rebase.

## Decisão
**Deferido.** Execução ocorre direto em `main` com waves sequenciais `W0→W11` via Orca `run_566be80b7ce1`. Rebase não necessário; execução em `main` preserva `AGENTS.md` e evita rewrite.

## Gate
`none / decision record needed` → atendido.
