# Restore drill de producao — 2026-09-25 (alvo descartavel na VPS)

Drill executado conforme `docs/runbooks/database-recovery.md` §2.2 Opcao A e
§2.3 (roteiro testavel), autorizado explicitamente pelo owner nesta sessao
(TASK_ID DRILL-PROD-01). Origem do backup: **producao (VPS)**. Nenhum segredo,
senha, connection string, IP ou hostname de producao e reproduzido neste
arquivo — a VPS e referida apenas como "VPS de producao".

## Descoberta (VPS de producao)

- Container PostgreSQL de producao: `synkroo-prod-postgres`
  (`pgvector/pgvector:pg17`), compose `synkroo-prod-postgres`
  (`running(2)`), status `healthy`, up ha 2 semanas. Banco `synkroo`,
  usuario `synkroo` (nomes via env do compose; senha nunca exibida).
- Volume de dados: `synkroo-prod-postgres_synkroo_prod_pgdata`.
- Espaco em disco: 23 GiB livres em `/` (dump de ~180 KiB — espaco suficiente,
  sem bloqueio).
- Tamanho do pgdata (via `du` no container): 77 MiB.
- Diretório canonico `/var/backups/synkroo/` **nao existia** — criado com
  permissao `0700`. Nao havia backup anterior: este drill gerou o primeiro
  backup canonico diario (idade do backup anterior: N/A).

## Comandos executados (resumo sanitizado)

```bash
# 1. Backup logico dentro do container de producao (pg_dump roda DENTRO do
#    container; nenhuma escrita/delecao no banco — operacao somente leitura)
docker exec synkroo-prod-postgres pg_dump -U synkroo -d synkroo -Fc -f /tmp/synkroo-prod-20260925-143506.dump
docker cp synkroo-prod-postgres:/tmp/synkroo-prod-20260925-143506.dump /var/backups/synkroo/synkroo-prod-20260925-143506.dump
docker exec synkroo-prod-postgres rm /tmp/synkroo-prod-20260925-143506.dump
sha256sum /var/backups/synkroo/synkroo-prod-20260925-143506.dump

# 2. Alvo isolado NA VPS (porta somente em loopback; senha aleatoria gerada na
#    VPS via openssl, entregue por arquivo com POSTGRES_PASSWORD_FILE — nunca
#    ecoada nem trafegada; imagem pgvector/pgvector:pg17 ja presente, sem pull)
docker run --rm -d --name synkroo-prod-drill \
  -e POSTGRES_DB=synkroo_drill -e POSTGRES_USER=drill_test \
  -e POSTGRES_PASSWORD_FILE=/run/secrets/drill_pw \
  -v /tmp/synkroo-drill-pw:/run/secrets/drill_pw:ro \
  -p 127.0.0.1:55436:5432 pgvector/pgvector:pg17
docker exec synkroo-prod-drill pg_isready -U drill_test -d synkroo_drill

# 3. Restore no alvo (pg_restore DENTRO do alvo, --no-owner)
docker cp /var/backups/synkroo/synkroo-prod-20260925-143506.dump synkroo-prod-drill:/tmp/restore.dump
docker exec synkroo-prod-drill pg_restore -U drill_test -d synkroo_drill --no-owner /tmp/restore.dump

# 4. Verificacao pos-restore (APENAS contagens agregadas; nenhuma linha de
#    dados visualizada ou exportada — LGPD)
#    SELECT count(*) FROM clinics / users / patients / appointments
#    SELECT count(*) + SELECT id, hash ... ORDER BY id em
#    drizzle.__drizzle_migrations (alvo x producao)

# 5. Limpeza (dump de producao PERMANECE — e o backup canonico diario)
docker stop synkroo-prod-drill   # --rm remove o container; nada persiste
rm -f /tmp/synkroo-drill-pw
```

Desvios honestos do roteiro literal (sem impacto na validade):
- Senha do alvo via `POSTGRES_PASSWORD_FILE` em vez de `-e POSTGRES_PASSWORD=<valor>`,
  para nunca expor o segredo em linha de comando ou log.
- `pg_restore`/`psql` no alvo executados com o papel `drill_test` (primeira
  tentativa com o papel `postgres` falhou na conexao — papel inexistente num
  cluster recem-inicializado com `POSTGRES_USER=drill_test`; nada havia sido
  restaurado, retry limpo em seguida, sem efeito colateral).

## Resultados

- Verificacao pos-restore no alvo: `clinics: 0`, `users: 0`, `patients: 0`,
  `appointments: 0`. O banco de producao esta vazio (sem seed/dados reais no
  momento do drill) — contagens zeradas esperadas e validas; nenhuma linha de
  dado pessoal existia para expor.
- Ledger: 33 migrations aplicadas na producao e 33 no alvo restaurado;
  `SELECT id, hash ... ORDER BY id` identico linha a linha nos dois bancos —
  o restore reproduziu a producao com fidelidade.
- Container de producao permaneceu `healthy` durante todo o drill
  (`pg_isready` OK apos a limpeza); nenhum restart/stop/alteracao na producao.
- Dump de producao preservado em `/var/backups/synkroo/` (184.231 bytes).

## Tempos medidos (datapoint RTO real, banco de 77 MiB)

| Etapa | Duracao |
|---|---|
| Backup (`pg_dump -Fc` no container + `docker cp` + sha256, 184.231 bytes) | < 60 s (14:35 UTC) |
| Subida + `pg_isready` do alvo (init do cluster) | ~10 s |
| Restore real (`pg_restore --no-owner`, 14:36:48 → 14:36:49 UTC) | ~1 s |
| Verificacao (4 contagens + ledger alvo x prod) | < 30 s |
| Fim a fim (descoberta → limpeza) | ~5 min |

Datapoint RTO **real de producao**: restore + verificacao < 60 s (banco pequeno,
77 MiB de pgdata). Nao extrapolar para cenarios com volume maior, rede
degradada ou switch de apontamento (smoke pos-deploy nao incluido).

## Bloco de evidencia (§5 do runbook)

```text
RESTORE TEST — 2026-09-25
- Backup usado: synkroo-prod-20260925-143506.dump (hash sha256: 0bb2f5e9f47875aaa24e5ba59292b093f492527d9702db340d5c77b4c0a72ef3; 184.231 bytes)
- Origem do backup: producao (VPS)
- Ambiente de restore: container descartavel synkroo-prod-drill na VPS (pgvector/pgvector:pg17, porta 127.0.0.1:55436)
- Início/fim do restore: 14:36:48 → 14:36:49 UTC (tempo total: ~1 s; fim a fim descoberta→limpeza: ~5 min)
- pg_restore: [x] OK sem erros / [ ] OK com avisos (anexar) / [ ] FALHOU (anexar log redatado)
- Ledger de migrations confere com a producao (33 aplicadas; 33/33 e hashes identicos linha a linha): [x] sim / [ ] nao
- Smoke pos-restore ([smoke-deploy-runbook](../../ops/smoke-deploy-runbook.md)): [ ] PASS / [ ] FAIL — nao executado (alvo descartavel remoto removido apos a verificacao; smoke nao executa contra alvo descartavel)
- Verificacao executada: contagens das 4 tabelas core (todas zero — banco de producao vazio, sem dados pessoais) + ledger 33/33 identico
- RPO: backup anterior inexistente (diretorio /var/backups/synkroo/ criado neste drill, 0700) — este e o primeiro backup canonico diario; idade do backup anterior: N/A
- Smoke pós-restore: PENDENTE (alvo descartável remoto; executar no próximo drill com alvo vivo)
- Resultado: [ ] backup VÁLIDO (validade plena — exige restore OK + ledger conferido + smoke PASS, §2.2) / [x] VÁLIDO PARA DRILL DE PRODUÇÃO (restore + ledger verificados; validade completa condicionada ao smoke pós-restore) / [ ] backup INVÁLIDO (ação: <…>)
- Responsavel: database-engineer (drill autorizado pelo owner) — RPO/RTO seguem medidos, A RATIFICAR pelo owner
```
