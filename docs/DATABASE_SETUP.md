# Setup do Banco de Dados - Synkroo

## Pré-requisitos

- [ ] Node.js 20+
- [ ] PostgreSQL 15+ (local ou cloud)
- [ ] Drizzle ORM (já incluso no projeto)

## Passos

### 1. Criar banco PostgreSQL

```bash
# Local (Docker)
docker run -d --name synkroo-db \
  -e POSTGRES_USER=synkroo \
  -e POSTGRES_PASSWORD=change-me-local-dev-password \
  -e POSTGRES_DB=synkroo \
  -p 55432:5432 \
  postgres:15-alpine
```

### 2. Configurar .env.local

```env
DATABASE_URL=postgresql://synkroo:change-me-local-dev-password@127.0.0.1:55432/synkroo

# Auth (NextAuth)
AUTH_SECRET=seu-secret-com-32-chars-no-minimo
AUTH_URL=http://localhost:3000
JWT_SECRET=seu-secret-com-16-chars-no-minimo
```

### 3. Aplicar migrations Drizzle

```bash
# Push schema para o banco
npm run db:push

# Verificar health
npm run db:health
```

### 4. Seed data (opcional)

```bash
npm run db:seed
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

### Schemas Drizzle

Definições em `src/lib/db/schema/` — portadas das migrations SQL legadas do Supabase.

## Troubleshooting

### Erro: "relation does not exist"

Migrations não foram aplicadas. Execute:
```bash
npm run db:push
```

### Erro: "connection refused"

Verifique se o PostgreSQL está rodando:
```bash
docker ps | grep synkroo-db
```

### Erro: "password authentication failed"

Verifique `DATABASE_URL` em `.env.local`.

## Próximos Passos

Após o setup do banco:

1. ✅ Testar health: `GET /api/health`
2. ✅ Criar primeira clínica via seed
3. ✅ Conectar WhatsApp → Agente → Database
