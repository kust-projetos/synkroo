# F6.14 — Sidecar Mutual Authentication (mTLS), HMAC Signature with Nonce, Timeout & Egress Allowlist

**Data:** 2026-08-23  
**Branch:** main  
**Status:** PARTIAL — Autenticação mTLS + HMAC com nonce, proteção anti-replay, timeout budget, idempotência e allowlist de egress implementados e validados via testes de contrato; live sidecar deploy permanece para Gate O3-X03  
**Wave:** W6 (O3-G08) — Sidecar Isolation & Security

---

## Resumo

- **Requisito F6.14:** Autenticar sidecar por mTLS + HMAC com nonce; definir timeout, idempotência e egress allowlist.
- **Implementações:**
  1. **Autenticação Criptográfica HMAC com Nonce (`src/lib/sidecar/crypto.ts`):**
     - Assinatura HMAC-SHA256 computada sobre a string canônica `${timestamp}.${nonce}.${idempotencyKey}.${sha256(body)}`.
     - Proteção contra replay attacks: nonces são verificados em `NonceSeenStore` e rejeitados se reutilizados.
     - Validação de janela de tempo / clock skew (máximo 300s).
  2. **Validação de Identidade mTLS (`src/lib/sidecar/mtls.ts`):**
     - Suporte a verificação de certificados mútuos (mTLS) via headers confiáveis de terminação TLS (`cf-client-cert-presented`, `cf-client-cert-san-dns`, `x-client-cert-sha256`).
     - Validação contra lista de SAN DNS (`allowedSanDns`) e impressões digitais de certificados permitidos (`allowedThumbprints`).
  3. **Egress Allowlist (`src/lib/sidecar/egress.ts`):**
     - Validação rigorosa de URLs de saída (`validateEgressUrl`), permitindo apenas domínios autorizados (ex.: `web.whatsapp.com`, `*.whatsapp.net`, `*.whatsapp.com`).
     - Bloqueio preventivo de endereços IP literais, rede local (127.0.0.1, 10.x, 192.168.x) e endpoints de metadados cloud (169.254.169.254).
  4. **Cliente de Comunicação com Timeout & Idempotência (`src/lib/sidecar/client.ts`):**
     - [`SidecarClient`](file:///D:/projetos/synkroo/src/lib/sidecar/client.ts): Anexa automaticamente cabeçalhos de segurança (`x-sidecar-signature`, `x-sidecar-timestamp`, `x-sidecar-nonce`, `x-sidecar-idempotency-key`).
     - Orçamento estrito de timeout com cancelamento via `AbortController`.
     - Falha fechada (*fail-closed*) sem vazamento de estado parcial.

---

## Arquivos Criados / Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/lib/sidecar/types.ts` | NEW | Interfaces e contratos de payload, mTLS, egress e seen store |
| `src/lib/sidecar/errors.ts` | NEW | Hierarquia `SidecarError` com códigos estruturados |
| `src/lib/sidecar/crypto.ts` | NEW | Assinatura HMAC-SHA256, verificação e anti-replay |
| `src/lib/sidecar/mtls.ts` | NEW | Validação de headers de certificado mTLS |
| `src/lib/sidecar/egress.ts` | NEW | Validador de allowlist de domínios com suporte a wildcards |
| `src/lib/sidecar/client.ts` | NEW | Cliente HTTP seguro para comunicação com o sidecar |
| `src/lib/sidecar/index.ts` | NEW | Exportações públicas do módulo |
| `src/lib/sidecar/__tests__/sidecar-auth.test.ts` | NEW | 12 testes unitários e de contrato cobrindo HMAC, nonce, mTLS, egress e timeout |
| `docs/superpowers/audits/2026-08-23-f6-14-sidecar-mtls-hmac.md` | NEW | Este relatório de auditoria |

---

## Testes Executados

| Suite / Comando | Resultado | Detalhes |
|---|---|---|
| `npx jest src/lib/sidecar/__tests__/` | **PASS** | 1 suite, 12 testes verdes |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 erros de tipagem TypeScript |
| `npm run lint` (`eslint . --max-warnings=0`) | **PASS** | 0 warnings / 0 erros |
| `npm run roadmap:check` | **PASS** | 143 itens consistentes |
