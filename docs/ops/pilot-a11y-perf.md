# Pilot A11y / Perf / Mobile — F12.05 DRY-RUN 2026-08-26 21:50Z

**Candidato:** `892581b5 21:27Z` `synkroo-staging 476 files` `HYPERDRIVE e0033a75f4e2449084b00b41e22e49a6`
**Fonte:** `next.config.ts:17` `headers()` `src/__tests__/security/headers.test.ts:4` `docs/superpowers/audits/f11-15-security-headers.md`

**Headers staging live `curl --max-time 10` `Cache-Control: no-cache`:**
- `/` → `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` `Strict-Transport-Security: max-age=31536000; includeSubDomains` `X-Content-Type-Options: nosniff` `X-Frame-Options: DENY` `Referrer-Policy: strict-origin-when-cross-origin` `Permissions-Policy: camera=(), microphone=(), geolocation=()` `x-nextjs-cache: MISS`
- `/api/health` → `200 {"status":"healthy"}` + mesmos headers `x-nextjs-cache: None` (dynamic)

`next.config.ts:25` HSTS só em `NODE_ENV=production` — staging `production` OK `headers.test.ts:20`.

**Manifest / Sidebar:**
- `src/__tests__/security/manifest-paths.test.ts` `no stale English paths` `/dashboard/conversas` canonical `/dashboard/followup` page `src/app/dashboard/followup/page.tsx`
- `src/components/clinic-selector.tsx` multi/single clinic, `queryClient.invalidateQueries()` `src/hooks/__tests__/use-clinic-switch.test.tsx` 3 tests
- Mobile/desktop: `src/components/ui/dashboard-layout.tsx` responsive `Tailwind + Radix UI`; viewport `e2e/journey-patient.spec.ts` usa `Playwright` com `storageState` isolado; `npm run test:e2e:production` CI `continue-on-error true` cobre smoke desktop/mobile sem baseline beta.

**Performance:**
- `build:cf 107s` `123/123 pages` `Middleware 73.5 kB` `First Load JS 106 kB` `Total Upload 23319 KiB gzip 4017 KiB` `Worker Startup 39 ms` `health latency 131-344` `database ok`
- `Recharts 3` + `Tailwind` + `Radix` — sem blocking render excessivo; `PageSpeed` formal pendente janela piloto `2026-09-01T02:00Z` com candidata staging real + `Lighthouse` owner.

**A11y:**
- `Radix UI` base a11y, `src/components/ui/*` com `aria-*`; `e2e` cobre `h1, h2` e navegação teclado; audit `axe` completo pendente piloto.

*Dry-run 21:50Z — validação formal a11y/perf/mobile com candidata `892581b5` na janela piloto.*
