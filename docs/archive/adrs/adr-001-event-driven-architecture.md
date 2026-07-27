# ADR-001: Event-Driven Architecture para Comunicação Assíncrona

**Status:** ✅ Accepted
**Data:** 2026-03-27
**Decisores:** Winston (Arquiteto), Walis (Product Owner)

---

## Contexto

O Synkroo precisa processar mensagens de múltiplos canais (WhatsApp, Instagram, Chat Widget) com alta disponibilidade e baixa latência. O sistema deve:

1. **Receber webhooks** de plataformas externas (Meta, WhatsApp Business API)
2. **Processar mensagens** com o agente IA (latência variável de 1-5s)
3. **Enviar respostas** para múltiplos canais
4. **Executar jobs agendados** (lembretes, follow-ups)
5. **Manter resiliência** a falhas de serviços externos

### Problema

Uma arquitetura síncrona convencional apresentaria:
- Timeouts ao processar mensagens com IA (LLMs podem demorar >5s)
- Falhas em cascata se um serviço externo ficar indisponível
- Dificuldade em escalar horizontalmente
- Perda de mensagens em caso de falhas

---

## Decisão

**Adotar Event-Driven Architecture** com os seguintes padrões:

### 1. Message Queue Pattern

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Producer   │────▶│    Queue     │────▶│   Consumer   │
│  (Webhook)   │     │  (Supabase)  │     │   (Worker)   │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Implementação:**
- **Queue:** Supabase `message_queue` table com status
- **Producer:** Edge Functions recebendo webhooks
- **Consumer:** Edge Functions polling ou Realtime subscriptions

### 2. Event Types

| Evento | Payload | Handler |
|--------|---------|---------|
| `message.received` | `{channel, from, content, timestamp}` | Orchestrator Agent |
| `message.processed` | `{response, confidence, agent}` | WhatsApp/Instagram Sender |
| `message.failed` | `{error, retry_count}` | Retry Worker |
| `appointment.created` | `{patient_id, datetime, procedure}` | Reminder Scheduler |
| `reminder.due` | `{appointment_id, type}` | Message Sender |

### 3. Outbox Pattern

Para garantir atomicidade entre operações de banco e eventos:

```sql
-- Tabela de outbox
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Transação atômica
BEGIN;
  INSERT INTO messages (...) VALUES (...);
  INSERT INTO outbox_events (event_type, payload)
    VALUES ('message.received', '{"...": "..."}');
COMMIT;
```

### 4. Retry Policy

```
Strategy: Exponential Backoff with Jitter

1ª tentativa: imediato
2ª tentativa: +1s
3ª tentativa: +5s
4ª tentativa: +30s
5ª tentativa: +2min
6ª tentativa: +10min (máximo)

Após 6 falhas: Dead Letter Queue (DLQ)
```

---

## Alternativas Consideradas

### Alternativa 1: Arquitetura Síncrona
- **Prós:** Mais simples de implementar
- **Contras:** Timeouts, falhas em cascata, não escala
- **Veredito:** ❌ Rejeitada - não atende requisitos de latência e resiliência

### Alternativa 2: Message Broker Externo (RabbitMQ/Kafka)
- **Prós:** Features avançadas, alta throughput
- **Contras:** Complexidade adicional, custo, mais uma dependência
- **Veredito:** ⚠️ Postergada - reavaliar se escala exigir (1000+ clínicas)

### Alternativa 3: Supabase Queue (Decisão Atual)
- **Prós:** Sem serviço adicional, integração nativa, custo zero adicional
- **Contras:** Menos features que RabbitMQ
- **Veredito:** ✅ Aceita - adequada para MVP e escala prevista

---

## Consequências

### Positivas
- ✅ **Resiliência:** Mensagens não são perdidas em falhas
- ✅ **Escalabilidade:** Workers podem escalar independentemente
- ✅ **Observabilidade:** Rastreamento completo do ciclo de vida
- ✅ **Flexibilidade:** Fácil adicionar novos consumidores

### Negativas
- ⚠️ **Complexidade:** Mais código para gerenciar estado
- ⚠️ **Latência Adicional:** Overhead de fila (~50-100ms)
- ⚠️ **Debugging:** Mais difícil rastrear fluxos assíncronos

### Mitigações
- Implementar correlation IDs para rastreamento
- Dashboard de monitoramento de filas
- Alertas para DLQ

---

## Referências

- [Enterprise Integration Patterns - Message Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/MessageChannel.html)
- [Outbox Pattern - Debezium](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

---

**Relacionado com:**
- Epic E-01: Atendimento Multicanal
- Epic E-02: Gestão de Agendamentos
- Epic E-03: Follow-up e Retenção