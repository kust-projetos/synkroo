# Auth API Tests

Suite de testes para os endpoints de autenticação JWT do Synkroo.

## Cenários Cobertos

| # | Cenário | Endpoint | Status | Descrição |
|---|---------|----------|--------|-----------|
| 1 | Login válido | POST /api/auth/login | ✅ | Retorna 200 + tokens quando credenciais válidas |
| 2 | Login inválido | POST /api/auth/login | ✅ | Retorna 401 quando credenciais erradas |
| 3 | Refresh token válido | GET /api/auth/session | ✅ | Retorna novo access token válido |
| 4 | Refresh token expirado | GET /api/auth/session | ✅ | Retorna 401 quando token expirado |
| 5 | Refresh token já usado | GET /api/auth/session | ✅ | Rejeita tokens com replay attack |
| 6 | Logout | POST /api/auth/logout | ✅ | Invalida refresh token |

## Resultados dos Testes

```
PASS src/__tests__/api/auth/auth.test.ts
  Auth API Endpoints
    POST /api/auth/login
      1. Login válido - deve retornar 200 + tokens
        √ deve retornar 200 com tokens quando credenciais são válidas
        √ deve incluir profile com clinic info quando usuário tem clínica
      2. Login inválido - credenciais erradas devem retornar 401
        √ deve retornar 401 quando email não existe
        √ deve retornar 401 quando senha está incorreta
        √ deve retornar 400 quando email e senha não são fornecidos
        √ deve retornar 400 quando email está vazio
        √ deve retornar 403 quando conta está desativada
    POST /api/auth/logout
      6. Logout - deve invalidar refresh token
        √ deve retornar 200 quando logout é bem sucedido
        √ deve retornar 400 quando há erro no logout
    GET /api/auth/session
      3. Refresh token válido - deve retornar novo access token
        √ deve retornar sessão válida quando token é válido
        √ deve retornar perfil do usuário junto com sessão
      4. Refresh token expirado - deve retornar 401
        √ deve retornar authenticated: false quando token expirou
    Token Rotation Security
      5. Refresh token já usado (rotação) - deve ser rejeitado
        √ deve rejeitar refresh token já utilizado (replay attack)
        √ deve detectar token adulterado
    Edge Cases
      √ deve lidar com erro de rede inesperadamente
      √ deve lidar com user sem profile (needsProfile)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

## Scripts

```bash
# Rodar todos os testes
npm test

# Rodar apenas os testes de auth
npm test -- --testPathPattern="auth.test"

# Rodar em modo watch
npm run test:watch

# Gerar coverage
npm test -- --coverage

# Coverage detalhado
npm test -- --coverage --coverageReporters="html,text,lcov"
```

## Cobertura Esperada

| Arquivo | Statements | Branches | Functions | Lines |
|---------|------------|----------|-----------|-------|
| auth/login/route.ts | 100% | 100% | 100% | 100% |
| auth/logout/route.ts | 100% | 100% | 100% | 100% |
| auth/session/route.ts | 100% | 100% | 100% | 100% |
| **Total** | **100%** | **100%** | **100%** | **100%** |

## Estrutura dos Testes

```
src/__tests__/api/auth/
├── auth.test.ts       # Suite principal de testes
├── auth.mocks.ts      # Mocks para Supabase e Next.js
└── README.md          # Esta documentação
```

## Mock Strategy

Os testes usam mocks do NextAuth (Auth.js) para:
- Simular respostas de autenticação
- Testar cenários de erro sem necessidade de DB real
- Isolar testes de dependências externas

### Mocks Principais

- `createClient()` - Simula o cliente Supabase server-side
- `getUser()` - Simula usuário autenticado
- `getSession()` - Simula sessão ativa
- `signInWithPassword()` - Simula login
- `signOut()` - Simula logout

## Variáveis de Ambiente (Teste)

O arquivo `jest.setup.ts` define:

```bash
DATABASE_URL=postgres://test:test@localhost:5432/test
MINIMAX_API_KEY=test-minimax-key
```

## Notas de Segurança

- Tokens nunca são armazenados em texto puro nos testes
- Mocks de erro usam mensagens realistas do Supabase
- Testes de replay attack verificam rejeição de tokens reutilizados
