# Synkroo - Variáveis de Ambiente para Piloto

## Status das Variáveis (2026-03-28)

| Variável | Status | Descrição |
|----------|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Configurada | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Configurada | Chave pública do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Configurada | Chave de serviço (admin) |
| `MINIMAX_API_KEY` | ✅ Configurada | API key para LLM |
| `MINIMAX_MODEL` | ✅ Configurada | Modelo MiniMax (M2.7) |
| `JINA_API_KEY` | ✅ Configurada | Embeddings para RAG |
| `CRON_SECRET` | ✅ Configurada | Autenticação para cron jobs |
| `NODE_ENV` | ✅ Configurada | Ambiente (development) |

## Opcionais (não configuradas)

| Variável | Status | Necessária para |
|----------|--------|-----------------|
| `WHATSAPP_API_URL` | ⚠️ Não configurada | WhatsApp Business API |
| `WHATSAPP_TOKEN` | ⚠️ Não configurada | WhatsApp Business API |

## Como Configurar WhatsApp Business API (Opcional)

### 1. Criar conta Meta Business
1. Acesse: https://business.facebook.com
2. Crie uma conta comercial

### 2. Configurar WhatsApp Business
1. Vá para WhatsApp > Phone Numbers
2. Adicione um número de telefone
3. Copie o **Phone Number ID**

### 3. Criar Token de Acesso
1. Vá para System Users
2. Adicione um usuário do sistema
3. Gere um token permanente com permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`

### 4. Adicionar ao .env.local
```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
WHATSAPP_TOKEN={SEU_TOKEN}
```

## Sem WhatsApp Business API

O sistema funciona sem WhatsApp Business API:
- ✅ Chat Widget para site
- ✅ Dashboard de agendamentos
- ✅ Gestão de pacientes
- ✅ Lista de espera
- ✅ Analytics e relatórios
- ⚠️ Lembretes automáticos (requer WhatsApp API)

---

## Verificação Rápida

```bash
# Verificar se todas as variáveis estão configuradas
node -e "
require('dotenv').config({ path: '.env.local' });
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MINIMAX_API_KEY',
  'JINA_API_KEY',
  'CRON_SECRET'
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log('❌ Faltando:', missing.join(', '));
  process.exit(1);
}
console.log('✅ Todas as variáveis configuradas!');
"
```

---

**Última verificação:** 2026-03-28