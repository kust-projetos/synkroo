# W12 Pilot Readiness — EXTERNAL (sem execução)

> **Status:** EXTERNAL — preparação documental apenas, sem provisionamento, import ou execução de piloto.
> **Owner gate:** requer aprovação explícita do owner antes de qualquer J-01..J-12 ou drill.

## Owner
- Owner: _a preencher pelo owner_
- Tenant piloto: _nome da clínica piloto_
- Janela: _data/hora + fuso (ex: 2026-09-01 09:00 America/Sao_Paulo)_

## Rollback
- Rollback: `docs/superpowers/plans/2026-08-15-synkroo-roadmap-pendencias-master-plan.md` — manter `main` estável, rollback via redeploy da tag anterior, DB usa roll-forward (não down destrutivo) conforme F11.14.

## Dados
- Dados: apenas anonimizados ou aprovados pelo owner. Nenhum dado PII/produção sem consentimento. Sem credenciais em claro neste documento (apenas nomes de vars/fingerprints como `DATABASE_URL`, `AUTH_SECRET`).

## Gates exigidos
- J-01..J-12 sem capacidade baseline beta — requer ambiente staging/piloto aprovado
- Indisponibilidades: Evolution, LLM, DB, Queue, sidecar — drill apenas com autorização
- Validações: mobile/desktop, a11y, performance — contra candidato de release
- Treinamento: equipe nomeada, registro de feedback sem alteração automática de scope
- Scorecard: defects, segurança, SLO, operação — inputs dependem da execução do piloto (F12.07/F12.08)

## Checklist de preparação (sem execução externa)
- [ ] Owner, tenant e janela definidos e assinados
- [ ] Dataset anonimizado/aprovado registrado
- [ ] Ambiente staging/piloto provisionado via onboarding gerenciado (F11.02)
- [ ] Runbooks e alertas (F11.10) alinhados à janela
- [ ] Critérios de abort/roll-forward comunicados

## Referências
- `docs/security/credential-inventory.md` — inventário de credenciais (sem valores)
- `docs/superpowers/audits/roadmap-143-ledger.json` — W12 EXTERNAL (F12.01..F12.08)
