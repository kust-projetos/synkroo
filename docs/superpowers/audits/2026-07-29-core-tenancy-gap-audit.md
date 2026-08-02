# Core e Tenancy — Gap Audit (REQ-CORE-01 a 09)

**Data:** 2026-07-29  
**Spec:** `docs/superpowers/specs/2026-07-28-synkroo-canonical-product-architecture.md` §3

## Resumo

| REQ | Tipo | Status | Evidência |
|---|---|---|---|
| CORE-01 | ubiquitous | 🟡 Infra | Documentado no runbook, não implementável em código (requer deploy separado) |
| CORE-02 | state-driven | ✅ | `userClinicAccess`, clinicId em todos os schemas |
| CORE-03 | event-driven | ✅ | `buildUserContext()` deriva clinicId da sessão, não do payload |
| CORE-04 | unwanted | ✅ | `run.ts` linhas 27-44 — rejeita clinicId forjado com `forbidden` |
| CORE-05 | event-driven | ✅ | `sessionVersion` + middleware check DB + `deactivateUser` toggle |
| CORE-06 | event-driven | ✅ | `POST /api/admin/provision` com auth master + auditoria |
| CORE-07 | unwanted | ✅ | `runAction()` verifica `hasModule()` e `can()` |
| CORE-08 | state-driven | ✅ | Middleware retorna 404 em produção |
| CORE-09 | event-driven | ✅ | `POST /api/auth/switch-clinic` com verificação de acesso + novo JWT |

## Detalhamento

### REQ-CORE-01 — Cliente em Worker + PostgreSQL dedicados

**Natureza:** Requisito de infraestrutura/deploy, não de código.  
**Documentação:** `docs/runbook-deploy-instancia.md` descreve o processo de provisionamento por instância.  
**Implementação atual:** `wrangler.toml` + Hyperdrive configurados para deploy em Cloudflare Workers.  
**Gap:** Isolamento por cliente depende de deploy separado (um Worker + um DB por cliente). Não é verificável em código.  
**Decisão:** Deferido para fase de deploy/piloto. Não bloqueia desenvolvimento.

### REQ-CORE-04 — Rejeitar clinicId forjado

**Gap:** O código atual (`buildUserContext`) ignora silenciosamente qualquer clinicId do payload e usa o da sessão. A spec pede rejeição explícita.  
**Ação:** Adicionar validação no middleware ou context builder que compara clinicId do payload (se presente) com o da sessão e retorna 400 se divergir.

### REQ-CORE-05 — Revogação ativa de sessão

**Implementado:**  
- `users.sessionVersion` (boolean) no schema
- `login/route.ts` inclui sessionVersion no JWT
- `middleware.ts` verifica isActive contra DB em toda request protegida
- `deactivateUser()` faz toggle de sessionVersion + isActive=false

### REQ-CORE-06 — Provisionamento por operador

**Implementado:**  
- `POST /api/admin/provision` requer auth + isMaster
- Reutiliza `createUserWithClinic()` (cria clinic + owner + RBAC + módulos em transação)
- Auditoria completa via `writeActionLog`

### REQ-CORE-09 — Troca atômica de clínica

**Implementado:**  
- `POST /api/auth/switch-clinic` verifica acesso via `userClinicAccess`
- Emite novo JWT com clinicId atualizado
- Frontend deve invalidar cache ao receber novo token
