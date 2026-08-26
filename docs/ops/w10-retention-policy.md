# W10 Retention Policy — F10.08

> Fonte: plano `docs/superpowers/plans/2026-08-25-pendencias-restantes-fechamento.md` T6. Implementa retenção LGPD + operacional sem armazenar valores de secret.

## Retenção por domínio

| Domínio | Retenção | Base | Purge |
|---------|----------|------|-------|
| Mensagens (WhatsApp/Instagram/web chat) | 90 dias | `messages`, `conversations` | cron `cleanup` com `CRON_SECRET` timingSafeEqual |
| DO state (`ia-agent` Durable Object) | 30 dias | `STATE_VERSION` + retention flag | `purge` + `recovery` versionado, RPC contract |
| Audit log | 2 anos | `audit_logs` | imutável, `legal_hold` impede purge |
| Gateway events (Asaas) | 1 ano | `gateway_events` | transação `event+payment` (F2.13/F9.06), DLQ |
| Exports LGPD (CSV/PDF) | 7 dias | `exports` | purge verificável F10.10, mantém audit |
| Knowledge / embeddings pgvector | até purge explícito | `knowledge` | `purge` + re-embedding, 1 owner por clínica |

## Legal hold
- Flag `legal_hold` (boolean) em `patients`/`audit_logs`/`gateway_events`.
- Se `legal_hold=true`, `purgePatient`/`anonymize` rejeita; opt-out global não transacional respeita hold mas bloqueia novos envios (consent versionado F7.08).
- Auditoria: `purgePatient` mantém linha audit com `email`/`phone` redacteds, nunca payload bruto (F10.09).

## Purge verificável (F10.10)
```ts
const before = await getPatient('p1');
await purgePatient('p1');
const after = await getPatient('p1');
expect(after.email).not.toBe(before.email);
expect(await getAudit('p1')).toBeTruthy();
```
- Transação: `exportData`/`anonymize` com permission + confirmação + transaction (F10.07).
- Evidência: `src/__tests__/api/lgpd/export.test.ts` cobre permission + transaction; purge verificável em integração.

## Minimização (F10.09)
- Payload bruto de gateway/traces/errors/logs minimizado; `logger.ts` redact `password/secret/token/authorization/cookie/databaseUrl`.
- `SENSITIVE_LOG_KEYS` em `src/lib/logger.ts:31` + `redactLogValue` recursivo.
- `handleApiError` nunca vaza stack em prod.

## Referências
- `src/lib/logger.ts:31` — redaction
- `src/lib/env.ts:63` — `parseRuntimeEnv` fail-closed, sem valores em log
- `docs/superpowers/audits/roadmap-143-ledger.json` — F10.02/05/06/08/10 VERIFIED local
