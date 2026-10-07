# P2 — Validação do target Contabo e closure (2026-10-07)

**Fase:** P2 — Hostinger → Contabo (runbook: `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`).
**Método desta rodada:** discovery → preparação → backup → rehearsal → validação → go/no-go → cutover → observação → closure,
a partir de `origin/main @ bf54b647` em worktree limpa (`feat/p2-contabo-migration`). Nenhuma operação P3/WAHA.
**Classificação de estado (§56):** `TARGET ACTIVE` — cutover executado em 2026-10-05 e confirmado vivo nesta rodada.
**Segredos:** nenhum secret neste documento. Roles/hosts aparecem como alias lógico (`hostinger-src`, `contabo-tgt`).

Docs-irmãos (histórico divergente, fonte NÃO canônica, auditado read-only §2):
`2026-10-05-hostinger-findings.md` · `2026-10-05-contabo-target-findings.md` (branch `fix/p0-trust-defects-2026-10-05`).

## 1. Git

- HEAD inicial/final da rodada: `origin/main @ bf54b647` (P0 CLOSED, P1 CLOSED, P2 NOT STARTED no ledger canônico).
- Branch: `feat/p2-contabo-migration` (worktree `D:/projetos/synkroo-p2-contabo`). Sem push direto em `main`; PR após review.
- Checkout divergente `D:/projetos/synkroo` auditado read-only (11 commits à frente, working tree suja). Classificação:
  | Item divergente | Classe |
  |---|---|
  | `72519aae` split source/target nos scripts VPS | reaproveitável (portar mínimo via PR futuro, não copiado aqui) |
  | `275fed7b` tooling P2 (inventory/backup/restore/bootstrap) | reaproveitável parcial (requer review+testes antes de portar) |
  | `cfb7d8c9` inventário Hostinger + dump `1b6394e0…` | evidência reaproveitável (números reconfirmados live hoje) |
  | `d6bdbcb6` fundação Contabo | reaproveitável (reconfirmado live) |
  | `f50cbf3a` rehearsal 5.3 GREEN | método útil; como prova, superseded pelo drill de hoje |
  | `7d245a92` cutover + smoke verde | EVIDÊNCIA CENTRAL — confirmada live hoje (Hyperdrive `modified_on`, PG target) |
  | `9a028dd0` credenciais demo no target | não portar sem revisar (fora do escopo mínimo desta rodada) |
  | `e81e4253` acoplamento rotação×Hyperdrive | reaproveitável (gotcha válido, registrado abaixo) |
  | `3863c4f0` decisão P3 WAHA + scaffold `ops/vps/waha/` + adapters WAHA + dirty tree funcional | EXCLUÍDO — P3, proibido nesta rodada |
- Timeline reconstruída por evidência: flip Hyperdrive 2026-10-05T21:04Z → re-smoke pós-rotação 21:24Z →
  backups diários target (05/06/07-10) → confirmação viva 2026-10-07 ~16:48Z (PG target uptime 44h).

## 2. Discovery — tabela comparativa

| Recurso | Hostinger (`hostinger-src`) | Contabo (`contabo-tgt`) | Gap | Ação |
|---|---|---|---|---|
| SO/kernel | Ubuntu 6.8.0-138 | Ubuntu 7.0.0-38 | nenhum | — |
| CPU/RAM/disco | 3.8 GiB / 48G, **89% usado** (5.3G livres) | 7.8 GiB / 96G, 38% usado (60G livres) | source quase cheia | nunca gravar dump on-host na source |
| PostgreSQL | 17.11 + pgvector 0.8.6, ledger 33, 68 tabelas, 11 MB | 17.11 + pgvector 0.8.7, ledger 33, 68 tabelas, 11 MB | só patch pgvector | nenhum (embeddings zerados ambos) |
| Docker/Compose | 29.x, 6 compose (traefik, pg+tunnel, sidecar, waha, infisical, ai-memory) | 29.1.3/2.40.3, 4 compose (traefik, pg, pi-finance×2) | tunnel synkroo omitido no target por decisão | documentado; sem mudança |
| cloudflared | `synkroo-prod-db-tunnel` ativo na source | serviço omitido no compose target (decisão owner pendente §4 Rede) | rota Hyperdrive é TCP CF-only, não tunnel | dívida explícita P2 (não-blocker) |
| Evolution | nenhum container nesta VPS (URL aponta p/ fora) | n/a | confirmar owner (bloqueia P3, não P2) | P3 |
| WAHA | `waha:latest` rodando na source (sem volume) | nada implantado | decisão provider pendente | P3 — NÃO TOCADO |
| Sidecar Playwright | loopback-only, healthy | n/a (app roda Cloudflare) | nenhum p/ P2 | — |
| Firewall | 15432 publicada mas bloqueada na borda | 15433 publicada `0.0.0.0`, UFW só ranges Cloudflare (15 regras v4), default deny | ideal seria `127.0.0.1`/tunnel-only | dívida explícita (não-blocker; Hyperdrive exige TCP da edge CF) |
| Volumes | pgdata + sessão sidecar (+ terceiros) | pgdata synkroo (+ pi-finance) | nenhum | — |
| Backups | `backup.sh` diário 03:30 UTC + rclone GDrive, retenção 14 | `backup-synkroo.sh` diário 03:30 UTC + rclone GDrive, retenção 14, manifests SHA | nenhum | — |
| Monitoring | healthcheck 30min + healthchecks.io | mesmo padrão (ping UUID target opcional) | `BACKUP_HC_PING_URL` opcional | dívida opcional |
| DNS/tunnel | Traefik 80/443 + acme.json válido | Traefik 80/443 coexistindo com pi-finance | nenhum p/ P2 | — |
| Hyperdrive | — | prod+staging → target desde 2026-10-05T21:24Z | — | rollback = 1 comando p/ source |

## 3. Banco

- Versões: source 17.11 / target 17.11. Extensions: `plpgsql`, `btree_gist 1.7`, `vector` (0.8.6 vs 0.8.7).
- Auth: `password_encryption=scram-sha-256`, `ssl=on`, `pg_hba` = `hostssl scram-sha-256` (+ `local trust` intra-container). Superuser: `synkroo`.
- TLS transporte: `sslmode=require` no Hyperdrive; self-signed no target. Residual P1 conhecido: scripts do repo usam
  `rejectUnauthorized:false` / argv password (limitação documentada) — sem mudança nesta rodada.
- Matriz 68 tabelas source×target (2026-10-07, `docker exec … psql -tAc`, só counts): 65/68 idênticas;
  deltas só-target: `action_logs` +11, `dentists` +2, `procedures` +3 (seed/smoke pós-restore, sem perda).
  Críticas: `clinics` 1=1, `users` 1=1, patients/appointments/conversations/messages/budgets/payments/leads zeradas em ambos
  (pré-piloto). Constraints 227=227, indexes 101=101 (invalid=0), encoding `UTF8`, timezone `GMT`.
- Restore drill mínimo (2026-10-07 ~16:47–16:48Z, DB isolado `synkroo_drill`, backup off-host do dia):
  off-host copy OK → tar list OK → `pg_restore --list` OK (404 TOC) → restore exit 0 →
  ledger 33 / clinics 1 / users 1 / vector 1 → DROP + cleanup OK.

## 4. Infra e Go/No-Go

| Gate | Resultado |
|---|---|
| backup válido (custom `-Fc` + SHA + `pg_restore --list`) | PASS |
| off-host copy (GDrive: 05×2, 06, 07-10) | PASS |
| rehearsal/estrutura (68 tabs, ledger 33, constraints, pgvector) | PASS |
| row counts (65/68 iguais; 3 deltas só-target explicados) | PASS |
| migrations (33=33) | PASS |
| tenant smoke (grants/constraints idênticos; middleware 307 anônimo em prod+staging) | PASS (estrutural; suite Jest cross-tenant roda em CI p/ mudanças de código, sem writes em prod) |
| app smoke (`smoke-deploy.mjs` staging+prod exit 0; `/login` 200) | PASS |
| performance (`SELECT 1`: source 0.146 ms vs target 0.310 ms; sem regressão grosseira) | PASS |
| firewall (UFW active, default deny, 15433 só CF) | PASS c/ dívida explícita (migrar p/ `127.0.0.1`/tunnel-only) |
| TLS/auth (SCRAM, ssl on, hostssl scram) | PASS c/ dívidas P1 documentadas |
| rollback (1 comando Hyperdrive p/ source; source intacta, PG healthy, ledger 33) | PASS (documentado abaixo) |
| target health (`systemctl --failed`=0, backup cron diário, disco 38%) | PASS |

Decisão: **GO** — nenhum item crítico FAIL. Nenhum novo flip necessário (flip já live desde 2026-10-05T21:24Z).

## 5. Cutover, pós-cutover e rollback

- Cutover (histórico, confirmado): final sync + restore + smoke pré-flip + flip Hyperdrive staging+prod →
  smoke pós-flip exit 0 ambos (2026-10-05 21:04Z; re-smoke 21:24Z pós-rotação hex + `uselibpqcompat` gotcha).
- Pós-cutover (esta rodada): DB health, app health, auth-pipeline, módulos de agenda, CRM e financeiro
  (schema válido, dados pré-piloto),
  outbox vazio, backup novo + drill, jobs verificados (crons só backup/healthcheck; sem dual-write — jobs de app rodam na Cloudflare).
- **Point of no simple rollback (§42):** target recebeu writes pós-cutover (seed demo, +16 linhas). Flip-back simples
  perderia esses writes — rollback agora exige reconciliação. Recomendação: SEGUIR NO TARGET.
- Rollback (se gatilhos: 5xx persistente, perda tenant, jobs críticos falhando, latência inviável):
  1. congelar writes target; 2. avaliar divergência; 3. `update-hyperdrive.ts --side=source`;
  4. reativar observação na source; 5. validar; 6. documentar incidente. Source preservada como `ROLLBACK STANDBY` —
  NÃO destruir VPS/volumes/backups/configs nesta rodada.

## 6. Dívida residual

- P2 operacional: `127.0.0.1`/tunnel-only p/ 15433; `BACKUP_HC_PING_URL` target; remoção do fallback legado
  `../vps-hostinger/.env`; TLS strict fim-a-fim (CA própria) — nenhuma bloqueia o closure.
- P3 (NÃO iniciado): decisão provider WhatsApp (WAHA na source vs Evolution), WAHA no target, migração de sessões.
- P4/P5: AI Control Plane, Policy Engine, autonomia — fora de escopo.

## 7. Conclusão

`P2 CLOSED`
