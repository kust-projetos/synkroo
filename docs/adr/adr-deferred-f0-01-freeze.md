# ADR-DEFERRED-F0.01 — Freeze de release/merge/push/clones

**Status:** DEFERRED — Decision Record
**Data:** 2026-08-24
**Wave:** W0 F0.01

## Contexto
F0.01 requer congelar release, merge, push e novos clones como contenção de incidente de credenciais. Plano `2026-08-15-synkroo-roadmap` classifica como `DEFERRED` aguardando `decision record`.

## Decisão
**Deferido com janela controlada.** Não executar freeze destrutivo automático. Manter política de freeze sob aprovação do owner com janela de manutenção, lista de clones, e plano de comunicação. Registro sanitizado em `docs/superpowers/audits/` + `docs/security/credential-inventory.md`.

## Consequência
Gate W0 permanece `DEFERRED` até owner autorizar janela. Nenhum push/merge automático é executado pelo agente.

## Gate
`none / decision record needed` → atendido por este ADR.
