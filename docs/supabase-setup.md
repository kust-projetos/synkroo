# Supabase Setup Guide - Synkroo

## 📋 Pré-requisitos

- Conta no [Supabase](https://supabase.com) (gratuita)
- Node.js 18+
- CLI do Supabase (opcional, mas recomendado)

## 🚀 Passo 1: Criar Projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e faça login
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `synkroo`
   - **Database Password**: Guarde bem esta senha!
   - **Region**: `São Paulo (sa-east-1)` - para menor latência no Brasil
4. Aguarde ~2 minutos para o projeto ser criado

## 🔑 Passo 2: Obter Credenciais

No dashboard do Supabase:

1. Vá em **Settings** → **API**
2. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ Mantenha secreto!)

## 📁 Passo 3: Configurar Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```bash
cp .env.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MiniMax (obter em minimax.chat)
MINIMAX_API_KEY=sua-api-key

# WhatsApp (configurar depois)
WHATSAPP_VERIFY_TOKEN=seu-token-aleatorio
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
```

## 🗄️ Passo 4: Aplicar Migrations

### Opção A: Via Supabase Dashboard (Mais Fácil)

1. No dashboard, vá em **SQL Editor**
2. Clique em **"New query"**
3. Cole o conteúdo de cada arquivo na ordem:

```
supabase/migrations/20260327000000_initial_schema.sql
supabase/migrations/20260327000001_seed_data.sql
supabase/migrations/20260327000002_functions.sql
```

4. Clique em **"Run"** para executar cada um

### Opção B: Via Supabase CLI

```bash
# Instalar CLI
npm install -g supabase

# Login
supabase login

# Link ao projeto (pegue o ref na URL: app.supabase.com/project/REF)
supabase link --project-ref seu-project-ref

# Aplicar migrations
supabase db push
```

## ✅ Passo 5: Testar Conexão

```bash
# Instalar dependência para o script de teste
npm install dotenv

# Executar teste
npx ts-node scripts/test-supabase.ts
```

Saída esperada:

```
🔍 Testing Supabase connection...

📋 Checking environment variables:
   NEXT_PUBLIC_SUPABASE_URL: ✅ Set
   NEXT_PUBLIC_SUPABASE_ANON_KEY: ✅ Set
   SUPABASE_SERVICE_ROLE_KEY: ✅ Set

🔐 Testing anon client (RLS protected)...
   ✅ RLS working correctly - anon cannot read without auth

🔑 Testing service role client (bypasses RLS)...
   ✅ Found 1 clinics:
      - Clínica Sorriso Branco (sorriso-branco)
   ✅ Found 3 patients
   ✅ get_patient_insights function working

✨ Connection test complete!
```

## 🔒 Passo 6: Verificar RLS (Row Level Security)

No SQL Editor, execute:

```sql
-- Verificar se RLS está habilitado
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Verificar políticas
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public';
```

Todas as tabelas devem ter `rowsecurity = true`.

## 📊 Estrutura do Banco

### Tabelas Principais

| Tabela | Propósito |
|--------|-----------|
| `clinics` | Clínicas cadastradas |
| `users` | Usuários (dentistas, admin, etc) |
| `patients` | Pacientes das clínicas |
| `dentists` | Dentistas com horários |
| `procedures` | Procedimentos oferecidos |
| `appointments` | Agendamentos |
| `conversations` | Conversas multicanal |
| `messages` | Mensagens das conversas |
| `knowledge_base` | Base de conhecimento para IA |

### Dados Demo

Após aplicar a seed, você terá:

- **1 clínica**: Clínica Sorriso Branco
- **3 usuários**: owner, admin, dentist
- **2 dentistas**: Dra. Ana Costa, Dr. Pedro Oliveira
- **3 pacientes**: Carlos, Fernanda, Roberto
- **5 procedimentos**: Clareamento, Limpeza, Extração, Canal, Implante
- **4 entradas na base de conhecimento**

## 🧪 Testando os Dados Demo

### Via Dashboard (Table Editor)

1. Vá em **Table Editor**
2. Selecione uma tabela (ex: `clinics`)
3. Veja os dados inseridos

### Via SQL

```sql
-- Ver clínica demo
SELECT * FROM clinics;

-- Ver procedimentos
SELECT name, price, duration_minutes FROM procedures;

-- Testar função de disponibilidade
SELECT * FROM get_availability(
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid,
  CURRENT_DATE + 1,
  30
);

-- Testar insights do paciente
SELECT * FROM get_patient_insights('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::uuid);
```

## 🔧 Próximos Passos

Após configurar o Supabase:

1. **Configurar WhatsApp Business API** (ver `docs/whatsapp-setup.md`)
2. **Configurar MiniMax API** (obter chave em minimax.chat)
3. **Executar o app**: `npm run dev`
4. **Testar webhook**: usar ngrok para expor localmente

## 🐛 Troubleshooting

### Erro: "Missing environment variables"

- Verifique se `.env.local` existe e tem todas as variáveis
- Reinicie o servidor dev após criar o arquivo

### Erro: "relation does not exist"

- As migrations não foram aplicadas
- Execute-as novamente via SQL Editor ou CLI

### Erro: "permission denied for table"

- RLS está bloqueando o acesso
- Use a service role key para operações admin
- Para operações do cliente, certifique-se de estar autenticado

### Erro: "function does not exist"

- A migration de functions não foi aplicada
- Execute `20260327000002_functions.sql`

## 📚 Recursos

- [Supabase Docs](https://supabase.com/docs)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Functions](https://supabase.com/docs/guides/database/functions)