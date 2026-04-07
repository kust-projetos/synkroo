# Performance Targets (SLIs/SLOs)

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Este documento define os indicadores de desempenho (SLIs), objetivos (SLOs) e orçamentos de erro para o Synkroo.

---

## Definições

| Termo | Definição |
|-------|-----------|
| **SLI** (Service Level Indicator) | Métrica que mede um aspecto do serviço |
| **SLO** (Service Level Objective) | Meta para o SLI em um período |
| **SLA** (Service Level Agreement) | Compromisso contratual com consequências |
| **Error Budget** | Quantidade de erros toleráveis dentro do SLO |

---

## SLIs e SLOs

### 1. Disponibilidade

**SLI:** Proporção de requisições válidas bem-sucedidas

```
SLI = (Total requests - Failed requests) / Total requests
```

| Serviço | SLO | Janela | Error Budget |
|---------|-----|--------|--------------|
| API Gateway | 99.9% | Mensal | 43.2 min/mês |
| WhatsApp Integration | 99.5% | Mensal | 3.6 h/mês |
| AI Processing | 99.0% | Mensal | 7.2 h/mês |
| Dashboard | 99.5% | Mensal | 3.6 h/mês |

### 2. Latência

**SLI:** Percentil do tempo de resposta

| Serviço | P50 Target | P90 Target | P99 Target |
|---------|------------|------------|------------|
| API REST | < 100ms | < 200ms | < 500ms |
| Mensagens (resposta IA) | < 2s | < 5s | < 10s |
| Disponibilidade (query) | < 50ms | < 100ms | < 200ms |
| Dashboard (carregamento) | < 1s | < 2s | < 3s |

### 3. Throughput

**SLI:** Requisições processadas por segundo

| Serviço | Sustained | Burst | Unit |
|---------|-----------|-------|------|
| API Gateway | 100 | 500 | req/s |
| Message Processing | 50 | 200 | msg/s |
| Webhook Ingestion | 200 | 1000 | webhook/s |

### 4. Erros

**SLI:** Taxa de erros por tipo

| Tipo | SLO | Threshold |
|------|-----|-----------|
| HTTP 5xx | < 0.1% | Alert at 0.05% |
| HTTP 4xx | < 1% | Alert at 0.5% |
| Timeouts | < 0.5% | Alert at 0.25% |
| AI Processing Failures | < 1% | Alert at 0.5% |

### 5. Saturação

**SLI:** Utilização de recursos

| Recurso | Target | Max | Action |
|---------|--------|-----|--------|
| CPU (containers) | < 70% | 85% | Scale up |
| Memory (containers) | < 75% | 90% | Scale up |
| Database Connections | < 80% | 90% | Scale up |
| Queue Depth | < 100 | 500 | Scale workers |

---

## Error Budgets

### Cálculo

```
Error Budget = (1 - SLO) × Time Window

Exemplo (99.9% mensal):
(1 - 0.999) × 30 dias × 24h × 60min = 43.2 minutos de downtime aceitável
```

### Políticas de Error Budget

| Budget Restante | Ação |
|-----------------|------|
| > 50% | Normal operations, feature development |
| 25% - 50% | Reduce risk, focus on reliability |
| < 25% | Freeze new features, reliability sprint |
| < 0% | Incident postmortem mandatory |

---

## Alertas

### Alerting Strategy

```
Severity Levels:
- P1 (Critical): SLO violation imminent, wake on-call
- P2 (Warning): Error budget burning fast, same-day response
- P3 (Info): Interesting patterns, next business day
```

### Alert Rules

| Alert | Condition | Severity | Response Time |
|-------|-----------|----------|---------------|
| `HighErrorRate` | 5xx > 0.05% for 5m | P1 | 15 min |
| `HighLatencyP99` | P99 > 2x target for 10m | P1 | 15 min |
| `ErrorBudgetBurning` | Budget consumption > 10%/day | P2 | 4 hours |
| `QueueBacklog` | Queue depth > 500 for 15m | P2 | 4 hours |
| `AIProcessingDegraded` | Failure rate > 0.5% for 10m | P2 | 4 hours |

---

## Dashboards

### Operacional

- Request rate por endpoint
- Latência P50/P90/P99
- Error rate por tipo
- Active connections
- Queue depth

### SLO

- Availability gauge (current vs target)
- Error budget remaining
- Burn rate
- Monthly trend

### Business

- Messages processed
- Appointments created
- Active conversations
- AI token usage

---

## Medição

### Ferramentas

| Camada | Ferramenta | Métricas |
|--------|------------|----------|
| Application | Sentry | Errors, traces |
| Infrastructure | Vercel Analytics | Latency, requests |
| Database | Supabase Dashboard | Query time, connections |
| AI/LLM | Custom metrics | Token usage, latency |

### Exported Metrics

```typescript
// Prometheus format
synkroo_http_requests_total{method, endpoint, status} counter
synkroo_http_request_duration_seconds{method, endpoint} histogram
synkroo_messages_processed_total{channel, direction} counter
synkroo_ai_latency_seconds{agent_type} histogram
synkroo_error_budget_remaining_gauge{service} gauge
```

---

## Relatórios

### Diário

- Resumo de SLIs
- Incidentes do dia
- Status do error budget

### Semanal

- Tendência de SLOs
- Top erros
- Ações de melhoria

### Mensal

- Relatório executivo
- Error budget utilizado
- Recomendações

---

## Revisão

- **Frequência:** Trimestral ou após incidentes
- **Critérios:** Ajustar SLOs com base em dados reais
- **Documentação:** Atualizar este documento

---

## Referências

- [Google SRE Book - SLOs](https://sre.google/sre-book/service-level-objectives/)
- [The Art of SLOs](https://sre.google/workbook/implementing-slos/)
- [Error Budget Policy](https://sre.google/workbook/error-budget-policy/)