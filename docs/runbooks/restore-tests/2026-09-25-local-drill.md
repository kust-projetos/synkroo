# Restore drill local — 2026-09-25 (Opção A, alvo descartável)

Drill executado conforme `docs/runbooks/database-recovery.md` §2.2 Opção A e
§2.3 (roteiro testável). Origem do backup: **dev local** (`synkroo-db`).
No momento deste drill local, o drill contra backup de **produção** estava
**PENDENTE-RUNTIME**; foi executado no mesmo dia — ver
[2026-09-25-prod-drill.md](2026-09-25-prod-drill.md).

## Comandos executados

```bash
# 1. Backup (14:12 UTC — 11:12 local UTC-3)
node scripts/db-backup.mjs --local --out-dir ./backups --keep 7

# 2. Alvo isolado
docker run --rm -d --name synkroo-restore-test \
  -e POSTGRES_DB=synkroo_restore -e POSTGRES_USER=synkroo_test \
  -e POSTGRES_PASSWORD=restore-test-only \
  -p 55435:5432 pgvector/pgvector:pg17
docker exec synkroo-restore-test pg_isready -U synkroo_test -d synkroo_restore

# 3. Dry-run (exit 0, só plano, nada alterado)
node scripts/db-restore.mjs ./backups/synkroo-20260925-141221.dump.gz --local \
  --container synkroo-restore-test --db synkroo_restore --user synkroo_test

# 4. Restore real (14:17:33 → 14:17:53 UTC — 11:17:33 → 11:17:53 local UTC-3)
node scripts/db-restore.mjs ./backups/synkroo-20260925-141221.dump.gz --local \
  --container synkroo-restore-test --db synkroo_restore --user synkroo_test --yes

# 5. Ledger de migrations (restore × dev × cadeia canônica)
docker exec synkroo-restore-test psql -U synkroo_test -d synkroo_restore \
  -t -c "SELECT count(*) FROM drizzle.__drizzle_migrations"
docker exec synkroo-db psql -U synkroo -d synkroo \
  -t -c "SELECT count(*) FROM drizzle.__drizzle_migrations"
# dumps id,hash em cada banco para inspeção visual (comparados manualmente):
docker exec synkroo-restore-test psql -U synkroo_test -d synkroo_restore \
  -t -c "SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id"
docker exec synkroo-db psql -U synkroo -d synkroo \
  -t -c "SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id"
# contagens conferem (31/31); identidade dos hashes verificada por inspeção
# visual dos dumps de saída, comandos registrados acima

# 6. Limpeza
docker stop synkroo-restore-test   # --rm remove; `docker ps -a` confirma ausência
```

## Resultados

- Verificação pós-restore do script: `clinics: 0`, `users: 0`, `patients: 0`,
  `appointments: 0` (dev local sem seed — contagens zeradas esperadas e válidas).
- Ledger: 31 migrations aplicadas no restore; contagens conferem (31/31) e a
  identidade dos hashes foi verificada por inspeção visual dos dumps de
  `SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id` em cada banco
  (comandos registrados acima). Cadeia canônica no repo: 33 arquivos em
  `src/lib/db/migrations/` (`0000`–`0033`, sem `0017`; journal com 33 entradas).
  Divergência explicada (estado NO MOMENTO do drill): `0032_idempotency_fingerprint`
  e `0033_idempotency_result_ref` ainda não haviam sido aplicadas no dev local
  — o restore reproduziu o dev com fidelidade, não é perda de dados.
  Atualização pós-drill (mesmo dia): `npm run db:migrate` executado no dev;
  contagem pós-migrate = 33/33.
- Banco dev `synkroo-db` intacto (healthy após o drill); nada de produção tocado.

## Tempos medidos (datapoint RTO local)

| Etapa | Duração aprox. |
|---|---|
| Backup (`pg_dump -Fc` + gzip + sha256, 24,2 KiB) | < 10 s |
| Subida + `pg_isready` do alvo (init do cluster) | ~ 50 s |
| Restore real + verificação (4 tabelas) | ~ 20 s (14:17:33 → 14:17:53 UTC) |
| Fim a fim (backup → limpeza) | ~ 5 min |

Datapoint RTO **local**: restore + verificação ≈ 20 s (banco pequeno, sem seed).
Não extrapolar para produção (volume, rede e smoke pós-deploy não incluídos).

## Bloco de evidência (§5 do runbook)

```text
RESTORE TEST — 2026-09-25
- Backup usado: synkroo-20260925-141221.dump.gz (hash sha256: 9bde01bcc6323d0023534309c3e99dcf884f657751992fab991daa918f578b5e)
- Origem do backup: dev local (container synkroo-db, db synkroo) — no momento deste drill, o drill de produção estava PENDENTE-RUNTIME (executado no mesmo dia, ver [2026-09-25-prod-drill.md](2026-09-25-prod-drill.md))
- Ambiente de restore: container descartável synkroo-restore-test (pgvector/pgvector:pg17, porta 55435)
- Início/fim do restore: 14:17:33 → 14:17:53 UTC (11:17:33 → 11:17:53 local UTC-3; tempo total: ~20 s; fim a fim backup→limpeza: ~5 min)
- pg_restore: [x] OK sem erros / [ ] OK com avisos (anexar) / [ ] FALHOU (anexar log redatado)
- Ledger de migrations confere com dev (31 aplicadas; contagens 31/31 e hashes idênticos por inspeção visual dos dumps, comandos acima): [x] sim / [ ] não
  (cadeia canônica no repo: 33 arquivos 0000–0033; dev no momento do drill: 31 aplicadas — pós-drill `npm run db:migrate` elevou para 33/33)
- Smoke pós-restore ([smoke-deploy-runbook](../../ops/smoke-deploy-runbook.md)): [ ] PASS / [ ] FAIL — não executado (alvo descartável removido após verificação; verificação por contagens + ledger)
- Smoke pós-restore: PENDENTE (alvo descartável removido; executar no próximo drill com alvo vivo)
- Resultado: [ ] backup VÁLIDO (validade plena — exige restore OK + ledger conferido + smoke PASS, §2.2) / [x] VÁLIDO PARA DRILL LOCAL (mecanismo provado; validade completa condicionada ao smoke pós-restore; o drill contra backup de produção foi executado no mesmo dia — [2026-09-25-prod-drill.md](2026-09-25-prod-drill.md)) / [ ] backup INVÁLIDO (ação: <…>)
- Responsável: database-engineer (drill automatizado) — Operação ciente: pendente (RPO/RTO seguem A CONFIRMAR pelo owner)
```
