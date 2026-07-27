# ADR-003: Estratégia de Caching Multi-Layer

**Status:** ✅ Accepted
**Data:** 2026-03-27
**Decisores:** Winston (Arquiteto), Walis (Product Owner)

---

## Contexto

O Synkroo precisa responder em <5s (P90) para mensagens de pacientes. As principais fontes de latência são:

| Fonte | Latência Típica | Frequência |
|-------|-----------------|------------|
| Claude API | 1-4s | Cada mensagem |
| Database queries | 5-50ms | Cada operação |
| WhatsApp API | 100-500ms | Cada envio |
| External MCP calls | 50-200ms | Conforme necessário |

### Requisitos de Cache

1. **Cache de contexto** - Evitar re-buscar dados do paciente
2. **Cache de disponibilidade** - Queries de agenda são frequentes
3. **Cache de respostas** - FAQs devem ter resposta instantânea
4. **Cache de sessão** - Contexto de conversa entre mensagens
5. **Invalidação seletiva** - Não invalidar tudo em cada mudança

---

## Decisão

**Implementar Cache Multi-Layer** com estratégias diferentes por tipo:

### Arquitetura de Cache

```
┌─────────────────────────────────────────────────────────────────┐
│                      CACHE LAYERS                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Browser/Edge Cache (CDN)                              │
│  ├── Assets estáticos (JS, CSS, imagens)                        │
│  ├── TTL: 1 ano (cache-bust com hash)                           │
│  └── Invalidação: nunca (nova URL = novo arquivo)               │
│                                                                  │
│  Layer 2: Next.js Cache (ISR/SSG)                               │
│  ├── Páginas estáticas (landing, docs)                          │
│  ├── TTL: 1 hora                                                │
│  └── Invalidação: revalidate on-demand                          │
│                                                                  │
│  Layer 3: Application Cache (Redis/Upstash)                     │
│  ├── Dados frequentes (disponibilidade, paciente)               │
│  ├── TTL: 5-60 minutos                                          │
│  └── Invalidação: event-driven (webhooks)                       │
│                                                                  │
│  Layer 4: Database Cache (PostgreSQL)                           │
│  ├── Query plan cache                                           │
│  ├── Connection pool                                            │
│  └── Materialized views                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Estratégias por Tipo de Dado

#### 1. Cache de Disponibilidade (Redis)

```typescript
// Key: availability:{clinic_id}:{date}
// TTL: 5 minutos
// Invalidação: On appointment create/update/delete

async function getCachedAvailability(clinicId: string, date: string) {
  const cacheKey = `availability:${clinicId}:${date}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Cache miss - query DB
  const availability = await queryAvailability(clinicId, date);

  // Store in cache
  await redis.setex(cacheKey, 300, JSON.stringify(availability));

  return availability;
}

// Invalidation
async function invalidateAvailabilityCache(clinicId: string, date: string) {
  await redis.del(`availability:${clinicId}:${date}`);
}
```

#### 2. Cache de Paciente (Redis)

```typescript
// Key: patient:{patient_id}
// TTL: 30 minutos
// Invalidação: On patient update

interface PatientCache {
  id: string;
  name: string;
  phone: string;
  lastAppointment: Date;
  preferences: Record<string, any>;
}

async function getCachedPatient(patientId: string): Promise<PatientCache> {
  const cacheKey = `patient:${patientId}`;
  const cached = await redis.get(cacheKey);

  if (cached) {
    cacheMetrics.hits++;
    return JSON.parse(cached);
  }

  cacheMetrics.misses++;
  const patient = await db.patients.findById(patientId);

  await redis.setex(cacheKey, 1800, JSON.stringify(patient));
  return patient;
}
```

#### 3. Cache de Contexto de Conversa (Redis)

```typescript
// Key: conversation:{phone_number}
// TTL: 30 minutos (renovado a cada mensagem)
// Invalidação: Expiração natural

interface ConversationContext {
  phone: string;
  clinicId: string;
  patientId?: string;
  lastIntent?: string;
  lastEntities?: Record<string, any>;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Sliding window TTL
async function updateConversationContext(phone: string, updates: Partial<ConversationContext>) {
  const cacheKey = `conversation:${phone}`;
  const existing = await redis.get(cacheKey);

  const context = existing
    ? { ...JSON.parse(existing), ...updates, updatedAt: new Date() }
    : { phone, ...updates, messageCount: 0, createdAt: new Date(), updatedAt: new Date() };

  context.messageCount++;

  // Reset TTL on each update (sliding window)
  await redis.setex(cacheKey, 1800, JSON.stringify(context));

  return context;
}
```

#### 4. Cache de Respostas (Semantic Cache)

```typescript
// Cache semântico para FAQs
// Usa embeddings para encontrar respostas similares

async function findCachedResponse(message: string, clinicId: string): Promise<string | null> {
  // Generate embedding for message
  const embedding = await generateEmbedding(message);

  // Search for similar cached queries
  const similar = await db.query(`
    SELECT response, similarity
    FROM cached_responses
    WHERE clinic_id = $1
    AND embedding <=> $2 < 0.1
    ORDER BY embedding <=> $2
    LIMIT 1
  `, [clinicId, embedding]);

  if (similar.rows.length > 0) {
    cacheMetrics.semanticHits++;
    return similar.rows[0].response;
  }

  return null;
}

// Store new response
async function cacheResponse(query: string, response: string, clinicId: string) {
  const embedding = await generateEmbedding(query);

  await db.query(`
    INSERT INTO cached_responses (clinic_id, query, response, embedding)
    VALUES ($1, $2, $3, $4)
  `, [clinicId, query, response, embedding]);
}
```

### Invalidation Strategies

| Evento | Cache Afetado | Ação |
|--------|---------------|------|
| `appointment.created` | `availability:{clinic_id}:{date}` | DELETE |
| `appointment.updated` | `availability:{clinic_id}:{date}` | DELETE |
| `appointment.deleted` | `availability:{clinic_id}:{date}` | DELETE |
| `patient.updated` | `patient:{patient_id}` | DELETE |
| `clinic.settings.updated` | `clinic:{clinic_id}` | DELETE |

---

## Alternativas Consideradas

### Alternativa 1: Sem Cache (Database Only)
- **Prós:** Mais simples, dados sempre atualizados
- **Contras:** Latência alta, não escala
- **Veredito:** ❌ Rejeitada - não atende requisitos de performance

### Alternativa 2: Cache Everything
- **Prós:** Performance máxima
- **Contras:** Inconsistência de dados, complexidade de invalidação
- **Veredito:** ❌ Rejeitada - over-engineering

### Alternativa 3: Multi-Layer com Invalidação Seletiva (Decisão Atual)
- **Prós:** Performance + Consistência balanceadas
- **Contras:** Mais código
- **Veredito:** ✅ Aceita

---

## Consequências

### Positivas
- ✅ **Latência reduzida:** De 2-5s para <500ms em cache hits
- ✅ **Custo reduzido:** Menos chamadas de API
- ✅ **Escalabilidade:** Suporta mais usuários com mesmo hardware

### Negativas
- ⚠️ **Complexidade:** Código adicional para gerenciar cache
- ⚠️ **Inconsistência potencial:** Dados podem estar desatualizados
- ⚠️ **Custo Redis:** Serviço adicional

### Mitigações
- TTL curto para dados críticos (5 min)
- Event-driven invalidation
- Cache warming em horários de pico

---

## Métricas de Sucesso

| Métrica | Target | Como Medir |
|---------|--------|------------|
| Cache Hit Rate | > 70% | Redis INFO |
| Latência P90 (cacheado) | < 100ms | APM |
| Latência P90 (não cacheado) | < 3s | APM |
| Invalidação latency | < 100ms | Logs |

---

## Referências

- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
- [Cache Invalidation Patterns](https://martinfowler.com/bliki/TwoHardThings.html)
- [Semantic Caching with pgvector](https://supabase.com/blog/openai-embeddings-postgres-vector)

---

**Relacionado com:**
- Epic E-01: Atendimento Multicanal
- Epic E-02: Gestão de Agendamentos
- NFR-01: API Response Time < 200ms