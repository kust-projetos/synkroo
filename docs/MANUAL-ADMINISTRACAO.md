# Synkroo - Manual de Administração

## Visão Geral

Este manual é destinado a administradores da clínica e cobre funcionalidades avançadas de gestão.

---

## 1. Gerenciamento de Usuários

### 1.1 Níveis de Acesso

| Role | Permissões |
|------|------------|
| **Admin** | Acesso total, pode gerenciar usuários e configurações |
| **Recepcionista** | Pode gerenciar agendamentos, pacientes e conversas |
| **Dentista** | Pode ver seus agendamentos e pacientes |
| **Financeiro** | Acesso a relatórios financeiros (futuro) |

### 1.2 Adicionar Usuários

1. Acesse **Configurações** > **Usuários**
2. Clique em **+ Novo Usuário**
3. Preencha:
   - Nome completo
   - E-mail
   - Role (função)
   - Senha temporária
4. O usuário receberá um e-mail com instruções

---

## 2. Configurações da Clínica

### 2.1 Horários de Funcionamento

Configure os horários padrão para verificação de disponibilidade:

```json
{
  "operating_hours": {
    "start": "08:00",
    "end": "18:00",
    "lunchStart": "12:00",
    "lunchEnd": "13:00",
    "workDays": [1, 2, 3, 4, 5]
  }
}
```

**Nota:** 0 = Domingo, 1 = Segunda, ..., 6 = Sábado

### 2.2 Lembretes Automáticos

| Lembrete | Quando | Configuração |
|----------|--------|--------------|
| 24h antes | Um dia antes da consulta | Automático via cron |
| 2h antes | Duas horas antes | Automático via cron |
| Pós-consulta | 7 dias após (follow-up) | Configurável |

### 2.3 Mensagens Personalizadas

Em **Configurações** > **Mensagens**, você pode personalizar:

- Saudação inicial
- Mensagem de lembrete
- Confirmação de agendamento
- Mensagem de cancelamento

---

## 3. Gestão de Leads

### 3.1 Pipeline de Leads

| Status | Descrição | Ação |
|--------|-----------|------|
| Novo | Lead recém-chegado | Contato inicial |
| Contatado | Primeiro contato feito | Qualificar |
| Qualificado | Interesse confirmado | Proposta |
| Proposta | Proposta enviada | Negociar |
| Negociação | Em negociação | Fechar |
| Convertido | Virou paciente | Agendar |
| Perdido | Não converteu | Arquivar |

### 3.2 Temperatura do Lead

| Temperatura | Critério | Prioridade |
|-------------|----------|------------|
| 🔥 Quente | Respondeu em <24h, pediu valor | Alta |
| 🌡️ Morno | Respondeu em 2-3 dias | Média |
| ❄️ Frio | Não respondeu ou demorou | Baixa |

### 3.3 Score Automático

O sistema calcula automaticamente um score baseado em:
- Frequência de interação
- Velocidade de resposta
- Tipos de perguntas
- Interesse demonstrado

---

## 4. Relatórios

### 4.1 Disponíveis

| Relatório | Período | Métricas |
|-----------|---------|----------|
| Agendamentos | Diário/Semanal/Mensal | Total, confirmados, cancelados |
| No-show | Mensal | Taxa, pacientes recorrentes |
| Pacientes | Mensal | Novos, ativos, inativos |
| Leads | Mensal | Novos, conversão, tempo médio |
| Faturamento | Mensal | Procedimentos realizados |

### 4.2 Exportação

Todos os relatórios podem ser exportados em:
- CSV (para Excel)
- PDF (para impressão)

---

## 5. Integrações

### 5.1 WhatsApp Business API

Para usar a API oficial do WhatsApp (recomendado para volume alto):

1. Crie uma conta em [business.facebook.com](https://business.facebook.com)
2. Configure o WhatsApp Business
3. Obtenha:
   - Phone Number ID
   - Permanent Token
4. Adicione ao `.env`:
   ```
   WHATSAPP_API_URL=https://graph.facebook.com/v18.0/{PHONE_ID}/messages
   WHATSAPP_TOKEN=seu-token
   ```

### 5.2 Webhooks

Configure webhooks para:
- Novos agendamentos
- Cancelamentos
- Novos leads
- Emergências

---

## 6. Backup e Segurança

### 6.1 Backup Automático

O Supabase realiza backup automático diário. Para backup adicional:

1. Exporte dados via Dashboard
2. Salve localmente ou em nuvem

### 6.2 Logs de Auditoria

Todas as ações são registradas em **Audit Logs**:
- Quem fez
- O que fez
- Quando fez
- De onde fez

---

## 7. Solução de Problemas

### 7.1 Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| WhatsApp desconecta | Sessão expirada | Reconectar via QR Code |
| Agendamentos não aparecem | Filtro ativo | Limpar filtros |
| IA não responde | API key inválida | Verificar configuração |
| Lembretes não saem | Cron não configurado | Verificar CRON_SECRET |

### 7.2 Logs do Sistema

Acesse logs em:
- **Configurações** > **Sistema** > **Logs**

---

## 8. API e Integrações

### 8.1 Endpoints Principais

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/appointments` | GET/POST | Agendamentos |
| `/api/patients` | GET/POST | Pacientes |
| `/api/agent/classify` | POST | Classificar mensagem |
| `/api/agent/schedule-flow` | POST | Fluxo de agendamento |
| `/api/cron/reminders` | POST | Lembretes (requer CRON_SECRET) |
| `/api/cron/followups` | POST | Follow-ups (requer CRON_SECRET) |

### 8.2 Autenticação

- **Usuários**: JWT via NextAuth/Auth.js
- **Cron**: Header `Authorization: Bearer {CRON_SECRET}`

---

## 9. Manutenção

### 9.1 Tarefas Recomendadas

| Frequência | Tarefa |
|------------|--------|
| Diário | Verificar conversas não respondidas |
| Semanal | Revisar lista de espera |
| Mensal | Limpar dados antigos |
| Trimestral | Revisar permissões de usuários |

### 9.2 Limpeza de Dados

O sistema possui limpeza automática:
- Logs antigos (>90 dias)
- Sessões expiradas
- Dados temporários

---

## 10. Contato Técnico

Para problemas técnicos:

- **E-mail**: tech@synkroo.com.br
- **Documentação API**: /docs/api
- **Status**: status.synkroo.com.br

---

*Versão: 1.0 - Março 2026*