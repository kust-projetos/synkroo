# Guia de Configuração - Synkroo

## Status Atual

| Componente | Status | Observação |
|------------|--------|------------|
| RAG/pgvector | ✅ Aplicado | Migration aplicada no PostgreSQL |
| Knowledge Base | ✅ Aplicado | 15 entradas Q&A seedadas |
| Chat Widget | ✅ Completo | Componente + widget.js |
| Lembretes | ✅ Implementado | Configurar env vars |
| Analytics UI | ✅ Completo | Funcional |

---

## 1. Migrations Aplicadas

As seguintes migrations foram aplicadas no banco PostgreSQL via Drizzle:

- ✅ `add_pgvector` - Extensão pgvector, tabelas, índices HNSW, funções RPC
- ✅ `seed_knowledge_base` - 15 entradas Q&A para clínica demo

### Estrutura Criada

**Tabelas:**
- `conversation_memories` - Memória de longo prazo com embeddings
- Coluna `embedding` em `knowledge_base` e `messages`

**Funções RPC:**
- `search_knowledge_base()` - Busca semântica
- `search_conversation_memories()` - Busca em memórias
- `store_message_with_embedding()` - Armazena com embedding

---

## 2. Configurar Variáveis de Ambiente

No **Vercel Dashboard**, configure:

### Variáveis Obrigatórias

```bash
# PostgreSQL + Drizzle (required)
DATABASE_URL=postgresql://xxx...

# Auth (NextAuth)
AUTH_SECRET=seu-auth-secret
JWT_SECRET=seu-jwt-secret

# MiniMax LLM (para chat/classificação de intenção)
MINIMAX_API_KEY=sua-chave-minimax
MINIMAX_MODEL=MiniMax-M2.7

# Cron Jobs (gerar com: openssl rand -base64 32)
CRON_SECRET=seu-secret-aleatorio-aqui
```

### Variáveis para Lembretes WhatsApp

```bash
# WhatsApp Business API
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/SEU_PHONE_NUMBER_ID/messages
WHATSAPP_TOKEN=seu-token-permanente-do-meta-business
```

### Variáveis para RAG/Embeddings

> **Opções GRATUITAS disponíveis!**

**Option 1: Jina AI (RECOMENDADO - GRATUITO)**
```bash
# Free tier: 1M tokens/mês
# Obter chave: https://jina.ai/embeddings/
JINA_API_KEY=jina_xxx...
```

**Option 2: HuggingFace Inference (GRATUITO)**
```bash
# Free tier disponível
# Obter chave: https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=hf_xxx...
```

**Option 3: Ollama Local (GRATUITO - Offline)**
```bash
# Instalar: https://ollama.ai/
# Executar: ollama pull nomic-embed-text
OLLAMA_HOST=http://localhost:11434
```

**Option 4: OpenAI (Pago - melhor qualidade)**
```bash
OPENAI_API_KEY=sk-xxx...
EMBEDDING_MODEL=text-embedding-3-small
```

**Comparativo de Provedores:**

| Provedor | Custo | Dimensões | Qualidade |
|----------|-------|-----------|-----------|
| **Jina AI** | GRATUITO (1M/mês) | 768 | ⭐⭐⭐⭐ |
| HuggingFace | GRATUITO | 384-768 | ⭐⭐⭐ |
| Ollama | GRATUITO | 768 | ⭐⭐⭐ |
| OpenAI small | $0.02/1M | 1536 | ⭐⭐⭐⭐⭐ |
| OpenAI large | $0.13/1M | 3072 | ⭐⭐⭐⭐⭐ |

---

## 3. Obter Credenciais

### Jina AI (GRATUITO - Recomendado)

1. Acesse [Jina AI Embeddings](https://jina.ai/embeddings/)
2. Crie uma conta gratuita
3. Gere uma API key
4. Copie para `JINA_API_KEY=jina_xxx...`

**Free tier:** 1 milhão de tokens por mês!

### HuggingFace (GRATUITO)

1. Acesse [HuggingFace Tokens](https://huggingface.co/settings/tokens)
2. Crie um token com permissão "read"
3. Copie para `HUGGINGFACE_API_KEY=hf_xxx...`

### Ollama Local (GRATUITO - Offline)

```bash
# Instalar Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.ai/install.sh | sh
# Windows: https://ollama.ai/download

# Baixar modelo de embedding
ollama pull nomic-embed-text

# Ollama roda automaticamente em localhost:11434
```

### WhatsApp Business API

1. Acesse [Meta Business Suite](https://business.facebook.com/)
2. Vá em **Configurações > WhatsApp > Configurações da API**
3. Copie:
   - `Phone Number ID` → parte da URL
   - `Permanent Token` → WHATSAPP_TOKEN

### OpenAI (OPCIONAL - Pago)

Para melhor qualidade de embeddings (não necessário se usar Jina AI gratuito):

1. Acesse [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Crie uma nova chave
3. Copie para `OPENAI_API_KEY`

---

## 4. Deploy na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Fazer deploy
vercel --prod
```

Os cron jobs são automaticamente registrados via `vercel.json`.

---

## 5. Testar Endpoints

### Testar Lembretes

```bash
curl -X POST https://seu-dominio.vercel.app/api/cron/reminders \
  -H "Authorization: Bearer seu-cron-secret" \
  -H "Content-Type: application/json"
```

### Testar Follow-ups

```bash
curl -X POST https://seu-dominio.vercel.app/api/cron/followups \
  -H "Authorization: Bearer seu-cron-secret" \
  -H "Content-Type: application/json"
```

### Testar RAG

```bash
# Adicionar conhecimento
curl -X POST https://seu-dominio.vercel.app/api/knowledge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer seu-jwt" \
  -d '{
    "category": "procedimentos",
    "question": "Vocês fazem clareamento?",
    "answer": "Sim, oferecemos clareamento..."
  }'
```

---

## 6. Verificar Logs

Na Vercel Dashboard:
1. **Deployments** → Selecione o deploy
2. **Functions** → Veja logs das serverless functions

Endpoints para monitorar:
- `/api/cron/reminders`
- `/api/cron/followups`
- `/api/analytics/insights`

---

## Checklist Pós-Deploy

- [x] Migration pgvector aplicada
- [x] Knowledge base seed aplicado
- [ ] CRON_SECRET configurado
- [ ] WHATSAPP_TOKEN configurado
- [ ] EMBEDDING_API_KEY configurado (OpenAI ou compatível)
- [ ] Testado endpoint de lembretes
- [ ] Testado endpoint de follow-ups
- [ ] Analytics carregando no dashboard
- [ ] Chat Widget testado

---

## Troubleshooting

### Erro: "Function not found"

As migrations não foram aplicadas. Execute-as manualmente no SQL Editor.

### Embeddings retornando zeros

A `EMBEDDING_API_KEY` não está configurada. O sistema funciona com embeddings zero em dev.

### Cron jobs não executando

Verifique se:
1. `CRON_SECRET` está configurado
2. O projeto está em modo **Production** na Vercel
3. Os logs mostram chamadas aos endpoints

### WhatsApp não envia

Verifique:
1. Token não expirou (use permanent token)
2. Número está aprovado no Meta Business
3. Phone Number ID está correto na URL

---

**Última atualização:** 2026-03-28