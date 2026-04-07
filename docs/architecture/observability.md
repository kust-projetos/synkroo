# Observability Strategy

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Estratégia de observabilidade baseada nos **Three Pillars**: Logs, Metrics e Traces, com foco em actionability e debugging efficiency.

---

## Pilares da Observabilidade

### 1. Logs

**Princípios:**
- Structured logging (JSON)
- Correlation IDs para rastreamento
- Níveis claros (DEBUG, INFO, WARN, ERROR)
- Context enrichment automático

**Formato:**

```json
{
  "timestamp": "2026-03-27T10:30:00.123Z",
  "level": "INFO",
  "service": "message-processor",
  "traceId": "abc123",
  "spanId": "def456",
  "clinicId": "clinic-uuid",
  "userId": "user-uuid",
  "message": "Message processed successfully",
  "context": {
    "channel": "whatsapp",
    "messageId": "msg-uuid",
    "processingTimeMs": 1234
  }
}
```

**Ferramentas:**
- **Aplicação:** Pino (Node.js)
- **Coleta:** Vercel Log Drains → Datadog
- **Retenção:** 30 dias (hot), 90 dias (cold)

**Log Levels:**

| Nível | Uso | Exemplo |
|-------|-----|---------|
| DEBUG | Desenvolvimento | Variáveis internas |
| INFO | Eventos normais | Message received |
| WARN | Problemas recuperáveis | Retry attempt |
| ERROR | Falhas que afetam usuário | API failure |

### 2. Metrics

**Tipos:**
- **Counter:** Incrementa apenas (requests, errors)
- **Gauge:** Valor instantâneo (queue depth, memory)
- **Histogram:** Distribuição (latency, size)

**Categories:**

#### Business Metrics

```yaml
# Messages
- synkroo.messages.received{channel}
- synkroo.messages.sent{channel}
- synkroo.messages.failed{channel, reason}

# Appointments
- synkroo.appointments.created{clinic}
- synkroo.appointments.cancelled{reason}
- synkroo.appointments.confirmed

# AI
- synkroo.ai.tokens_used{model, agent}
- synkroo.ai.latency_seconds{agent}
- synkroo.ai.errors{agent, error_type}
```

#### System Metrics

```yaml
# HTTP
- http.requests.total{method, endpoint, status}
- http.request.duration_seconds{method, endpoint}

# Database
- db.queries.total{operation, table}
- db.query.duration_seconds{operation}
- db.connections.active
- db.connections.idle

# Queue
- queue.messages.pending{queue_name}
- queue.messages.processed{queue_name}
- queue.processing_time_seconds{queue_name}
```

#### Infrastructure Metrics

```yaml
# Compute
- system.cpu.usage_percent
- system.memory.usage_percent
- system.disk.io_bytes{direction}

# Network
- network.requests_per_second
- network.error_rate
```

**Ferramentas:**
- **Collection:** OpenTelemetry SDK
- **Storage:** Prometheus (Vercel)
- **Visualization:** Grafana

### 3. Traces

**Distributed Tracing:**

```
┌─────────────────────────────────────────────────────────────┐
│                      Trace: msg-123                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Span 1] HTTP POST /webhooks/whatsapp         50ms         │
│     │                                                        │
│     ├─ [Span 2] validate_signature             5ms          │
│     │                                                        │
│     ├─ [Span 3] parse_message                  10ms         │
│     │                                                        │
│     ├─ [Span 4] db.insert_message              20ms         │
│     │                                                        │
│     └─ [Span 5] enqueue_for_processing         15ms         │
│                                                              │
│  [Span 6] message-processor                    2500ms       │
│     │                                                        │
│     ├─ [Span 7] get_patient_context            50ms         │
│     │    └─ db.query                          45ms          │
│     │                                                        │
│     ├─ [Span 8] ai.classify_intent            800ms        │
│     │    └─ claude.api                        750ms         │
│     │                                                        │
│     ├─ [Span 9] ai.generate_response          1500ms       │
│     │    └─ claude.api                        1400ms       │
│     │                                                        │
│     └─ [Span 10] send_whatsapp_reply          150ms        │
│          └─ meta.api                          130ms         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Atributos Obrigatórios:**

```typescript
interface SpanAttributes {
  // Identificação
  'service.name': string;
  'service.version': string;

  // Tenant
  'synkroo.clinic_id': string;

  // Request
  'http.method': string;
  'http.url': string;
  'http.status_code': number;

  // Context
  'synkroo.message_id'?: string;
  'synkroo.patient_id'?: string;
  'synkroo.appointment_id'?: string;
}
```

**Ferramentas:**
- **SDK:** OpenTelemetry JavaScript
- **Export:** OTLP → Jaeger (via Vercel)
- **Sampling:** 10% normal, 100% errors

---

## Dashboards

### 1. Operations Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    OPERATIONS OVERVIEW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  REQ/S       │  │  P99 LATENCY │  │  ERROR RATE  │      │
│  │    125       │  │    245ms     │  │    0.05%     │      │
│  │  ✓ Normal    │  │  ✓ Normal    │  │  ✓ Normal    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  [Request Rate Graph - 24h]                                 │
│  [Latency Heatmap - 24h]                                    │
│  [Error Timeline - 24h]                                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ TOP ENDPOINTS BY LATENCY                              │   │
│  │ POST /messages/incoming      2.5s (P99)              │   │
│  │ GET /appointments/avail      150ms (P99)             │   │
│  │ POST /webhooks/whatsapp      50ms (P99)              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Business Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    BUSINESS METRICS                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MESSAGES     │  │ APPOINTMENTS │  │ AI TOKENS    │      │
│  │   TODAY      │  │   TODAY      │  │   TODAY      │      │
│  │   1,234      │  │    89        │  │   245K       │      │
│  │   +12%       │  │   +5%        │  │   +8%        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  [Messages by Channel - Pie Chart]                          │
│  [Appointments by Clinic - Bar Chart]                       │
│  [AI Cost Trend - Line Graph]                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. SLO Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│                    SLO TRACKING                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  SERVICE          SLO      CURRENT    ERROR BUDGET         │
│  ─────────────────────────────────────────────────────      │
│  API Gateway      99.9%    99.95%     ████████░░ 80%       │
│  WhatsApp         99.5%    99.7%      █████████░ 90%       │
│  AI Processing    99.0%    98.5%      ████░░░░░░ 40% ⚠️    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Alertas

### Alert Routing

```yaml
routes:
  - match:
      severity: critical
    receivers: [pagerduty, slack-ops]

  - match:
      severity: warning
    receivers: [slack-ops]

  - match:
      severity: info
    receivers: [slack-dev]
```

### Alert Definitions

```yaml
groups:
  - name: synkroo-critical
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: AILatencyHigh
        expr: |
          histogram_quantile(0.99,
            rate(synkroo_ai_latency_seconds_bucket[10m])
          ) > 10
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "AI latency P99 above 10s"

      - alert: QueueBacklog
        expr: queue_messages_pending > 500
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Queue backlog growing"
```

---

## Instrumentação

### Aplicação

```typescript
// otel.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PrometheusExporter({ port: 9090 }),
  instrumentations: [
    new HttpInstrumentation(),
    new PgInstrumentation(),
  ],
});

sdk.start();
```

### Middleware

```typescript
// tracing-middleware.ts
import { trace, context } from '@opentelemetry/api';

export function tracingMiddleware(req, res, next) {
  const tracer = trace.getTracer('synkroo-api');
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`);

  span.setAttributes({
    'http.method': req.method,
    'http.url': req.url,
    'synkroo.clinic_id': req.headers['x-clinic-id'],
  });

  context.with(trace.setSpan(context.active(), span), () => {
    res.on('finish', () => {
      span.setAttributes({
        'http.status_code': res.statusCode,
      });
      span.end();
    });
    next();
  });
}
```

---

## Runbooks

Cada alerta tem um runbook associado em `docs/runbooks/`:

- `high-error-rate.md`
- `ai-latency-high.md`
- `queue-backlog.md`
- `database-connections-exhausted.md`

---

## Ferramentas Stack

| Categoria | Ferramenta | Uso |
|-----------|------------|-----|
| Logging | Pino + Datadog | Logs estruturados |
| Metrics | Prometheus + Grafana | Métricas e dashboards |
| Tracing | OpenTelemetry + Jaeger | Distributed tracing |
| APM | Sentry | Error tracking, performance |
| Alerting | PagerDuty + Slack | Incident management |

---

## Referências

- [OpenTelemetry Best Practices](https://opentelemetry.io/docs/concepts/signals/)
- [Google SRE - Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
- [The Three Pillars of Observability](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/ch01.html)