# Setup do Banco de Dados - Synkroo

## Pré-requisitos

- [ ] Node.js 20+
- [ ] Conta no Supabase (https://supabase.com)
- [ ] Supabase CLI (opcional): `npm install -g supabase`

## Passos

### 1. Criar Projeto no Supabase

1. Acesse https://supabase.com/dashboard
2. Clique em "New Project"
3. Preencha:
   - **Nome**: synkroo
   - **Senha do banco**: (anote bem!)
   - **Região**: mais próxima do Brasil (Southeast Asia ou US East)
4. Aguarde ~2 minutos para o projeto ficar pronto

### 2. Obter Credenciais

No dashboard do Supabase:
1. Vá em **Settings** → **API**
2. Copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ mantenha secreto!)

### 3. Configurar .env.local

Crie o arquivo `.env.local` na raiz do projeto:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# MiniMax API
MINIMAX_API_KEY=sua-api-key
MINIMAX_API_URL=https://api.minimax.io/v1/text/chatcompletion_v2
MINIMAX_MODEL=MiniMax-M2.7

# WhatsApp
WHATSAPP_HEADLESS=false
WHATSAPP_SESSION_PATH=./.whatsapp-session
```

### 4. Aplicar Migrations

#### Opção A: Via Supabase CLI (Recomendado)

```bash
# Login no Supabase
npx supabase login

# Link ao projeto
npx supabase link --project-ref seu-projeto

# Aplicar migrations
npx supabase db push
```

#### Opção B: Via Dashboard (SQL Editor)

1. Acesse **SQL Editor** no dashboard
2. Cole o conteúdo de cada migration em ordem:
   - `20260327000000_initial_schema.sql`
   - `20260327000001_seed_data.sql`
   - `20260327000002_functions.sql`
   - `20260327000005_fix_all_rls.sql`
3. Execute cada uma

### 5. Verificar Setup

```bash
# Executar script de verificação
node scripts/setup-db.js

# Ou testar a API de health check
curl http://localhost:3000/api/health
```

### 6. Seed Data (Opcional)

Para dados de teste:

```bash
npx supabase db seed
```

## Estrutura do Banco

### Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `clinics` | Clínicas (multi-tenant root) |
| `users` | Funcionários |
| `patients` | Pacientes |
| `dentists` | Dentistas |
| `procedures` | Procedimentos |
| `conversations` | Conversas multicanal |
| `messages` | Mensagens |
| `appointments` | Agendamentos |
| `follow_ups` | Follow-ups |
| `knowledge_base` | Base de conhecimento |

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado com isolamento por `clinic_id`.

## Troubleshooting

### Erro: "relation does not exist"

Migrations não foram aplicadas. Execute:
```bash
npx supabase db push
```

### Erro: "permission denied for table"

Verifique se RLS está configurado corretamente:
```sql
SELECT * FROM pg_policies WHERE tablename = 'users';
```

### Erro: "JWT expired"

Renove as chaves no dashboard do Supabase.

## Próximos Passos

Após o setup do banco:

1. ✅ Testar API: `GET /api/health`
2. ✅ Criar primeira clínica via seed
3. ✅ Implementar autenticação
4. ✅ Conectar WhatsApp → Agente → Database