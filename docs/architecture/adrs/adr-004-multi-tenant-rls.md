# ADR-004: Multi-Tenancy via Row-Level Security

**Status:** ✅ Accepted
**Data:** 2026-03-27
**Decisores:** Winston (Arquiteto), Walis (Product Owner)

---

## Contexto

O Synkroo é uma plataforma SaaS multi-tenant onde múltiplas clínicas compartilham a mesma infraestrutura. Requisitos críticos:

1. **Isolamento total de dados** - Uma clínica NUNCA pode ver dados de outra
2. **Compliance LGPD** - Dados de saúde requerem proteção máxima
3. **Performance** - Queries não podem ter overhead significativo
4. **Simplicidade** - Desenvolvedores não devem gerenciar isolamento manualmente

### Modelos de Multi-Tenancy Considerados

| Modelo | Isolamento | Custo | Complexidade |
|--------|------------|-------|--------------|
| Database per Tenant | ⭐⭐⭐ | $$$ | Alta |
| Schema per Tenant | ⭐⭐ | $$ | Média |
| Row-Level Security | ⭐⭐⭐ | $ | Baixa |

---

## Decisão

**Adotar Row-Level Security (RLS)** do PostgreSQL como mecanismo de isolamento:

### 1. Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED DATABASE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     clinics                              │   │
│  │  clinic_id │ name │ settings │ ...                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     users                                │   │
│  │  user_id │ clinic_id │ email │ role │ ...               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   patients                               │   │
│  │  patient_id │ clinic_id │ name │ phone │ ...            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  appointments                            │   │
│  │  appointment_id │ clinic_id │ patient_id │ ...          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ══════════════════════════════════════════════════════════   │
│  RLS POLICIES (aplicadas automaticamente em cada query)        │
│  ══════════════════════════════════════════════════════════   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Implementação

#### JWT com Claims de Tenant

```typescript
// JWT payload gerado pelo Supabase Auth
interface JWTClaims {
  sub: string;           // user_id
  email: string;
  clinic_id: string;     // ← Claim crítico para RLS
  role: 'owner' | 'admin' | 'dentist' | 'staff';
  iat: number;
  exp: number;
}
```

#### Políticas RLS por Tabela

```sql
-- Habilitar RLS em todas as tabelas
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Política para clinics
CREATE POLICY "Users can only see their own clinic"
ON clinics FOR SELECT
USING (clinic_id = auth.jwt() ->> 'clinic_id');

-- Política para patients
CREATE POLICY "Users can only see their clinic's patients"
ON patients FOR ALL
USING (clinic_id = auth.jwt() ->> 'clinic_id');

-- Política para appointments com verificação de role
CREATE POLICY "Staff can view appointments"
ON appointments FOR SELECT
USING (
  clinic_id = auth.jwt() ->> 'clinic_id'
);

CREATE POLICY "Dentists can manage own appointments"
ON appointments FOR ALL
USING (
  clinic_id = auth.jwt() ->> 'clinic_id'
  AND (
    auth.jwt() ->> 'role' IN ('owner', 'admin')
    OR dentist_id = auth.uid()
  )
);

-- Política para conversations (multi-tenant + paciente)
CREATE POLICY "Clinic can see own conversations"
ON conversations FOR ALL
USING (
  clinic_id = auth.jwt() ->> 'clinic_id'
);
```

#### Função de Verificação de Acesso

```sql
-- Helper function para verificar acesso
CREATE OR REPLACE FUNCTION auth.has_clinic_access(target_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.jwt() ->> 'clinic_id' = target_clinic_id::text
    AND auth.jwt() ->> 'role' IN ('owner', 'admin', 'dentist', 'staff')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3. Fluxo de Autenticação

```
1. Login (Email/Password)
   └── Supabase Auth valida credenciais
       └── Busca clinic_id do usuário
           └── Gera JWT com claims:
               {
                 "sub": "user-uuid",
                 "clinic_id": "clinic-uuid",  ← Usado pelo RLS
                 "role": "admin"
               }

2. Request Autenticado
   └── Header: Authorization: Bearer <jwt>
       └── Supabase valida JWT
           └── RLS usa clinic_id do JWT automaticamente
               └── Query: SELECT * FROM patients
                   └── PostgreSQL adiciona implicitamente:
                       WHERE clinic_id = '<jwt.clinic_id>'

3. Resultado
   └── Usuário só vê dados da própria clínica
       └── Impossível acessar dados de outra clínica
           └── Mesmo com SQL injection, RLS protege
```

### 4. Service Account para Background Jobs

```sql
-- Role de serviço para jobs em background
CREATE ROLE synkroo_service;

-- Concede acesso total (apenas para service account)
GRANT ALL ON ALL TABLES IN SCHEMA public TO synkroo_service;

-- Jobs usam connection string específica
-- DATABASE_URL=postgres://synkroo_service:password@...
```

---

## Alternativas Consideradas

### Alternativa 1: Database per Tenant
- **Prós:** Isolamento físico, backup por cliente, customização
- **Contras:** Custo muito alto, operacionalmente complexo, não escala para 1000+ clínicas
- **Veredito:** ❌ Rejeitada - over-engineering para MVP

### Alternativa 2: Schema per Tenant
- **Prós:** Isolamento lógico, backup por cliente
- **Contras:** Migrations em N schemas, complexidade de queries
- **Veredito:** ⚠️ Rejeitada - não justifica para nosso caso

### Alternativa 3: Row-Level Security (Decisão Atual)
- **Prós:** Simples, custo baixo, isolamento garantido pelo banco
- **Contras:** Isolamento lógico, não físico
- **Veredito:** ✅ Aceita - ideal para MVP e scale

---

## Consequências

### Positivas
- ✅ **Segurança por padrão:** Dados isolados automaticamente
- ✅ **Custo baixo:** Uma database serve todas as clínicas
- ✅ **Simplicidade:** Devs não precisam filtrar manualmente
- ✅ **Compliance LGPD:** Isolamento garantido a nível de banco

### Negativas
- ⚠️ **Isolamento lógico:** Não físico (backup é de todas clínicas)
- ⚠️ **Vendor lock-in:** Supabase/PostgreSQL específico
- ⚠️ **Performance:** RLS adiciona verificação em cada query

### Mitigações
- Backup granular com `pg_dump --table="*clinic_id=X*"`
- Testes de penetração para verificar RLS
- Monitoring de queries RLS para performance

---

## Testes de Segurança

```typescript
// Teste: Usuário não pode ver dados de outra clínica
describe('RLS Security', () => {
  it('should not allow cross-tenant access', async () => {
    // Login como clínica A
    const clientA = await supabase.auth.signInWithPassword({
      email: 'clinic-a@test.com',
      password: 'password'
    });

    // Tentar acessar paciente da clínica B
    const { data, error } = await clientA
      .from('patients')
      .select('*')
      .eq('id', 'patient-from-clinic-b');

    expect(data).toBeNull(); // RLS bloqueou
    expect(error).toBeNull(); // Não é erro, é vazio
  });
});
```

---

## Referências

- [PostgreSQL Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Multi-Tenant Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations)

---

**Relacionado com:**
- Epic E-04: CRM Inteligente
- Epic E-08: Dashboard e Gestão
- NFR-13: Data Isolation (Zero cross-tenant access)
- DR-07: Isolamento Multi-tenant