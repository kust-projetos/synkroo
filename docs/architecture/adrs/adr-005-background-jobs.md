# ADR-005: Background Jobs com Supabase Edge Functions

**Status:** ✅ Accepted
**Data:** 2026-03-27
**Decisores:** Winston (Arquiteto), Walis (Product Owner)

---

## Contexto

O Synkroo precisa executar várias tarefas em background:

| Tarefa | Frequência | Criticidade | Timeout |
|--------|------------|-------------|---------|
| Envio de lembretes | A cada 1 min | Alta | 30s |
| Processamento de mensagens | Contínuo | Alta | 15s |
| Follow-up pós-consulta | A cada 5 min | Média | 60s |
| Limpeza de dados | Diário | Baixa | 300s |
| Relatórios agregados | Diário | Baixa | 300s |
| Sync com WhatsApp | Contínuo | Alta | 60s |

### Requisitos

1. **Execução agendada** - Jobs precisam rodar em horários específicos
2. **Retry automático** - Falhas devem ser retried com backoff
3. **Observabilidade** - Monitorar execuções, falhas, latência
4. **Custo eficiente** - Pagar apenas pelo uso
5. **Escalabilidade** - Suportar aumento de volume

---

## Decisão

**Usar Supabase Edge Functions + pg_cron** para jobs em background:

### 1. Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKGROUND JOBS ARCHITECTURE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    pg_cron (Scheduler)                  │    │
│  │                                                          │    │
│  │  Job              | Schedule    | Function               │    │
│  │  ─────────────────┼─────────────┼─────────────────────── │    │
│  │  reminders        | * * * * *   | send_reminders()       │    │
│  │  followups        | */5 * * * * | process_followups()    │    │
│  │  cleanup          | 0 2 * * *   | cleanup_old_data()     │    │
│  │  reports          | 0 6 * * *   | generate_reports()     │    │
│  │                                                          │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Supabase Edge Functions (Deno)            │    │
│  │                                                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │    │
│  │  │ reminder-   │  │ followup-   │  │ cleanup-    │     │    │
│  │  │ worker      │  │ worker      │  │ worker      │     │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │    │
│  │                                                          │    │
│  │  Features:                                              │    │
│  │  • Auto-scaling                                        │    │
│  │  • Global distribution                                 │    │
│  │  • TypeScript/Deno runtime                             │    │
│  │  • Secrets management                                  │    │
│  │                                                          │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Job Queue (PostgreSQL)               │    │
│  │                                                          │    │
│  │  CREATE TABLE job_queue (                               │    │
│  │    id UUID PRIMARY KEY,                                  │    │
│  │    job_type TEXT NOT NULL,                               │    │
│  │    payload JSONB NOT NULL,                               │    │
│  │    status TEXT DEFAULT 'pending',                        │    │
│  │    attempts INT DEFAULT 0,                                │    │
│  │    max_attempts INT DEFAULT 3,                           │    │
│  │    run_at TIMESTAMPTZ DEFAULT NOW(),                     │    │
│  │    created_at TIMESTAMPTZ DEFAULT NOW()                  │    │
│  │  );                                                      │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Implementação

#### Job Scheduler (pg_cron)

```sql
-- Habilitar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job de lembretes (a cada minuto)
SELECT cron.schedule(
  'send-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://synkroo.supabase.co/functions/v1/reminder-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);

-- Job de follow-up (a cada 5 minutos)
SELECT cron.schedule(
  'process-followups',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://synkroo.supabase.co/functions/v1/followup-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
    body := '{"scheduled": true}'::jsonb
  );
  $$
);

-- Job de limpeza (diário às 2h)
SELECT cron.schedule(
  'cleanup-old-data',
  '0 2 * * *',
  $$
  DELETE FROM conversations
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND clinic_id IN (
    SELECT clinic_id FROM clinic_settings
    WHERE data_retention_days < 90
  );
  $$
);
```

#### Edge Function: Reminder Worker

```typescript
// supabase/functions/reminder-worker/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const startTime = Date.now()

  try {
    // Buscar lembretes pendentes
    const { data: reminders, error } = await supabase
      .from('reminders')
      .select(`
        id,
        appointment_id,
        type,
        scheduled_at,
        appointments!inner (
          patient_id,
          clinic_id,
          datetime,
          patients ( phone, name ),
          clinics ( whatsapp_number )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(100)

    if (error) throw error

    // Processar em paralelo (max 10)
    const results = await Promise.allSettled(
      reminders.map(reminder => sendReminder(reminder))
    )

    // Log de resultados
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(JSON.stringify({
      success: true,
      processed: reminders.length,
      successful,
      failed,
      durationMs: Date.now() - startTime
    }))

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { status: 500 })
  }
})

async function sendReminder(reminder: any) {
  // Enviar via WhatsApp
  const message = formatReminderMessage(reminder)

  const result = await whatsappClient.sendMessage({
    to: reminder.appointments.patients.phone,
    message
  })

  // Atualizar status
  await supabase
    .from('reminders')
    .update({
      status: result.success ? 'sent' : 'failed',
      sent_at: result.success ? new Date().toISOString() : null,
      error: result.error
    })
    .eq('id', reminder.id)

  return result
}
```

### 3. Retry Strategy

```typescript
// Job Queue com retry automático
interface JobQueueItem {
  id: string
  job_type: string
  payload: Record<string, any>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  max_attempts: number
  run_at: Date
  error?: string
}

async function processJobQueue() {
  // Atomic claim (SELECT FOR UPDATE SKIP LOCKED)
  const { data: job } = await supabase.rpc('claim_job')

  if (!job) return null

  try {
    await executeJob(job)

    await supabase
      .from('job_queue')
      .update({ status: 'completed' })
      .eq('id', job.id)

  } catch (error) {
    const attempts = job.attempts + 1

    if (attempts >= job.max_attempts) {
      // Dead Letter Queue
      await supabase
        .from('job_queue')
        .update({
          status: 'failed',
          attempts,
          error: error.message
        })
        .eq('id', job.id)
    } else {
      // Retry com backoff
      const delay = Math.pow(2, attempts) * 1000 // 2s, 4s, 8s...

      await supabase
        .from('job_queue')
        .update({
          status: 'pending',
          attempts,
          run_at: new Date(Date.now() + delay),
          error: error.message
        })
        .eq('id', job.id)
    }
  }
}
```

### 4. Monitoramento

```typescript
// Logs estruturados para observabilidade
interface JobLog {
  job_id: string
  job_type: string
  status: 'started' | 'completed' | 'failed'
  duration_ms?: number
  error?: string
  metadata?: Record<string, any>
}

async function logJob(log: JobLog) {
  await supabase.from('job_logs').insert({
    ...log,
    created_at: new Date().toISOString()
  })
}
```

---

## Alternativas Consideradas

### Alternativa 1: BullMQ + Redis
- **Prós:** Features avançadas, controle fino
- **Contras:** Serviço adicional, custo extra, complexidade
- **Veredito:** ⚠️ Postergada - reavaliar se volume exigir

### Alternativa 2: AWS Lambda + EventBridge
- **Prós:** Escala infinita, integração AWS
- **Contras:** Vendor lock-in, custo imprevisível
- **Veredito:** ❌ Rejeitada - Supabase já cobre

### Alternativa 3: Supabase Edge Functions + pg_cron (Decisão Atual)
- **Prós:** Sem serviço adicional, custo previsível, simples
- **Contras:** Menos features que BullMQ
- **Veredito:** ✅ Aceita - adequada para MVP

---

## Consequências

### Positivas
- ✅ **Custo baixo:** Paga só pelo tempo de execução
- ✅ **Simplicidade:** Tudo no Supabase
- ✅ **Auto-scaling:** Escala automaticamente
- ✅ **Global:** Edge Functions distribuídas

### Negativas
- ⚠️ **Timeout limits:** Max 150s para Edge Functions
- ⚠️ **Cold starts:** ~50-200ms para funções não usadas
- ⚠️ **Debugging:** Mais difícil que processo local

### Mitigações
- Jobs longos divididos em chunks
- Warm-up de funções críticas
- Logs estruturados para debugging

---

## Métricas

| Métrica | Target | Alert Threshold |
|---------|--------|------------------|
| Job Success Rate | > 99% | < 95% |
| Job Latency P95 | < 5s | > 10s |
| Queue Depth | < 100 | > 500 |
| Failed Jobs (DLQ) | 0 | > 10 |

---

## Referências

- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [pg_cron Extension](https://github.com/citusdata/pg_cron)
- [Background Jobs Best Practices](https://github.com/background-jobs/recommendations)

---

**Relacionado com:**
- Epic E-02: Gestão de Agendamentos (lembretes)
- Epic E-03: Follow-up e Retenção
- ADR-001: Event-Driven Architecture