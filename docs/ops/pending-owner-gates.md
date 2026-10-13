# Gates do owner/operador — spec-only (sem mutação)

Gerado 2026-10-13 na rodada autônoma de pendências. Nenhum item aqui foi
executado; cada um exige decisão ou acesso do owner. `GO` só com evidência.

## G1. Piloto W12 — execução real (janela 2026-09-01 vencida)
- Teto atual: dry-run 92/100 (`docs/goals/roadmap-143-resume.md`).
- Para GO: backup `pg_dump` staging + sha256, J-01..J-12 autenticados,
  6 drills com injeção real, rubrica → GO do owner (`B-OWNER-GO-NO-GO` R5).
- Decisão pendente do owner desde 2026-09-25 (go/no-go do piloto).

## G2. Switch real em produção + smoke fim a fim
- Feito: drill local 2026-09-26 completo (RTO ~114s, smoke 3/3).
- Falta: switch real em prod, datapoint de restore em prod com smoke,
  drill mensal agendado, ratificação de RPO/RTO pelo owner.

## G3. Limiter distribuído (DO/KV)
- Estado: limiter in-memory por instância + identidade via headers de borda.
- Gatilho documentado para migrar; sem incidente que o exija. Não migrar
  por hipótese.

## G4. Remoção do fallback `../vps-hostinger/.env`
- Código centralizado em `scripts/lib/vps-env.mjs:36` (+ espelho TS) com
  warn; `SYNKROO_VPS_ENV` canônico e fail-closed.
- Só remover após confirmar `SYNKROO_VPS_ENV` válido na VPS (ver
  `docs/ops/vps-access.md`). Remoção antes disso aborta os 5 scripts.

## G5. D3 G3 — drill de contenção
- Mecanismo pronto (commit `f2ec8a5e`); drill G3 pendente em target real.

## G6. Tranches major #19 (next 16) e #20 (zod 4) — NÃO mergear
- #19: tsc/testes passam, build quebra (next-auth v4 incompatível provável
  + eslint-config-next 15 + matriz @opennextjs/cloudflare). Exige triage do
  build log + plano de migração next-auth.
- #20: tsc quebra em 3 actions (`receber-mensagem.ts:18`,
  `receber-widget-mensagem.ts:15`, `processar-webhook-whatsapp.ts:23`) +
  2 testes + `zod-to-json-schema@3` incompatível. Exige migração dedicada.
