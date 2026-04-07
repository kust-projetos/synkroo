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

No **Supabase Dashboard** ou **Vercel Dashboard**, adicione:

```bash
# Obrigatório para lembretes
CRON_SECRET=seu-secret-aleatorio-aqui
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID/messages
WHATSAPP_TOKEN=seu-token-do-whatsapp-business

# Opcional (já configurado)
MINIMAX_API_KEY=sua-chave-minimax
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
# Testar endpoint de lembretes
curl -X POST https://seu-dominio.vercel.app/api/cron/reminders \
  -H "Authorization: Bearer seu-secret-aleatorio-aqui" \
  -H "Content-Type: application/json"

# Testar endpoint de follow-ups
curl -X POST https://seu-dominio.vercel.app/api/cron/followups \
  -H "Authorization: Bearer seu-secret-aleatorio-aqui" \
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