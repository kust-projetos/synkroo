# Restore drill local — 2026-09-26 (alvo VIVO + smoke fim-a-fim)

Drill executado conforme `docs/runbooks/database-recovery.md` §2.2 Opção A e
§2.3 (roteiro testável). Origem do backup: **dev local** (`synkroo-db`).
Este drill completa o que ficou pendente no
[drill local de 2026-09-25](2026-09-25-local-drill.md)
(smoke pós-restore não executado — alvo descartável removido após verificação):
**alvo mantido vivo + smoke fim-a-fim PASS + RTO fim-a-fim medido**.
Nada de produção/VPS tocado (proibição respeitada: sem SSH, sem commit/push,
sem `db:reset`, só containers prefixo `dr-drill-`).

## Comandos executados

```bash
# 1. Dev local já ativo (synkroo-db healthy há 8h); backup atual (17:04:38 local UTC-3 / 20:04:38 UTC)
node scripts/db-backup.mjs --local --out-dir ./backups --keep 7
# → backups/synkroo-20260926-200438.dump.gz (63,2 KiB / 64.714 bytes,
#   sha256 30335ab7f0cc8a3ad01f21e5246668cc93842a9db5a888eddbf07bdabafc4266)

# 2. Estado-fonte registrado (dev local, pré-backup)
docker exec synkroo-db psql -U synkroo -d synkroo -tAc "SELECT ... FROM clinics/users/patients/appointments"
# clinics=1 users=1 patients=2 appointments=73 · migrations=33

# 3. Alvo isolado (mesma imagem do compose: pgvector/pgvector:pg17)
# Nota: existia um dr-drill-pg stale (exited, criado 07:19 de hoje por tentativa
# anterior) — removido (`docker rm`) e recriado fresco com o mesmo nome/porta.
docker run -d --name dr-drill-pg -e POSTGRES_PASSWORD=drill -p 15433:5432 pgvector/pgvector:pg17
docker exec dr-drill-pg pg_isready -U postgres -d postgres   # accepting connections em ~18 s

# 4. Restore real (17:07:08 → ~17:07:23 local; 20:07:08 UTC)
# DESVIO DOCUMENTADO vs roteiro prescrito: o host Windows NÃO tem pg_restore/psql
# no PATH, de modo que o modo `--url` (DATABASE_URL) do script é inexequível aqui.
# Usado o modo equivalente `--local --container dr-drill-pg --db postgres --user postgres`
# (mesmo pg_restore, mesma verificação, alvo igualmente isolado; porta 15433 = prescrita).
node scripts/db-restore.mjs ./backups/synkroo-20260926-200438.dump.gz --local \
  --container dr-drill-pg --db postgres --user postgres --yes
# ✅ pg_restore concluído sem erro
# ✅ Verificação pós-restore: clinics: 1, users: 1, patients: 2, appointments: 73 (idêntico à fonte)

# 5. Ledger de migrations no alvo
docker exec dr-drill-pg psql -U postgres -d postgres -tAc "SELECT count(*) FROM drizzle.__drizzle_migrations"
# migrations=33 (confere 33/33 com a cadeia canônica 0000–0033)

# 6. SMOKE fim-a-fim com alvo vivo (a peça faltante do drill de 2026-09-25)
# App apontado para o alvo com env mínimas DESCARTÁVEIS geradas na hora
# (AUTH_SECRET 64hex ≥32, JWT_SECRET 48hex ≥16 — nunca segredos reais; .env.local
# intacto, override só no processo-filho via env):
$env:DATABASE_URL='postgresql://postgres:drill@localhost:15433/postgres'
npm run dev -- -p 3005   # PID filho node; pronto (GET /api/health 200) em ~50 s
# (a) GET http://localhost:3005/api/health
# → 200 {"status":"ok","timestamp":"2026-09-26T20:08:50.215Z","version":"1.0.0"}  PASS
# (b) GET http://localhost:3005/api/health/db
# → 200 {"data":{"status":"complete","complete":true,"migrationsApplied":33,"migrationsExpected":33}}  PASS
# (c) GET http://localhost:3005/dashboard sem sessão (MaximumRedirection 0)
# → 307 Location: /login?redirectTo=%2Fdashboard  PASS

# 7. Limpeza (17:09+ local)
docker rm -f dr-drill-pg            # alvo descartável removido
# dev server morto (node PID 15492 na porta 3005; porta 3005 livre confirmada)
# Backup MANTIDO em backups/synkroo-20260926-200438.dump.gz (+ .sha256)
# `docker ps` final: só pi-f2-integration-sol, ai-memory, synkroo-db (intacto: 1/1/2/73)
```

## Resultados

- Restore: OK sem erros; contagens idênticas à fonte (1/1/2/73); ledger 33/33.
- Smoke fim-a-fim (alvo vivo): **3/3 PASS** — (a) liveness 200 `status:ok`;
  (b) db 200 `complete:true` 33/33; (c) `/dashboard` → 307 para
  `/login?redirectTo=%2Fdashboard`.
- Banco dev `synkroo-db` intacto; `.env.local` e demais arquivos intocados;
  nenhum container fora do prefixo `dr-drill-*` tocado.
- Logs do dev server do drill (diagnóstico, se necessário):
  `C:\Users\walis\AppData\Local\Temp\opencode\dr-drill-dev.log` (+ `.err.log`).

## Tempos medidos (RTO local fim-a-fim)

| Etapa | Duração |
|---|---|
| Backup (`pg_dump -Fc` + gzip + sha256, 63,2 KiB) | < 10 s (17:04:38 local) |
| Subida + `pg_isready` do alvo (init do cluster) | ~ 18 s |
| Restore real + verificação (4 tabelas) | ~ 15 s (17:07:08 → ~17:07:23 local) |
| Boot do app contra o alvo + primeira resposta 200 | ~ 50 s (17:07:55 → 17:08:45 local; inclui compilação Next) |
| 3 checks do smoke | ~ 17 s (17:08:45 → 17:09:02 local) |
| **RTO local fim-a-fim (início do restore → último check PASS)** | **~ 114 s (≈ 2 min)** |

Datapoint RTO **local**: restore + smoke fim-a-fim ≈ 2 min (banco pequeno,
seed de dev). Não extrapolar para produção (volume, rede, switch real e
Hyperdrive não incluídos).

## Bloco de evidência (§5 do runbook)

```text
RESTORE TEST — 2026-09-26
- Backup usado: synkroo-20260926-200438.dump.gz (63,2 KiB / 64.714 bytes;
  hash sha256: 30335ab7f0cc8a3ad01f21e5246668cc93842a9db5a888eddbf07bdabafc4266)
- Origem do backup: dev local (container synkroo-db, db synkroo; clinics=1 users=1 patients=2 appointments=73, ledger 33)
- Ambiente de restore: container descartável dr-drill-pg (pgvector/pgvector:pg17, porta 15433; stale exited removido e recriado)
- Início do restore → último check PASS: 17:07:08 → 17:09:02 local UTC-3 (20:07:08 → 20:09:02 UTC; RTO fim-a-fim ≈ 114 s ≈ 2 min)
- pg_restore: [x] OK sem erros / [ ] OK com avisos (anexar) / [ ] FALHOU (anexar log redatado)
  (modo --local --container dr-drill-pg — desvio documentado: host sem pg_restore/psql inviabiliza --url/DATABASE_URL)
- Ledger de migrations confere com cadeia canônica 0000–0033 (33/33 no alvo): [x] sim / [ ] não
- Smoke pós-restore ([smoke-deploy-runbook](../../ops/smoke-deploy-runbook.md), alvo vivo, app em :3005):
  (a) liveness 200 [x] PASS · (b) db 200 complete:true 33/33 [x] PASS · (c) /dashboard → 307 /login [x] PASS
- Resultado: [x] backup VÁLIDO (restore OK + ledger conferido + smoke PASS, §2.2) / [ ] backup INVÁLIDO (ação: <…>)
- Responsável: infra-engineer (drill W2-DR-DRILL-LOCAL) — Operação ciente: pendente (RPO/RTO seguem A CONFIRMAR pelo owner)
```

## O que falta (pós-drill)

- **Switch real**: reapontar app/Hyperdrive para banco restaurado e liberar
  escrita (cenário §3a) — nunca exercitado; exige janela e decisão do owner.
- **Drill mensal**: rotina proposta (§1 do runbook) ainda sem agendamento nem
  dono definidos.
- **Decisão de retenção do owner**: RPO/RTO fim-a-fim de produção seguem
  A RATIFICAR; RPO (backup diário/off-host/cron) NÃO medido nem configurado;
  retenção 7+4+3 e cópia off-host pendentes de decisão operacional.
- **Reprodutibilidade Windows**: documentar no runbook que o modo `--url` dos
  scripts exige `postgresql-client` no host (inexistente neste host Windows) e
  que o modo `--local --container <alvo>` é o equivalente operacional.
```

(End of file - total 112 lines)
