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
inválido, o script falha sem usar fallback. Durante a migração, ainda existe um
fallback temporário e deprecated para `../vps-hostinger/.env`; removê-lo e
separar explicitamente as configurações source/target continuam pendentes antes
da execução do rehearsal.

## 3. Inventário obrigatório na Hostinger

Antes de copiar qualquer coisa, coletar somente metadados/redacted output:

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

- confirmar versão source;
- listar extensions;
- migration ledger;
- tamanho;
- conexões;
- encoding/timezone;
- backup recente;
- restore drill atual.

### 5.2 Backup source

Usar scripts canônicos de backup quando aplicáveis. Produzir:
- dump custom format;
- hash SHA-256;
- timestamp;
- metadata redatada.

Nunca depender do único backup no mesmo host.

### 5.3 Restore rehearsal Contabo

Restaurar primeiro em DB isolado.

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
→ HMAC
→ installation/session resolve
→ normalize
→ freshness/replay
→ provider event dedup
→ receberMensagem Action
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
