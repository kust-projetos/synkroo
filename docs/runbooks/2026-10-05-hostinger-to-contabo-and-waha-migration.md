# Runbook — Hostinger → Contabo + Evolution → WAHA

**Data:** 2026-10-05  
**Status:** planejamento de migração; nenhuma operação externa autorizada por este documento  
**Objetivo:** migrar os workloads VPS do Synkroo da Hostinger para a Contabo e substituir Evolution API por WAHA com rollback controlado.

## 1. Princípio

São duas migrações diferentes:

1. **infra:** Hostinger → Contabo;
2. **canal:** Evolution → WAHA.

Elas são sequenciais, não simultâneas.

```text
Hostinger current
   ↓ inventory + backup
Contabo replica/staging
   ↓ restore + smoke
DB/infra cutover
   ↓ observation
WAHA canary
   ↓ provider cutover
WAHA production
   ↓ observation
cleanup/decommission
```

## 2. Estado conhecido pelo repositório

### PostgreSQL
`ops/vps/synkroo-prod-postgres/docker-compose.yml`:
- PostgreSQL 17 com pgvector;
- volume `synkroo_prod_pgdata`;
- TLS custom;
- cloudflared sidecar/tunnel.

### WhatsApp fallback
`ops/vps/whatsapp-sidecar`:
- sidecar Node/Playwright;
- volume de sessão;
- porta local;
- Traefik/rede `proxy`;
- URL pública esperada.

### Configuração operacional
Os três scripts operacionais aceitam `SYNKROO_VPS_ENV` apontando para um `.env`
privado fora do repositório. Se a variável estiver definida mas o caminho for
inválido, o script falha sem usar fallback. Ainda existe um fallback temporário
e deprecated para `../vps-hostinger/.env`; a remoção dele é pendência de P2.

A separação source/target está implementada (P1 do plano vNext, ver
`docs/ops/vps-access.md` §Contrato source/target):

- `--side=source|target` é **obrigatório** nos três scripts
  (`migrate-vps.ts`, `setup-staging-db.ts`, `update-hyperdrive.ts`). Ausente ou
  inválido: imprime o uso e sai com código 1, sem tocar em conexão nenhuma.
- Cada lado tem chaves próprias no `.env`: `VPS_SOURCE_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD}`
  e `VPS_TARGET_{IP,PG_PORT,POSTGRES_PASSWORD,STAGING_PASSWORD}`. As chaves
  genéricas (`VPS_IP`, `VPS_PG_PORT`, `VPS_POSTGRES_PASSWORD`,
  `VPS_STAGING_PASSWORD`) são aliases deprecated: fallback **por chave**, com
  aviso `[deprecated]` e sem vazar valor.
- Em `migrate-vps.ts`, `--side` (qual VPS) e `--target` (qual banco dentro
  daquela VPS: `production`/`staging`/`all`) são eixos ortogonais.

**Antes do rehearsal**, criar o `.env` do target com as chaves `VPS_TARGET_*`
(IP, porta, e as duas senhas) fora deste repositório e apontar `SYNKROO_VPS_ENV`
para ele nas sessões do target. Um `.env` por lado é o recomendado: evita o
fallback genérico e impede que a execução leia a VPS errada.

```bash
# source
export SYNKROO_VPS_ENV=../vps-hostinger/.env
npx tsx scripts/migrate-vps.ts --side=source --target=all
npx tsx scripts/setup-staging-db.ts --side=source

# target
export SYNKROO_VPS_ENV=../vps-contabo/.env   # caminho ilustrativo
npx tsx scripts/migrate-vps.ts --side=target --target=all
npx tsx scripts/setup-staging-db.ts --side=target
npx tsx scripts/update-hyperdrive.ts --side=target
```

A porta é validada estritamente (inteiro 1–65535); a senha de staging nunca é
preenchida com a de produção, em nenhum dos lados.

## 3. Inventário obrigatório na Hostinger

Antes de copiar qualquer coisa, coletar somente metadados/redacted output.

Ferramenta: `ops/vps/inventory/collect-inventory.sh` — roda na própria VPS (`--side=source|target` obrigatório, redação best-effort + revisão manual antes de compartilhar; ver `ops/vps/inventory/README.md`).

**Executado (2026-10-05):** inventário coletado e revisado — ver docs/inventory/2026-10-05-hostinger-source.txt e ...-findings.md.

```bash
hostname
uname -a
df -h
free -h
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker compose ls
docker network ls
docker volume ls
systemctl --failed
systemctl list-timers --all
crontab -l
sudo ss -lntup
```

Descobrir:

- PostgreSQL;
- cloudflared;
- Evolution;
- Traefik/Nginx;
- sidecar Playwright;
- staging;
- outros containers dependentes;
- cron/jobs;
- systemd/PM2;
- volumes;
- bind mounts;
- certificados;
- firewall;
- backup;
- monitoramento.

Nunca copiar output contendo secret para issue/commit.

## 4. Contabo foundation

Ferramenta: `ops/vps/contabo/bootstrap.sh` — idempotente, dry-run por default, firewall em gate separado (`--apply-firewall`) e teste de login por chave em segundo terminal obrigatório antes dele. Sequência completa em `ops/vps/contabo/README.md`.

### Host

- atualizar sistema;
- criar usuário operacional;
- SSH por chave;
- desabilitar login por senha/root conforme política aprovada;
- configurar firewall default-deny;
- instalar Docker + Compose;
- configurar NTP;
- criar `/opt/synkroo`;
- criar `/var/backups/synkroo`;
- garantir espaço e inode;
- configurar logs/monitoramento;
- configurar backup off-host.

### Rede

Somente portas necessárias publicamente.

PostgreSQL não deve ficar globalmente exposto só para facilitar Hyperdrive. Preferir túnel/rota compatível validada. Não repetir a regra de firewall que anteriormente quebrou Hyperdrive sem identificar a origem real do tráfego.

## 5. Migração PostgreSQL

### 5.1 Pré-check

**Executado (2026-10-05):** ver docs/inventory/2026-10-05-hostinger-findings.md (PG 17.11, 11 MB, ledger 33, extensões ok).

- confirmar versão source;
- listar extensions;
- migration ledger;
- tamanho;
- conexões;
- encoding/timezone;
- backup recente;
- restore drill atual.

### 5.2 Backup source

Ferramenta: `npx tsx scripts/backup-vps-db.ts --side=source` (dump custom `-Fc` + SHA-256 + `*.meta.json` redatado, delegando ao `scripts/db-backup.mjs`).

Usar scripts canônicos de backup quando aplicáveis. Produzir:
- dump custom format;
- hash SHA-256;
- timestamp;
- metadata redatada.

Nunca depender do único backup no mesmo host.

### 5.3 Restore rehearsal Contabo

Restaurar primeiro em DB isolado.

Ferramenta: `npx tsx scripts/restore-vps-db.ts --side=target --from <dump.gz> --create-db synkroo_rehearsal` (gate SHA-256 antes do restore, `--create-db` isolado, extensões `vector`/`btree_gist`, ledger Drizzle e smoke de tabelas-chave).

Validar:
- pgvector;
- btree_gist;
- migrations;
- constraints;
- counts de tabelas-chave;
- queries de health;
- aplicação via staging;
- Hyperdrive/tunnel;
- latência aceitável.

### 5.4 Cutover DB

1. anunciar janela;
2. bloquear writes ou colocar aplicação em modo de manutenção;
3. backup/delta final;
4. restaurar/aplicar delta no target;
5. validar hash/ledger;
6. trocar conexão/tunnel/Hyperdrive;
7. rodar readiness/smoke;
8. liberar writes;
9. monitorar erros/latência.

### Rollback DB

Se gate crítico falhar:
- bloquear writes;
- reapontar aplicação ao source Hostinger;
- validar smoke;
- reconciliar qualquer write ocorrido no target antes de nova tentativa.

Hostinger não é destruída no dia do cutover.

## 6. WAHA na Contabo

O WAHA nasce no target. Não há benefício em instalar nova Evolution na Contabo salvo contingência temporária.

### 6.1 Deployment baseline

Docker Compose com:
- imagem WAHA **pinada**;
- restart policy;
- volume de sessão;
- env file fora do repo;
- API key;
- webhook HMAC;
- reverse proxy HTTPS;
- healthcheck;
- resource limits avaliados;
- logs com rotação;
- backup de dados persistentes necessários.

Dashboard e Swagger devem ficar restritos ou desabilitados externamente.

### 6.2 Secrets

Separar:
- `WAHA_API_URL`;
- `WAHA_API_KEY`;
- `WAHA_SESSION`/installation mapping;
- `WAHA_WEBHOOK_HMAC_KEY`.

Valores ficam em secret manager/env, não Git.

### 6.3 Engine

Não escolher somente por benchmark.

Executar compatibility matrix para:
- QR/login;
- reconnect;
- text inbound/outbound;
- image;
- audio;
- document;
- message ID;
- sender/JID/LID;
- webhook;
- status;
- read receipt se usado.

GOWS/NOWEB podem reduzir recursos; WEBJS pode servir como baseline de compatibilidade. Fixar um engine após testes.

### 6.4 Scaffold local e estado observado (2026-10-06)

- O recheck read-only da source encontrou `devlikeapro/waha:latest`, RepoDigest
  `sha256:41283bd89922ec3f722e5a772b844c451634d4aa72e9c34043c3480184f970fe`,
  bind de sessão em `/home/deploy/infra/waha/sessions:/app/.sessions`, sem
  healthcheck e labels Traefik `websecure`/`cf`. O digest é um **candidato** da
  imagem atualmente executada na source; sua proveniência/plataforma e o engine
  ainda precisam do gate P3.5. A documentação VPS declara NOWEB, mas o env
  efetivo do container não foi lido.
- O recheck read-only do Contabo em `2026-10-06T08:12:13Z` não encontrou
  container/volume WAHA. `ops/vps/waha/docker-compose.yml` é apenas scaffold
  loopback (`127.0.0.1:3000`), com `WAHA_IMAGE_DIGEST`/`WAHA_ENGINE` requeridos; não
  publica rota Traefik, não configura DNS/secrets e **não foi implantado**.
- O Worker Cloudflare não alcança esse bind loopback. Antes de fornecer
  `WAHA_API_URL` à aplicação, o owner deve aprovar um padrão de acesso privado/
  edge-authenticated para o serviço WAHA. Não transformar o endpoint
  administrativo completo `/api/*` em origem pública apenas por haver API key.
- O scaffold cria volume de sessão, mas o backup target atual não o inclui. O
  volume contém estado reutilizável de WhatsApp; P3.4 precisa aprovar e ensaiar
  confidencialidade, backup cifrado/off-host, restore e re-pareamento antes de
  qualquer sessão real.

## 7. Refatoração da aplicação para WAHA

### 7.1 Adapter

Criar contrato neutro `WhatsAppProviderAdapter`.

Implementações temporárias:
- EvolutionAdapter;
- WahaAdapter;
- opcional PlaywrightFallbackAdapter enquanto necessário.

### 7.2 Facade

`channel-service.ts` decide provider via config/installation e mantém:
- idempotência local;
- timeout;
- logging redatado;
- erro tipado;
- métricas.

Nenhum módulo de CRM/financeiro/follow-up deve conhecer WAHA diretamente.

### 7.3 Inbound

Criar `POST /api/whatsapp/waha`.

Pipeline:
```text
WAHA webhook
→ in-memory rate limit (identity = CF-Connecting-IP only in prod; supplemental,
  Cloudflare edge rate limit on the exact path is the mandatory ops gate)
→ bounded raw-body read (size + deadline)
→ HMAC-SHA512 over exact raw bytes
→ parse + event/session allowlist
→ atendimento module gate
→ enabled WAHA session → channel installation → clinic mapping
→ identify direct inbound message (echo/group/LID fail-closed)
→ freshness using signed root timestamp
→ session-scoped provider-message dedup
→ receberMensagem Action (durable message + outbox)
→ conversation/agent pipeline
```

Não derivar clinicId de campo público sem resolver installation confiável.

### 7.4 Outbound

```text
domain action
→ channel-service
→ outbound idempotency claim
→ WahaAdapter.sendText/sendMedia
→ normalized SendResult
```

POST não ganha retry cego.

## 8. Testes WAHA

### Contract
- status;
- QR;
- send;
- media;
- webhook schemas;
- HMAC inválido;
- unknown session;
- malformed payload.

### Integration
- WAHA real em staging;
- inbound→DB;
- outbound;
- duplicate webhook;
- restart;
- network timeout;
- provider 4xx/5xx.

### E2E
- paciente manda mensagem;
- conversa criada;
- agente responde;
- agendamento;
- follow-up;
- takeover;
- attachment mínimo requerido.

## 9. Canary

Usar número não crítico.

Gate sugerido:
- pelo menos 24h de execução;
- múltiplos reconnects/restarts testados;
- zero perda conhecida;
- zero duplicação conhecida;
- inbound/outbound e anexos necessários verdes;
- health monitorado;
- agent flow completo.

## 10. Cutover Evolution → WAHA

### Pré-condições

- Contabo estável;
- DB já migrado;
- WahaAdapter em produção mas desabilitado;
- canary verde;
- rollback definido;
- owner disponível para QR/auth quando necessário.

### Passos

1. pausar automações de envio do tenant/número;
2. drenar outbound queue;
3. registrar último provider event cursor/tempo observável;
4. impedir novo inbound Evolution de gerar side effects;
5. autenticar sessão WAHA;
6. atualizar channel installation/provider;
7. habilitar webhook WAHA;
8. smoke inbound;
9. smoke outbound;
10. reabilitar automações;
11. observar métricas/erros.

### Rollback

Rollback é possível apenas se a sessão Evolution antiga continuar funcional e não houver conflito de linked device/session.

Se possível:
1. pausar outbound;
2. desabilitar webhook WAHA;
3. restaurar provider=Evolution;
4. validar inbound/outbound;
5. reabilitar jobs.

Se a sessão Evolution tiver sido invalidada, rollback significa reautenticar o provider anterior; isso deve ser considerado no go/no-go.

## 11. Sidecar Playwright

Após WAHA estabilizar:
- medir se ainda existe cenário real onde o sidecar agrega disponibilidade;
- se não houver, removê-lo para reduzir superfície operacional;
- se mantido, tratá-lo como provider explícito, não fallback escondido.

## 12. Cleanup

Somente após janela de observação:

### Evolution
- remover `EVOLUTION_API_URL`;
- remover `EVOLUTION_API_KEY`;
- remover `EVOLUTION_INSTANCE_NAME`;
- remover endpoint/provider legado;
- remover testes exclusivos;
- atualizar ADR/docs.

### Hostinger
- backup final;
- verificar nenhum DNS/tunnel/job aponta para source;
- verificar nenhum backup único ficou lá;
- revogar keys específicas;
- desligar serviços;
- manter snapshot pelo período aprovado;
- depois cancelar/decommission.

## 13. Go/No-Go

### Infra GO
- restore test verde;
- DB health verde;
- migrations completas;
- staging verde;
- backup off-host;
- rollback ensaiado.

### WAHA GO
- adapter contract verde;
- HMAC/API auth verde;
- canary verde;
- session persistence/reconnect verde;
- observabilidade;
- rollback compreendido.

### Inbound WAHA GO (ops gate)
- **Regra de rate limit na borda Cloudflare** para o path EXATO
  `POST /api/whatsapp/waha` (path exato, sem wildcard), configurada e verificada
  (429 + `Retry-After` no edge). Esta é a exigência do gate: um limiter no
  Traefik do *backend WAHA* (API do container WAHA) **não** conta — ele protege
  a superfície de chamada da API do provider, não este webhook inbound, e não
  deve ser usado como evidência de que o inbound está limitado.
- Confirmar que o sinal de client IP da Cloudflare chega ao Worker: o
  `CF-Connecting-IP` presente no request exatamente como a borda o injeta (ver
  §13.1) e que a origem **não** é contornável (DNS/hostname de origem único
  atrás da borda; sem rota alternativa que alcance o Worker/Contabo sem passar
  pela Cloudflare). Sem isso, a identidade do limiter in-process cai no sentinel
  compartilhado — o que super-limita, mas sinaliza que a borda não está no
  caminho do tráfego.
- O limiter in-process da aplicação (`rateLimitPresets.webhook`, prefixo
  `waha-webhook`) é **suplementar**: o store é in-memory e por instância, então
  não limita tráfego agregado/distribuído e é perdido a cada deploy. Ele
  existe para impedir que tráfego não autenticado, com headers bem formados,
  consuma repetidamente o orçamento de 256 KiB / 10 s de leitura do corpo antes
  da verificação HMAC — não substitui o gate da borda.
  Em produção a identidade dele vem **apenas** de `CF-Connecting-IP`
  (presente, limitado e sem whitespace/comma); `X-Forwarded-For`/`X-Real-IP` são
  settáveis pelo cliente e nunca são usados, nem como fallback — header ausente
  ou inválido cai num único sentinel compartilhado.

#### 13.1 Como confirmar o sinal da borda (sem criar a regra aqui)
A regra em si é um passo de ops no dashboard — não versionada neste repositório.
Para produzir evidência, o operador confirma em runtime:
- request de teste chegando pela borda mostra `CF-Connecting-IP` preenchido no
  handler (log/observabilidade do Worker), sem `CF-Ray`/`cf-connecting-ip`
  ausentes;
- o comportamento observado é consistente com §13: com header ausente, todas as
  requisições compartilham uma única cota (`waha-webhook:unknown-cf-client`),
  e não uma cota por `X-Forwarded-For`.

Qualquer falha Sev-0/Sev-1 = NO-GO.

## 14. Evidências a registrar

Para cada etapa:
- timestamp;
- commit/version;
- container image digest/tag;
- source/target identificados sem secrets;
- backup hash;
- testes executados;
- smoke;
- decisão GO/NO-GO;
- rollback, se ocorreu;
- responsável/aprovador.

## 15. Referências

- WAHA: https://github.com/devlikeapro/waha
- WAHA docs: https://waha.devlike.pro/
- Segurança: https://waha.devlike.pro/docs/how-to/security/
- Eventos/webhooks: https://waha.devlike.pro/docs/how-to/events/
- Engines: https://waha.devlike.pro/docs/how-to/engines/
