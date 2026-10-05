# Synkroo vNext — AI-Native Business Operating System

**Versão:** 1.0  
**Data:** 2026-10-05  
**Status:** direção canônica para a próxima evolução do produto  
**Baseline preservado:** `main@c3aa243c172cf59be64ffccaaf806a138c534721`  
**Relacionada:** issue #21 — agent-ready/headless actions + outcome telemetry

## 1. Decisão

O Synkroo evolui de uma plataforma modular com agente conversacional para um **Business Operating System AI-native**.

A IA será o operador padrão dos fluxos elegíveis. O backend continuará autoritativo. O humano atuará principalmente em exceções, aprovações, decisões estratégicas, risco clínico, jurídico, LGPD e ações de alto impacto.

> A LLM percebe, planeja e orquestra. Actions e services validam e executam. O banco e os sistemas de registro permanecem como fonte da verdade.

Não haverá reescrita total. A fundação já validada — modular monolith, Action Layer, RBAC, tenant scope, idempotência, auditoria, PostgreSQL/Drizzle, Cloudflare, queues e adapters — deve ser preservada e evoluída.

## 2. Problema atual

O produto já possui capacidades fortes em atendimento, agenda, leads, CRM, pipeline, follow-up, reativação, campanhas, financeiro, RAG, analytics e segurança.

O principal gargalo é que as capacidades do backend são muito maiores que as capacidades disponíveis para o agente autônomo. A bridge atual usa deny-by-default e uma allowlist pequena, majoritariamente de agenda/paciente.

O vNext deve transformar capacidades isoladas em um sistema operacional orientado a:

```text
evento → objetivo → decisão → policy → action → verificação → outcome
                                                ↘ exceção humana
```

## 3. Objetivos de produto

O Synkroo deve operar, dentro de políticas explícitas:

1. atendimento multicanal;
2. vendas;
3. CRM;
4. agendamento e capacidade;
5. follow-ups e jornadas;
6. reativação;
7. campanhas;
8. cobrança e financeiro;
9. customer success;
10. conteúdo;
11. redes sociais;
12. tráfego pago;
13. analytics e otimização.

O humano recebe uma fila priorizada de exceções, aprovações, baixa confiança, falhas repetidas e decisões de maior risco.

## 4. Dois Operating Systems sobre o mesmo core

### Clinic OS
Opera a clínica cliente: atendimento, agenda, CRM, comercial, retenção, financeiro, marketing, analytics e IA.

### Synkroo Agency OS
Opera a própria Synkroo: prospecção, vendas, onboarding, projetos, deployments, suporte, incidentes, CS, financeiro, conteúdo, social, Ads, capacidade e fleet management.

Os dois reutilizam Action Layer, eventos, policies, observabilidade e UX patterns, mantendo isolamento de dados e permissões.

## 5. Arquitetura alvo

```text
┌────────────────────────────────────────────────────────────────┐
│ EXPERIENCE                                                     │
│ Control Center │ Dashboard │ WhatsApp │ Instagram │ Email      │
│ Voice │ Web Widget │ Mobile/PWA                                │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│ AI CONTROL PLANE                                               │
│ Goals │ Event Router │ Context │ Planner │ Policies │ Skills   │
│ Runs │ Verification │ Memory │ Exceptions │ Learning          │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│ CAPABILITY / ACTION LAYER                                      │
│ CRM │ Sales │ Agenda │ Follow-up │ Finance │ Content │ Social  │
│ Paid Media │ CS │ Messaging │ Analytics │ Integrations        │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│ AUTHORITATIVE BACKEND                                          │
│ Services │ Rules │ State │ Transactions │ Idempotency │ Audit  │
│ Events │ Outbox │ Queues │ Provider Adapters                   │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│ DATA / EXTERNAL SYSTEMS                                        │
│ PostgreSQL │ pgvector │ Storage │ WAHA │ Asaas │ Meta │ Google│
└────────────────────────────────────────────────────────────────┘
```

## 6. AI Control Plane

### BusinessEvent

Todo fato operacional relevante deve poder originar evento normalizado, por exemplo:

- `lead.created`
- `conversation.unanswered`
- `appointment.cancelled`
- `appointment.no_show`
- `budget.stale`
- `payment.overdue`
- `patient.inactive`
- `campaign.completed`
- `ads.cpa.threshold_exceeded`
- `integration.degraded`

Eventos carregam referências e contexto mínimo, não dumps arbitrários de PII.

### Goal

Resultado desejado, não instrução de baixo nível. Exemplos: converter lead, preencher horário cancelado, recuperar orçamento, reduzir inadimplência, reativar paciente, cumprir SLA, manter CPA em envelope.

### AgentRun

Cada execução registra evento de origem, objetivo, contexto, plano, tools avaliadas, PolicyDecision, ActionAttempts, verificações, outcome, custo, duração e escalada.

### Verification loop

Nenhuma ação consequencial é concluída só porque o LLM afirmou sucesso:

```text
decidir → executar Action → resultado tipado → validar pós-condição
→ registrar outcome → responder/concluir
```

## 7. Policy Engine e autonomia

A segurança atual deny-by-default é preservada e generalizada.

| Classe | Regra | Exemplos |
|---|---|---|
| AUTO | executa + audita | leitura, nota, tag, lembrete, follow-up elegível |
| CONFIRM | confirmação da pessoa afetada | agendar/reagendar e certas alterações cadastrais |
| APPROVAL | aprovador interno com permission | aumento de budget, disparo amplo, refund, ações financeiras relevantes |
| DENY | agente nunca executa | diagnóstico/prescrição, bypass LGPD, DB/shell genérico |

Regras obrigatórias:

- deny-by-default;
- RBAC e módulo ativo;
- tenant/clinic derivados de contexto confiável;
- idempotência em side effects;
- aprovação vinculada a payload imutável e TTL;
- limites de gasto server-side;
- kill switch global, por tenant e por domínio;
- rollout `OFF → OBSERVE → ASSIST → AUTO_LIMITED → AUTO`.

## 8. Capability model

### Agenda
Manter agenda/waitlist/lembretes e evoluir para preenchimento autônomo de capacidade e redução de no-show.

### Atendimento
Inbox unificado, identity resolver, SLA, takeover, anexos e contexto único entre canais.

### Comercial / CRM
Expor Actions tipadas para captura, qualificação, scoring, estágio, notas/tags, avaliação, conversão e encerramento. Cada lead/oportunidade deve possuir estado, objetivo, próxima ação, prazo, automação ativa, bloqueio e risco.

### Follow-up / Retenção
Evoluir crons isolados para **Journey Engine** stateful, com branches, wait states, stop conditions e outcomes.

### Financeiro
Preservar billing/cobrança atual e expandir gradualmente para contas a receber/pagar, despesas, recorrências, conciliação, fluxo de caixa, DRE simplificada, centros de custo, forecast e unit economics.

### Content Studio — novo
```text
insight → pauta → briefing → criação → revisão → compliance
→ aprovação → publicação → medição → reciclagem
```

### Social Media — novo
Calendário, publicação, comentários, inbox, menções, analytics e biblioteca de assets para Instagram, LinkedIn, TikTok, YouTube e Google Business.

### Paid Media — novo
AdAccount, Campaign, AdSet/Group, Creative, Audience, BudgetPolicy, Spend, Conversion, Attribution e Experiment. Leitura pode ser AUTO; mutações de verba começam em OBSERVE/ASSIST e só avançam após evidência.

## 9. WhatsApp Provider — WAHA substitui Evolution API

### Decisão

O provider principal de WhatsApp do vNext será **WAHA**. Evolution API será descontinuada após migração validada.

A aplicação não deve depender diretamente de WAHA. Deve existir um contrato neutro:

```ts
interface WhatsAppProviderAdapter {
  getStatus(installation: InstallationRef): Promise<ProviderStatus>
  startSession(input: StartSessionInput): Promise<SessionResult>
  getQrCode(installation: InstallationRef): Promise<QrResult>
  sendText(input: SendTextInput): Promise<SendResult>
  sendMedia(input: SendMediaInput): Promise<SendResult>
  markRead?(input: MarkReadInput): Promise<void>
  normalizeWebhook(input: unknown): Promise<NormalizedInboundEvent[]>
}
```

O `channel-service` passa a depender do adapter/registry, não de `evolution-service.ts`.

### WAHA deployment contract

- self-hosted em Docker na VPS Contabo;
- versão da imagem pinada em produção;
- API protegida por API key;
- HTTPS via reverse proxy/tunnel;
- Dashboard/Swagger não expostos publicamente sem necessidade;
- webhook com HMAC;
- session storage persistente e incluído no backup;
- health e session status monitorados;
- engine selecionado por compatibilidade, não hardcoded na regra de negócio.

### Engine

GOWS/NOWEB são candidatos por menor consumo; WEBJS permanece opção de compatibilidade. A escolha final exige contract tests dos recursos Synkroo usados. A troca de provider e a troca de engine não devem ser experimentos simultâneos no cutover.

### Migração funcional

Criar:

- `waha-service.ts` / adapter;
- `/api/whatsapp/waha` webhook;
- normalizador WAHA → evento interno;
- status/QR;
- outbound text/media;
- session-to-clinic mapping;
- testes de HMAC/replay/dedup;
- feature flag `WHATSAPP_PROVIDER=waha|evolution` durante transição.

Depois do aceite:

- remover Evolution como default;
- congelar novos usos;
- remover env vars e endpoints legados em tranche posterior;
- atualizar ADR-BASE-08.

O sidecar Playwright atual não deve ser automaticamente mantido como fallback permanente. WAHA já é um runtime WhatsApp próprio; após estabilização, reavaliar se o sidecar ainda reduz risco ou apenas duplica complexidade.

## 10. Outcome telemetry

Medir resultado de negócio, não somente tokens/tool calls.

Outcomes iniciais:

- lead_contacted;
- lead_qualified;
- appointment_scheduled;
- appointment_recovered;
- no_show_prevented;
- budget_recovered;
- payment_recovered;
- patient_reactivated;
- conversation_resolved;
- human_escalation;
- failed_workflow;
- content_published;
- lead_generated;
- paid_conversion;
- revenue_influenced.

Derivar custo por outcome, taxa de automação, taxa de exceção, tempo para resultado e receita recuperada/influenciada.

## 11. Control Center

A home passa a mostrar trabalho real da IA:

- objetivos;
- saúde operacional;
- Agent Runs;
- activity feed;
- outcomes;
- exceções;
- aprovações;
- integration health;
- automation rate;
- custos.

As páginas atuais continuam como drill-down e operação manual.

## 12. Human-as-exception

Escalar: risco clínico, diagnóstico/medicação, pedido humano, baixa confiança, conflito de dados, falhas repetidas, provider degradado, policy APPROVAL, limites financeiros, jurídico/LGPD, segurança e negociação complexa.

Toda exceção inclui resumo, objetivo, tentativas, decisão pendente, recomendação, prioridade e SLA.

## 13. Skills e memória

Skills descrevem procedimento reutilizável e tools permitidas; não concedem privilégio.

Memória auxilia preferências/aprendizado, mas não é fonte de verdade para saldo, pagamento, agenda, consentimento, preço, estágio, permission ou contrato. Antes de agir, o backend é reconsultado.

## 14. Infraestrutura vNext

A arquitetura não deve depender do nome do provedor VPS.

- source da migração: Hostinger;
- target: Contabo;
- runtime: Linux/Docker provider-neutral.

Conhecido no repo como ligado à VPS:

- PostgreSQL 17 + pgvector;
- Cloudflare Tunnel do DB;
- sidecar Playwright;
- volumes e rotinas de backup.

Descobrir remotamente antes do corte: Evolution, proxy/Traefik, rede `proxy`, staging, cron, systemd, PM2, certificados, firewall, observabilidade e outros serviços.

O WAHA deve nascer diretamente na Contabo; não migrar uma instalação Evolution para a Contabo para depois descartá-la, salvo necessidade temporária de rollback.

## 15. NFRs adicionais

- policy version em toda decisão;
- pós-condição para ação consequencial;
- cost/rate budget por tenant;
- circuit breaker por provider;
- replay protection;
- DLQ observável;
- feature flags de autonomia;
- shadow mode;
- secret redaction;
- backups off-host;
- restore drills;
- observabilidade de WAHA/sessões/webhooks.

## 16. Critérios de aceite da fundação vNext

- [ ] BusinessEvent + outbox.
- [ ] Goal + AgentRun persistidos.
- [ ] Policy Engine sem redução de segurança.
- [ ] Outcome telemetry.
- [ ] verificação pós-action.
- [ ] pelo menos CRM + follow-up + agenda com workflow agent-ready.
- [ ] Exception Queue + Approval Inbox.
- [ ] Control Center com atividade real.
- [ ] kill switch e níveis de autonomia.
- [ ] WAHA validado em staging/test number.
- [ ] Evolution removida do caminho principal sem regressão.
- [ ] Hostinger → Contabo ensaiado e executado com rollback.
- [ ] evals de ação correta e recusa correta.

## 17. Não objetivos imediatos

- big-bang rewrite;
- microservices por domínio;
- dezenas de agentes independentes;
- SQL/shell para LLM;
- todos os canais simultaneamente;
- remover UI manual;
- substituir regras clínicas por LLM.

## 18. Ordem de prioridade

1. baseline documental;
2. provider-neutral infra;
3. Contabo + restore rehearsal;
4. cutover Hostinger → Contabo;
5. WAHA adapter + canary + cutover Evolution → WAHA;
6. AI Control Plane;
7. agent-ready CRM/sales/follow-up/finance;
8. Control Center;
9. Content/Social/Paid Media;
10. Agency OS;
11. inteligência preditiva.
