# Synkroo vNext — Master Implementation Plan

**Data:** 2026-10-05  
**Spec:** `docs/superpowers/specs/2026-10-05-synkroo-vnext-ai-native-business-os-design.md`  
**Estratégia:** evolução incremental, sem reescrita total.

## 1. Fases

| Fase | Resultado |
|---|---|
| P0 Baseline | fontes de verdade reconciliadas |
| P1 Infra provider-neutral | scripts/docs deixam de depender de Hostinger |
| P2 Contabo migration | workloads VPS migrados com rollback |
| P3 WAHA migration | WAHA substitui Evolution atrás de adapter neutro |
| P4 Event/Run/Outcome | AI Control Plane mínimo |
| P5 Policy Engine | autonomia granular por Action |
| P6 Agent-ready Core | CRM/vendas/follow-up/finance operáveis pela IA |
| P7 Journey Engine | jornadas stateful/proativas |
| P8 Control Center | humano supervisiona exceções/outcomes |
| P9 Growth Platform | conteúdo/social/paid media |
| P10 Omnichannel | e-mail/voz e demais canais |
| P11 Agency OS | operação interna da Synkroo |
| P12 Intelligence | previsão/otimização por outcome |

## 2. P0 — Baseline

- [x] marcar documentos históricos quando contradisserem vNext;
- [x] atualizar arquitetura que ainda descreve Supabase como stack atual;
- [x] reconciliar referências antigas a Claude SDK com adapter multi-provider;
- [x] inventory de UI/API/Action/service/repository/tests/runtime;
- [x] listar todas as Actions por módulo;
- [x] classificar Actions em AUTO/CONFIRM/APPROVAL/DENY;
- [x] mapear duplicação legado `src/services` vs `src/modules`;
- [x] criar ADR do AI Control Plane;
- [x] atualizar ADR de WhatsApp para WAHA.

**Gate:** um conceito não pode ter duas fontes canônicas concorrentes.

## 3. P1 — Infra provider-neutral

### Código/scripts

- [x] substituir dependência fixa de `../vps-hostinger/.env` nos três scripts operacionais;
- [x] aceitar caminho explícito via `SYNKROO_VPS_ENV`;
- [x] manter fallback legado apenas durante a migração, com deprecation;
- [ ] separar configuração source/target;
- [x] impedir fallback de credencial staging→prod;
- [x] preflight sem imprimir secrets.

### Documentação

- [x] atualizar `docs/ops/vps-access.md`;
- [ ] padronizar `VPS_SOURCE_*` e `VPS_TARGET_*` nos runbooks de migração;
- [x] não renomear secrets de runtime Cloudflare sem necessidade.

## 4. P2 — Hostinger → Contabo

Executar conforme `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`.

### Inventário Hostinger

Confirmado pelo repo:
- PostgreSQL 17 + pgvector;
- cloudflared/tunnel;
- sidecar Playwright.

Descobrir:
- Evolution;
- Traefik/proxy;
- rede Docker;
- outros bancos;
- cron/systemd/PM2;
- certificados;
- firewall;
- volumes;
- observabilidade;
- backups.

### Contabo foundation

- [ ] SSH key-only;
- [ ] usuário admin não-root;
- [ ] firewall default-deny;
- [ ] Docker/Compose;
- [ ] NTP/timezone;
- [ ] diretórios de app/backups;
- [ ] monitoramento;
- [ ] backup off-host.

### Banco

- [ ] dump consistente;
- [ ] SHA-256;
- [ ] restore isolado na Contabo;
- [ ] extensões;
- [ ] migration ledger;
- [ ] smoke;
- [ ] staging apontado ao target;
- [ ] teste Hyperdrive;
- [ ] freeze/final sync;
- [ ] cutover;
- [ ] janela de rollback com Hostinger intacta.

**Gate:** não iniciar cutover do WhatsApp no mesmo momento do cutover de DB.

## 5. P3 — Evolution → WAHA

### P3.1 Provider abstraction

Criar `WhatsAppProviderAdapter` e registry.

Refatorar:
- `channel-service.ts` deixa de importar Evolution diretamente;
- callers continuam usando `sendWhatsAppMessage`/Action interfaces;
- idempotência permanece na facade, não no leaf provider.

### P3.2 WAHA adapter

Implementar:
- health/session status;
- start/restart/logout;
- QR;
- send text;
- media necessários;
- mark read se requerido;
- normalização de webhook;
- provider message id;
- errors tipados;
- timeout;
- sem retry automático de mutação sem proteção local.

### P3.3 Segurança

- [ ] `WAHA_API_KEY` em secret manager/env, nunca repo;
- [ ] usar API key na API;
- [ ] webhook HMAC;
- [ ] HTTPS;
- [ ] Dashboard/Swagger restritos/desabilitados externamente;
- [ ] keys por sessão quando fizer sentido;
- [ ] rate limiting/reverse proxy;
- [ ] logs redatados.

### P3.4 Persistência

- [ ] volume/session storage;
- [ ] backup de sessão/configuração aplicável;
- [ ] política de restore;
- [ ] não presumir que sessão Evolution pode ser convertida;
- [ ] planejar novo QR/login do WhatsApp para WAHA;
- [ ] registrar owner da sessão/clinic installation.

### P3.5 Engine contract

Testar WEBJS, GOWS e/ou NOWEB apenas no ambiente de teste.

Matriz mínima:
- login/QR;
- inbound text;
- outbound text;
- image/audio/document;
- delivery/status usados;
- webhook;
- sender/JID/LID;
- reconnect;
- session restart;
- consumo CPU/RAM.

Escolher engine depois dos testes e piná-la em produção.

### P3.6 Canary

- [ ] número de teste;
- [ ] staging;
- [ ] webhook real;
- [ ] 24h+ de estabilidade;
- [ ] reconnect;
- [ ] mensagens duplicadas;
- [ ] mensagens perdidas;
- [ ] anexos;
- [ ] agent flow.

### P3.7 Cutover

- [ ] feature flag `WHATSAPP_PROVIDER`;
- [ ] janela de mudança;
- [ ] parar ingest Evolution do tenant alvo;
- [ ] autenticar WAHA;
- [ ] trocar channel installation;
- [ ] smoke inbound/outbound;
- [ ] observar;
- [ ] rollback lógico para Evolution apenas se a sessão antiga continuar válida.

### P3.8 Cleanup posterior

- [ ] tornar WAHA default;
- [ ] deprecar `EVOLUTION_*`;
- [ ] remover endpoint Evolution em tranche posterior;
- [ ] remover `evolution-service.ts`;
- [ ] reavaliar sidecar Playwright;
- [ ] atualizar docs/env/ADR/tests.

**Gate:** WAHA precisa passar contrato funcional e segurança antes de remover Evolution.

## 6. P4 — Event / Run / Outcome foundation

Criar/reconciliar:
- BusinessEvent;
- Goal;
- AgentRun;
- ActionAttempt;
- PolicyDecision;
- Outcome;
- Exception;
- Approval.

Reaproveitar ou migrar conscientemente `pendingActions`, `decisionLogs`, `smartTriggerLog`, `agentQueue`, `agentDlq` e `agentLogs`; evitar estruturas duplicadas.

Primeiro fluxo de prova:
`appointment.cancelled → fill_waitlist → verify → outcome`.

## 7. P5 — Policy Engine

- metadata de risco por Action;
- profile por tenant;
- AUTO/CONFIRM/APPROVAL/DENY;
- constraints;
- approval token server-side;
- policyVersion;
- kill switch;
- autonomy state por domínio;
- testes de bypass/payload mutation/replay.

Durante a transição, a allowlist atual permanece fallback conservador.

## 8. P6 — Agent-ready Core

### Comercial/CRM
lead.created → dedup → score → qualify → next action → contact/follow-up → appointment → outcome.

### Follow-up
orçamento, inativos, tratamento incompleto, confirmação e recuperação.

### Financeiro
primeiro OBSERVE/ASSIST. Leitura e reminders podem ganhar autonomia antes de criação/alteração de cobrança.

### Atendimento
identity resolver + contexto único de canal.

**Gate:** staging demonstra lead→agendamento, orçamento→follow-up, inativo→reativação e cobrança→ação/approval.

## 9. P7 — Journey Engine

Entidades: JourneyDefinition, JourneyInstance, Step, WaitState, BranchCondition, StopCondition, Attempt, Outcome.

Jornadas iniciais:
- lead sem resposta;
- confirmação/no-show;
- orçamento;
- tratamento incompleto;
- inativo;
- cobrança;
- CS/renovação.

## 10. P8 — Control Center

Substituir placeholders por dados reais.

Páginas:
- `/dashboard/ai/runs`;
- `/dashboard/ai/exceptions`;
- `/dashboard/ai/approvals`;
- `/dashboard/ai/outcomes`;
- `/dashboard/automations`;
- `/dashboard/integrations`.

## 11. P9 — Growth Platform

### Content
pauta/briefing/asset/calendário/review/compliance/publicação/analytics/repurpose.

### Social
Instagram primeiro; depois LinkedIn, Google Business, YouTube e TikTok.

### Paid Media
começar read-only/recommendation; depois AUTO_LIMITED dentro de BudgetPolicy.

## 12. P10 — Omnichannel

Adicionar e-mail e voz sobre o mesmo customer/conversation context, não como sistemas paralelos.

## 13. P11 — Agency OS

Módulos: agency CRM, vendas, clientes, projects, deployments, fleet, incidents, support, CS, finance, content/social/ads.

Fleet deve mostrar versão, health, migrations, integrations, agent failure rate, custo, incidentes, SLA, backup e restore drill.

## 14. P12 — Intelligence

Somente após outcomes confiáveis:
- next-best-action;
- no-show;
- churn;
- conversion propensity;
- Ads optimization;
- content prediction;
- anomaly detection.

## 15. Gates de qualidade

Cada tranche inclui:
- unit;
- contract;
- PostgreSQL integration;
- E2E;
- tenant-negative;
- policy-negative;
- idempotency/replay;
- provider failure;
- timeout;
- rollback;
- agent evals.

Evals testam tanto executar corretamente quanto **recusar/escalar corretamente**.

## 16. Ordem imediata

1. P0 baseline.
2. P1 provider-neutral.
3. P2 Contabo rehearsal/cutover.
4. estabilizar DB/infra.
5. P3 WAHA canary/cutover.
6. estabilizar canal.
7. iniciar P4 AI Control Plane.

Não combinar DB cutover, WAHA cutover e refatoração do Control Plane na mesma janela operacional.
