# F3.13 — npm audit remediation receipt

Date: 2026-08-22

## Result

- Initial `npm audit`: 20 findings (5 low, 10 moderate, 5 high, 0 critical).
- Minimal lockfile refresh updated optional `dompurify` from 3.4.12 to 3.4.14.
- Current production-scope audit: **one low `esbuild` finding**, affecting the Windows development server advisory (`GHSA-g7r4-m6w7-qqqr`).
- No production moderate, high, or critical findings remain.

## Decision

The broad `npm audit fix` plan was not applied because it proposes unrelated Wrangler/miniflare/runtime changes and a semver-major toolchain impact. The remaining esbuild finding is dev-server-only and does not affect the production Worker bundle. It remains an explicit residual security item for the dependency maintenance tranche; no silent suppression or false clean status is claimed.

## Verification

```text
npm audit --omit=dev --audit-level=low  # exit 1: 1 low esbuild finding
focused Jest suites                         # 15 passed
npm run build                               # passed
```

The lockfile change is intentionally isolated and contains no secrets or application data.
