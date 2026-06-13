# Goal Plan — migrate-supabase-cutover

## 1. Contexto
- Repo: `D:/projetos/synkroo`
- Stack: Next.js 15, React 19, TypeScript 5.6, Jest, Playwright, Supabase legado
- Estado atual: projeto ainda depende de `@supabase/ssr`, `@supabase/supabase-js`, scripts/envs/migrations Supabase e helpers `src/lib/supabase*`
- Comando teste: `npm test -- --runInBand`
- Comando build: `npm run build`
- Comando lint: `npm run lint`
- Plano base: `docs/superpowers/plans/2026-06-07-supabase-postgres-cutover.md`
- Spec base: `docs/superpowers/specs/2026-06-07-supabase-postgres-cutover-design.md`

## 2. Estado final mensurável
- `rg -n "@supabase|supabase\.from|\.rpc\(" src package.json .env.example scripts` retorna 0 matches relevantes de runtime
- `npm test -- --runInBand` exits 0
- `npm run build` exits 0
- `npm run lint` exits 0
- scripts locais de banco funcionam sem Supabase CLI

## 3. Prova surfaceável
- Comandos:
  - `rg -n "@supabase|supabase\.from|\.rpc\(" src package.json .env.example scripts`
  - `npm test -- --runInBand`
  - `npm run build`
  - `npm run lint`
- Output esperado no transcript:
  - grep sem matches de runtime
  - Jest com 0 failures
  - build com exit 0
  - lint com exit 0
- Frequência: ao fim de cada fase principal e na validação final
- Echo obrigatório: sim

## 4. Restrições
### Específicas do projeto
- NÃO mudar UX nem escopo funcional do produto
- NÃO iniciar migração de dados de produção do Supabase nesta execução
- NÃO manter auth Supabase em paralelo após início do cutover de auth
- NÃO introduzir novos imports `@supabase/*`
- Preservar temporariamente o contrato das rotas `/api/auth/login|logout|session|signup`

### Padrão
- NÃO usar `--no-verify`
- NÃO desabilitar lint nem inserir `// @ts-ignore`, `# type: ignore`, `eslint-disable` como atalho
- NÃO modificar lockfiles sem necessidade real da mudança de dependências
- NÃO commitar mensagens vagas
- NÃO commitar segredos
- NÃO force-push ou resetar branch

## 5. Bound
- 120 turns — migração multi-fase com infra, schema, auth, data access, testes e cleanup

## 6. Modo de execução recomendado
- Auto mode: ligado se disponível
- Execução prática nesta sessão: coordenação planner + worker1 + reviewer por fases

## 7. Condição final (cole no /goal)
```text
Substituir o Supabase do Synkroo por pgvector/pgvector + Drizzle + Auth.js Credentials seguindo `docs/superpowers/plans/2026-06-07-supabase-postgres-cutover.md` até que `rg -n "@supabase|supabase\.from|\.rpc\(" src package.json .env.example scripts` não mostre matches de runtime relevantes, `npm test -- --runInBand` exit 0, `npm run build` exit 0 e `npm run lint` exit 0, preservando temporariamente o contrato de `/api/auth/login|logout|session|signup`, sem mudar UX, sem iniciar migração de dados de produção, sem novos imports `@supabase/*`, sem usar --no-verify, sem desabilitar lint/type-ignore, sem modificar lockfiles sem necessidade real, or stop after 120 turns. Report turn count, fase atual, verificações da fase e remaining bound each turn. Claude must echo full output of each verification command.
```

## 8. Comando completo
```text
/goal Substituir o Supabase do Synkroo por pgvector/pgvector + Drizzle + Auth.js Credentials seguindo `docs/superpowers/plans/2026-06-07-supabase-postgres-cutover.md` até que `rg -n "@supabase|supabase\.from|\.rpc\(" src package.json .env.example scripts` não mostre matches de runtime relevantes, `npm test -- --runInBand` exit 0, `npm run build` exit 0 e `npm run lint` exit 0, preservando temporariamente o contrato de `/api/auth/login|logout|session|signup`, sem mudar UX, sem iniciar migração de dados de produção, sem novos imports `@supabase/*`, sem usar --no-verify, sem desabilitar lint/type-ignore, sem modificar lockfiles sem necessidade real, or stop after 120 turns. Report turn count, fase atual, verificações da fase e remaining bound each turn. Claude must echo full output of each verification command.
```

## 9. Checklist pré-entrega
- [x] ≤4000 chars
- [x] comando concreto presente
- [x] output literal/resultado verificável definido
- [x] restrições específicas + padrão
- [x] bound presente
- [x] echo obrigatório
- [x] arquivo salvo em docs/goals/
