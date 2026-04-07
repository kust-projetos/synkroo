# Cost Model

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Modelo de custos para operação do Synkroo, com projeções para 1, 10, 50 e 100 clínicas.

---

## Estrutura de Custos

### Categorias

| Categoria | Descrição | Tipo |
|-----------|-----------|------|
| **Infrastructure** | Cloud services, hosting | Variable |
| **AI/LLM** | Claude API, tokens | Variable |
| **Communication** | WhatsApp API, SMS | Variable |
| **Third-party** | SaaS tools, services | Fixed |
| **Personnel** | Dev, ops, support | Fixed |

---

## Custos Fixos (Mensais)

| Serviço | Provedor | Plano | Custo (USD) |
|---------|----------|-------|-------------|
| Hosting | Vercel | Pro | $20 |
| Database | Supabase | Pro | $25 |
| Redis | Upstash | Pay-as-you-go | $10 (base) |
| Monitoring | Sentry | Team | $26 |
| Error Tracking | Bugsnag | Pro | $29 |
| Logging | Datadog | Pro | $31 |
| Domain | Cloudflare | Pro | $20 |
| SSL | Cloudflare | Included | $0 |
| **Total Fixos** | | | **$161** |

---

## Custos Variáveis

### 1. AI/LLM (Claude API)

| Modelo | Uso | Custo/1K tokens | Volume/mês (1 clínica) | Custo/mês |
|--------|-----|-----------------|------------------------|-----------|
| Claude Sonnet 4 | Classificação + resposta | $0.003 (input) / $0.015 (output) | 50K input + 200K output | $3.15 |
| Claude Haiku | Simple tasks | $0.00025 / $0.00125 | 100K input + 300K output | $0.40 |
| **Total AI** | | | | **$3.55/clínica/mês** |

**Escalabilidade:**

| Clínicas | Mensagens/mês | Tokens/mês | Custo AI/mês |
|----------|---------------|------------|--------------|
| 1 | 500 | 500K | $3.55 |
| 10 | 5,000 | 5M | $35.50 |
| 50 | 25,000 | 25M | $177.50 |
| 100 | 50,000 | 50M | $355.00 |

### 2. WhatsApp Business API

| Componente | Custo |
|------------|-------|
| Incoming messages | Free |
| Outgoing (24h window) | Free |
| Template messages | $0.005 - $0.09/msg |
| **Estimativa por clínica** | $5-20/mês |

**Uso típico por clínica:**
- 200 conversas/mês
- 50 templates/mês (lembretes)
- Custo: ~$10/mês

### 3. Infrastructure (Vercel + Supabase)

| Recurso | Tier | Custo Base | Threshold |
|---------|------|------------|-----------|
| Bandwidth | Vercel | $0/100GB | $0.10/GB after |
| Function Executions | Vercel | $0/1M | $0.60/1M after |
| Database Storage | Supabase | 8GB included | $0.125/GB after |
| Database Compute | Supabase | Included | $0.10/hour additional |

**Projeção por escala:**

| Clínicas | Bandwidth | Functions | DB Storage | DB Compute | Total |
|----------|-----------|-----------|------------|------------|-------|
| 1 | $0 | $0 | $0 | $0 | $0 |
| 10 | $0 | $5 | $2 | $10 | $17 |
| 50 | $10 | $30 | $15 | $50 | $105 |
| 100 | $30 | $80 | $40 | $120 | $270 |

---

## Projeção de Custos por Escala

### 1 Clínica (MVP)

| Categoria | Custo/mês |
|-----------|-----------|
| Fixed Infrastructure | $161 |
| AI/LLM | $3.55 |
| WhatsApp | $10 |
| Variable Infrastructure | $0 |
| **TOTAL** | **~$175/mês** |

### 10 Clínicas

| Categoria | Custo/mês |
|-----------|-----------|
| Fixed Infrastructure | $161 |
| AI/LLM | $35.50 |
| WhatsApp | $100 |
| Variable Infrastructure | $17 |
| **TOTAL** | **~$314/mês** |

**Custo por clínica:** $31.40

### 50 Clínicas

| Categoria | Custo/mês |
|-----------|-----------|
| Fixed Infrastructure | $161 |
| AI/LLM | $177.50 |
| WhatsApp | $500 |
| Variable Infrastructure | $105 |
| **TOTAL** | **~$944/mês** |

**Custo por clínica:** $18.88

### 100 Clínicas

| Categoria | Custo/mês |
|-----------|-----------|
| Fixed Infrastructure | $161 |
| AI/LLM | $355 |
| WhatsApp | $1,000 |
| Variable Infrastructure | $270 |
| **TOTAL** | **~$1,786/mês** |

**Custo por clínica:** $17.86

---

## Pricing Model

### Sugestão de Preços

| Plano | Preço | Margem (100 clínicas) |
|-------|-------|----------------------|
| **Starter** (1-10 clínicas) | $49/mês | 56% |
| **Growth** (11-50 clínicas) | $39/mês | 107% |
| **Scale** (51+ clínicas) | $29/mês | 63% |

### Margem por Plano

```
Starter (1 clínica):
  Receita: $49
  Custo: $175 (presta prejuízo no início)
  Margem: -$126
  → Necessário volume mínimo de 4 clínicas para break-even

Growth (30 clínicas):
  Receita: $1,170 ($39 × 30)
  Custo: $542 (estimado)
  Margem: $628 (54%)

Scale (100 clínicas):
  Receita: $2,900 ($29 × 100)
  Custo: $1,786
  Margem: $1,114 (38%)
```

---

## Break-Even Analysis

```
Fixed Costs: $161/mês
Variable Cost per Clinic: ~$17/mês (at scale)

Break-even Calculation:
Revenue = Fixed + (Variable × N)
$39 × N = $161 + ($17 × N)
$39N - $17N = $161
$22N = $161
N = 7.3 clínicas

→ Break-even: ~8 clínicas
```

---

## Cost Optimization Strategies

### 1. AI/LLM Optimization

| Estratégia | Economia | Implementação |
|------------|----------|---------------|
| Response caching | 30-50% | Redis cache para FAQs |
| Model routing | 20-30% | Haiku para tarefas simples |
| Context optimization | 15-20% | Resumir histórico longo |
| Batch processing | 10-15% | Agrupar mensagens não urgentes |

**Implementação:**

```typescript
// Semantic caching
async function getCachedResponse(message: string) {
  const embedding = await generateEmbedding(message);
  const cached = await redis.hnsw('responses').search(embedding, { k: 1, threshold: 0.95 });

  if (cached) {
    return cached.response;
  }

  // Call Claude API
  const response = await claude.messages.create({ ... });

  // Cache for future
  await redis.hnsw('responses').add(embedding, { response });

  return response;
}
```

### 2. Infrastructure Optimization

| Estratégia | Economia |
|------------|----------|
| Edge caching (CDN) | 40% bandwidth |
| Function cold start optimization | 20% compute |
| Database connection pooling | 30% DB compute |
| Image optimization | 50% storage |

### 3. WhatsApp Optimization

| Estratégia | Economia |
|------------|----------|
| Use 24h window | 80% template costs |
| Batch reminders | 30% template costs |
| Smart scheduling | 20% retries |

---

## Monitoring & Budgeting

### Cost Alerts

```yaml
# Vercel budget alert
Budget: $200/month
Alert at: 50%, 75%, 90%, 100%

# Supabase budget alert
Budget: $100/month
Alert at: 75%, 100%
```

### Dashboards

- **Daily cost tracking** by service
- **Cost per clinic** metric
- **Token usage** per clinic
- **WhatsApp spend** per clinic

### Forecasting

```
Model: Linear regression based on:
- Active clinics
- Message volume
- Historical patterns

Accuracy: ±15% for next month
```

---

## Cost Reporting

### Monthly Report

```markdown
# Synkroo Cost Report - March 2026

## Summary
- **Total Cost:** $542.00
- **Revenue:** $1,170.00
- **Margin:** $628.00 (54%)
- **Clinics:** 30

## Breakdown
| Category | Cost | % of Total |
|----------|------|------------|
| Infrastructure | $210 | 39% |
| AI/LLM | $112 | 21% |
| WhatsApp | $180 | 33% |
| Other | $40 | 7% |

## Trends
- AI costs: +12% vs last month
- Infrastructure: +5% vs last month
- WhatsApp: -3% vs last month

## Recommendations
- Implement caching for common queries (save ~$30/mo)
- Review unused database storage
- Negotiate WhatsApp volume discount
```

---

## Referências

- [Vercel Pricing](https://vercel.com/pricing)
- [Supabase Pricing](https://supabase.com/pricing)
- [Anthropic Pricing](https://www.anthropic.com/pricing)
- [WhatsApp Business API Pricing](https://developers.facebook.com/docs/whatsapp/pricing)