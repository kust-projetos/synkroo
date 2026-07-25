#!/bin/bash

# Script de Configuração - Synkroo
# Executar na raiz do projeto synkroo

echo "🔧 Configurando variáveis de ambiente do Synkroo..."
echo ""

# Verificar se .env.local existe
if [ ! -f ".env.local" ]; then
    echo "❌ Arquivo .env.local não encontrado!"
    echo "   Crie o arquivo primeiro com suas credenciais do PostgreSQL."
    exit 1
fi

# CRON_SECRET (gerado apenas quando ausente)
CRON_SECRET="$(
  node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"
)"

# Verificar se CRON_SECRET já existe
if grep -q "^CRON_SECRET=" .env.local; then
    echo "⚠️  CRON_SECRET já existe no arquivo."
else
    echo "" >> .env.local
    echo "# Cron Jobs Secret (gerado automaticamente)" >> .env.local
    echo "CRON_SECRET=$CRON_SECRET" >> .env.local
    echo "✅ CRON_SECRET configurado!"
fi

echo ""
echo "📋 Próximos passos - Configurar manualmente:"
echo ""
echo "1. MINIMAX_API_KEY"
echo "   - Acesse: https://www.minimaxi.com/"
echo "   - Crie uma conta e obtenha sua API key"
echo "   - Adicione ao .env.local: MINIMAX_API_KEY=sua-chave"
echo ""
echo "2. EMBEDDING_API_KEY (Jina AI - GRATUITO)"
echo "   - Acesse: https://jina.ai/embeddings/"
echo "   - Crie uma conta gratuita (1M tokens/mês)"
echo "   - Adicione ao .env.local: JINA_API_KEY=jina_xxx..."
echo "   - Adicione também: EMBEDDING_PROVIDER=jina"
echo ""
echo "3. WHATSAPP_TOKEN (OPCIONAL - Para lembretes via WhatsApp)"
echo "   - Acesse: https://business.facebook.com/"
echo "   - Configurações > WhatsApp > API"
echo "   - Adicione ao .env.local:"
echo "     WHATSAPP_API_URL=https://graph.facebook.com/v18.0/PHONE_ID/messages"
echo "     WHATSAPP_TOKEN=seu-token"
echo ""
echo "📝 Exemplo de .env.local completo:"
echo ""
cat << 'EOF'
# PostgreSQL (required)
DATABASE_URL=postgresql://synkroo:password@127.0.0.1:55432/synkroo

# Auth (NextAuth)
AUTH_SECRET=seu-auth-secret-com-32-chars
JWT_SECRET=seu-jwt-secret

# Cron Jobs
CRON_SECRET=<gerado-pelo-script>

# MiniMax LLM
MINIMAX_API_KEY=sua-chave-minimax

# Embeddings (Jina AI - GRATUITO)
JINA_API_KEY=jina_xxx...
EMBEDDING_PROVIDER=jina

# WhatsApp (OPCIONAL)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/PHONE_ID/messages
WHATSAPP_TOKEN=seu-token-whatsapp
EOF

echo ""
echo "✨ Após configurar, execute: npm run dev"
