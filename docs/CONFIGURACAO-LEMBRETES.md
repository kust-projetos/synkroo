# Configuração de Lembretes Automáticos

## Status Atual

O sistema de lembretes automáticos está **95% implementado**:

| Componente | Status |
|------------|--------|
| Serviço de lembretes | ✅ Implementado |
| Endpoint de cron | ✅ Implementado |
| Tabela no banco | ✅ Criada |
| Vercel Cron | ✅ Configurado |
| Variáveis de ambiente | ❌ **Pendente** |

---

## Passos para Completar

### 1. Configurar Variáveis de Ambiente

No ambiente de deploy atual — secrets do Cloudflare Workers (`npx wrangler secret put <NOME>`) ou `.dev.vars` local (o banco é PostgreSQL via Drizzle ORM/Hyperdrive, não há dashboard de banco) — adicione:

> **Nota 2026-10-05 (P0 vNext):** este guia é **histórico** e estava desatualizado. Supabase foi removido; `WHATSAPP_API_URL`/`WHATSAPP_TOKEN` **não existem** no schema de env (`src/lib/env.ts`) — a integração atual usa `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` (com migração vNext planejada para WAHA, ver `docs/adr/ADR-BASE-08-evolution-provider.md`). Configure secrets no painel Cloudflare/`wrangler`, não em dashboard de BaaS.

> **Nota (2026-10-05):** as seções abaixo que referenciam **Vercel Cron / `vercel --prod`** são históricas da v1. O deploy atual é Cloudflare Workers (OpenNext) e os crons rodam no scheduler da Cloudflare, gated por `CRON_JOBS_ENABLED` — ver `docs/ops/` e `src/app/api/cron/*`. Não siga os passos Vercel como procedimento vigente.

```bash
# Obrigatório para lembretes
CRON_SECRET=seu-secret-aleatorio-aqui

# WhatsApp (provider atual)
EVOLUTION_API_URL=...
EVOLUTION_API_KEY=...
```

### 2. Gerar CRON_SECRET

```bash
# Gerar secret aleatório
openssl rand -base64 32
```

### 3. Obter Credenciais WhatsApp Business API

1. Acesse [Meta Business Suite](https://business.facebook.com/)
2. Vá em **Configurações > WhatsApp > Configurações da API**
3. Copie:
   - `Phone Number ID` → parte da URL
   - `Permanent Token` → WHATSAPP_TOKEN

### 4. Deploy com Cron Jobs

O arquivo `vercel.json` já está configurado. Ao fazer deploy na Vercel:

```bash
vercel --prod
```

Os cron jobs serão registrados automaticamente.

### 5. Testar Manualmente

```bash
# Testar endpoint de lembretes (CRON_SECRET vem do ambiente; nunca colar o valor literal)
curl -X POST "https://seu-dominio.exemplo/api/cron/reminders" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"

# Testar endpoint de follow-ups
curl -X POST "https://seu-dominio.exemplo/api/cron/followups" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

### 6. Verificar Logs

Na Vercel Dashboard, verifique os logs dos cron jobs em:
- **Deployments > Functions > /api/cron/reminders**

---

## Fluxo de Lembretes

```
Cron Job (a cada 5 min)
    ↓
/api/cron/reminders
    ↓
reminder.service.ts
    ↓
Busca agendamentos nas próximas 24h ou 2h
    ↓
Verifica se já enviou lembrete (tabela appointment_reminders)
    ↓
Formata mensagem
    ↓
Envia via WhatsApp Business API
    ↓
Registra envio na tabela
```

---

## Mensagens Enviadas

### Lembrete 24h

```
🏥 *Lembrete de Consulta - [Clínica]*

Olá, [Paciente]! 👋

Você tem uma consulta agendada para *amanhã*:

📅 *Data:* quinta-feira, 28 de março
⏰ *Horário:* 14:00
👨‍⚕️ *Profissional:* Dr(a). Maria
🦷 *Procedimento:* Limpeza

Por favor, confirme sua presença respondendo esta mensagem.
```

### Lembrete 2h

```
🏥 *Sua consulta é em 2 horas!*

[Paciente], não se esqueça:

📅 *Hoje* às *14:00*
👨‍⚕️ Dr(a). Maria

📍 [Clínica]

Estamos te esperando!
```

---

## Troubleshooting

### Lembretes não estão sendo enviados

1. **Verifique as variáveis de ambiente**
   ```bash
   vercel env ls
   ```

2. **Verifique se o cron job está ativo**
   ```bash
   vercel cron ls
   ```

3. **Verifique os logs do cron job**
   - Vercel Dashboard > Functions > /api/cron/reminders

### Erro de autenticação do WhatsApp

1. Verifique se o token não expirou
2. Gere um novo token permanente em Meta Business Suite
3. Verifique se o número está aprovado

### Nenhum agendamento encontrado

1. Verifique se há agendamentos com status `confirmed`
2. Verifique se os agendamentos estão nas próximas 24h ou 2h
3. Verifique se os pacientes têm telefone cadastrado

---

## Próximos Passos Após Configuração

1. ✅ Lembretes automáticos funcionando
2. Implementar **RAG/pgvector** para memória do agente
3. Completar **UI de Analytics** no dashboard
4. Implementar **Chat Widget** para site